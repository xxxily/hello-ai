import fs from 'fs';
import path from 'path';

// Instead of hardcoding categories, read them from data/projects.json
const dataPath = path.resolve(__dirname, '../../data/projects.json');
let aiCategories = [];

try {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  aiCategories = data.categories.map(c => ({
    text: `${c.icon || ''} ${c.name}`.trim(),
    link: `/home/${c.id}.md`
  }));
} catch (err) {
  console.error('Failed to load projects.json for nav:', err);
}

export default [
  { text: '快速开始', link: '/home/' },
  {
    text: '相关连接',
    ariaLabel: '相关连接',
    items: [
      {
        text: 'AI 项目分类',
        items: aiCategories
      },
      {
        text: '站长作品',
        items: [
          { text: 'h5player', link: 'https://github.com/xxxily/h5player', target: '_blank' },
          { text: 'Fiddler-plus', link: 'https://github.com/xxxily/Fiddler-plus', target: '_blank' },
          { text: 'broadcast-message', link: 'https://broadcast-message.anzz.top/', target: '_blank' },
          { text: 'vue-debug-helper', link: 'https://github.com/xxxily/broadcast-message', target: '_blank' },
          { text: 'processAssist', link: 'https://github.com/xxxily/processAssist', target: '_blank' },
          { text: 'ffmpeg-script', link: 'https://github.com/xxxily/ffmpeg-script', target: '_blank' },
        ]
      },
    ]
  },
]
