import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataFile = path.join(__dirname, '../data/projects.json');
const docsDir = path.join(__dirname, '../home');

function generateMarkdown(category) {
  let md = `# ${category.name}\n\n`;
  md += `> ${category.description}\n\n`;

  const count = category.projects ? category.projects.length : 0;

  if (count === 0) {
    md += `*目前该分类下暂无收录项目，但我们的 AI 正在努力搜罗中，敬请期待！*\n`;
    return md;
  }

  md += `> 当前分类已收录 **${count}** 个相关项目。\n\n`;

  // Sort function
  const sortFn = (a, b) => (b.stars || 0) - (a.stars || 0);

  // Group by subcategory
  const groups = {};
  category.projects.forEach(p => {
    const sub = p.subcategory || '未分类 (Others)';
    if (!groups[sub]) groups[sub] = [];
    groups[sub].push(p);
  });

  // Decide if we should show subcategory headers
  // E.g. for "trending" we might just have "未分类 (Others)", we can skip the header if there's only one group named "未分类 (Others)".
  const groupKeys = Object.keys(groups);
  const showGroupTittle = !(category.id === 'trending' || (groupKeys.length === 1 && groupKeys[0] === '未分类 (Others)'));

  // Define logic for writing a single project
  const writeProject = (project, headingLevel) => {
    let out = `${headingLevel} [${project.name}](${project.url})\n\n`;
    out += `${project.description}\n\n`;

    const tags = Array.isArray(project.tags) ? project.tags.map(t => `\`${t}\``).join(' ') : '';
    const stars = project.stars ? (project.stars >= 1000 ? (project.stars / 1000).toFixed(1) + 'k' : project.stars) : 'N/A';

    out += `- **Stars:** ⭐️ ${stars}\n`;
    out += `- **Tags:** ${tags || '无'}\n`;

    if (project.lastUpdated && project.lastUpdated !== 'unknown') {
      const d = new Date(project.lastUpdated);
      if (!isNaN(d.getTime())) {
        out += `- **最后活动时间:** ${d.toISOString().slice(0, 10)}\n`;
      } else {
        out += `- **最后活动时间:** ${project.lastUpdated}\n`;
      }
    }
    out += `\n`;
    return out;
  };

  if (!showGroupTittle) {
    // Just sort and render ALL directly using ##
    const sortedProjects = category.projects.sort(sortFn);
    sortedProjects.forEach((project) => {
      md += writeProject(project, '##');
    });
  } else {
    // Sort keys so "未分类 (Others)" goes last
    const orderedKeys = groupKeys.sort((a, b) => {
      if (a === '未分类 (Others)') return 1;
      if (b === '未分类 (Others)') return -1;
      return a.localeCompare(b);
    });

    orderedKeys.forEach(sub => {
      md += `## ${sub}\n\n`;
      const sortedSubProjects = groups[sub].sort(sortFn);
      sortedSubProjects.forEach((project) => {
        md += writeProject(project, '###');
      });
    });
  }

  return md;
}

/**
 * Update README files with stats
 */
