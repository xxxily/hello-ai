import fs from 'fs';
import path from 'path';

const dataPath = path.resolve(__dirname, '../../data/categories.json');
let aiCategories = [];

try {
  const categories = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  aiCategories = categories.map(c => ({
    text: `${c.icon || ''} ${c.name}`.trim(),
    link: `/home/${c.id}.md`
  }));
} catch (err) {
  console.error('Failed to load categories.json for sidebar:', err);
}

export default [
  {
    text: '关于 Hello-AI',
    items: [
      { text: '项目介绍', link: '/home/index.md' },
    ],
  },
  {
    text: '探索 AI 项目',
    items: aiCategories,
  },
]
