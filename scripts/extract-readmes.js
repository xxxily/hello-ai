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
const DEFAULT_REJECTED_INPUT = path.join(rootDir, 'data/rejected-projects');
const DEFAULT_WORKDIR = path.resolve(rootDir, '..', 'hello-ai-readme-lab');
const DEFAULT_REJECTED_WORKDIR = path.resolve(rootDir, '..', 'hello-ai-rejected-readme-lab');
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
  workdir: process.env.README_EXTRACT_WORKDIR || '',
  limit: 0,
  category: '',
  subcategory: '',
  minStars: 0,
  maxStars: 0,
  since: '',
  addedSince: '',
  updatedWithinDays: 0,
  addedWithinDays: 0,
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
  options.workdir = path.resolve(String(options.workdir || defaultWorkdirForInput(options.input)));
  options.limit = toNonNegativeInt(options.limit, 0);
  options.minStars = toNonNegativeInt(options.minStars, 0);
  options.maxStars = toNonNegativeInt(options.maxStars, 0);
  options.updatedWithinDays = toNonNegativeInt(options.updatedWithinDays, 0);
  options.addedWithinDays = toNonNegativeInt(options.addedWithinDays, 0);
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

  validateOptions(options);

  return options;
}

function defaultWorkdirForInput(inputPath) {
  return path.resolve(inputPath) === DEFAULT_REJECTED_INPUT
    ? DEFAULT_REJECTED_WORKDIR
    : DEFAULT_WORKDIR;
}

function validateOptions(options) {
  if (options.maxStars > 0 && options.minStars > options.maxStars) {
    throw new Error('最低 Stars 不能大于最高 Stars。');
  }

  for (const [key, label] of [['since', '更新起始日期'], ['addedSince', '收录起始日期']]) {
    if (options[key] && !isValidDateOption(options[key])) {
      throw new Error(`${label}格式无效，请使用 YYYY-MM-DD。`);
    }
  }
}

