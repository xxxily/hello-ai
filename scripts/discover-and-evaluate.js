import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataFile = path.join(__dirname, '../data/projects.json');
const queueFile = path.join(__dirname, '../data/pending-projects.json');
const topicsFile = path.join(__dirname, '../data/topics.json');
const rejectedDir = path.join(__dirname, '../data/rejected-projects');
const sensitiveDebugDir = path.join(__dirname, '../.omx/sensitive-word-debug');

import { resolveLLMConfig, buildRequestBody, stripThinkTags } from './llm-provider.js';
import {
  buildEvaluationBatchData,
  buildEvaluationMessages,
  buildEvaluationPrompt,
  buildValidCategoriesString,
  extractEvaluations,
  findEvaluation,
  judgeEvaluation,
} from './evaluation-prompt.js';

const { provider: LLM_PROVIDER, baseUrl: LLM_BASE_URL, apiKey: LLM_API_KEY, model: LLM_MODEL } = resolveLLMConfig();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DISCOVER_BATCH_SIZE = parseInt(process.env.DISCOVER_BATCH_SIZE || '10', 10);
const EVALUATE_BATCH_SIZE = parseInt(process.env.EVALUATE_BATCH_SIZE || '5', 10);

const MAX_PAGES_DEFAULT = parseInt(process.env.MAX_PAGES_DEFAULT || '5', 10);
const MAX_PAGES_QUALITY = parseInt(process.env.MAX_PAGES_QUALITY || '20', 10);
const QUALITY_TOPIC_THRESHOLD = parseInt(process.env.QUALITY_TOPIC_THRESHOLD || '5', 10);
const AUTO_FETCH_DESC_STARS = parseInt(process.env.AUTO_FETCH_DESC_STARS || '1000', 10);

const sessionFile = path.join(__dirname, '../data/discovery-session.json');
const reEvaluateSessionFile = path.join(__dirname, '../data/re-evaluate-session.json');
const REJECTED_CHUNK_SIZE = 30000; // Roughly 20MB per chunk
const DEFAULT_TOPICS = {
  active: {
    ai: { level: 1, lastExplored: "1970-01-01T00:00:00Z", score: 0 },
  },
  niche: {},
  exhausted: {},
};

function parseUpdatedWithinDays(args = process.argv) {
  const flag = '--updated-within-days';
  let rawValue = null;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === flag) {
      rawValue = args[index + 1];
      break;
    }
    if (arg.startsWith(`${flag}=`)) {
      rawValue = arg.slice(flag.length + 1);
      break;
    }
  }

  if (rawValue === null) return null;

  const days = Number(rawValue);
  if (typeof rawValue !== 'string' || rawValue.trim() === '' || !Number.isInteger(days) || days < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }
  return days;
}

function isUpdatedSince(item, cutoffTime) {
  if (!cutoffTime) return true;
  const pushedAt = new Date(item.pushed_at).getTime();
  return Number.isFinite(pushedAt) && pushedAt >= cutoffTime;
}

async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        console.warn(`⚠️ [Fetch] Received status ${res.status} for ${url}. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
      }
      return res;
    } catch (err) {
      if (i === retries - 1) {
        throw err;
      }
      console.warn(`⚠️ [Fetch] Connection failed for ${url}: ${err.message}. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

async function fetchRepoDetails(full_name) {
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  }
  const res = await fetchWithRetry(`https://api.github.com/repos/${full_name}`, { headers });
  if (!res.ok) return null;
  return await res.json();
}

function loadJson(filePath, defaultVal = null) {
  if (fs.existsSync(filePath)) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
    catch (e) { return defaultVal; }
  }
  return defaultVal;
}

import { extractCategories } from './extract-categories.js';
import { parseGithubUrl, sanitizeDescription, shouldBlockProject } from './project-filters.js';
import { listRejectedFiles, normalizeRepoUrl } from './dedup-rejected.js';

function loadRejectedUrlSet() {
  const urls = new Set();
  for (const file of listRejectedFiles(rejectedDir)) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(rejectedDir, file), 'utf-8'));
      for (const item of asArray(content.rejected)) {
        const key = normalizeRepoUrl(item.url || item.html_url);
        if (key) urls.add(key);
      }
    } catch (e) {
      console.error(`❌ Error loading ${file} from rejected projects folder:`, e.message);
    }
  }
  return urls;
}

