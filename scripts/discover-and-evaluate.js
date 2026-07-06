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
const DEFAULT_TOPICS = {
  active: {
    ai: { level: 1, lastExplored: "1970-01-01T00:00:00Z", score: 0 },
  },
  niche: {},
  exhausted: {},
};

async function fetchRepoDetails(full_name) {
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  }
  const res = await fetch(`https://api.github.com/repos/${full_name}`, { headers });
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
import { sanitizeDescription, shouldBlockProject } from './project-filters.js';

function loadRejected() {
  if (!fs.existsSync(rejectedDir)) {
    fs.mkdirSync(rejectedDir, { recursive: true });
    return { rejected: [] };
  }
  const files = fs.readdirSync(rejectedDir).filter(f => f.endsWith('.json')).sort();
  let allRejected = [];
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(rejectedDir, file), 'utf-8'));
      if (content.rejected) allRejected = allRejected.concat(content.rejected);
    } catch (e) {
      console.error(`❌ Error loading ${file} from rejected projects folder:`, e.message);
    }
  }
  return { rejected: allRejected };
}

function saveRejected(data) {
  if (!fs.existsSync(rejectedDir)) fs.mkdirSync(rejectedDir, { recursive: true });
  const rejected = data.rejected || [];
  const chunkSize = 30000; // Roughly 20MB per chunk
  const numParts = Math.ceil(rejected.length / chunkSize);

  for (let i = 0; i < numParts; i++) {
    const chunk = rejected.slice(i * chunkSize, (i + 1) * chunkSize);
    const fileName = `rejected-part-${i + 1}.json`;
    fs.writeFileSync(path.join(rejectedDir, fileName), JSON.stringify({ rejected: chunk }, null, 2), 'utf-8');
  }
  
  // Clean up extra parts if any
  const existingFiles = fs.readdirSync(rejectedDir).filter(f => f.endsWith('.json'));
  for (const file of existingFiles) {
    const match = file.match(/rejected-part-(\d+)\.json/);
    if (match) {
      const partNum = parseInt(match[1], 10);
      if (partNum > numParts) {
        fs.unlinkSync(path.join(rejectedDir, file));
      }
    }
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

  const searchUrl = `https://api.github.com/search/repositories?q=${q}+stars:>=${minStars}&sort=${randomSort}&order=desc&per_page=${batchSize}&page=${pageToExplore}`;

  console.log(`🔍 [GitHub Search] Using keyword/topic: "${q}"`);
  console.log(`🌐 Calling GitHub API: sort:${randomSort}, page:${pageToExplore}, stars:>=${minStars}`);

  try {
    const res = await fetch(searchUrl, {
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
      asArray(c.projects).forEach(p => {
        if (p.url) projectUrlMap.set(p.url.toLowerCase(), p);
      });
    });

    const pendingUrls = new Set();
    pendingQueue.forEach(item => {
      if (item.html_url) pendingUrls.add(item.html_url.toLowerCase());
    });

    let queuedCount = 0;
    let newTopicsCount = 0;
    let updatedProjectCount = 0;
    let blockedCount = 0;

    for (const item of items) {
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

      const url = item.html_url.toLowerCase();
      const existingProject = projectUrlMap.get(url);

      if (existingProject) {
        // Already approved project, update its stats directly
        existingProject.stars = item.stargazers_count;
        existingProject.lastUpdated = item.pushed_at;
        existingProject.topics = item.topics || [];
        existingProject._lastChecked = new Date().toISOString();
        updatedProjectCount++;
      } else if (!pendingUrls.has(url) && !isUpdateOnly) {
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
    if (blockedCount > 0) {
      console.log(`🚫 Blocked ${blockedCount} suspicious or blacklisted projects before queueing.`);
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
  const rejectedDb = loadRejected();
  const categories = asArray(projectDb.categories);

  // Dynamic categories string for prompt
  const validCategoriesStr = buildValidCategoriesString(categories);

  const totalPending = pendingDb.queue.length;
  console.log(`\n📊 [Task Pool] Current pending tasks awaiting evaluation: ${totalPending}`);
  console.log(`🤖 [Task Pool] Evaluating up to ${EVALUATE_BATCH_SIZE} projects using Provider: ${LLM_PROVIDER}, Model: ${LLM_MODEL}...`);

  // Grab up to EVALUATE_BATCH_SIZE items
  const rawBatch = pendingDb.queue.splice(0, EVALUATE_BATCH_SIZE);
  const batch = [];
  let skippedBeforeEval = 0;
  for (const item of rawBatch) {
    const blockCheck = shouldBlockProject(item);
    if (blockCheck.blocked) {
      console.log(`🚫 [Blocked] Dropping queued project ${item.html_url || item.name}: ${blockCheck.reason}`);
      skippedBeforeEval++;
      continue;
    }
    item.description = sanitizeDescription(item.description);
    batch.push(item);
  }

  if (batch.length === 0) {
    saveJson(queueFile, pendingDb);
    console.log(`🚫 Dropped ${skippedBeforeEval} blocked projects. Nothing safe left in this batch.`);
    return;
  }

  console.log(`▶️ Evaluating ${batch.length} projects in a batch...`);

  const batchData = buildEvaluationBatchData(batch);
  const prompt = buildEvaluationPrompt(batchData, validCategoriesStr);

  let evaluations = [];
  try {
    const responseData = await askLLM(prompt);
    evaluations = responseData.evaluations || [];
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

  for (const item of batch) {
    // Find matching output
    const matchIndex = batchData.findIndex(b => b.name === item.name);
    const evalData = evaluations.find(e => e.id === matchIndex) || evaluations.find(e => e.project?.name === item.name);

    if (evalData && evalData.is_valuable && evalData.category_id && evalData.project) {
        const category = categories.find(c => c.id === evalData.category_id);
      if (category) {
        if (!category.projects) category.projects = [];

        let projectToAdd = evalData.project;
        projectToAdd.url = item.html_url;
        projectToAdd.stars = item.stargazers_count;
        projectToAdd.lastUpdated = item.pushed_at;
        projectToAdd.addedAt = new Date().toISOString();
        projectToAdd._lastChecked = new Date().toISOString();
        projectToAdd.topics = item.topics || [];

        if (evalData.subcategory) {
          projectToAdd.subcategory = evalData.subcategory;
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
      const reason = evalData?.reason || 'Not valuable enough or incomplete';
      console.log(`  ❌ Rejected [${item.name}] -> ${reason}`);
      recordRejected(item, reason);
    }
  }

  function recordRejected(item, reason) {
    rejectedDb.rejected.push({
      name: item.name,
      url: item.html_url,
      description: item.description,
      topics: item.topics,
      rejected_at: new Date().toISOString(),
      reason: reason
    });
  }

  // Refreshed Trending logic
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

  // Save changes
  saveJson(queueFile, pendingDb);
  saveJson(dataFile, projectDb);
  saveRejected(rejectedDb);
  if (topicsDbLoaded) saveJson(topicsFile, topicsDbLoaded);

  console.log(`\n🎉 Evaluated ${batch.length} projects. Added ${addedCount} to the active directory.`);
  console.log(`🔥 Trending category automatically rebuilt with top ${topTrending.length} recently updated high-star projects.`);
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
  await discover();
  if (!process.argv.includes('--update-only')) {
    await evaluate();
  } else {
    console.log('⏭️ [Update Mode] Skipped evaluate() stage.');
  }
}

run().catch(console.error);
