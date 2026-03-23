#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const topicsFile = path.join(__dirname, '../data/topics.json');

function loadJson(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.error(`❌ Error parsing ${filePath}:`, e.message);
      return null;
    }
  }
  return null;
}

const UNEXPLORED_DATE = '1970-01-01T00:00:00Z';

function analyze() {
  const topicsDb = loadJson(topicsFile);
  if (!topicsDb) {
    console.error('❌ Could not load topics.json');
    return;
  }

  const showScored = process.argv.includes('--show-scored') || process.argv.includes('-a');

  const categories = ['active', 'niche', 'exhausted'];
  let totalCount = 0;
  let exploredCount = 0;
  let unexploredCount = 0;
  let allTopics = [];

  console.log('\n📊 [Topic Analysis] Start analyzing topics.json...\n');

  categories.forEach(cat => {
    const group = topicsDb[cat] || {};
    const keys = Object.keys(group);
    
    let catTotal = keys.length;
    let catExplored = 0;
    let catUnexplored = 0;

    keys.forEach(key => {
      const topic = group[key];
      const isExplored = topic.lastExplored && topic.lastExplored !== UNEXPLORED_DATE;
      
      if (isExplored) catExplored++;
      else catUnexplored++;

      allTopics.push({
        name: key,
        group: cat,
        ...topic
      });
    });

    totalCount += catTotal;
    exploredCount += catExplored;
    unexploredCount += catUnexplored;

    if (catTotal > 0) {
      console.log(`📂 Category [${cat.toUpperCase()}]:`);
      console.log(`   - Total: ${catTotal}`);
      console.log(`   - Explored: ${catExplored}`);
      console.log(`   - Unexplored: ${catUnexplored}`);
      console.log('');
    }
  });

  console.log('📈 Global Summary:');
  console.log(`   - Total Topics: ${totalCount}`);
  console.log(`   - Total Explored/Evaluated: ${exploredCount} (${((exploredCount / totalCount) * 100).toFixed(2)}%)`);
  console.log(`   - Total Unexplored: ${unexploredCount} (${((unexploredCount / totalCount) * 100).toFixed(2)}%)`);
  console.log('');

  // Sort by score
  allTopics.sort((a, b) => (b.score || 0) - (a.score || 0));

  console.log('🏆 Top 100 High Frequency Topics (by Score):');
  const top100 = allTopics.slice(0, 100);
  
  // Format table output
  console.log('┌' + '─'.repeat(30) + '┬' + '─'.repeat(10) + '┬' + '─'.repeat(15) + '┐');
  console.log('│ Topic' + ' '.repeat(24) + '│ Score    │ Category      │');
  console.log('├' + '─'.repeat(30) + '┼' + '─'.repeat(10) + '┼' + '─'.repeat(15) + '┤');
  
  top100.forEach(t => {
    if (t.score > 0 || top100.indexOf(t) < 20) {
      const name = t.name.length > 28 ? t.name.substring(0, 25) + '...' : t.name;
      const scoreStr = (t.score || 0).toString();
      console.log(`│ ${name.padEnd(28)} │ ${scoreStr.padEnd(8)} │ ${t.group.padEnd(13)} │`);
    }
  });
  console.log('└' + '─'.repeat(30) + '┴' + '─'.repeat(10) + '┴' + '─'.repeat(15) + '┘');

  if (showScored) {
    const scoredTopics = allTopics.filter(t => (t.score || 0) > 0);
    console.log(`\n📄 [All Scored Topics] (Count: ${scoredTopics.length}):`);
    scoredTopics.forEach(t => {
      console.log(`- ${t.name}: ${t.score} (${t.group})`);
    });
  } else {
    console.log(`\n💡 Hint: Use '--show-scored' or '-a' to list all topics with a score.`);
  }
}

analyze();