// Append deduplicated entries to the last rejected part only (avoids rewriting all rejected files per batch).
function appendRejected(entries, existingUrlSet = null) {
  if (!Array.isArray(entries) || entries.length === 0) return;
  if (!fs.existsSync(rejectedDir)) fs.mkdirSync(rejectedDir, { recursive: true });

  const knownUrls = existingUrlSet || loadRejectedUrlSet();
  const uniqueToAppend = [];
  for (const item of entries) {
    const key = normalizeRepoUrl(item.url || item.html_url);
    if (!key || knownUrls.has(key)) continue;
    knownUrls.add(key);
    uniqueToAppend.push({
      ...item,
      url: String(item.url || item.html_url || '').trim(),
    });
  }
  if (uniqueToAppend.length === 0) return;

  const partNums = fs.readdirSync(rejectedDir)
    .map(f => f.match(/^rejected-part-(\d+)\.json$/))
    .filter(Boolean)
    .map(m => parseInt(m[1], 10));
  let partNum = partNums.length > 0 ? Math.max(...partNums) : 1;
  let filePath = path.join(rejectedDir, `rejected-part-${partNum}.json`);
  let currentChunk = [];

  if (fs.existsSync(filePath)) {
    // Throws on corrupted file instead of silently overwriting it.
    currentChunk = asArray(JSON.parse(fs.readFileSync(filePath, 'utf-8')).rejected);
  }

  let offset = 0;
  while (offset < uniqueToAppend.length) {
    if (currentChunk.length >= REJECTED_CHUNK_SIZE) {
      partNum++;
      filePath = path.join(rejectedDir, `rejected-part-${partNum}.json`);
      currentChunk = [];
    }
    const spaceLeft = REJECTED_CHUNK_SIZE - currentChunk.length;
    const slice = uniqueToAppend.slice(offset, offset + spaceLeft);
    currentChunk.push(...slice);
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify({ rejected: currentChunk }, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
    offset += slice.length;
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  if (filePath.endsWith('projects.json')) {
    extractCategories();
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeProjectDb(value) {
  return value && Array.isArray(value.categories) ? value : { categories: [] };
}

function normalizePendingDb(value) {
  return value && Array.isArray(value.queue) ? value : { queue: [] };
}

function normalizeTopicsDb(value) {
  const topics = value && typeof value === 'object' ? value : {};
  topics.active = topics.active && typeof topics.active === 'object' ? topics.active : {};
  topics.niche = topics.niche && typeof topics.niche === 'object' ? topics.niche : {};
  topics.exhausted = topics.exhausted && typeof topics.exhausted === 'object' ? topics.exhausted : {};
  if (Object.keys(topics.active).length === 0) {
    topics.active.ai = { ...DEFAULT_TOPICS.active.ai };
  }
  return topics;
}

function parseLLMErrorPayload(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function isSensitiveWordsError(err) {
  const values = [
    err?.code,
    err?.responseJson?.error?.code,
    err?.responseJson?.error?.message,
    err?.responseText,
    err?.message,
  ];

  return values.some(value => String(value || '').includes('sensitive_words_detected'));
}

function writeSensitiveWordsDebugContext({ err, prompt, batch, batchData, requestBody }) {
  fs.mkdirSync(sensitiveDebugDir, { recursive: true });

  const timestamp = new Date().toISOString();
  const fileStamp = timestamp.replace(/[:.]/g, '-');
  const basePath = path.join(sensitiveDebugDir, `sensitive-${fileStamp}`);
  const contextFile = `${basePath}.json`;
  const promptFile = `${basePath}.prompt.txt`;

  const context = {
    createdAt: timestamp,
    provider: LLM_PROVIDER,
    baseUrl: LLM_BASE_URL,
    model: LLM_MODEL,
    status: err?.status,
    statusText: err?.statusText,
    errorCode: err?.code || err?.responseJson?.error?.code,
    errorMessage: err?.responseJson?.error?.message || err?.message,
    responseText: err?.responseText,
    batch,
    batchData,
    prompt,
    requestBody,
  };

  fs.writeFileSync(contextFile, JSON.stringify(context, null, 2), 'utf-8');
  fs.writeFileSync(promptFile, prompt, 'utf-8');

  return { contextFile, promptFile };
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function printSensitiveWordsDebugContext({ err, debugFiles }) {
  const debugJson = path.relative(process.cwd(), debugFiles.contextFile);
  const promptTxt = path.relative(process.cwd(), debugFiles.promptFile);
  const locateCommand = `npm run ai:locate-sensitive -- --debug ${shellQuote(debugJson)} --steps 4`;
  const continueCommand = `npm run ai:locate-sensitive -- --file ${shellQuote('.omx/sensitive-word-debug/bisect-xxx.json')} --steps 4`;

  console.error('\n🔎 sensitive_words_detected');
  console.error(`Provider: ${LLM_PROVIDER}`);
  console.error(`Model: ${LLM_MODEL}`);
  console.error(`Status: ${err?.status || 'unknown'} ${err?.statusText || ''}`.trim());
  console.error(`Debug JSON: ${debugJson}`);
  console.error(`Prompt TXT: ${promptTxt}`);
  console.error('\nStart bisect with:');
  console.error(locateCommand);
  console.error('\nContinue from a bisect result with:');
  console.error(continueCommand);
  console.error('');
}

async function askLLM(prompt) {
  const messages = buildEvaluationMessages(prompt);

  const body = buildRequestBody(LLM_PROVIDER, LLM_MODEL, messages, {
    temperature: 0.1,
    responseFormat: { type: "json_object" },
  });

  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text();
    const payload = parseLLMErrorPayload(txt);
    const apiError = new Error(`LLM API error: ${res.statusText} - ${txt}`);
    apiError.status = res.status;
    apiError.statusText = res.statusText;
    apiError.responseText = txt;
    apiError.responseJson = payload;
    apiError.code = payload?.error?.code;
    apiError.requestBody = body;
    throw apiError;
  }

  const resData = await res.json();
  let content = resData.choices[0].message.content;
  content = stripThinkTags(content);
  let cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanContent);
}

// 1. Discover mode
async function discover() {
  const isResume = process.argv.includes('--resume');
  const isUpdateOnly = process.argv.includes('--update-only');
  const updatedWithinDays = parseUpdatedWithinDays();
  const updatedCutoff = updatedWithinDays && updatedWithinDays > 0
    ? Date.now() - updatedWithinDays * 24 * 60 * 60 * 1000
    : null;

  if (process.argv.includes('--consume-only') && !isUpdateOnly) {
    console.log('⏭️ [Discovery] Skipped GitHub API discovery due to --consume-only flag.');
    return;
  }

  const session = loadJson(sessionFile, { lastTopic: null, lastPage: 0 }); // Always load session if it exists
  const topicsDb = normalizeTopicsDb(loadJson(topicsFile, DEFAULT_TOPICS));

  // Select topic
  const activeTopics = Object.keys(topicsDb.active);
  if (activeTopics.length === 0) {
    console.error(`❌ Topics DB has no active topics!`);
    return;
  }

  // CLI Args Parsing for topic selection
  const sortTopicByMatch = process.argv.find(arg => arg.startsWith('--sort-topic-by='));
  const sortTopicBy = sortTopicByMatch ? sortTopicByMatch.split('=')[1] : (isUpdateOnly ? 'quality' : 'time');

  const topicOrderMatch = process.argv.find(arg => arg.startsWith('--topic-order='));
  const topicOrder = topicOrderMatch ? topicOrderMatch.split('=')[1] : (sortTopicBy === 'quality' ? 'desc' : 'asc');

  // Sort topics
  activeTopics.sort((a, b) => {
    const topicA = topicsDb.active[a];
    const topicB = topicsDb.active[b];

    const timeA = new Date(topicA.lastExplored || 0).getTime();
    const timeB = new Date(topicB.lastExplored || 0).getTime();

    if (sortTopicBy === 'quality') {
      const scoreA = topicA.score || 0;
      const scoreB = topicB.score || 0;

      // If both are high quality, prioritize the one explored least recently (rotation)
      if (scoreA >= QUALITY_TOPIC_THRESHOLD && scoreB >= QUALITY_TOPIC_THRESHOLD) {
        return timeA - timeB;
      }

      if (scoreA !== scoreB) {
        return topicOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
      }
    }

    // Default: Sort by lastExplored time (oldest first)
    if (timeA !== timeB) {
      return timeA - timeB;
    }

    return 0;
  });

  // Pick the topic to search
  let pickedTopic = activeTopics[0];
  let pageToExplore = 1;
  let isSticky = false;

  // Sticky topic logic with session
  if (session.lastTopic && activeTopics.includes(session.lastTopic)) {
    const sessionTopicScore = topicsDb.active[session.lastTopic].score || 0;
    const sessionMaxPages = sessionTopicScore >= QUALITY_TOPIC_THRESHOLD ? MAX_PAGES_QUALITY : MAX_PAGES_DEFAULT;

    if (session.lastPage < sessionMaxPages) {
      pickedTopic = session.lastTopic;
      pageToExplore = session.lastPage + 1;
      isSticky = true;
      console.log(`🔄 [Sticky] Continuing topic "${pickedTopic}" (${pageToExplore}/${sessionMaxPages})`);
    } else {
      console.log(`✅ [Sticky] Topic "${session.lastTopic}" exhausted. Finding next...`);
      if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);

      // Update exploration time for the exhausted topic
      if (topicsDb.active[session.lastTopic]) {
        topicsDb.active[session.lastTopic].lastExplored = new Date().toISOString();
      }

      // Pick next topic from sorted list
      const currentIdx = activeTopics.indexOf(session.lastTopic);
      const nextIdx = (currentIdx + 1) % activeTopics.length;
      pickedTopic = activeTopics[nextIdx];

      if (pickedTopic === session.lastTopic && activeTopics.length > 1) {
        pickedTopic = activeTopics[(nextIdx + 1) % activeTopics.length];
      }
    }
  }

  let topicScore = topicsDb.active[pickedTopic].score || 0;
  const githubMaxResults = 1000;
  const batchSize = Math.min(isUpdateOnly ? DISCOVER_BATCH_SIZE * 3 : DISCOVER_BATCH_SIZE, 100);

  // Recalculate maxPages based on batch size and GitHub limits
  const maxPagesPossible = Math.floor(githubMaxResults / batchSize);
  const maxPagesForTopic = Math.min(topicScore >= QUALITY_TOPIC_THRESHOLD ? MAX_PAGES_QUALITY : MAX_PAGES_DEFAULT, maxPagesPossible);

  // If not already sticky/resuming, determine start page
  if (!isSticky) {
    if (topicScore >= QUALITY_TOPIC_THRESHOLD) {
      pageToExplore = 1; // Start sequential dive for quality topics
      console.log(`🎯 [Sticky] High-quality topic detected. Starting deep dive for "${pickedTopic}"`);
    } else {
      pageToExplore = Math.floor(Math.random() * Math.min(maxPagesForTopic, maxPagesPossible)) + 1; // Random for others
    }
  }

  if (pageToExplore > maxPagesForTopic) {
    if (isSticky) {
      console.log(`✅ [Sticky] Topic "${pickedTopic}" reached GitHub pagination limit (${pageToExplore - 1}/${maxPagesPossible}). Clearing session.`);
      if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);

      // Update exploration time for the topic that just finished its deep dive
      topicsDb.active[pickedTopic].lastExplored = new Date().toISOString();

      // Pick next topic from sorted list
      const currentIdx = activeTopics.indexOf(pickedTopic);
      // If we are at the end of the list or can't find it, go to index 0. 
      // But if index 0 is the current one, we might need index 1.
      const nextIdx = (currentIdx + 1) % activeTopics.length;
      pickedTopic = activeTopics[nextIdx];

      // Ensure we don't pick the same topic if others are available
      if (pickedTopic === session.lastTopic && activeTopics.length > 1) {
        pickedTopic = activeTopics[(nextIdx + 1) % activeTopics.length];
      }

      pageToExplore = 1;
      isSticky = false;
      topicScore = topicsDb.active[pickedTopic].score || 0; // Update local score for stats below

      // Re-calculate max pages for the new topic
      maxPagesForTopic = Math.min(topicScore >= QUALITY_TOPIC_THRESHOLD ? MAX_PAGES_QUALITY : MAX_PAGES_DEFAULT, maxPagesPossible);

      console.log(`🏷️  Falling back to Next Topic: ${pickedTopic}`);
    } else {
      pageToExplore = Math.max(1, maxPagesForTopic);
    }
  }

  console.log(`🏷️  Selected Topic for exploration: ${pickedTopic} (Score: ${topicScore}, Max Pages: ${maxPagesForTopic})`);

  // Update exploration time ONLY IF we are done or it's a random low-score exploration
  const isFinished = pageToExplore >= maxPagesForTopic;
  const isDeepDive = topicScore >= QUALITY_TOPIC_THRESHOLD;

  if (isFinished || !isDeepDive) {
    topicsDb.active[pickedTopic].lastExplored = new Date().toISOString();
  }

  const sortOptions = ['updated', 'stars', 'forks'];
  const randomSort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
  const minStars = 500;

  const useTopic = Math.random() > 0.4;
  const q = useTopic ? `topic:${pickedTopic}` : pickedTopic;
  const updatedSince = updatedCutoff ? new Date(updatedCutoff).toISOString().slice(0, 10) : null;
  const updatedQualifier = updatedSince ? `+pushed:>=${updatedSince}` : '';

  const searchUrl = `https://api.github.com/search/repositories?q=${q}+stars:>=${minStars}${updatedQualifier}&sort=${randomSort}&order=desc&per_page=${batchSize}&page=${pageToExplore}`;

  console.log(`🔍 [GitHub Search] Using keyword/topic: "${q}"`);
  console.log(`🌐 Calling GitHub API: sort:${randomSort}, page:${pageToExplore}, stars:>=${minStars}`);
  if (updatedSince) {
    console.log(`📅 [Discovery] Only queueing repositories pushed since ${updatedSince} (${updatedWithinDays} days).`);
  }

  try {
    const res = await fetchWithRetry(searchUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': GITHUB_TOKEN ? `token ${GITHUB_TOKEN}` : undefined
      }
    });
    if (!res.ok) throw new Error(`GitHub search failed: ${res.statusText}`);
    const data = await res.json();
    const items = asArray(data.items);

    if (items.length > 0) {
      const summary = items.map(item => `   - ${item.full_name} [★ ${item.stargazers_count}]`).join('\n');
      console.log(`📋 Search Results Summary:\n${summary}`);
    }

    const projectDb = normalizeProjectDb(loadJson(dataFile));
    const pendingDb = normalizePendingDb(loadJson(queueFile, { queue: [] }));
    const categories = asArray(projectDb.categories);
    const pendingQueue = asArray(pendingDb.queue);
    pendingDb.queue = pendingQueue;

    const projectUrlMap = new Map();
    categories.forEach(c => {
      if (c.id === 'trending') return;
      asArray(c.projects).forEach(p => {
        const key = normalizeRepoUrl(p.url);
        if (key) projectUrlMap.set(key, p);
      });
    });

    const pendingUrls = new Set();
    pendingQueue.forEach(item => {
      const key = normalizeRepoUrl(item.html_url || item.url);
      if (key) pendingUrls.add(key);
    });

    const rejectedUrls = loadRejectedUrlSet();

    let queuedCount = 0;
    let newTopicsCount = 0;
    let updatedProjectCount = 0;
    let blockedCount = 0;
    let staleCount = 0;
    let skippedRejectedCount = 0;

    for (const item of items) {
      // GitHub search is date-filtered, but check again before queueing as a safeguard.
      if (!isUpdatedSince(item, updatedCutoff)) {
        staleCount++;
        continue;
      }

      const url = normalizeRepoUrl(item.html_url);
      const existingProject = projectUrlMap.get(url);

      if (!existingProject && rejectedUrls.has(url)) {
        skippedRejectedCount++;
        continue;
      }

      // Proactive description fetching
      if (!item.description && item.stargazers_count >= AUTO_FETCH_DESC_STARS) {
        console.log(`📡 [Proactive Fetch] Fetching description for ${item.full_name} (${item.stargazers_count} stars)...`);
        const details = await fetchRepoDetails(item.full_name);
        if (details && details.description) {
          item.description = details.description;
        }
      }

      const blockCheck = shouldBlockProject(item);
      if (blockCheck.blocked) {
        console.log(`🚫 [Blocked] Skipping ${item.full_name || item.html_url}: ${blockCheck.reason}`);
        blockedCount++;
        continue;
      }

      // Collect new topics into topicsDB
      if (Array.isArray(item.topics)) {
        item.topics.forEach(t => {
          const lcT = t.toLowerCase();
          if (/[\u4e00-\u9fa5]/.test(lcT)) return; // Skip Chinese/non-searchable topics

          if (!topicsDb.active[lcT] && !topicsDb.niche[lcT] && !topicsDb.exhausted[lcT]) {
            topicsDb.active[lcT] = { level: 2, lastExplored: "1970-01-01T00:00:00Z", added: new Date().toISOString(), score: 0 };
            newTopicsCount++;
          }
        });
      }

      if (existingProject) {
        // Already approved project, update its stats directly
        existingProject.stars = item.stargazers_count;
        existingProject.lastUpdated = item.pushed_at;
        existingProject.topics = item.topics || [];
        existingProject._lastChecked = new Date().toISOString();
        updatedProjectCount++;
      } else if (url && !pendingUrls.has(url) && !isUpdateOnly) {
        pendingDb.queue.push({
          name: item.name,
          html_url: item.html_url,
          description: sanitizeDescription(item.description),
          topics: item.topics,
          stargazers_count: item.stargazers_count,
          pushed_at: item.pushed_at,
          added_to_queue: new Date().toISOString()
        });
        pendingUrls.add(url);
        queuedCount++;
      }
    }

    saveJson(topicsFile, topicsDb);
    if (newTopicsCount > 0) console.log(`🏷️  Added ${newTopicsCount} new topics to active DB.`);

    if (updatedProjectCount > 0) {
      saveJson(dataFile, projectDb); // Save the updated project stats
      console.log(`🔄 Synced updated stats for ${updatedProjectCount} existing projects.`);
    }

    if (queuedCount > 0) {
      saveJson(queueFile, pendingDb);
      console.log(`📥 Added ${queuedCount} new projects to the local pending queue.`);
    } else {
      console.log(`📥 No new projects to add to the queue right now.`);
    }
    if (skippedRejectedCount > 0) {
      console.log(`⏭️  Skipped ${skippedRejectedCount} already-rejected projects.`);
    }
    if (blockedCount > 0) {
      console.log(`🚫 Blocked ${blockedCount} suspicious or blacklisted projects before queueing.`);
    }
    if (staleCount > 0) {
      console.log(`📅 Skipped ${staleCount} repositories outside the ${updatedWithinDays}-day update window.`);
    }

    // Save or clear session state
    if (isDeepDive && !isFinished) {
      saveJson(sessionFile, { lastTopic: pickedTopic, lastPage: pageToExplore });
      console.log(`💾 [Session] Saved progress: ${pickedTopic} - Page ${pageToExplore}`);
    } else if (isFinished && fs.existsSync(sessionFile)) {
      const currentSession = loadJson(sessionFile);
      if (currentSession && currentSession.lastTopic === pickedTopic) {
        fs.unlinkSync(sessionFile);
        console.log(`🗑️ [Session] Cleared session for finished topic: ${pickedTopic}`);
      }
    }
  } catch (err) {
    console.error(`❌ Discovery failed: ${err.message}`);
    if (err.stack) console.error(err.stack);
  }
}