function updateReadmes(stats) {
  const lastUpdated = new Date(stats.lastUpdated).toISOString().split('T')[0];

  const catMapping = {
    trending: '🔥 Trending',
    llms: '🧠 Foundation Models',
    agents: '🤖 Agents & Orchestration',
    rag_data: '🔍 RAG & Data Engineering',
    infrastructure: '☁️ Infrastructure & Deployment',
    finetuning: '🔧 Fine-tuning & Training',
    multimodal: '👁️ Multimodal (Audio/Video)',
    devtools: '🛠️ Developer Tools & SDKs',
    applications: '🎨 AI Applications',
    learning: '📚 Learning Resources',
    desktop_tools: '💻 Desktop & OS Apps',
    robotics_iot: '🦾 Robotics & IoT',
    finance_business: '💼 Business & Finance'
  };

  const generateStatsMd = (isChinese) => {
    let md = `<!-- STATS_START -->\n`;
    if (isChinese) {
      md += `## 📊 项目统计\n\n`;
      md += `*此项目已收录 AI 相关的优质开源项目概况如下：*\n\n`;
      md += `- 📁 **收录总量**：${stats.totalProjects}\n`;
      md += `- 🏷️ **分类概览**：\n`;
      for (const key in stats.categories) {
        const cat = stats.categories[key];
        md += `  - ${cat.name}：${cat.count}\n`;
      }
      md += `- 📅 **最后更新**：${lastUpdated}\n`;
    } else {
      md += `## 📊 Project Statistics\n\n`;
      md += `*This project has collected high-quality open-source AI projects as follows:*\n\n`;
      md += `- 📁 **Total Projects**: ${stats.totalProjects}\n`;
      md += `- 🏷️ **Categories**:\n`;
      for (const key in stats.categories) {
        const cat = stats.categories[key];
        const engName = catMapping[key] || cat.name;
        md += `  - ${engName}: ${cat.count}\n`;
      }
      md += `- 📅 **Last Updated**: ${lastUpdated}\n`;
    }
    md += `<!-- STATS_END -->`;
    return md;
  };

  const files = [
    { path: path.join(__dirname, '../README.md'), isChinese: false, anchor: '## Overview' },
    { path: path.join(__dirname, '../README-zh.md'), isChinese: true, anchor: '## 概述' },
    { path: path.join(__dirname, '../home/index.md'), isChinese: true, anchor: '## 概述' }
  ];

  files.forEach(file => {
    if (!fs.existsSync(file.path)) return;

    let content = fs.readFileSync(file.path, 'utf-8');
    const statsMd = generateStatsMd(file.isChinese);

    const startMarker = '<!-- STATS_START -->';
    const endMarker = '<!-- STATS_END -->';

    if (content.includes(startMarker) && content.includes(endMarker)) {
      // Replace existing
      const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'g');
      content = content.replace(regex, statsMd);
    } else {
      // Insert before anchor
      if (content.includes(file.anchor)) {
        content = content.replace(file.anchor, `${statsMd}\n\n${file.anchor}`);
      } else {
        console.warn(`Anchor ${file.anchor} not found in ${file.path}`);
      }
    }

    fs.writeFileSync(file.path, content, 'utf-8');
    console.log(`Updated stats in: ${file.path}`);
  });
}

function build() {
  if (!fs.existsSync(dataFile)) {
    console.error('Data file not found:', dataFile);
    process.exit(1);
  }

  const rawData = fs.readFileSync(dataFile, 'utf-8');
  let data;
  try {
    data = JSON.parse(rawData);
  } catch (err) {
    console.error('Failed to parse projects.json:', err);
    process.exit(1);
  }

  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const uniqueProjectUrls = new Set();
  const stats = {
    totalProjects: 0,
    categories: {},
    lastUpdated: new Date().toISOString()
  };

  data.categories.forEach((category) => {
    let catProjectCount = 0;
    if (category.projects) {
      catProjectCount = category.projects.length;
      category.projects.forEach(p => {
        if (p.url) uniqueProjectUrls.add(p.url);
      });
    }

    stats.categories[category.id] = {
      name: category.name,
      count: catProjectCount
    };

    const mdContent = generateMarkdown(category);
    const outputPath = path.join(docsDir, `${category.id}.md`);
    fs.writeFileSync(outputPath, mdContent, 'utf-8');
    console.log(`Generated: ${outputPath}`);
  });

  stats.totalProjects = uniqueProjectUrls.size;
  const statsPath = path.join(__dirname, '../data/stats.json');
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf-8');
  console.log(`Generated stats: ${statsPath}`);

  // Sync stats to READMEs
  updateReadmes(stats);

  console.log('\nDocs generation completed successfully.');
  console.log(`Total projects collected (unique): ${uniqueProjectUrls.size}`);
}

build();
