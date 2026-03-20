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

  if (!category.projects || category.projects.length === 0) {
    md += `*目前该分类下暂无收录项目，但我们的 AI 正在努力搜罗中，敬请期待！*\n`;
    return md;
  }

  // Sort projects by stars (descending) by default
  const sortedProjects = category.projects.sort((a, b) => (b.stars || 0) - (a.stars || 0));

  sortedProjects.forEach((project) => {
    md += `## [${project.name}](${project.url})\n\n`;
    md += `${project.description}\n\n`;

    const tags = Array.isArray(project.tags) ? project.tags.map(t => `\`${t}\``).join(' ') : '';
    // Use stars and format it nicely (e.g., 1.2k)
    const stars = project.stars ? (project.stars >= 1000 ? (project.stars / 1000).toFixed(1) + 'k' : project.stars) : 'N/A';
    
    md += `- **Stars:** ⭐️ ${stars}\n`;
    md += `- **Tags:** ${tags || '无'}\n`;
    
    if (project.lastUpdated && project.lastUpdated !== 'unknown') {
        const d = new Date(project.lastUpdated);
        if (!isNaN(d.getTime())) {
            md += `- **最后活动时间:** ${d.toISOString().slice(0, 10)}\n`;
        } else {
            md += `- **最后活动时间:** ${project.lastUpdated}\n`;
        }
    }
    
    md += `\n`;
  });

  return md;
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

  data.categories.forEach((category) => {
    const mdContent = generateMarkdown(category);
    const outputPath = path.join(docsDir, `${category.id}.md`);
    fs.writeFileSync(outputPath, mdContent, 'utf-8');
    console.log(`Generated: ${outputPath}`);
  });

  console.log('Docs generation completed successfully.');
}

build();