// 2. Evaluate mode
async function evaluate() {
  const pendingDb = normalizePendingDb(loadJson(queueFile, { queue: [] }));
  if (!pendingDb.queue || pendingDb.queue.length === 0) {
    console.log('✨ The pending queue is empty. Nothing to evaluate.');
    if (process.argv.includes('--consume-only')) {
      process.exit(2);
    }
    return;
  }

  if (EVALUATE_BATCH_SIZE <= 0) {
    console.log('⏭️ [Evaluation] Skipped because EVALUATE_BATCH_SIZE is 0.');
    return;
  }

  const projectDb = normalizeProjectDb(loadJson(dataFile));
  const categories = asArray(projectDb.categories);
  const rejectedUrls = loadRejectedUrlSet();
  const approvedUrls = new Set();
  categories.forEach(c => {
    if (c.id === 'trending') return;
    asArray(c.projects).forEach(p => {
      const key = normalizeRepoUrl(p.url);
      if (key) approvedUrls.add(key);
    });
  });

  // Dynamic categories string for prompt
  const validCategoriesStr = buildValidCategoriesString(categories);

  const totalPending = pendingDb.queue.length;
  console.log(`\n📊 [Task Pool] Current pending tasks awaiting evaluation: ${totalPending}`);
  console.log(`🤖 [Task Pool] Evaluating up to ${EVALUATE_BATCH_SIZE} projects using Provider: ${LLM_PROVIDER}, Model: ${LLM_MODEL}...`);

  // Drain up to EVALUATE_BATCH_SIZE valid, unevaluated items from the queue
  const batch = [];
  const batchUrls = new Set();
  let skippedBeforeEval = 0;
  let skippedKnownCount = 0;
  while (batch.length < EVALUATE_BATCH_SIZE && pendingDb.queue.length > 0) {
    const item = pendingDb.queue.shift();
    const url = normalizeRepoUrl(item.html_url || item.url);
    if (!url || approvedUrls.has(url) || rejectedUrls.has(url) || batchUrls.has(url)) {
      skippedKnownCount++;
      continue;
    }
    const blockCheck = shouldBlockProject(item);
    if (blockCheck.blocked) {
      console.log(`🚫 [Blocked] Dropping queued project ${item.html_url || item.name}: ${blockCheck.reason}`);
      skippedBeforeEval++;
      continue;
    }
    item.description = sanitizeDescription(item.description);
    batch.push(item);
    batchUrls.add(url);
  }

  if (skippedKnownCount > 0) {
    console.log(`⏭️  Skipped ${skippedKnownCount} queued projects already approved/rejected or duplicated.`);
  }

  if (batch.length === 0) {
    saveJson(queueFile, pendingDb);
    console.log(`✨ No valid unevaluated projects left in the queue (blocked: ${skippedBeforeEval}, already known: ${skippedKnownCount}).`);
    if (process.argv.includes('--consume-only')) {
      process.exit(2);
    }
    return;
  }

  console.log(`▶️ Evaluating ${batch.length} projects in a batch...`);

  const batchData = buildEvaluationBatchData(batch);
  const prompt = buildEvaluationPrompt(batchData, validCategoriesStr);

  let evaluations = [];
  try {
    const responseData = await askLLM(prompt);
    evaluations = extractEvaluations(responseData);
  } catch (err) {
    console.error(`🚨 LLM Error: ${err.message}`);
    if (isSensitiveWordsError(err)) {
      const debugFiles = writeSensitiveWordsDebugContext({
        err,
        prompt,
        batch,
        batchData,
        requestBody: err.requestBody,
      });
      printSensitiveWordsDebugContext({ err, debugFiles });
    }
    console.log(`⚠️ Restoring batch to queue for retry later. Backing off...`);
    pendingDb.queue.unshift(...batch);
    saveJson(queueFile, pendingDb);
    return;
  }

  let addedCount = 0;
  let topicsDbLoaded = null;
  const newRejectedEntries = [];

  for (const [index, item] of batch.entries()) {
    // Find matching output
    const evalData = findEvaluation(evaluations, index, item.name);
    const verdict = judgeEvaluation(evalData, categories);

    if (evalData?.project && (verdict.status === 'accepted' || verdict.status === 'invalid_category')) {
      const category = verdict.category;
      if (category) {
        if (!category.projects) category.projects = [];

        let projectToAdd = evalData.project;
        projectToAdd.url = item.html_url;
        projectToAdd.stars = item.stargazers_count;
        projectToAdd.lastUpdated = item.pushed_at;
        projectToAdd.addedAt = new Date().toISOString();
        projectToAdd._lastChecked = new Date().toISOString();
        projectToAdd.topics = item.topics || [];

        if (verdict.subcategory) {
          projectToAdd.subcategory = verdict.subcategory;
        }

        category.projects.push(projectToAdd);
        console.log(`  ✅ Approved [${item.name}] -> Category '${category.id}'`);
        addedCount++;

        // Increase topic score using original GitHub topics
        if (!topicsDbLoaded) topicsDbLoaded = loadJson(topicsFile);
        if (Array.isArray(item.topics)) {
          item.topics.forEach(t => {
            const lcT = t.toLowerCase();
            if (topicsDbLoaded.active[lcT]) {
              topicsDbLoaded.active[lcT].score = (topicsDbLoaded.active[lcT].score || 0) + 1;
            } else if (topicsDbLoaded.niche && topicsDbLoaded.niche[lcT]) {
              topicsDbLoaded.niche[lcT].score = (topicsDbLoaded.niche[lcT].score || 0) + 1;
            } else if (topicsDbLoaded.exhausted && topicsDbLoaded.exhausted[lcT]) {
              topicsDbLoaded.exhausted[lcT].score = (topicsDbLoaded.exhausted[lcT].score || 0) + 1;
            }
            // Note: We no longer add NEW topics here based on LLM tags or original topics.
            // New topics are only added during the 'discover' phase.
          });
        }
      } else {
        console.log(`  ⚠️ Rejected [${item.name}] -> LLM returned invalid category '${evalData.category_id}'. Recording manually.`);
        recordRejected(item, `Invalid category: ${evalData.category_id}`);
      }
    } else {
      const reason = verdict.reason || 'Not valuable enough or incomplete';
      console.log(`  ❌ Rejected [${item.name}] -> ${reason}`);
      recordRejected(item, reason);
    }
  }

  function recordRejected(item, reason) {
    newRejectedEntries.push({
      name: item.name,
      url: item.html_url,
      description: item.description,
      topics: item.topics,
      rejected_at: new Date().toISOString(),
      reason: reason
    });
  }

  // Save changes
  saveJson(queueFile, pendingDb);
  if (addedCount > 0) {
    // Refreshed Trending logic
    const trendingCount = rebuildTrending(categories);
    saveJson(dataFile, projectDb);
    console.log(`🔥 Trending category automatically rebuilt with top ${trendingCount} recently updated high-star projects.`);
  }
  appendRejected(newRejectedEntries, rejectedUrls);
  if (topicsDbLoaded) saveJson(topicsFile, topicsDbLoaded);

  console.log(`\n🎉 Evaluated ${batch.length} projects. Added ${addedCount} to the active directory.`);
}

