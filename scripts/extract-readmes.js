#!/usr/bin/env node

import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const DEFAULT_INPUT = path.join(rootDir, 'data/projects.json');
const DEFAULT_WORKDIR = path.resolve(rootDir, '..', 'hello-ai-readme-lab');
const MANIFEST_FILE = 'manifest.jsonl';
const MANIFEST_SNAPSHOT_FILE = 'manifest.latest.json';
const SUMMARY_FILE = 'summary.json';
const DEFAULT_README_PATHS = [
  'README.md',
  'README.zh.md',
  'README_zh.md',
  'README.en.md',
  'README.rst',
  'README.txt',
  'docs/README.md',
];

const TERMINAL_STATUSES = new Set(['ok', 'not_found', 'unsupported']);
const RETRYABLE_STATUSES = new Set([
  'network_error',
  'http_error',
  'rate_limited',
  'timeout',
  'parse_error',
]);
let activeRunContext = null;
let sigintCount = 0;

const defaultOptions = {
  input: DEFAULT_INPUT,
  workdir: process.env.README_EXTRACT_WORKDIR || DEFAULT_WORKDIR,
  limit: 0,
  category: '',
  subcategory: '',
  minStars: 0,
  maxStars: 0,
  since: '',
  addedSince: '',
  concurrency: numberFromEnv('README_EXTRACT_CONCURRENCY', 2),
  intervalMs: numberFromEnv('README_EXTRACT_INTERVAL_MS', 500),
  retry: numberFromEnv('README_EXTRACT_RETRY', 3),
  retryDelayMs: numberFromEnv('README_EXTRACT_RETRY_DELAY_MS', 1000),
  timeoutMs: numberFromEnv('README_EXTRACT_TIMEOUT_MS', 30000),
  maxBytes: numberFromEnv('README_EXTRACT_MAX_BYTES', 2_000_000),
  staleDays: numberFromEnv('README_EXTRACT_STALE_DAYS', 7),
  progressIntervalMs: 1000,
  resume: true,
  force: false,
  sync: false,
  retryNotFound: false,
  waitRateLimit: false,
  dryRun: false,
  tui: false,
  includeTrending: false,
  help: false,
};

class RateLimitError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'RateLimitError';
    this.status = details.status || 403;
    this.retryAfterMs = details.retryAfterMs || 0;
    this.resetAt = details.resetAt || '';
    this.remaining = details.remaining;
  }
}

class HttpError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = details.status || 0;
    this.body = details.body || '';
    this.retryable = details.retryable ?? true;
  }
}

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

function nowIso() {
  return new Date().toISOString();
}

function parseArgs(argv) {
  const parsed = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (!arg.startsWith('--')) continue;

    if (arg === '--help') {
      parsed.help = true;
      continue;
    }

    if (arg.startsWith('--no-')) {
      parsed[toCamel(arg.slice(5))] = false;
      continue;
    }

    const eqIndex = arg.indexOf('=');
    let key = arg.slice(2);
    let value = true;

    if (eqIndex >= 0) {
      key = arg.slice(2, eqIndex);
      value = arg.slice(eqIndex + 1);
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      value = argv[i + 1];
      i += 1;
    }

    const camelKey = toCamel(key);
    if (Object.prototype.hasOwnProperty.call(parsed, camelKey)) {
      parsed[camelKey] = `${parsed[camelKey]},${value}`;
    } else {
      parsed[camelKey] = value;
    }
  }

  return parsed;
}