function isValidDateOption(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
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
AI 项目 README 提取工具

用法：
  pnpm ai:extract-readmes -- [options]
  node scripts/extract-readmes.js [options]

运行模式：
  --tui                         打开中文交互配置和实时进度面板
  --dry-run                     只预览候选项目和任务统计，不发起请求
  --resume / --no-resume        是否跳过清单中已完成的项目，默认跳过
  --sync                        通过 ETag/Last-Modified 检查已有 README 更新
  --force                       忽略本地缓存并重新提取

项目筛选：
  --input <path>                项目数据文件或 JSON 分片目录，默认 data/projects.json
  --category <ids>              分类 ID，多个值用逗号分隔，如 agents,rag_data
  --subcategory <names>         子分类，多个值用逗号分隔
  --min-stars <n>               只提取 Stars 不少于 n 的项目；0 表示不限制
  --max-stars <n>               只提取 Stars 不超过 n 的项目；0 表示不限制
  --updated-within-days <n>     只提取最近 n 天内更新的项目；0 表示不限制
  --added-within-days <n>       只提取最近 n 天内收录的项目；0 表示不限制
  --since <YYYY-MM-DD>          只提取此日期后更新的项目
  --added-since <YYYY-MM-DD>    只提取此日期后收录的项目
  --limit <n>                   本次最多处理数量；0 表示不限制
  --include-trending            去重后仍保留仅存在于 trending 分类的项目

  注意：项目缺少 Stars 时按 0 处理；缺少更新时间时不会命中更新时间筛选。
        rejected_at 会作为 rejected 项目的收录时间参与筛选。

执行参数：
  --workdir <dir>               输出目录；主库默认 ../hello-ai-readme-lab
                                rejected 目录默认 ../hello-ai-rejected-readme-lab
  --concurrency <n>             并发数，默认 ${defaultOptions.concurrency}
  --interval-ms <n>             HTTP 请求间隔（毫秒），默认 ${defaultOptions.intervalMs}
  --retry <n>                   单个项目失败重试次数，默认 ${defaultOptions.retry}
  --retry-delay-ms <n>          重试基础退避时间（毫秒），默认 ${defaultOptions.retryDelayMs}
  --timeout-ms <n>              单次请求超时时间（毫秒），默认 ${defaultOptions.timeoutMs}
  --max-bytes <n>               README 最大字节数，默认 ${defaultOptions.maxBytes}

同步参数：
  --stale-days <n>              同步时仅检查超过 n 天未检查的记录；0 表示全部
  --retry-not-found             同步时重试过期的 not_found/unsupported 记录
  --wait-rate-limit             达到 GitHub 限额后等待重置，不提前结束

示例：
  pnpm ai:extract-readmes -- --dry-run --min-stars 1000 --updated-within-days 30
  pnpm ai:extract-rejected-readmes
  pnpm ai:extract-readmes -- --dry-run --category agents --limit 100
  node scripts/extract-readmes.js --input data/rejected-projects --dry-run
  pnpm ai:extract-readmes -- --limit 500 --concurrency 3 --interval-ms 800
  pnpm ai:extract-readmes -- --sync --stale-days 7 --resume
  pnpm ai:extract-readmes -- --tui
`);
}

async function applyTuiConfig(options) {
  if (!process.stdin.isTTY) {
    throw new Error('--tui 需要在交互式终端中运行。');
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = query => new Promise(resolve => rl.question(query, resolve));
  let cancelled = false;

  try {
    while (true) {
      const fields = createTuiFields(options);
      printTuiConfig(fields);
      const selection = (await question('请选择要修改的编号（可用逗号分隔，直接回车开始执行，q 退出）：')).trim();

      if (!selection) {
        try {
          validateOptions(options);
          break;
        } catch (err) {
          console.log(`\n配置有误：${err.message}`);
          continue;
        }
      }
      if (['q', 'quit', 'exit'].includes(selection.toLowerCase())) {
        cancelled = true;
        break;
      }

      const indexes = parseTuiSelection(selection, fields.length);
      if (indexes.length === 0) {
        console.log('\n未识别到有效编号，请重新输入。');
        continue;
      }

      for (const index of indexes) {
        const field = fields[index - 1];
        const answer = await question(`\n${field.label}\n当前值：${formatTuiValue(field)}\n请输入新值${field.hint ? `（${field.hint}）` : ''}，直接回车保持不变：`);
        if (answer.trim()) field.update(answer.trim());
      }
    }
  } finally {
    rl.close();
  }

  if (cancelled) return null;
  console.log('\n配置已确认，开始执行。\n');
  return normalizeOptions(options);
}

function createTuiFields(options) {
  const setText = key => value => {
    options[key] = value;
  };
  const setPath = key => value => {
    options[key] = path.resolve(value);
  };
  const setInputPath = value => {
    const previousDefaultWorkdir = defaultWorkdirForInput(options.input);
    const nextInput = path.resolve(value);
    if (options.workdir === previousDefaultWorkdir) {
      options.workdir = defaultWorkdirForInput(nextInput);
    }
    options.input = nextInput;
  };
  const setNumber = (key, minimum = 0) => value => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < minimum) {
      console.log(`输入无效：请输入不小于 ${minimum} 的数字，已保留原值。`);
      return;
    }
    options[key] = Math.floor(parsed);
  };
  const setBoolean = key => value => {
    const normalized = String(value).trim().toLowerCase();
    if (!['1', '0', 'true', 'false', 'yes', 'no', 'y', 'n', 'on', 'off', '是', '否'].includes(normalized)) {
      console.log('输入无效：请输入“是”或“否”，已保留原值。');
      return;
    }
    options[key] = normalized === '是' ? true : normalized === '否' ? false : toBoolean(normalized, options[key]);
  };
  const setDate = key => value => {
    const cleared = clearableValue(value);
    if (cleared && !isValidDateOption(cleared)) {
      console.log('输入无效：请使用 YYYY-MM-DD 格式，已保留原值。');
      return;
    }
    options[key] = cleared;
  };

  const fields = [
    { group: '项目筛选', label: '最低 Stars', key: 'minStars', hint: '0 表示不限制', update: setNumber('minStars') },
    { group: '项目筛选', label: '最高 Stars', key: 'maxStars', hint: '0 表示不限制', update: setNumber('maxStars') },
    { group: '项目筛选', label: '最近更新天数', key: 'updatedWithinDays', hint: '如 30；0 表示不限制', update: setNumber('updatedWithinDays') },
    { group: '项目筛选', label: '最近收录天数', key: 'addedWithinDays', hint: '如 7；0 表示不限制', update: setNumber('addedWithinDays') },
    { group: '项目筛选', label: '更新起始日期', key: 'since', hint: 'YYYY-MM-DD；“-”表示清空', update: setDate('since') },
    { group: '项目筛选', label: '收录起始日期', key: 'addedSince', hint: 'YYYY-MM-DD；“-”表示清空', update: setDate('addedSince') },
    { group: '项目筛选', label: '分类', key: 'category', hint: '多个值用逗号分隔；“-”表示全部', update: value => setText('category')(clearableValue(value)) },
    { group: '项目筛选', label: '子分类', key: 'subcategory', hint: '多个值用逗号分隔；“-”表示全部', update: value => setText('subcategory')(clearableValue(value)) },
    { group: '项目筛选', label: '最多处理数量', key: 'limit', hint: '0 表示不限制', update: setNumber('limit') },
    { group: '项目筛选', label: '包含仅 trending 项目', key: 'includeTrending', hint: '是/否', update: setBoolean('includeTrending') },
    { group: '执行设置', label: '项目数据文件或目录', key: 'input', update: setInputPath },
    { group: '执行设置', label: '输出目录', key: 'workdir', update: setPath('workdir') },
    { group: '执行设置', label: '并发数', key: 'concurrency', hint: '至少为 1', update: setNumber('concurrency', 1) },
    { group: '执行设置', label: '请求间隔（毫秒）', key: 'intervalMs', update: setNumber('intervalMs') },
    { group: '执行设置', label: '失败重试次数', key: 'retry', update: setNumber('retry') },
    { group: '执行设置', label: '重试退避（毫秒）', key: 'retryDelayMs', update: setNumber('retryDelayMs') },
    { group: '执行设置', label: '请求超时（毫秒）', key: 'timeoutMs', hint: '至少为 1000', update: setNumber('timeoutMs', 1000) },
    { group: '执行设置', label: 'README 最大字节数', key: 'maxBytes', hint: '0 表示不限制', update: setNumber('maxBytes') },
    { group: '执行设置', label: '断点续跑', key: 'resume', hint: '是/否', update: setBoolean('resume') },
    { group: '执行设置', label: '同步已有 README', key: 'sync', hint: '是/否', update: setBoolean('sync') },
    { group: '执行设置', label: '同步检查间隔天数', key: 'staleDays', hint: '0 表示全部检查', update: setNumber('staleDays') },
    { group: '执行设置', label: '重试未找到的 README', key: 'retryNotFound', hint: '是/否', update: setBoolean('retryNotFound') },
    { group: '执行设置', label: '等待 GitHub 限额重置', key: 'waitRateLimit', hint: '是/否', update: setBoolean('waitRateLimit') },
    { group: '执行设置', label: '强制重新提取', key: 'force', hint: '是/否', update: setBoolean('force') },
    { group: '执行设置', label: '仅预览，不抓取', key: 'dryRun', hint: '是/否', update: setBoolean('dryRun') },
  ];

  return fields.map(field => ({ ...field, getValue: () => options[field.key] }));
}

function printTuiConfig(fields) {
  console.log('\nHello-AI README 提取配置');
  console.log('直接回车将使用以下配置，只有需要调整时才选择对应编号。');
  let currentGroup = '';
  for (const [index, field] of fields.entries()) {
    if (field.group !== currentGroup) {
      currentGroup = field.group;
      console.log(`\n${currentGroup}`);
    }
    console.log(`  ${String(index + 1).padStart(2, ' ')}. ${field.label.padEnd(18, ' ')} ${formatTuiValue(field)}`);
  }
  console.log('');
}

function formatTuiValue(field) {
  const actualValue = field.getValue();
  if (typeof actualValue === 'boolean') return actualValue ? '是' : '否';
  if (actualValue === '') return '全部/未设置';
  return String(actualValue);
}

function parseTuiSelection(input, fieldCount) {
  const selected = new Set();
  for (const part of String(input).split(/[，,\s]+/)) {
    if (!/^\d+$/.test(part)) continue;
    const index = Number(part);
    if (index >= 1 && index <= fieldCount) selected.add(index);
  }
  return [...selected];
}

function clearableValue(value) {
  return value === '-' ? '' : value;
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    if (fallback !== null) return fallback;
    throw err;
  }
}

function resolveProjectInput(inputPath) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`项目数据路径不存在：${inputPath}`);
  }

  const stat = fs.statSync(inputPath);
  if (stat.isFile()) {
    return { path: inputPath, type: 'file', files: [inputPath] };
  }

  if (!stat.isDirectory()) {
    throw new Error(`项目数据路径必须是 JSON 文件或目录：${inputPath}`);
  }

  const files = fs.readdirSync(inputPath, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map(entry => path.join(inputPath, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true }));

  if (files.length === 0) {
    throw new Error(`项目数据目录中没有 JSON 文件：${inputPath}`);
  }

  return { path: inputPath, type: 'directory', files };
}

function readProjectInputFile(filePath) {
  let projectDb;
  try {
    projectDb = readJson(filePath);
  } catch (err) {
    throw new Error(`读取项目数据失败 ${filePath}：${err.message}`);
  }

  if (!Array.isArray(projectDb?.categories) && !Array.isArray(projectDb?.rejected)) {
    throw new Error(`不支持的项目数据结构 ${filePath}：需要 categories 或 rejected 数组。`);
  }

  return projectDb;
}

async function forEachProjectBatch(inputInfo, options, visitor) {
  const seenUrls = new Set();
  const batchOptions = { ...options, limit: 0 };
  let remaining = options.limit > 0 ? options.limit : Infinity;

  for (const filePath of inputInfo.files) {
    const projectDb = readProjectInputFile(filePath);
    const candidates = flattenProjects(projectDb, batchOptions);
    const projects = [];

    for (const project of candidates) {
      if (seenUrls.has(project.sourceKey)) continue;
      seenUrls.add(project.sourceKey);
      projects.push(project);
      remaining -= 1;
      if (remaining === 0) break;
    }

    if (projects.length > 0) {
      const shouldContinue = await visitor(projects, filePath);
      if (shouldContinue === false) break;
    }

    if (remaining === 0) break;
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
  const categories = projectCategories(projectDb);
  const categoryFilter = new Set(splitList(options.category).map(normalizeKey));
  const subcategoryFilter = new Set(splitList(options.subcategory).map(normalizeKey));
  const sinceTime = latestCutoffTime(options.since, options.updatedWithinDays);
  const addedSinceTime = latestCutoffTime(options.addedSince, options.addedWithinDays);
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

      const addedAt = project.addedAt || project.added_to_queue || project.rejected_at || '';
      const addedAtTime = parseDateTime(addedAt);
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
        addedAt,
        topics: Array.isArray(project.topics) ? project.topics : [],
        tags: Array.isArray(project.tags) ? project.tags : [],
      });
    }
  }

  let projects = [...byUrl.values()].filter(project => !project.skippedTrending);
  if (options.limit > 0) projects = projects.slice(0, options.limit);
  return projects;
}

function projectCategories(projectDb) {
  const categories = Array.isArray(projectDb?.categories) ? [...projectDb.categories] : [];
  if (Array.isArray(projectDb?.rejected)) {
    categories.push({
      id: 'rejected',
      name: '已拒绝项目',
      projects: projectDb.rejected,
    });
  }
  return categories;
}

function latestCutoffTime(dateValue, withinDays) {
  const fixedTime = parseDateTime(dateValue);
  const relativeTime = withinDays > 0 ? Date.now() - withinDays * 86400000 : 0;
  return Math.max(fixedTime, relativeTime);
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
  const skipped = createSkippedCounts();
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

function createSkippedCounts() {
  return {
    completed: 0,
    fresh: 0,
    notFound: 0,
    unsupported: 0,
  };
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
          progress.log(`达到 GitHub 请求限额，等待 ${formatDuration(waitMs)} 后重试 ${project.owner}/${project.repo}。`);
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
        progress.log(`${project.owner}/${project.repo} 触发 GitHub 请求限额，当前任务完成后停止。`);
        return record;
      }

      const retryable = isRetryableError(err);
      if (attempt < maxAttempts && retryable) {
        const waitMs = options.retryDelayMs * attempt;
        progress.log(`重试 ${attempt}/${options.retry} ${project.owner}/${project.repo}：${err.message}`);
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
  progress.log(`失败 ${project.owner}/${project.repo}：${record.error}`);
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
  if (record.status === 'ok' && record.unchanged) return `无更新 ${label}（${reason}）`;
  if (record.status === 'ok') return `已提取 ${label}，${record.bytes || 0} 字节`;
  if (record.status === 'not_found') return `未找到 README：${label}`;
  if (record.status === 'unsupported') return `不支持 ${label}：${record.reason}`;
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

    console.log('Hello-AI README 提取工具');
    console.log(final ? '状态：已完成' : '状态：运行中，按 Ctrl+C 可安全停止');
    console.log('');
    console.log(`进度：${bar} ${processed}/${total} ${percent.toFixed(1)}%`);
    console.log(`进行中：${this.state.active}  剩余：${Math.max(0, total - processed)}  已用时：${formatDuration(elapsedMs)}  预计剩余：${etaMs ? formatDuration(etaMs) : '-'}`);
    console.log('');
    console.log(`成功：${this.state.ok}  无更新：${this.state.unchanged}  未找到：${this.state.notFound}  不支持：${this.state.unsupported}`);
    console.log(`失败：${this.state.failed}  请求受限：${this.state.rateLimited}  已跳过：${this.state.skippedTotal}`);
    console.log(`GitHub 限额：剩余 ${this.state.rateLimit.remaining || '-'} / ${this.state.rateLimit.limit || '-'}  重置时间 ${this.state.rateLimit.resetAt || '-'}`);
    console.log('');
    console.log('最近事件：');
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
            progress.log(`未处理错误：${err.message}`);
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

async function analyzeProjectInput(inputInfo, options, latestByUrl) {
  const analysis = {
    totalCandidates: 0,
    scheduled: 0,
    skipped: createSkippedCounts(),
    byCategory: {},
    byReason: {},
  };

  await forEachProjectBatch(inputInfo, options, projects => {
    const { worklist, skipped } = buildWorklist(projects, latestByUrl, options);
    analysis.totalCandidates += projects.length;
    analysis.scheduled += worklist.length;
    mergeCounts(analysis.skipped, skipped);
    mergeCounts(analysis.byCategory, countBy(projects, project => project.categoryId));
    mergeCounts(analysis.byReason, countBy(worklist, item => item.reason));
  });

  return analysis;
}

function mergeCounts(target, source) {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] || 0) + value;
  }
  return target;
}

function printDryRun(analysis, manifestInfo, options, inputInfo) {
  const skippedTotal = Object.values(analysis.skipped).reduce((sum, value) => sum + value, 0);

  console.log('预览摘要');
  console.log(`项目数据：${path.relative(rootDir, options.input) || options.input}`);
  console.log(`输入类型：${inputInfo.type === 'directory' ? `目录（${inputInfo.files.length} 个 JSON 分片）` : '单个 JSON 文件'}`);
  console.log(`输出目录：${options.workdir}`);
  console.log(`清单记录数：${manifestInfo.totalEntries}`);
  console.log(`去重后候选数：${analysis.totalCandidates}`);
  console.log(`计划处理数：${analysis.scheduled}`);
  console.log(`跳过数量：${skippedTotal}`);
  console.log('');
  console.log('跳过明细：', JSON.stringify(analysis.skipped));
  console.log('任务原因：', JSON.stringify(analysis.byReason));
  console.log('分类分布：', JSON.stringify(analysis.byCategory));
  console.log('');
  console.log(`执行参数：并发 ${options.concurrency}，请求间隔 ${options.intervalMs}ms，重试 ${options.retry} 次`);
  console.log(`运行模式：断点续跑=${formatBoolean(options.resume)}，同步=${formatBoolean(options.sync)}，强制提取=${formatBoolean(options.force)}，过期天数=${options.staleDays}`);
  console.log(`筛选条件：Stars ${formatNumberRange(options.minStars, options.maxStars)}，更新时间 ${formatDateFilter(options.since, options.updatedWithinDays)}，收录时间 ${formatDateFilter(options.addedSince, options.addedWithinDays)}`);
}

function formatBoolean(value) {
  return value ? '是' : '否';
}

function formatNumberRange(minimum, maximum) {
  if (minimum && maximum) return `${minimum} - ${maximum}`;
  if (minimum) return `>= ${minimum}`;
  if (maximum) return `<= ${maximum}`;
  return '不限';
}

function formatDateFilter(dateValue, days) {
  if (dateValue && days > 0) return `${days} 天内且不早于 ${dateValue}`;
  if (days > 0) return `${days} 天内`;
  if (dateValue) return `不早于 ${dateValue}`;
  return '不限';
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
    if (!options) {
      console.log('\n已取消执行。');
      return;
    }
  }

  const inputInfo = resolveProjectInput(options.input);
  const manifestInfo = loadManifest(options.workdir);
  const analysis = await analyzeProjectInput(inputInfo, options, manifestInfo.latestByUrl);

  if (options.dryRun) {
    printDryRun(analysis, manifestInfo, options, inputInfo);
    return;
  }

  fs.mkdirSync(options.workdir, { recursive: true });

  const state = buildState(analysis.scheduled, analysis.skipped);
  const ctx = {
    throttle: createThrottle(options.intervalMs),
    latestByUrl: manifestInfo.latestByUrl,
    rateLimit: {},
    stopRequested: false,
  };
  activeRunContext = ctx;
  const progress = new ProgressView(options, state);

  progress.start();
  progress.log(`项目数据：${options.input}${inputInfo.type === 'directory' ? `（${inputInfo.files.length} 个分片）` : ''}`);
  progress.log(`输出目录：${options.workdir}`);
  progress.log(`计划处理 ${analysis.scheduled} 个项目，跳过 ${state.skippedTotal} 个。`);

  const startedAt = Date.now();
  try {
    await forEachProjectBatch(inputInfo, options, async projects => {
      if (ctx.stopRequested) return false;
      const { worklist } = buildWorklist(projects, ctx.latestByUrl, options);
      await runPool(worklist, options, ctx, progress, state);
      return !ctx.stopRequested;
    });
  } finally {
    const finishedAt = nowIso();
    const summary = {
      startedAt: new Date(startedAt).toISOString(),
      finishedAt,
      elapsedMs: Date.now() - startedAt,
      options: summarizeOptions(options),
      inputFiles: inputInfo.files.length,
      totalCandidates: analysis.totalCandidates,
      scheduled: analysis.scheduled,
      skipped: analysis.skipped,
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
      console.log('执行摘要');
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
    updatedWithinDays: options.updatedWithinDays,
    addedWithinDays: options.addedWithinDays,
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
    includeTrending: options.includeTrending,
  };
}

process.on('SIGINT', () => {
  sigintCount += 1;
  if (sigintCount >= 2) {
    console.log('\n已请求强制停止。');
    process.exit(130);
  }

  if (activeRunContext) activeRunContext.stopRequested = true;
  console.log('\n已请求安全停止。不会启动新任务，当前任务完成后退出；再次按 Ctrl+C 可强制停止。');
  process.exitCode = 130;
});

main().catch(err => {
  console.error(`README 提取失败：${err.stack || err.message}`);
  process.exit(1);
});
