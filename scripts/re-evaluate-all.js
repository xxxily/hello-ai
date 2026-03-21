import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataFile = path.join(__dirname, '../data/projects.json');
const queueFile = path.join(__dirname, '../data/pending-projects.json');

function loadJson(filePath, defaultVal = null) {
  if (fs.existsSync(filePath)) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
    catch(e) { return defaultVal; }
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

function run() {
  const projectDb = loadJson(dataFile);
  const pendingDb = loadJson(queueFile, { queue: [] });

  let movedCount = 0;

  projectDb.categories.forEach(category => {
    if (category.id === 'trending') return;

    if (category.projects && category.projects.length > 0) {
      category.projects.forEach(p => {
        // 检查队列中是否已经存在该 URL，避免重复
        const exists = pendingDb.queue.find(q => (q.html_url || '').toLowerCase() === (p.url || '').toLowerCase());
        
        if (!exists) {
          pendingDb.queue.push({
            name: p.name,
            html_url: p.url || p.html_url,
            // 将原有的中文 description 或 tags 继续塞回给 LLM 作为参考上下文
            description: p.description || '',
            topics: p.tags || [],
            stargazers_count: p.stars || 500,
            pushed_at: p.lastUpdated || new Date().toISOString(),
            added_to_queue: new Date().toISOString()
          });
          movedCount++;
        }
      });
      // 清空该类别下旧的项目数据
      category.projects = [];
    }
  });

  if (movedCount > 0) {
    saveJson(dataFile, projectDb);
    saveJson(queueFile, pendingDb);
    console.log(`✅ 成功将 ${movedCount} 个历史项目退回至 pending-projects.json 待审队列！`);
    console.log(`🚀 现有的 projects.json 分类已被清空（保留了 Trending），你可以重新运行 npm run ai:loop-eval 进行全新的评估！`);
  } else {
    console.log(`⚠️ 目前没有可回退的项目。`);
  }
}

run();
