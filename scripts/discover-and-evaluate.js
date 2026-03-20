import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataFile = path.join(__dirname, '../data/projects.json');
const queueFile = path.join(__dirname, '../data/pending-projects.json');

// By default, try to use a local LLM if API key isn't provided (e.g., Ollama or LM Studio)
// You can set LLM_BASE_URL to http://127.0.0.1:11434/v1 for Ollama
const LLM_API_KEY = process.env.LLM_API_KEY || 'local-fallback';
const LLM_BASE_URL = process.env.LLM_BASE_URL || (LLM_API_KEY === 'local-fallback' ? 'http://127.0.0.1:11434/v1' : 'https://api.openai.com/v1');
const LLM_MODEL = process.env.LLM_MODEL || (LLM_API_KEY === 'local-fallback' ? 'llama3' : 'gpt-4o-mini');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DISCOVER_BATCH_SIZE = parseInt(process.env.DISCOVER_BATCH_SIZE || '10', 10);
const EVALUATE_BATCH_SIZE = parseInt(process.env.EVALUATE_BATCH_SIZE || '3', 10);

function loadJson(filePath) {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return null;
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function askLLM(prompt) {
  // Even for local LLMs, authorization header might be required but arbitrary
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
  // Fallback: strip markdown JSON formatting if local LLM wraps it
  let cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanContent);
}