function rebuildTrending(categories) {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  let candidates = [];
  categories.forEach(category => {
    if (category.id === 'trending') return;
    asArray(category.projects).forEach(p => {
      let dateObj;
      try { dateObj = new Date(p.lastUpdated); } catch (e) { }
      if (dateObj && !isNaN(dateObj.getTime()) && dateObj > threeMonthsAgo) {
        if (p.stars && p.stars >= 1000) candidates.push(p);
      }
    });
  });

  candidates.sort((a, b) => b.stars - a.stars);
  const topTrending = candidates.slice(0, 30);

  const trendingCategory = categories.find(c => c.id === 'trending');
  if (trendingCategory) {
    trendingCategory.projects = topTrending.map(p => ({ ...p }));
  }
  return topTrending.length;
}

function parseListFlag(flag, args = process.argv) {
  const index = args.findIndex(arg => arg === flag || arg.startsWith(`${flag}=`));
  if (index === -1) return null;
  const rawValue = args[index] === flag ? args[index + 1] : args[index].slice(flag.length + 1);
  return String(rawValue || '').split(',').map(v => v.trim()).filter(Boolean);
}

// 3. Re-evaluate mode: re-check existing approved projects, removing non-AI ones and fixing categories.
async function reEvaluate() {
  if (EVALUATE_BATCH_SIZE <= 0) {
    console.log('⏭️ [Re-evaluate] Skipped because EVALUATE_BATCH_SIZE is 0.');
    return;
  }

  const projectDb = normalizeProjectDb(loadJson(dataFile));
  const categories = asArray(projectDb.categories);
  const validIds = categories.filter(c => c.id !== 'trending').map(c => c.id);

  // Session: projects with _reEvaluatedAt >= startedAt are done in this round.
  let session = process.argv.includes('--re-evaluate-restart') ? null : loadJson(reEvaluateSessionFile);
  if (!session || !session.startedAt) {
    session = { startedAt: new Date().toISOString(), categories: [] };
  }
  const categoryFilter = parseListFlag('--re-evaluate-categories');
  if (categoryFilter) session.categories = categoryFilter;

  const unknownIds = asArray(session.categories).filter(id => !validIds.includes(id));
  if (unknownIds.length > 0) {
    console.error(`❌ [Re-evaluate] Unknown category ids: ${unknownIds.join(', ')}. Valid: ${validIds.join(', ')}`);
    process.exit(1);
  }
  saveJson(reEvaluateSessionFile, session);

  const targetIds = session.categories.length > 0 ? session.categories : validIds;
  const startedAtTime = new Date(session.startedAt).getTime();
  const isDone = p => p._reEvaluatedAt && new Date(p._reEvaluatedAt).getTime() >= startedAtTime;

  const remaining = [];
  let total = 0;
  for (const category of categories) {
    if (!targetIds.includes(category.id)) continue;
    for (const project of asArray(category.projects)) {
      total++;
      if (!isDone(project)) remaining.push({ project, category });
    }
  }

  console.log(`\n♻️  [Re-evaluate] Round started at ${session.startedAt}, categories: ${targetIds.join(', ')}`);
  console.log(`📊 [Re-evaluate] Remaining ${remaining.length} / ${total} projects.`);
  if (remaining.length === 0) {
    console.log('✨ [Re-evaluate] All target projects have been re-evaluated in this round.');
    process.exit(2);
  }

  const batch = remaining.slice(0, EVALUATE_BATCH_SIZE);
  console.log(`🤖 [Re-evaluate] Evaluating ${batch.length} projects using Provider: ${LLM_PROVIDER}, Model: ${LLM_MODEL}...`);

  // Stored descriptions were rewritten by the LLM (often with invented AI claims), so prefer fresh GitHub metadata.
  const items = await Promise.all(batch.map(async ({ project }) => {
    const { owner, repo } = parseGithubUrl(project.url);
    let details = null;
    if (owner && repo) {
      try { details = await fetchRepoDetails(`${owner}/${repo}`); } catch (e) { }
    }
    const storedTopics = asArray(project.topics).length > 0 ? project.topics : asArray(project.tags);
    return {
      name: project.name,
      html_url: project.url,
      description: details?.description || project.description || '',
      topics: asArray(details?.topics).length > 0 ? details.topics : storedTopics,
    };
  }));

  const now = new Date().toISOString();
  const removedEntries = [];
  const stats = { kept: 0, moved: 0, removed: 0, unchanged: 0 };

  const removeFrom = (category, project) => {
    category.projects = asArray(category.projects).filter(p => p !== project);
  };
  const recordRemoved = (item, category, reason) => {
    removedEntries.push({
      name: item.name,
      url: item.html_url,
      description: item.description,
      topics: item.topics,
      rejected_at: now,
      reason: `[Re-evaluate] ${reason}`,
      previous_category: category.id,
    });
    stats.removed++;
  };

  // Blocked projects are removed without being sent to the LLM.
  const llmEntries = [];
  batch.forEach((entry, index) => {
    const item = items[index];
    const blockCheck = shouldBlockProject(item);
    if (blockCheck.blocked) {
      console.log(`  🚫 Removed [${item.name}] (${entry.category.id}) -> ${blockCheck.reason}`);
      removeFrom(entry.category, entry.project);
      recordRemoved(item, entry.category, blockCheck.reason);
      return;
    }
    item.description = sanitizeDescription(item.description);
    llmEntries.push({ ...entry, item });
  });

  if (llmEntries.length > 0) {
    const llmItems = llmEntries.map(e => e.item);
    const batchData = buildEvaluationBatchData(llmItems);
    const prompt = buildEvaluationPrompt(batchData, buildValidCategoriesString(categories));

    let evaluations = [];
    try {
      evaluations = extractEvaluations(await askLLM(prompt));
    } catch (err) {
      console.error(`🚨 LLM Error: ${err.message}`);
      if (isSensitiveWordsError(err)) {
        const debugFiles = writeSensitiveWordsDebugContext({
          err,
          prompt,
          batch: llmItems,
          batchData,
          requestBody: err.requestBody,
        });
        printSensitiveWordsDebugContext({ err, debugFiles });
      }
      console.log('⚠️ Batch left unchanged, will retry in the next run.');
      if (removedEntries.length > 0) {
        rebuildTrending(categories);
        saveJson(dataFile, projectDb);
        appendRejected(removedEntries);
      }
      return;
    }

    llmEntries.forEach(({ project, category, item }, index) => {
      const verdict = judgeEvaluation(findEvaluation(evaluations, index, item.name), categories);

      if (verdict.status === 'rejected') {
        console.log(`  ❌ Removed [${item.name}] (${category.id}) -> ${verdict.reason}`);
        removeFrom(category, project);
        recordRemoved(item, category, verdict.reason);
        return;
      }

      project._reEvaluatedAt = now;

      if (verdict.status !== 'accepted') {
        // Keep the project as-is when the model output is unusable, so a bad response never deletes data.
        console.log(`  ⚠️ Kept [${item.name}] (${category.id}) unchanged -> ${verdict.reason}`);
        stats.unchanged++;
        return;
      }

      const target = verdict.category;
      if (target.id !== category.id) {
        removeFrom(category, project);
        if (!target.projects) target.projects = [];
        if (verdict.subcategory) project.subcategory = verdict.subcategory;
        else delete project.subcategory;
        const url = String(project.url || '').toLowerCase();
        if (!target.projects.some(p => String(p.url || '').toLowerCase() === url)) {
          target.projects.push(project);
        }
        console.log(`  🔀 Moved [${item.name}] ${category.id} -> ${target.id}${verdict.subcategory ? ` / ${verdict.subcategory}` : ''}`);
        stats.moved++;
      } else {
        if (verdict.subcategory) project.subcategory = verdict.subcategory;
        console.log(`  ✅ Kept [${item.name}] in '${category.id}'`);
        stats.kept++;
      }
    });
  }

  rebuildTrending(categories);
  saveJson(dataFile, projectDb);
  appendRejected(removedEntries);

  console.log(`\n🎉 [Re-evaluate] Kept ${stats.kept}, moved ${stats.moved}, removed ${stats.removed}, unchanged ${stats.unchanged}. Remaining ${remaining.length - batch.length}.`);
}

