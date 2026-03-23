import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const topicsFile = path.join(__dirname, '../data/topics.json');

function cleanTopics() {
  if (!fs.existsSync(topicsFile)) {
    console.error('File not found:', topicsFile);
    return;
  }

  const topicsDb = JSON.parse(fs.readFileSync(topicsFile, 'utf-8'));
  const hasChinese = (str) => /[\u4e00-\u9fa5]/.test(str);

  let removedCount = 0;

  const sections = ['active', 'niche', 'exhausted'];
  sections.forEach(section => {
    if (topicsDb[section]) {
      const originalKeys = Object.keys(topicsDb[section]);
      originalKeys.forEach(key => {
        if (hasChinese(key)) {
          delete topicsDb[section][key];
          removedCount++;
        }
      });
    }
  });

  if (removedCount > 0) {
    fs.writeFileSync(topicsFile, JSON.stringify(topicsDb, null, 2), 'utf-8');
    console.log(`✅ Cleaned up ${removedCount} Chinese topics from topics.json`);
  } else {
    console.log('✨ No Chinese topics found to clean.');
  }
}

cleanTopics();
