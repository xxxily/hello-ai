import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rejectedFile = path.join(__dirname, '../data/rejected-projects.json');
const outputDir = path.join(__dirname, '../data/rejected-projects');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function splitRejected() {
  if (!fs.existsSync(rejectedFile)) {
    console.error('❌ Source file not found:', rejectedFile);
    return;
  }

  console.log('📖 Reading large JSON file...');
  const data = JSON.parse(fs.readFileSync(rejectedFile, 'utf-8'));
  const rejected = data.rejected || [];
  
  const totalCount = rejected.length;
  console.log(`📊 Total rejected projects: ${totalCount}`);

  // Split into chunks of 10,000 items each (adjust based on item size)
  // 111MB / totalCount gives average size per item.
  // Let's just split into 5 parts for now to be safe.
  const numParts = 5;
  const chunkSize = Math.ceil(totalCount / numParts);

  for (let i = 0; i < numParts; i++) {
    const start = i * chunkSize;
    const end = Math.min((i + 1) * chunkSize, totalCount);
    if (start >= totalCount) break;

    const chunk = rejected.slice(start, end);
    const partFileName = `rejected-part-${i + 1}.json`;
    const partFilePath = path.join(outputDir, partFileName);

    console.log(`💾 Writing ${partFileName} (${chunk.length} items)...`);
    fs.writeFileSync(partFilePath, JSON.stringify({ rejected: chunk }, null, 2), 'utf-8');
  }

  console.log('✅ Split complete!');
}

splitRejected().catch(console.error);
