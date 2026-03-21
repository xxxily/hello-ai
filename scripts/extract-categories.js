import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function extractCategories() {
  const dataPath = path.resolve(__dirname, '../data/projects.json');
  const outPath = path.resolve(__dirname, '../data/categories.json');

  try {
    if (!fs.existsSync(dataPath)) {
      console.warn('⚠️ projects.json not found, skipping category extraction.');
      return;
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    if (!data.categories) {
      console.warn('⚠️ No categories found in projects.json.');
      return;
    }

    const categoriesInfo = data.categories.map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon || ''
    }));

    fs.writeFileSync(outPath, JSON.stringify(categoriesInfo, null, 2), 'utf-8');
    console.log(`✅ Extracted ${categoriesInfo.length} categories to categories.json`);
  } catch (err) {
    console.error('❌ Failed to extract categories from projects.json:', err);
  }
}

// Support running directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  extractCategories();
}