async function initTopics() {
  const topicsDb = normalizeTopicsDb(loadJson(topicsFile));
  const projectDb = normalizeProjectDb(loadJson(dataFile));
  let updates = 0;

  for (const t in topicsDb.active) topicsDb.active[t].score = 0;
  for (const t in topicsDb.niche) topicsDb.niche[t].score = 0;
  for (const t in topicsDb.exhausted) topicsDb.exhausted[t].score = 0;

  asArray(projectDb.categories).forEach(c => {
    asArray(c.projects).forEach(p => {
      if (Array.isArray(p.topics || p.tags)) {
        const tagsToSync = p.topics || p.tags;
        tagsToSync.forEach(tag => {
          const lcT = tag.toLowerCase();
          if (/[\u4e00-\u9fa5]/.test(lcT)) return; // Skip Chinese topics

          if (topicsDb.active[lcT]) {
            topicsDb.active[lcT].score = (topicsDb.active[lcT].score || 0) + 1;
            updates++;
          } else if (topicsDb.niche && topicsDb.niche[lcT]) {
            topicsDb.niche[lcT].score = (topicsDb.niche[lcT].score || 0) + 1;
            updates++;
          } else if (topicsDb.exhausted && topicsDb.exhausted[lcT]) {
            topicsDb.exhausted[lcT].score = (topicsDb.exhausted[lcT].score || 0) + 1;
            updates++;
          }
        });
      }
    });
  });

  saveJson(topicsFile, topicsDb);
  console.log(`✅ Topics initialized. Updated ${updates} topic scores based on approved projects.`);
  process.exit(0);
}

async function run() {
  if (process.argv.includes('--init-topics')) {
    await initTopics();
    return;
  }
  if (process.argv.includes('--re-evaluate')) {
    await reEvaluate();
    return;
  }
  await discover();
  if (!process.argv.includes('--update-only')) {
    await evaluate();
  } else {
    console.log('⏭️ [Update Mode] Skipped evaluate() stage.');
  }
}

run().catch(console.error);