function toCamel(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function normalizeOptions(rawOptions = {}) {
  const options = { ...defaultOptions, ...rawOptions };

  options.input = path.resolve(String(options.input || defaultOptions.input));
  options.workdir = path.resolve(String(options.workdir || defaultOptions.workdir));
  options.limit = toNonNegativeInt(options.limit, 0);
  options.minStars = toNonNegativeInt(options.minStars, 0);
  options.maxStars = toNonNegativeInt(options.maxStars, 0);
  options.concurrency = Math.max(1, toNonNegativeInt(options.concurrency, defaultOptions.concurrency));
  options.intervalMs = Math.max(0, toNonNegativeInt(options.intervalMs, defaultOptions.intervalMs));
  options.retry = Math.max(0, toNonNegativeInt(options.retry, defaultOptions.retry));
  options.retryDelayMs = Math.max(0, toNonNegativeInt(options.retryDelayMs, defaultOptions.retryDelayMs));
  options.timeoutMs = Math.max(1000, toNonNegativeInt(options.timeoutMs, defaultOptions.timeoutMs));
  options.maxBytes = Math.max(0, toNonNegativeInt(options.maxBytes, defaultOptions.maxBytes));
  options.staleDays = Math.max(0, toNonNegativeInt(options.staleDays, defaultOptions.staleDays));
  options.progressIntervalMs = Math.max(250, toNonNegativeInt(options.progressIntervalMs, defaultOptions.progressIntervalMs));
  options.resume = toBoolean(options.resume, true);
  options.force = toBoolean(options.force, false);
  options.sync = toBoolean(options.sync, false);
  options.retryNotFound = toBoolean(options.retryNotFound, false);
  options.waitRateLimit = toBoolean(options.waitRateLimit, false);
  options.dryRun = toBoolean(options.dryRun, false);
  options.tui = toBoolean(options.tui, false);
  options.includeTrending = toBoolean(options.includeTrending, false);
  options.help = toBoolean(options.help, false);

  return options;
}

function toNonNegativeInt(value, fallback) {
  if (value === true || value === false || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(text)) return false;
  return fallback;
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function printHelp() {
  console.log(`
AI project README extraction

Usage:
  pnpm ai:extract-readmes -- [options]
  node scripts/extract-readmes.js [options]

Modes:
  --tui                         Interactive setup plus live progress panel
  --dry-run                     Show candidate/worklist stats without fetching
  --resume / --no-resume        Skip terminal manifest records by default
  --sync                        Re-check existing records by ETag/Last-Modified
  --force                       Ignore cache and fetch again

Input filters:
  --input <file>                Project DB, default data/projects.json
  --category <ids>              Comma separated category ids, e.g. agents,rag_data
  --subcategory <names>         Comma separated subcategory names
  --min-stars <n>
  --max-stars <n>
  --since <YYYY-MM-DD>          Filter by lastUpdated
  --added-since <YYYY-MM-DD>    Filter by addedAt
  --limit <n>                   0 means no limit
  --include-trending            Keep trending-only records after de-duplication

Execution:
  --workdir <dir>               Default ../hello-ai-readme-lab
  --concurrency <n>             Default ${defaultOptions.concurrency}
  --interval-ms <n>             Global delay between HTTP requests, default ${defaultOptions.intervalMs}
  --retry <n>                   Per project retry count, default ${defaultOptions.retry}
  --retry-delay-ms <n>          Base retry backoff, default ${defaultOptions.retryDelayMs}
  --timeout-ms <n>              Per request timeout, default ${defaultOptions.timeoutMs}
  --max-bytes <n>               Max README bytes, default ${defaultOptions.maxBytes}

Synchronization:
  --stale-days <n>              With --sync, re-check records older than n days; 0 checks all
  --retry-not-found             With --sync, retry stale not_found/unsupported records
  --wait-rate-limit             Wait until GitHub reset instead of stopping gracefully

Examples:
  pnpm ai:extract-readmes -- --dry-run --category agents --limit 100
  pnpm ai:extract-readmes -- --limit 500 --concurrency 3 --interval-ms 800
  pnpm ai:extract-readmes -- --sync --stale-days 7 --resume
  pnpm ai:extract-readmes -- --tui
`);
}

async function applyTuiConfig(options) {
  if (!process.stdin.isTTY) {
    throw new Error('--tui requires an interactive terminal.');
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = query => new Promise(resolve => rl.question(query, resolve));
  const ask = async (label, current) => {
    const answer = await question(`${label} [${current}]: `);
    return answer.trim() || current;
  };
  const askBool = async (label, current) => {
    const answer = await question(`${label} (${current ? 'Y/n' : 'y/N'}): `);
    if (!answer.trim()) return current;
    return toBoolean(answer, current);
  };

  console.log('\nHello-AI README 提取交互配置\n');
  options.workdir = path.resolve(await ask('工作目录', options.workdir));
  options.category = await ask('分类过滤，逗号分隔，空表示全部', options.category || '');
  options.subcategory = await ask('子分类过滤，逗号分隔，空表示全部', options.subcategory || '');
  options.limit = toNonNegativeInt(await ask('本次最多处理数量，0 表示不限制', options.limit), options.limit);
  options.concurrency = Math.max(1, toNonNegativeInt(await ask('并发数', options.concurrency), options.concurrency));
  options.intervalMs = Math.max(0, toNonNegativeInt(await ask('请求间隔 ms', options.intervalMs), options.intervalMs));
  options.retry = Math.max(0, toNonNegativeInt(await ask('失败重试次数', options.retry), options.retry));
  options.retryDelayMs = Math.max(0, toNonNegativeInt(await ask('重试基础退避 ms', options.retryDelayMs), options.retryDelayMs));
  options.resume = await askBool('断点续跑，跳过已完成记录', options.resume);
  options.sync = await askBool('同步已有 README 更新', options.sync);
  if (options.sync) {
    options.staleDays = Math.max(0, toNonNegativeInt(await ask('同步检查间隔天数，0 表示全部检查', options.staleDays), options.staleDays));
    options.retryNotFound = await askBool('同步时重试 not_found/unsupported', options.retryNotFound);
  }
  options.dryRun = await askBool('只预览，不抓取', options.dryRun);
  rl.close();

  return normalizeOptions(options);
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    if (fallback !== null) return fallback;
    throw err;
  }
}

function parseGithubUrl(url = '') {
  try {
    const parsed = new URL(String(url));
    if (!/github\.com$/i.test(parsed.hostname)) return null;
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return null;
    return {
      owner: decodeURIComponent(segments[0]),
      repo: decodeURIComponent(segments[1]).replace(/\.git$/i, ''),
    };
  } catch {
    return null;
  }
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function flattenProjects(projectDb, options) {
  const categories = Array.isArray(projectDb?.categories) ? projectDb.categories : [];
  const categoryFilter = new Set(splitList(options.category).map(normalizeKey));
  const subcategoryFilter = new Set(splitList(options.subcategory).map(normalizeKey));
  const sinceTime = parseDateTime(options.since);
  const addedSinceTime = parseDateTime(options.addedSince);
  const byUrl = new Map();

  for (const category of categories) {
    const categoryId = String(category.id || '');
    const categoryAllowed = categoryFilter.size === 0 || categoryFilter.has(normalizeKey(categoryId));
    if (!categoryAllowed) continue;

    for (const project of Array.isArray(category.projects) ? category.projects : []) {
      const url = String(project.url || project.html_url || '').trim();
      const identity = parseGithubUrl(url);
      if (!identity) continue;

      const subcategory = String(project.subcategory || '');
      if (subcategoryFilter.size > 0 && !subcategoryFilter.has(normalizeKey(subcategory))) continue;

      const stars = Number(project.stars || project.stargazers_count || 0);
      if (options.minStars && stars < options.minStars) continue;
      if (options.maxStars && stars > options.maxStars) continue;

      const lastUpdatedTime = parseDateTime(project.lastUpdated || project.pushed_at);
      if (sinceTime && (!lastUpdatedTime || lastUpdatedTime < sinceTime)) continue;

      const addedAtTime = parseDateTime(project.addedAt || project.added_to_queue);
      if (addedSinceTime && (!addedAtTime || addedAtTime < addedSinceTime)) continue;

      const sourceKey = normalizeKey(url);
      const existing = byUrl.get(sourceKey);
      const shouldReplace = existing?.categoryId === 'trending' && categoryId !== 'trending';
      if (existing && !shouldReplace) continue;

      if (!options.includeTrending && categoryId === 'trending' && !categoryFilter.has('trending')) {
        if (!existing) {
          byUrl.set(sourceKey, {
            skippedTrending: true,
            sourceKey,
            url,
            owner: identity.owner,
            repo: identity.repo,
            categoryId,
          });
        }
        continue;
      }

      byUrl.set(sourceKey, {
        sourceKey,
        url,
        owner: identity.owner,
        repo: identity.repo,
        name: String(project.name || identity.repo),
        categoryId,
        categoryName: String(category.name || categoryId),
        subcategory,
        stars,
        lastUpdated: project.lastUpdated || project.pushed_at || '',
        addedAt: project.addedAt || project.added_to_queue || '',
        topics: Array.isArray(project.topics) ? project.topics : [],
        tags: Array.isArray(project.tags) ? project.tags : [],
      });
    }
  }

  let projects = [...byUrl.values()].filter(project => !project.skippedTrending);
  if (options.limit > 0) projects = projects.slice(0, options.limit);
  return projects;
}

function parseDateTime(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function loadManifest(workdir) {
  const manifestPath = path.join(workdir, MANIFEST_FILE);
  const latestByUrl = new Map();
  let totalEntries = 0;

  if (!fs.existsSync(manifestPath)) {
    return { latestByUrl, totalEntries };
  }

  const lines = fs.readFileSync(manifestPath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    totalEntries += 1;
    try {
      const record = JSON.parse(line);
      if (record.url) latestByUrl.set(normalizeKey(record.url), record);
    } catch {
      // Ignore corrupted audit lines. The jsonl file remains append-only.
    }
  }

  return { latestByUrl, totalEntries };
}

function appendManifestRecord(workdir, latestByUrl, record) {
  fs.mkdirSync(workdir, { recursive: true });
  const fullRecord = { ...record, recordedAt: nowIso() };
  fs.appendFileSync(path.join(workdir, MANIFEST_FILE), `${JSON.stringify(fullRecord)}\n`, 'utf-8');
  if (record.url) latestByUrl.set(normalizeKey(record.url), fullRecord);
  return fullRecord;
}

function writeManifestSnapshot(workdir, latestByUrl) {
  const records = [...latestByUrl.values()].sort((a, b) => String(a.url).localeCompare(String(b.url)));
  writeJsonAtomic(path.join(workdir, MANIFEST_SNAPSHOT_FILE), records);
}

function buildWorklist(projects, latestByUrl, options) {
  const skipped = {
    completed: 0,
    fresh: 0,
    notFound: 0,
    unsupported: 0,
  };
  const worklist = [];

  for (const project of projects) {
    const prior = latestByUrl.get(normalizeKey(project.url));

    if (options.force || !options.resume || !prior) {
      worklist.push({ project, prior, reason: prior ? 'forced' : 'new' });
      continue;
    }

    const localFilesExist = hasLocalFiles(options.workdir, prior);
    const stale = isManifestRecordStale(prior, options.staleDays);

    if (prior.status === 'ok') {
      if (!localFilesExist) {
        worklist.push({ project, prior, reason: 'missing_local_cache' });
      } else if (options.sync && stale) {
        worklist.push({ project, prior, reason: 'sync_stale_ok' });
      } else {
        skipped[options.sync ? 'fresh' : 'completed'] += 1;
      }
      continue;
    }

    if (prior.status === 'not_found') {
      if (options.sync && options.retryNotFound && stale) {
        worklist.push({ project, prior, reason: 'retry_stale_not_found' });
      } else {
        skipped.notFound += 1;
      }
      continue;
    }

    if (prior.status === 'unsupported') {
      if (options.sync && options.retryNotFound && stale) {
        worklist.push({ project, prior, reason: 'retry_stale_unsupported' });
      } else {
        skipped.unsupported += 1;
      }
      continue;
    }

    if (RETRYABLE_STATUSES.has(prior.status)) {
      worklist.push({ project, prior, reason: `retry_${prior.status}` });
      continue;
    }

    if (!TERMINAL_STATUSES.has(prior.status)) {
      worklist.push({ project, prior, reason: 'unknown_prior_status' });
    }
  }

  return { worklist, skipped };
}

function hasLocalFiles(workdir, record) {
  const readmeFile = record.readmeFile ? path.join(workdir, record.readmeFile) : '';
  const normalizedFile = record.normalizedFile ? path.join(workdir, record.normalizedFile) : '';
  return Boolean(readmeFile && fs.existsSync(readmeFile) && normalizedFile && fs.existsSync(normalizedFile));
}

function isManifestRecordStale(record, staleDays) {
  if (staleDays === 0) return true;
  const checkedTime = parseDateTime(record.checkedAt || record.fetchedAt || record.recordedAt);
  if (!checkedTime) return true;
  return Date.now() - checkedTime >= staleDays * 86400000;
}

function createThrottle(intervalMs) {
  let chain = Promise.resolve();
  let lastStartedAt = 0;

  return async function waitForSlot() {
    if (!intervalMs) return;
    chain = chain.then(async () => {
      const waitMs = Math.max(0, lastStartedAt + intervalMs - Date.now());
      if (waitMs > 0) await sleep(waitMs);
      lastStartedAt = Date.now();
    });
    return chain;
  };
}

function githubHeaders(extra = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'hello-ai-readme-extractor',
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

async function fetchWithTimeout(url, requestOptions, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...requestOptions, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new HttpError(`Request timed out after ${timeoutMs}ms`, { status: 0, retryable: true });
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGitHub(url, options, ctx, extraHeaders = {}) {
  await ctx.throttle();

  const res = await fetchWithTimeout(
    url,
    { headers: githubHeaders(extraHeaders) },
    options.timeoutMs
  );

  ctx.rateLimit = readRateLimit(res.headers);

  if (res.status === 403 || res.status === 429) {
    const text = await safeReadText(res);
    const retryAfter = Number(res.headers.get('retry-after') || 0);
    const resetSeconds = Number(res.headers.get('x-ratelimit-reset') || 0);
    const remaining = Number(res.headers.get('x-ratelimit-remaining') || -1);
    const looksRateLimited =
      res.status === 429 ||
      remaining === 0 ||
      /rate limit|secondary rate limit|abuse detection/i.test(text);

    if (looksRateLimited) {
      const resetAt = resetSeconds ? new Date(resetSeconds * 1000).toISOString() : '';
      const resetDelayMs = resetSeconds ? Math.max(0, resetSeconds * 1000 - Date.now()) : 0;
      throw new RateLimitError('GitHub rate limit reached', {
        status: res.status,
        retryAfterMs: retryAfter ? retryAfter * 1000 : resetDelayMs,
        resetAt,
        remaining,
      });
    }

    throw new HttpError(`GitHub request failed: ${res.status} ${res.statusText}`, {
      status: res.status,
      body: text,
      retryable: true,
    });
  }

  return res;
}

function readRateLimit(headers) {
  return {
    limit: headers.get('x-ratelimit-limit') || '',
    remaining: headers.get('x-ratelimit-remaining') || '',
    resetAt: headers.get('x-ratelimit-reset')
      ? new Date(Number(headers.get('x-ratelimit-reset')) * 1000).toISOString()
      : '',
  };
}

async function safeReadText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function buildReadmeCandidates(project) {
  const owner = encodeURIComponent(project.owner);
  const repo = encodeURIComponent(project.repo);
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  return [
    {
      label: 'default',
      pathHint: '',
      apiUrl: `${base}/readme`,
    },
    ...DEFAULT_README_PATHS.map(readmePath => ({
      label: readmePath,
      pathHint: readmePath,
      apiUrl: `${base}/contents/${readmePath.split('/').map(encodeURIComponent).join('/')}`,
    })),
  ];
}

async function fetchReadme(project, prior, options, ctx) {
  for (const candidate of buildReadmeCandidates(project)) {
    const conditionalHeaders = {};
    const canUseConditional =
      !options.force &&
      Boolean(prior?.etag) &&
      normalizeKey(prior?.apiUrl) === normalizeKey(candidate.apiUrl);

    if (canUseConditional) {
      conditionalHeaders['If-None-Match'] = prior.etag;
    }

    const res = await fetchGitHub(candidate.apiUrl, options, ctx, conditionalHeaders);

    if (res.status === 304) {
      return {
        status: 'not_modified',
        candidate,
        etag: prior.etag || '',
        lastModified: prior.lastModified || '',
      };
    }

    if (res.status === 404) continue;

    const text = await safeReadText(res);
    if (!res.ok) {
      throw new HttpError(`README metadata request failed: ${res.status} ${res.statusText}`, {
        status: res.status,
        body: text.slice(0, 800),
        retryable: res.status >= 500,
      });
    }

    let metadata;
    try {
      metadata = JSON.parse(text);
    } catch (err) {
      throw new HttpError(`Invalid GitHub JSON response: ${err.message}`, {
        status: res.status,
        body: text.slice(0, 800),
        retryable: true,
      });
    }

    if (metadata.type && metadata.type !== 'file') continue;

    const content = await resolveReadmeContent(metadata, options, ctx);
    const byteLength = Buffer.byteLength(content, 'utf-8');
    if (options.maxBytes > 0 && byteLength > options.maxBytes) {
      return {
        status: 'unsupported',
        reason: `README exceeds max bytes (${byteLength} > ${options.maxBytes})`,
        candidate,
        metadata,
        etag: res.headers.get('etag') || '',
        lastModified: res.headers.get('last-modified') || '',
      };
    }

    return {
      status: 'ok',
      content,
      byteLength,
      candidate,
      metadata,
      etag: res.headers.get('etag') || '',
      lastModified: res.headers.get('last-modified') || '',
    };
  }

  return { status: 'not_found', reason: 'No README found in GitHub API or fallback paths' };
}

async function resolveReadmeContent(metadata, options, ctx) {
  if (metadata.encoding === 'base64' && metadata.content) {
    return Buffer.from(String(metadata.content).replace(/\s/g, ''), 'base64').toString('utf-8');
  }

  if (!metadata.download_url) {
    throw new HttpError('README metadata has no content or download_url', {
      status: 0,
      retryable: false,
    });
  }

  await ctx.throttle();
  const res = await fetchWithTimeout(metadata.download_url, {
    headers: {
      'User-Agent': 'hello-ai-readme-extractor',
    },
  }, options.timeoutMs);

  if (!res.ok) {
    const text = await safeReadText(res);
    throw new HttpError(`Raw README download failed: ${res.status} ${res.statusText}`, {
      status: res.status,
      body: text.slice(0, 800),
      retryable: res.status >= 500,
    });
  }

  return await res.text();
}

async function processProject(entry, options, ctx, progress) {
  const { project, prior } = entry;
  const maxAttempts = options.retry + 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await fetchReadme(project, prior, options, ctx);
      const record = writeResult(project, prior, result, options, ctx.latestByUrl, attempt);
      progress.log(formatOutcome(project, record, entry.reason));
      return record;
    } catch (err) {
      lastError = err;

      if (err instanceof RateLimitError) {
        if (options.waitRateLimit) {
          const waitMs = Math.max(err.retryAfterMs || 0, 60_000);
          progress.log(`Rate limited. Waiting ${formatDuration(waitMs)} before retrying ${project.owner}/${project.repo}.`);
          await sleep(waitMs + 1000);
          continue;
        }

        const record = appendManifestRecord(options.workdir, ctx.latestByUrl, {
          ...baseManifestRecord(project),
          status: 'rate_limited',
          checkedAt: nowIso(),
          attempts: attempt,
          error: err.message,
          resetAt: err.resetAt,
          retryAfterMs: err.retryAfterMs,
        });
        ctx.stopRequested = true;
        progress.log(`Rate limited at ${project.owner}/${project.repo}. Stopping after active tasks finish.`);
        return record;
      }

      const retryable = isRetryableError(err);
      if (attempt < maxAttempts && retryable) {
        const waitMs = options.retryDelayMs * attempt;
        progress.log(`Retry ${attempt}/${options.retry} for ${project.owner}/${project.repo}: ${err.message}`);
        await sleep(waitMs);
        continue;
      }

      break;
    }
  }

  const status = errorStatus(lastError);
  const record = appendManifestRecord(options.workdir, ctx.latestByUrl, {
    ...baseManifestRecord(project),
    status,
    checkedAt: nowIso(),
    attempts: maxAttempts,
    error: String(lastError?.message || lastError || 'Unknown error').slice(0, 1000),
    httpStatus: lastError?.status || 0,
  });
  progress.log(`Failed ${project.owner}/${project.repo}: ${record.error}`);
  return record;
}

function writeResult(project, prior, result, options, latestByUrl, attempts) {
  const base = baseManifestRecord(project);
  const checkedAt = nowIso();

  if (result.status === 'not_modified') {
    return appendManifestRecord(options.workdir, latestByUrl, {
      ...prior,
      ...base,
      status: 'ok',
      checkedAt,
      attempts,
      unchanged: true,
      apiUrl: result.candidate.apiUrl,
      etag: result.etag || prior?.etag || '',
      lastModified: result.lastModified || prior?.lastModified || '',
    });
  }

  if (result.status === 'not_found') {
    return appendManifestRecord(options.workdir, latestByUrl, {
      ...base,
      status: 'not_found',
      checkedAt,
      attempts,
      reason: result.reason,
    });
  }

  if (result.status === 'unsupported') {
    return appendManifestRecord(options.workdir, latestByUrl, {
      ...base,
      status: 'unsupported',
      checkedAt,
      attempts,
      reason: result.reason,
      apiUrl: result.candidate?.apiUrl || '',
      readmePath: result.metadata?.path || result.candidate?.pathHint || '',
      etag: result.etag || '',
      lastModified: result.lastModified || '',
    });
  }

  const metadata = result.metadata || {};
  const readmePath = metadata.path || result.candidate.pathHint || 'README.md';
  const readmeFile = readmeOutputPath(project, readmePath);
  const normalizedFile = normalizedOutputPath(project);
  const absoluteReadmeFile = path.join(options.workdir, readmeFile);
  const absoluteNormalizedFile = path.join(options.workdir, normalizedFile);
  const contentHash = sha256(result.content);
  const normalized = normalizeReadme(project, result, contentHash);

  writeTextAtomic(absoluteReadmeFile, result.content);
  writeJsonAtomic(absoluteNormalizedFile, normalized);

  return appendManifestRecord(options.workdir, latestByUrl, {
    ...base,
    status: 'ok',
    checkedAt,
    fetchedAt: checkedAt,
    attempts,
    unchanged: false,
    apiUrl: result.candidate.apiUrl,
    readmePath,
    readmeFile,
    normalizedFile,
    downloadUrl: metadata.download_url || '',
    htmlUrl: metadata.html_url || '',
    sha: metadata.sha || '',
    etag: result.etag || '',
    lastModified: result.lastModified || '',
    bytes: result.byteLength,
    contentHash,
  });
}

function baseManifestRecord(project) {
  return {
    url: project.url,
    owner: project.owner,
    repo: project.repo,
    name: project.name,
    categoryId: project.categoryId,
    subcategory: project.subcategory || '',
  };
}

function readmeOutputPath(project, readmePath) {
  return path.join(
    'readmes',
    'github.com',
    safePathSegment(project.owner),
    safePathSegment(project.repo),
    ...String(readmePath || 'README.md').split('/').map(safePathSegment)
  );
}

function normalizedOutputPath(project) {
  return path.join(
    'normalized',
    'github.com',
    safePathSegment(project.owner),
    `${safePathSegment(project.repo)}.json`
  );
}

function safePathSegment(value) {
  const safe = String(value || 'unknown').replace(/[<>:"\\|?*\u0000-\u001F]/g, '_').replace(/^\.+$/, '_');
  return safe || 'unknown';
}

function normalizeReadme(project, result, contentHash) {
  const markdown = result.content || '';
  const metadata = result.metadata || {};
  const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, ' ');
  const codeBlocks = extractCodeBlocks(withoutComments);
  const textWithoutCode = withoutComments.replace(/```[\s\S]*?```/g, ' ').replace(/~~~[\s\S]*?~~~/g, ' ');
  const headings = extractHeadings(textWithoutCode);
  const plainText = toPlainText(textWithoutCode);
  const linkCount = countMatches(markdown, /\[[^\]]+\]\((?!#)[^)]+\)/g) + countMatches(markdown, /https?:\/\/[^\s)]+/g);
  const imageCount = countMatches(markdown, /!\[[^\]]*]\([^)]+\)/g) + countMatches(markdown, /<img\b/gi);
  const languageHint = detectLanguage(plainText);
  const installSignals = detectInstallSignals(markdown);
  const riskSignals = detectRiskSignals(markdown);
  const scenarioSignals = detectScenarioSignals(markdown);

  return {
    source: {
      url: project.url,
      owner: project.owner,
      repo: project.repo,
      name: project.name,
      categoryId: project.categoryId,
      subcategory: project.subcategory || '',
      readmePath: metadata.path || result.candidate?.pathHint || 'README.md',
      downloadUrl: metadata.download_url || '',
      htmlUrl: metadata.html_url || '',
    },
    fetch: {
      status: 'ok',
      fetchedAt: nowIso(),
      sha: metadata.sha || '',
      etag: result.etag || '',
      lastModified: result.lastModified || '',
      bytes: result.byteLength,
      contentHash,
    },
    content: {
      format: formatFromPath(metadata.path || result.candidate?.pathHint || 'README.md'),
      languageHint,
      title: headings[0]?.text || project.name,
      plainTextLength: plainText.length,
      plainTextPreview: plainText.slice(0, 800),
      headingCount: headings.length,
      headings: headings.slice(0, 80),
      codeBlockCount: codeBlocks.length,
      codeLanguages: topValues(codeBlocks.map(block => block.language).filter(Boolean), 12),
      linkCount,
      imageCount,
      installSignals,
      riskSignals,
      scenarioSignals,
      readmeQualityScore: scoreReadmeQuality({ headings, codeBlocks, linkCount, installSignals, plainText }),
    },
  };
}

function extractCodeBlocks(text) {
  const blocks = [];
  const regex = /(?:```|~~~)\s*([A-Za-z0-9_+.#-]*)[^\n]*\n([\s\S]*?)(?:```|~~~)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      language: String(match[1] || '').trim().toLowerCase(),
      length: match[2]?.length || 0,
    });
  }
  return blocks;
}

function extractHeadings(text) {
  const headings = [];
  const regex = /^(#{1,6})\s+(.+?)\s*#*\s*$/gm;
  let match;
  while ((match = regex.exec(text)) !== null) {
    headings.push({
      level: match[1].length,
      text: cleanupInlineMarkdown(match[2]).slice(0, 160),
    });
  }
  return headings;
}

function cleanupInlineMarkdown(text) {
  return String(text || '')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toPlainText(markdown) {
  return cleanupInlineMarkdown(markdown)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[>\-|]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countMatches(text, regex) {
  return (String(text || '').match(regex) || []).length;
}

function detectLanguage(text) {
  const sample = String(text || '').slice(0, 6000);
  if (!sample) return 'unknown';
  const chineseCount = countMatches(sample, /[\u4e00-\u9fff]/g);
  const asciiWordCount = countMatches(sample, /[A-Za-z]{2,}/g);
  if (chineseCount > 80 && chineseCount > asciiWordCount * 0.2) return 'zh';
  if (asciiWordCount > 20) return 'en';
  return 'unknown';
}

function detectInstallSignals(markdown) {
  const text = String(markdown || '').toLowerCase();
  const signals = [
    ['quickstart', /quick\s*start|getting\s*started|快速开始|快速上手/],
    ['install', /installation|install|安装/],
    ['docker', /\bdocker\b|docker-compose|compose\.ya?ml/],
    ['npm', /\bnpm\s+(install|i|run)\b|\bpnpm\s+(install|i|run)\b|\byarn\s+(add|install)\b/],
    ['python', /\bpip\s+install\b|\buv\s+pip\b|\bpoetry\s+install\b|\bconda\s+install\b/],
    ['go', /\bgo\s+(install|get|run)\b/],
    ['rust', /\bcargo\s+(install|run|build)\b/],
    ['api', /\bapi\b|sdk|endpoint/],
    ['demo', /\bdemo\b|example|examples|示例/],
  ];
  return signals.filter(([, regex]) => regex.test(text)).map(([name]) => name);
}

function detectRiskSignals(markdown) {
  const text = String(markdown || '').toLowerCase();
  const signals = [
    ['archived', /\barchived\b|存档/],
    ['deprecated', /\bdeprecated\b|弃用|不再维护/],
    ['experimental', /\bexperimental\b|实验性|prototype|proof of concept|\bpoc\b/],
    ['wip', /\bwip\b|work in progress|施工中/],
    ['unmaintained', /unmaintained|no longer maintained|停止维护/],
    ['breaking_changes', /breaking changes?|破坏性变更/],
  ];
  return signals.filter(([, regex]) => regex.test(text)).map(([name]) => name);
}

function detectScenarioSignals(markdown) {
  const text = String(markdown || '').toLowerCase();
  const signals = [
    ['agent', /\bagents?\b|autonomous agent|tool use|function calling/],
    ['rag', /\brag\b|retrieval augmented|vector database|embedding/],
    ['mcp', /\bmcp\b|model context protocol/],
    ['llm', /\bllms?\b|large language model|chatgpt|claude|ollama/],
    ['multimodal', /multimodal|vision|image generation|video|audio|speech/],
    ['finetuning', /fine[ -]?tuning|lora|training|trainer/],
    ['inference', /inference|serving|vllm|deployment/],
    ['workflow', /workflow|automation|orchestration|pipeline/],
  ];
  return signals.filter(([, regex]) => regex.test(text)).map(([name]) => name);
}

function scoreReadmeQuality({ headings, codeBlocks, linkCount, installSignals, plainText }) {
  let score = 0;
  if (plainText.length > 500) score += 15;
  if (plainText.length > 2000) score += 15;
  if (headings.length >= 3) score += 15;
  if (headings.length >= 8) score += 10;
  if (codeBlocks.length > 0) score += 10;
  if (codeBlocks.length >= 3) score += 10;
  if (linkCount > 0) score += 5;
  if (installSignals.includes('install')) score += 10;
  if (installSignals.includes('quickstart')) score += 10;
  return Math.min(100, score);
}

function topValues(values, limit) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function formatFromPath(readmePath) {
  const ext = path.extname(String(readmePath || '')).toLowerCase();
  if (ext === '.rst') return 'rst';
  if (ext === '.txt') return 'text';
  if (ext === '.md' || ext === '.markdown' || !ext) return 'markdown';
  return ext.slice(1);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function isRetryableError(err) {
  if (err instanceof RateLimitError) return false;
  if (err instanceof HttpError) return err.retryable;
  return true;
}

function errorStatus(err) {
  if (err instanceof HttpError && /timed out/i.test(err.message)) return 'timeout';
  if (err instanceof HttpError) return 'http_error';
  if (err instanceof SyntaxError) return 'parse_error';
  return 'network_error';
}

function writeTextAtomic(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, filePath);
}

function writeJsonAtomic(filePath, data) {
  writeTextAtomic(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function formatOutcome(project, record, reason) {
  const label = `${project.owner}/${project.repo}`;
  if (record.status === 'ok' && record.unchanged) return `Unchanged ${label} (${reason})`;
  if (record.status === 'ok') return `Fetched ${label} ${record.bytes || 0} bytes`;
  if (record.status === 'not_found') return `Not found ${label}`;
  if (record.status === 'unsupported') return `Unsupported ${label}: ${record.reason}`;
  return `${record.status} ${label}`;
}

class ProgressView {
  constructor(options, state) {
    this.options = options;
    this.state = state;
    this.timer = null;
    this.startedAt = Date.now();
  }

  start() {
    if (this.options.tui) {
      process.stdout.write('\x1b[2J\x1b[H');
      this.timer = setInterval(() => this.render(), this.options.progressIntervalMs);
      this.render();
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.options.tui) this.render(true);
  }

  log(message) {
    const line = `[${new Date().toLocaleTimeString()}] ${message}`;
    this.state.events.push(line);
    this.state.events = this.state.events.slice(-10);
    if (!this.options.tui) console.log(line);
  }

  render(final = false) {
    if (!this.options.tui) return;
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);

    const elapsedMs = Date.now() - this.startedAt;
    const processed = this.state.processed;
    const total = this.state.total;
    const percent = total ? (processed / total) * 100 : 100;
    const bar = progressBar(percent, 34);
    const perSecond = processed > 0 ? processed / Math.max(1, elapsedMs / 1000) : 0;
    const etaMs = perSecond > 0 ? ((total - processed) / perSecond) * 1000 : 0;

    console.log('Hello-AI README Extractor');
    console.log(final ? 'Status: finished' : 'Status: running, press Ctrl+C to stop gracefully');
    console.log('');
    console.log(`Progress: ${bar} ${processed}/${total} ${percent.toFixed(1)}%`);
    console.log(`Active: ${this.state.active}  Remaining: ${Math.max(0, total - processed)}  Elapsed: ${formatDuration(elapsedMs)}  ETA: ${etaMs ? formatDuration(etaMs) : '-'}`);
    console.log('');
    console.log(`OK: ${this.state.ok}  Unchanged: ${this.state.unchanged}  Not found: ${this.state.notFound}  Unsupported: ${this.state.unsupported}`);
    console.log(`Failed: ${this.state.failed}  Rate limited: ${this.state.rateLimited}  Skipped: ${this.state.skippedTotal}`);
    console.log(`Rate limit: remaining ${this.state.rateLimit.remaining || '-'} / ${this.state.rateLimit.limit || '-'}  reset ${this.state.rateLimit.resetAt || '-'}`);
    console.log('');
    console.log('Recent events:');
    for (const event of this.state.events.slice(-10)) console.log(`  ${event}`);
  }
}

function progressBar(percent, width) {
  const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * width);
  return `[${'#'.repeat(filled)}${'.'.repeat(width - filled)}]`;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

async function runPool(worklist, options, ctx, progress, state) {
  let nextIndex = 0;

  return new Promise(resolve => {
    const launch = () => {
      if ((ctx.stopRequested || nextIndex >= worklist.length) && state.active === 0) {
        resolve();
        return;
      }

      while (!ctx.stopRequested && state.active < options.concurrency && nextIndex < worklist.length) {
        const entry = worklist[nextIndex];
        nextIndex += 1;
        state.active += 1;

        processProject(entry, options, ctx, progress)
          .then(record => {
            applyRecordToState(record, state);
          })
          .catch(err => {
            state.failed += 1;
            progress.log(`Unhandled error: ${err.message}`);
          })
          .finally(() => {
            state.processed += 1;
            state.active -= 1;
            state.rateLimit = ctx.rateLimit || state.rateLimit;
            launch();
          });
      }
    };

    launch();
  });
}

function applyRecordToState(record, state) {
  if (record.status === 'ok' && record.unchanged) {
    state.unchanged += 1;
  } else if (record.status === 'ok') {
    state.ok += 1;
  } else if (record.status === 'not_found') {
    state.notFound += 1;
  } else if (record.status === 'unsupported') {
    state.unsupported += 1;
  } else if (record.status === 'rate_limited') {
    state.rateLimited += 1;
  } else {
    state.failed += 1;
  }
}

function buildState(total, skipped) {
  return {
    total,
    processed: 0,
    active: 0,
    ok: 0,
    unchanged: 0,
    notFound: 0,
    unsupported: 0,
    failed: 0,
    rateLimited: 0,
    skippedTotal: Object.values(skipped).reduce((sum, value) => sum + value, 0),
    rateLimit: {},
    events: [],
  };
}

function printDryRun(projects, worklist, skipped, manifestInfo, options) {
  const byCategory = countBy(projects, project => project.categoryId);
  const byReason = countBy(worklist, item => item.reason);

  console.log('Dry run summary');
  console.log(`Input: ${path.relative(rootDir, options.input) || options.input}`);
  console.log(`Workdir: ${options.workdir}`);
  console.log(`Manifest entries: ${manifestInfo.totalEntries}`);
  console.log(`Unique candidates: ${projects.length}`);
  console.log(`Scheduled: ${worklist.length}`);
  console.log(`Skipped: ${Object.values(skipped).reduce((sum, value) => sum + value, 0)}`);
  console.log('');
  console.log('Skipped detail:', JSON.stringify(skipped));
  console.log('Work reasons:', JSON.stringify(byReason));
  console.log('Categories:', JSON.stringify(byCategory));
  console.log('');
  console.log(`Concurrency: ${options.concurrency}, interval: ${options.intervalMs}ms, retry: ${options.retry}`);
  console.log(`Mode: resume=${options.resume}, sync=${options.sync}, force=${options.force}, staleDays=${options.staleDays}`);
}

function countBy(items, getKey) {
  const counts = {};
  for (const item of items) {
    const key = getKey(item) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function writeSummary(workdir, summary) {
  writeJsonAtomic(path.join(workdir, SUMMARY_FILE), summary);
}

async function main() {
  let options = normalizeOptions(parseArgs(process.argv.slice(2)));
  if (options.help) {
    printHelp();
    return;
  }

  if (options.tui) {
    options = await applyTuiConfig(options);
  }

  const projectDb = readJson(options.input);
  const projects = flattenProjects(projectDb, options);
  const manifestInfo = loadManifest(options.workdir);
  const { worklist, skipped } = buildWorklist(projects, manifestInfo.latestByUrl, options);

  if (options.dryRun) {
    printDryRun(projects, worklist, skipped, manifestInfo, options);
    return;
  }

  fs.mkdirSync(options.workdir, { recursive: true });

  const state = buildState(worklist.length, skipped);
  const ctx = {
    throttle: createThrottle(options.intervalMs),
    latestByUrl: manifestInfo.latestByUrl,
    rateLimit: {},
    stopRequested: false,
  };
  activeRunContext = ctx;
  const progress = new ProgressView(options, state);

  progress.start();
  progress.log(`Workdir: ${options.workdir}`);
  progress.log(`Scheduled ${worklist.length} projects, skipped ${state.skippedTotal}.`);

  const startedAt = Date.now();
  try {
    await runPool(worklist, options, ctx, progress, state);
  } finally {
    const finishedAt = nowIso();
    const summary = {
      startedAt: new Date(startedAt).toISOString(),
      finishedAt,
      elapsedMs: Date.now() - startedAt,
      options: summarizeOptions(options),
      totalCandidates: projects.length,
      scheduled: worklist.length,
      skipped,
      results: {
        ok: state.ok,
        unchanged: state.unchanged,
        notFound: state.notFound,
        unsupported: state.unsupported,
        failed: state.failed,
        rateLimited: state.rateLimited,
      },
      stoppedEarly: ctx.stopRequested,
    };

    writeManifestSnapshot(options.workdir, ctx.latestByUrl);
    writeSummary(options.workdir, summary);
    progress.stop();
    activeRunContext = null;

    if (!options.tui) {
      console.log('');
      console.log('Summary');
      console.log(JSON.stringify(summary, null, 2));
    }
  }
}

function summarizeOptions(options) {
  return {
    input: options.input,
    workdir: options.workdir,
    limit: options.limit,
    category: options.category,
    subcategory: options.subcategory,
    minStars: options.minStars,
    maxStars: options.maxStars,
    since: options.since,
    addedSince: options.addedSince,
    concurrency: options.concurrency,
    intervalMs: options.intervalMs,
    retry: options.retry,
    retryDelayMs: options.retryDelayMs,
    timeoutMs: options.timeoutMs,
    maxBytes: options.maxBytes,
    staleDays: options.staleDays,
    resume: options.resume,
    force: options.force,
    sync: options.sync,
    retryNotFound: options.retryNotFound,
    waitRateLimit: options.waitRateLimit,
  };
}

process.on('SIGINT', () => {
  sigintCount += 1;
  if (sigintCount >= 2) {
    console.log('\nForced stop requested.');
    process.exit(130);
  }

  if (activeRunContext) activeRunContext.stopRequested = true;
  console.log('\nStop requested. No new tasks will start; current in-flight tasks will finish. Press Ctrl+C again to force stop.');
  process.exitCode = 130;
});

main().catch(err => {
  console.error(`README extraction failed: ${err.stack || err.message}`);
  process.exit(1);
});
