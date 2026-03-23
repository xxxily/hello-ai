#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rejectedFile = path.join(__dirname, '../data/rejected-projects.json');

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

function analyze() {
  const data = loadJson(rejectedFile);
  if (!data || !data.rejected) {
    console.error('❌ Could not load rejected-projects.json or "rejected" field is missing');
    return;
  }

  const rejected = data.rejected;
  const totalCount = rejected.length;

  console.log('\n📊 [Rejected Projects Analysis]');
  console.log('='.repeat(40));
  console.log(`Total Rejected Projects: ${totalCount}`);
  console.log('='.repeat(40));

  // 1. Analyze Rejection Reasons
  const reasons = {};
  const keywords = ['not specifically AI-focused', 'not AI-related', 'Demo/learning project', 'General-purpose', 'Tutorial', 'Personal'];
  const keywordCounts = {};
  keywords.forEach(k => keywordCounts[k] = 0);

  rejected.forEach(p => {
    reasons[p.reason] = (reasons[p.reason] || 0) + 1;
    keywords.forEach(k => {
      if (p.reason && p.reason.toLowerCase().includes(k.toLowerCase())) {
        keywordCounts[k]++;
      }
    });
  });

  console.log('\n🔍 Rejection Reason Keywords:');
  Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([keyword, count]) => {
      const percentage = ((count / totalCount) * 100).toFixed(1);
      console.log(`- ${keyword.padEnd(30)}: ${count.toString().padStart(5)} (${percentage}%)`);
    });

  // 2. Analyze Topics
  const topicCounts = {};
  rejected.forEach(p => {
    if (p.topics && Array.isArray(p.topics)) {
      p.topics.forEach(t => {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      });
    }
  });

  console.log('\n🏷️  Top 20 Topics in Rejected Projects:');
  Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([topic, count], index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${topic.padEnd(25)}: ${count}`);
    });

  // 3. Analyze Timeline
  const timelines = {};
  rejected.forEach(p => {
    if (p.rejected_at) {
      const date = p.rejected_at.split('T')[0];
      timelines[date] = (timelines[date] || 0) + 1;
    }
  });

  console.log('\n📅 Rejection Timeline (Last 10 days with activity):');
  Object.entries(timelines)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 10)
    .forEach(([date, count]) => {
      console.log(`- ${date}: ${count}`);
    });

  // 4. Search Functionality (Optional command line arg)
  const searchKeyword = process.argv[2];
  if (searchKeyword && !searchKeyword.startsWith('-')) {
    console.log(`\n🔎 Searching for projects with reason containing "${searchKeyword}":`);
    const results = rejected.filter(p => p.reason && p.reason.toLowerCase().includes(searchKeyword.toLowerCase()));
    console.log(`Found ${results.length} matches:`);
    results.slice(0, 20).forEach(p => {
      console.log(`- [${p.name}] ${p.url}\n  Reason: ${p.reason}`);
    });
    if (results.length > 20) console.log(`... and ${results.length - 20} more.`);
  }

  console.log('\n' + '='.repeat(40));
  console.log(`Analysis complete. Use \`node scripts/analyze-rejected.js <keyword>\` to search results.`);
}

analyze();
