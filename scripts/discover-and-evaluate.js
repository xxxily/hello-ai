import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataFile = path.join(__dirname, '../data/projects.json');
const queueFile = path.join(__dirname, '../data/pending-projects.json');
const topicsFile = path.join(__dirname, '../data/topics.json');
const rejectedFile = path.join(__dirname, '../data/rejected-projects.json');

const LLM_API_KEY = process.env.LLM_API_KEY || 'local-fallback';
const LLM_BASE_URL = process.env.LLM_BASE_URL || (LLM_API_KEY === 'local-fallback' ? 'http://127.0.0.1:11434/v1' : 'https://api.openai.com/v1');
const LLM_MODEL = process.env.LLM_MODEL || (LLM_API_KEY === 'local-fallback' ? 'llama3' : 'gpt-4o-mini');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DISCOVER_BATCH_SIZE = parseInt(process.env.DISCOVER_BATCH_SIZE || '10', 10);
const EVALUATE_BATCH_SIZE = parseInt(process.env.EVALUATE_BATCH_SIZE || '5', 10);

function loadJson(filePath, defaultVal = null) {
  if (fs.existsSync(filePath)) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
    catch (e) { return defaultVal; }
  }
  return defaultVal;
}

import { extractCategories } from './extract-categories.js';

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  if (filePath.endsWith('projects.json')) {
    extractCategories();
  }
}

