import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractCategories } from './extract-categories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataFile = path.join(__dirname, '../data/projects.json');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5', 10);

async function fetchRepoData(repoPath) {
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  }

  const res = await fetch(`https://api.github.com/repos/${repoPath}`, { headers });
  if (res.status === 403 || res.status === 429) {
    throw new Error('RATE_LIMIT');
  }
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
  return await res.json();
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

  const toCheck = allProjects.slice(0, BATCH_SIZE);
  if (toCheck.length === 0) {
    console.log('No projects to check.');
    return;
  }

  console.log(`Picking ${toCheck.length} projects from the pool for status check...`);
  let updatedCount = 0;

  for (const project of toCheck) {
    const urlParts = new URL(project.url).pathname.split('/').filter(Boolean);
    if (urlParts.length >= 2) {
      const repoPath = `${urlParts[0]}/${urlParts[1]}`;
      console.log(`🔄 Checking status for ${repoPath}...`);
      try {
        const repoData = await fetchRepoData(repoPath);
        project.stars = repoData.stargazers_count;
        project.lastUpdated = repoData.pushed_at;
        project._lastChecked = new Date().toISOString();
        
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const pushedDate = new Date(repoData.pushed_at);

        if (repoData.archived) {
          project.health = 'Archived';
        } else if (pushedDate < oneYearAgo) {
          project.health = 'Inactive';
        } else {
          project.health = 'Active';
        }

        updatedCount++;
        await new Promise(resolve => setTimeout(resolve, 1500)); // sleep to avoid rate limits
      } catch (err) {
        if (err.message === 'RATE_LIMIT') {
          console.error(`⚠️ GitHub API Rate limit hit. Fallback/stopping for now.`);
          break; // Stop processing further
        } else {
          console.error(`❌ Failed to update ${repoPath}: ${err.message}`);
          project._lastChecked = new Date().toISOString(); // prevent getting stuck
        }
      }
    }
  }

  if (updatedCount > 0) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf-8');
    extractCategories();
    console.log(`✅ Successfully updated ${updatedCount} projects.`);
  } else {
    console.log('No projects updated in this run.');
  }
}

updateStatus().catch(console.error);