// 1. Discover mode: Find trending projects and add to local queue
async function discover() {
  console.log(`🔍 [Task Pool] Searching for trending AI projects (Max ${DISCOVER_BATCH_SIZE})...`);

  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  }

  const topics = [
    'ai', 'llm', 'machine-learning', 'agent', 'autonomous-agents', 'multi-agent',
    'rag', 'generative-ai', 'deep-learning', 'openai', 'claude', 'deepseek',
    'gemini', 'llama3', 'vector-database', 'local-ai', 'self-hosted',
    'ai-infrastructure', 'ai-security', 'ai-coding', 'computer-vision',
    'voice-ai', 'multimodal', 'transformer', 'prompt-engineering',
    'stable-diffusion', 'diffusion-models', 'mlops', 'llmops', 'mcp', 'skills',
    'browser-automation', 'ai-tools', 'ai-agents', 'openclaw', 'assistant', 'claude',
    'ollama', 'gpt', 'audio', 'tts', 'stt', 'asr', 'speech', 'video', 'workflow', 'automation', 'low-code', 'no-code',
    'web-search', 'browser-use', 'awesome'
  ];
  const sortOptions = ['updated', 'stars', 'forks'];

  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  const randomSort = sortOptions[Math.floor(Math.random() * sortOptions.length)];
  const randomPage = Math.floor(Math.random() * 20) + 1; // 进一步扩大页码范围，挖掘更深
  const minStars = 500; // 恢复基础门槛为 500 星

  // 随机使用 topic 搜索或普通关键词搜索
  const useTopic = Math.random() > 0.4;
  const q = useTopic ? `topic:${randomTopic}` : randomTopic;

  const searchUrl = `https://api.github.com/search/repositories?q=${q}+stars:>=${minStars}&sort=${randomSort}&order=desc&per_page=${DISCOVER_BATCH_SIZE}&page=${randomPage}`;

  console.log(`🌐 Calling GitHub API: "${q}", sort:${randomSort}, page:${randomPage}, stars:>=${minStars}`);
  try {
    const res = await fetch(searchUrl, { headers });
    if (!res.ok) throw new Error(`GitHub search failed: ${res.statusText}`);
    const data = await res.json();

    const projectDb = loadJson(dataFile);
    const pendingDb = loadJson(queueFile) || { queue: [] };

    const existingUrls = new Set();
    projectDb.categories.forEach(c => {
      if (c.projects) c.projects.forEach(p => existingUrls.add(p.url.toLowerCase()));
    });
    pendingDb.queue.forEach(item => existingUrls.add(item.html_url.toLowerCase()));

    let queuedCount = 0;
    for (const item of data.items) {
      const url = item.html_url.toLowerCase();
      if (!existingUrls.has(url)) {
        pendingDb.queue.push({
          name: item.name,
          html_url: item.html_url,
          description: item.description,
          topics: item.topics,
          stargazers_count: item.stargazers_count,
          pushed_at: item.pushed_at,
          added_to_queue: new Date().toISOString()
        });
        existingUrls.add(url);
        queuedCount++;
      }
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

// 2. Evaluate mode: Pop from queue and let local/remote LLM evaluate
async function evaluate() {
  const pendingDb = loadJson(queueFile);
  if (!pendingDb || !pendingDb.queue || pendingDb.queue.length === 0) {
    console.log('✨ The pending queue is empty. Nothing to evaluate.');
    return;
  }

  const projectDb = loadJson(dataFile);
  console.log(`\n🤖 [Task Pool] Evaluating ${EVALUATE_BATCH_SIZE} projects using Model: ${LLM_MODEL} at ${LLM_BASE_URL}...`);

  let evaluatedCount = 0;
  let addedCount = 0;

  // Process N items from the queue
  while (evaluatedCount < EVALUATE_BATCH_SIZE && pendingDb.queue.length > 0) {
    const item = pendingDb.queue[0]; // peek
    console.log(`\n▶️ Evaluating [${item.name}](${item.html_url})...`);

    const prompt = `
Please evaluate this GitHub project based on its metadata. If it is a high-quality AI project suitable for the "Hello-AI" directory, extract its details.

Repository Name: ${item.name}
Description: ${item.description || 'No description'}
Topics: ${item.topics?.join(', ') || 'None'}

Valid Categories:
- llms (🧠 基础大模型 (Foundation Models))
- agents (🤖 智能体与编排 (Agents & Orchestration))
- rag_data (🔍 RAG与检索 (RAG & Retrieval))
- infrastructure (☁️ 基础设施与部署 (Infra & Deployment))
- finetuning (🔧 微调与训练 (Fine-tuning & Training))
- multimodal (👁️ 多模态与音视频 (Multimodal & Vision/Audio))
- devtools (🛠️ 开发工具与SDK (Developer Tools & SDKs))
- applications (🎨 AI终端应用 (AI Applications))
- learning (📚 学习与资源 (Learning & Resources))

Determine if the project is valuable enough (e.g. not a fork, has distinct value).
If it's NOT valuable, return {"is_valuable": false}.
If it IS valuable, return:
{
  "is_valuable": true,
  "category_id": "<one of the valid categories matching it best>",
  "project": {
    "name": "${item.name}",
    "url": "${item.html_url}",
    "description": "<Provide a concise, engaging summary in Chinese (max 2 sentences)>",
    "tags": ["Tag1", "Tag2"],
    "stars": ${item.stargazers_count},
    "lastUpdated": "${item.pushed_at}",
    "health": "Active",
    "addedAt": "${new Date().toISOString()}"
  }
}

Return ONLY standard JSON. Keep JSON minimal.`;

    try {
      const evaluation = await askLLM(prompt);

      if (evaluation.is_valuable && evaluation.category_id && evaluation.project) {
        const category = projectDb.categories.find(c => c.id === evaluation.category_id);
        if (category) {
          if (!category.projects) category.projects = [];
          evaluation.project._lastChecked = new Date().toISOString();
          category.projects.push(evaluation.project);
          console.log(`  ✅ Approved -> Category '${category.id}'`);
          addedCount++;
        } else {
          console.log(`  ⚠️ Rejected: LLM returned invalid category '${evaluation.category_id}'.`);
        }
      } else {
        console.log(`  ❌ Rejected by LLM (Not valuable enough or incomplete).`);
      }

      // Successfully evaluated (whether approved or rejected), remove from queue
      pendingDb.queue.shift();
      evaluatedCount++;

      // Delay to avoid LLM throttling (especially local setups)
      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      console.error(`  🚨 LLM Error: ${err.message}`);
      console.log(`  ⚠️ Keeping ${item.name} in queue for retry later. Backing off...`);
      break; // Stop evaluating to avoid repeating failures
    }
  }

  // Refreshed Trending logic: Calculate fully objectively, overriding LLM randomness
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  let candidates = [];
  projectDb.categories.forEach(category => {
    if (category.id === 'trending') return;
    if (category.projects) {
      category.projects.forEach(p => {
        let dateObj;
        try {
          dateObj = new Date(p.lastUpdated);
        } catch(e) {}
        if (dateObj && !isNaN(dateObj.getTime()) && dateObj > threeMonthsAgo) {
          if (p.stars && p.stars >= 1000) {
            candidates.push(p);
          }
        }
      });
    }
  });

  candidates.sort((a, b) => b.stars - a.stars);
  const topTrending = candidates.slice(0, 30);
  
  const trendingCategory = projectDb.categories.find(c => c.id === 'trending');
  if (trendingCategory) {
    trendingCategory.projects = topTrending.map(p => ({...p}));
  }

  // Save changes
  if (evaluatedCount > 0) {
    saveJson(queueFile, pendingDb);
    saveJson(dataFile, projectDb);
    console.log(`\n🎉 Evaluated ${evaluatedCount} projects. Added ${addedCount} to the active directory.`);
    console.log(`🔥 Trending category automatically rebuilt with top ${topTrending.length} recently updated high-star projects.`);
  }
}

async function run() {
  await discover();
  await evaluate();
}

run().catch(console.error);