async function askLLM(prompt) {
  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_API_KEY}`
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: 'You are an AI project curator. Your job is to strictly evaluate GitHub repositories and return JSON. Respond ONLY with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`LLM API error: ${res.statusText} - ${txt}`);
  }

  const resData = await res.json();
  const content = resData.choices[0].message.content;
  let cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanContent);
}

// 1. Discover mode
async function discover() {
  if (process.argv.includes('--consume-only')) {
    console.log('⏭️ [Discovery] Skipped GitHub API discovery due to --consume-only flag.');
    return;
  }

  console.log(`🔍 [Task Pool] Searching for trending AI projects (Max ${DISCOVER_BATCH_SIZE})...`);

  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  }

  const topicsDb = loadJson(topicsFile, { active: { "ai": { level: 1, lastExplored: "1970-01-01T00:00:00Z" } }, niche: {}, exhausted: {} });

  // Select topic
  const activeTopics = Object.keys(topicsDb.active);
  if (activeTopics.length === 0) {
    console.error(`❌ Topics DB has no active topics!`);
    return;
  }

  // CLI Args Parsing for topic selection
  const sortTopicByMatch = process.argv.find(arg => arg.startsWith('--sort-topic-by='));
  const sortTopicBy = sortTopicByMatch ? sortTopicByMatch.split('=')[1] : 'time'; // 'time' or 'quality'

  const topicOrderMatch = process.argv.find(arg => arg.startsWith('--topic-order='));
  const topicOrder = topicOrderMatch ? topicOrderMatch.split('=')[1] : (sortTopicBy === 'quality' ? 'desc' : 'asc');

  // Sort topics
  activeTopics.sort((a, b) => {
    const topicA = topicsDb.active[a];
    const topicB = topicsDb.active[b];

    let valA, valB;
    if (sortTopicBy === 'quality') {
      valA = topicA.score || 0;
      valB = topicB.score || 0;
    } else {
      valA = new Date(topicA.lastExplored || 0).getTime();
      valB = new Date(topicB.lastExplored || 0).getTime();
    }

    if (valA === valB) {
      // secondary sort by time ascending
      return new Date(topicA.lastExplored || 0).getTime() - new Date(topicB.lastExplored || 0).getTime();
    }
    return topicOrder === 'desc' ? valB - valA : valA - valB;
  });

  // Pick the topic to search
  const pickedTopic = activeTopics[0];
  console.log(`🏷️  Selected Topic for exploration: ${pickedTopic} (Sort By: ${sortTopicBy} ${topicOrder})`);

  // Update exploration time
  topicsDb.active[pickedTopic].lastExplored = new Date().toISOString();

  const sortOptions = ['updated', 'stars', 'forks'];
  const randomSort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
  const randomPage = Math.floor(Math.random() * 5) + 1;
  const minStars = 500;

  const useTopic = Math.random() > 0.4;
  const q = useTopic ? `topic:${pickedTopic}` : pickedTopic;

  const searchUrl = `https://api.github.com/search/repositories?q=${q}+stars:>=${minStars}&sort=${randomSort}&order=desc&per_page=${DISCOVER_BATCH_SIZE}&page=${randomPage}`;

  console.log(`🔍 [GitHub Search] Using keyword/topic: "${q}"`);
  console.log(`🌐 Calling GitHub API: sort:${randomSort}, page:${randomPage}, stars:>=${minStars}`);
  try {
    const res = await fetch(searchUrl, { headers });
    if (!res.ok) throw new Error(`GitHub search failed: ${res.statusText}`);
    const data = await res.json();

    if (data.items && data.items.length > 0) {
      const summary = data.items.map(item => `   - ${item.full_name} [★ ${item.stargazers_count}]`).join('\n');
      console.log(`📋 Search Results Summary:\n${summary}`);
    }

    const projectDb = loadJson(dataFile);
    const pendingDb = loadJson(queueFile, { queue: [] });

    const projectUrlMap = new Map();
    projectDb.categories.forEach(c => {
      if (c.projects) c.projects.forEach(p => projectUrlMap.set(p.url.toLowerCase(), p));
    });

    const pendingUrls = new Set();
    pendingDb.queue.forEach(item => pendingUrls.add(item.html_url.toLowerCase()));

    let queuedCount = 0;
    let newTopicsCount = 0;
    let updatedProjectCount = 0;

    for (const item of data.items) {
      // Collect new topics into topicsDB
      if (Array.isArray(item.topics)) {
        item.topics.forEach(t => {
          if (!topicsDb.active[t] && !topicsDb.niche[t] && !topicsDb.exhausted[t]) {
            topicsDb.active[t] = { level: 2, lastExplored: "1970-01-01T00:00:00Z", added: new Date().toISOString(), score: 0 };
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
        existingProject._lastChecked = new Date().toISOString();
        updatedProjectCount++;
      } else if (!pendingUrls.has(url)) {
        pendingDb.queue.push({
          name: item.name,
          html_url: item.html_url,
          description: item.description,
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
  } catch (err) {
    console.error(`❌ Discovery failed: ${err.message}`);
  }
}

// 2. Evaluate mode
async function evaluate() {
  const pendingDb = loadJson(queueFile, { queue: [] });
  if (!pendingDb.queue || pendingDb.queue.length === 0) {
    console.log('✨ The pending queue is empty. Nothing to evaluate.');
    if (process.argv.includes('--consume-only')) {
      process.exit(2);
    }
    return;
  }

  const projectDb = loadJson(dataFile);
  const rejectedDb = loadJson(rejectedFile, { rejected: [] });

  // Dynamic categories string for prompt
  const validCategoriesStr = projectDb.categories
    .filter(c => c.id !== 'trending')
    .map(c => `- ${c.id} (${c.name}) - Subcategories: [${(c.subcategories || []).join(', ')}]`)
    .join('\n');

  const totalPending = pendingDb.queue.length;
  console.log(`\n📊 [Task Pool] Current pending tasks awaiting evaluation: ${totalPending}`);
  console.log(`🤖 [Task Pool] Evaluating up to ${EVALUATE_BATCH_SIZE} projects using Model: ${LLM_MODEL}...`);

  // Grab up to EVALUATE_BATCH_SIZE items
  const batch = pendingDb.queue.splice(0, EVALUATE_BATCH_SIZE);
  console.log(`▶️ Evaluating ${batch.length} projects in a batch...`);

  const batchData = batch.map((item, index) => ({
    id: index,
    name: item.name,
    description: item.description || 'No description',
    topics: item.topics?.join(', ') || 'None'
  }));

  const prompt = `
Please evaluate these GitHub projects based on their metadata. Determine if each is a high-quality AI project suitable for the "Hello-AI" directory.

Projects to evaluate:
${JSON.stringify(batchData, null, 2)}

Valid Categories and their Subcategories:
${validCategoriesStr}

For each project, determine if it is valuable. 
If it's NOT valuable or not really AI-focused or too localized/forked, set "is_valuable": false and state a "reason".
If it IS valuable, set "is_valuable": true, pick the best "category_id", pick the most suitable "subcategory" (if applicable, else ""), and fill out the "project" details.

Required Output Format (JSON):
{
  "evaluations": [
    {
      "id": 0,
      "is_valuable": true,
      "category_id": "<one of the valid categories matching it best>",
      "subcategory": "<matching subcategory if applicable, or empty>",
      "project": {
        "name": "project_name",
        "description": "<Provide a concise, engaging summary in Chinese (max 2 sentences)>",
        "tags": ["Tag1", "Tag2"],
        "health": "Active"
      }
    },
    {
      "id": 1,
      "is_valuable": false,
      "reason": "Not related to AI or low quality."
    }
  ]
}

Return ONLY standard JSON. Keep JSON minimal.`;

  let evaluations = [];
  try {
    const responseData = await askLLM(prompt);
    evaluations = responseData.evaluations || [];
  } catch (err) {
    console.error(`🚨 LLM Error: ${err.message}`);
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
      const category = projectDb.categories.find(c => c.id === evalData.category_id);
      if (category) {
        if (!category.projects) category.projects = [];

        let projectToAdd = evalData.project;
        projectToAdd.url = item.html_url;
        projectToAdd.stars = item.stargazers_count;
        projectToAdd.lastUpdated = item.pushed_at;
        projectToAdd.addedAt = new Date().toISOString();
        projectToAdd._lastChecked = new Date().toISOString();

        if (evalData.subcategory) {
          projectToAdd.subcategory = evalData.subcategory;
        }

        category.projects.push(projectToAdd);
        console.log(`  ✅ Approved [${item.name}] -> Category '${category.id}'`);
        addedCount++;

        // Increase topic score
        if (!topicsDbLoaded) topicsDbLoaded = loadJson(topicsFile);
        if (Array.isArray(projectToAdd.tags)) {
          projectToAdd.tags.forEach(t => {
            const lcT = t.toLowerCase();
            if (topicsDbLoaded.active[lcT]) {
              topicsDbLoaded.active[lcT].score = (topicsDbLoaded.active[lcT].score || 0) + 1;
            } else if (topicsDbLoaded.niche && topicsDbLoaded.niche[lcT]) {
              topicsDbLoaded.niche[lcT].score = (topicsDbLoaded.niche[lcT].score || 0) + 1;
            } else if (topicsDbLoaded.exhausted && topicsDbLoaded.exhausted[lcT]) {
              topicsDbLoaded.exhausted[lcT].score = (topicsDbLoaded.exhausted[lcT].score || 0) + 1;
            } else {
              topicsDbLoaded.active[lcT] = { level: 2, lastExplored: "1970-01-01T00:00:00Z", added: new Date().toISOString(), score: 1 };
            }
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
  projectDb.categories.forEach(category => {
    if (category.id === 'trending') return;
    if (category.projects) {
      category.projects.forEach(p => {
        let dateObj;
        try { dateObj = new Date(p.lastUpdated); } catch (e) { }
        if (dateObj && !isNaN(dateObj.getTime()) && dateObj > threeMonthsAgo) {
          if (p.stars && p.stars >= 1000) candidates.push(p);
        }
      });
    }
  });

  candidates.sort((a, b) => b.stars - a.stars);
  const topTrending = candidates.slice(0, 30);

  const trendingCategory = projectDb.categories.find(c => c.id === 'trending');
  if (trendingCategory) {
    trendingCategory.projects = topTrending.map(p => ({ ...p }));
  }

  // Save changes
  saveJson(queueFile, pendingDb);
  saveJson(dataFile, projectDb);
  saveJson(rejectedFile, rejectedDb);
  if (topicsDbLoaded) saveJson(topicsFile, topicsDbLoaded);

  console.log(`\n🎉 Evaluated ${batch.length} projects. Added ${addedCount} to the active directory.`);
  console.log(`🔥 Trending category automatically rebuilt with top ${topTrending.length} recently updated high-star projects.`);
}

async function initTopics() {
  const topicsDb = loadJson(topicsFile);
  const projectDb = loadJson(dataFile);
  let updates = 0;

  for (const t in topicsDb.active) topicsDb.active[t].score = 0;
  for (const t in topicsDb.niche) topicsDb.niche[t].score = 0;
  for (const t in topicsDb.exhausted) topicsDb.exhausted[t].score = 0;

  projectDb.categories.forEach(c => {
    if (c.projects) {
      c.projects.forEach(p => {
        if (Array.isArray(p.tags)) {
          p.tags.forEach(tag => {
            const lcT = tag.toLowerCase();
            if (topicsDb.active[lcT]) {
              topicsDb.active[lcT].score = (topicsDb.active[lcT].score || 0) + 1;
              updates++;
            } else if (topicsDb.niche && topicsDb.niche[lcT]) {
              topicsDb.niche[lcT].score = (topicsDb.niche[lcT].score || 0) + 1;
              updates++;
            } else if (topicsDb.exhausted && topicsDb.exhausted[lcT]) {
              topicsDb.exhausted[lcT].score = (topicsDb.exhausted[lcT].score || 0) + 1;
              updates++;
            } else {
              topicsDb.active[lcT] = { level: 2, lastExplored: "1970-01-01T00:00:00Z", added: new Date().toISOString(), score: 1 };
              updates++;
            }
          });
        }
      });
    }
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
  await evaluate();
}

run().catch(console.error);
