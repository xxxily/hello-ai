import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractCategories } from './extract-categories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataFile = path.join(__dirname, '../data/projects.json');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const UPDATE_STATUS_BATCH_SIZE = parseInt(process.env.UPDATE_STATUS_BATCH_SIZE || '50', 10);
const UPDATE_STATUS_INTERVAL_SECONDS = parseInt(process.env.UPDATE_STATUS_INTERVAL_SECONDS || '60', 10);

async function fetchBatchRepoData(projects) {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is required for GraphQL API. Please check your .env file.');
  }

  const queries = projects.map((p, i) => {
    const urlParts = new URL(p.url).pathname.split('/').filter(Boolean);
    if (urlParts.length < 2) return null;
    const owner = urlParts[0];
    const name = urlParts[1];
    p._owner = owner;
    p._name = name;

    return `
      repo_${i}: repository(owner: "${owner}", name: "${name}") {
        stargazerCount
        pushedAt
        isArchived
      }
    `;
  }).filter(Boolean);

  if (queries.length === 0) return {};

  const query = `
    query {
      ${queries.join('\n')}
    }
  `;

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (res.status === 403 || res.status === 429) {
    throw new Error('RATE_LIMIT');
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}\n${errorText}`);
  }

  const result = await res.json();
  if (result.errors && !result.data) {
    throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);
  }

  return result.data || {};
}

async function updateStatus() {
  const rawData = fs.readFileSync(dataFile, 'utf-8');
  const data = JSON.parse(rawData);

  // Flatten all projects with a reference back to their category
  let allProjects = [];
  for (const category of data.categories) {
    if (!category.projects) continue;
    for (const project of category.projects) {
      if (project.url.includes('github.com')) {
        allProjects.push(project);
      }
    }
  }

  // Sort by _lastChecked ascending (oldest checked first)
  allProjects.sort((a, b) => {
    const timeA = a._lastChecked ? new Date(a._lastChecked).getTime() : 0;
    const timeB = b._lastChecked ? new Date(b._lastChecked).getTime() : 0;
    return timeA - timeB;
  });

  const toCheck = allProjects.slice(0, UPDATE_STATUS_BATCH_SIZE);
  if (toCheck.length === 0) {
    console.log('No projects to check.');
    return 0;
  }

  console.log(`Picking ${toCheck.length} projects from the pool for status check...`);

  try {
    const batchData = await fetchBatchRepoData(toCheck);
    let updatedCount = 0;

    toCheck.forEach((project, i) => {
      const repoData = batchData[`repo_${i}`];
      const repoPath = `${project._owner}/${project._name}`;

      if (repoData) {
        console.log(`✅ Updating ${repoPath}...`);
        project.stars = repoData.stargazerCount;
        project.lastUpdated = repoData.pushedAt;
        project._lastChecked = new Date().toISOString();

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const pushedDate = new Date(repoData.pushedAt);

        if (repoData.isArchived) {
          project.health = 'Archived';
        } else if (pushedDate < oneYearAgo) {
          project.health = 'Inactive';
        } else {
          project.health = 'Active';
        }
        updatedCount++;
      } else {
        console.warn(`⚠️ Repository not found or no data for ${repoPath}. Marking as checked to avoid stuck.`);
        project._lastChecked = new Date().toISOString();
      }
    });

    if (updatedCount > 0) {
      fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf-8');
      extractCategories();
      console.log(`✅ Successfully updated ${updatedCount} projects.`);
    } else {
      console.log('No projects updated in this run.');
    }
    return updatedCount;

  } catch (err) {
    if (err.message === 'RATE_LIMIT') {
      console.error(`⚠️ GitHub API Rate limit hit. Fallback/stopping for now.`);
    } else {
      console.error(`❌ Batch update failed: ${err.message}`);
    }
    return -1;
  }
}

async function start() {
  const isLoop = process.argv.includes('--loop');

  if (!isLoop) {
    await updateStatus();
    return;
  }

  console.log('┌────────────────────────────────────────────────────────┐');
  console.log('│                                                        │');
  console.log('│   🔄 Hello-AI 项目状态自动更新引擎启动 (Loop Mode)     │');
  console.log('│   按 Ctrl+C 可停止执行                                 │');
  console.log('│                                                        │');
  console.log('└────────────────────────────────────────────────────────┘');

  while (true) {
    const startTime = Date.now();
    const result = await updateStatus();

    if (result === -1) {
      console.log('等待 5 分钟后重试 (由于错误或频率限制)...');
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
      continue;
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const waitTime = Math.max(5, UPDATE_STATUS_INTERVAL_SECONDS - elapsed);

    console.log(`\n⏳ 本轮更新耗时 ${elapsed}s. 等待 ${waitTime}s 后进行下一轮...`);
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
  }
}

process.on('SIGINT', () => {
  console.log('\n\n👋 正在停止状态更新任务...');
  process.exit(0);
});

start().catch(err => {
  console.error('💥 状态更新引擎发生致命错误:', err);
  process.exit(1);
});
