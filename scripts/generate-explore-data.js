#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const projectsPath = path.join(rootDir, 'data/projects.json');
const statsPath = path.join(rootDir, 'data/stats.json');
const outDir = path.join(rootDir, 'public/explore/data');

const AI_TOPIC_HINTS = new Set([
  'ai',
  'agent',
  'agents',
  'ai-agent',
  'ai-agents',
  'autonomous-agent',
  'llm',
  'llms',
  'mcp',
  'rag',
  'retrieval',
  'embedding',
  'embeddings',
  'vector',
  'chatgpt',
  'claude',
  'deepseek',
  'ollama',
  'transformer',
  'diffusion',
  'multimodal',
  'computer-vision',
  'nlp',
  'machine-learning',
  'deep-learning',
  'finetuning',
  'fine-tuning',
  'inference',
  'workflow',
  'automation'
]);

const TASKS = [
  {
    id: 'build-agent',
    title: '构建 AI Agent',
    summary: '从框架、编排、浏览器自动化到 MCP 工具链，快速拼出可执行智能体。',
    query: 'agent automation workflow tool-use',
    categories: ['agents', 'devtools'],
    tags: ['agent', 'ai-agents', 'automation', 'mcp', 'workflow']
  },
  {
    id: 'ship-rag',
    title: '搭建 RAG / 知识库',
    summary: '覆盖文档解析、向量检索、GraphRAG、数据管道和端到端 RAG 框架。',
    query: 'rag vector database embedding retrieval',
    categories: ['rag_data', 'infrastructure'],
    tags: ['rag', 'vector-database', 'embedding', 'retrieval']
  },
  {
    id: 'local-models',
    title: '本地模型与推理',
    summary: '定位本地运行、模型服务、推理加速、开源模型和部署基础设施。',
    query: 'local llm inference ollama model serving',
    categories: ['llms', 'infrastructure'],
    tags: ['llm', 'ollama', 'inference', 'model-serving']
  },
  {
    id: 'multimodal-studio',
    title: '多模态生成',
    summary: '串联图像、视频、语音、扩散模型和创作型应用。',
    query: 'image video audio diffusion multimodal',
    categories: ['multimodal', 'applications'],
    tags: ['diffusion', 'image-generation', 'video', 'audio', 'multimodal']
  },
  {
    id: 'developer-stack',
    title: 'AI 开发者工具',
    summary: '聚合 AI IDE、代码助手、SDK、提示工程和自动化开发工具。',
    query: 'developer tools sdk code assistant claude',
    categories: ['devtools', 'desktop_tools'],
    tags: ['developer-tools', 'sdk', 'code', 'claude-code']
  },
  {
    id: 'learn-ai-engineering',
    title: '学习 AI 工程',
    summary: '从课程、awesome list、论文资源到工程实践样例，适合系统补课。',
    query: 'course tutorial awesome list machine learning',
    categories: ['learning'],
    tags: ['tutorial', 'awesome-list', 'course', 'machine-learning']
  }
];

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(fileName, data) {
  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, fileName);
  fs.writeFileSync(target, JSON.stringify(data), 'utf-8');
  const sizeKb = (fs.statSync(target).size / 1024).toFixed(1);
  console.log(`Generated ${path.relative(rootDir, target)} (${sizeKb} KB)`);
}

function parseRepo(url = '') {
  const match = String(url).match(/github\.com\/([^/\s]+)\/([^/#?\s]+)/i);
  const owner = match?.[1] || 'unknown';
  const repo = (match?.[2] || 'unknown').replace(/\.git$/i, '');
  return { owner, repo };
}

function safeId(owner, repo, usedIds) {
  const base = `${owner}_${repo}`.replace(/[^a-zA-Z0-9_-]/g, '_') || 'unknown_project';
  if (!usedIds.has(base)) {
    usedIds.add(base);
    return base;
  }

  let i = 2;
  while (usedIds.has(`${base}_${i}`)) i += 1;
  const id = `${base}_${i}`;
  usedIds.add(id);
  return id;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}#+._-]+/gu, ' ')
    .trim();
}

function uniqueTextList(values, limit = 24) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];
  for (const rawValue of values) {
    const value = String(rawValue || '').trim();
    const key = normalizeText(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function splitCategoryName(name = '') {
  const text = String(name);
  const match = text.match(/^(\p{Extended_Pictographic}\uFE0F?)\s*(.*)$/u);
  if (!match) return { icon: '', cleanName: text.trim() };
  return { icon: match[1], cleanName: match[2].trim() || text.trim() };
}

function dateValue(value) {
  if (!value || value === 'unknown') return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isActiveProject(project, cutoffTime) {
  const updatedAt = dateValue(project.lastUpdated);
  return !updatedAt || updatedAt >= cutoffTime;
}

function daysSince(value, nowMs) {
  const time = dateValue(value);
  if (!time) return 9999;
  return Math.max(0, Math.round((nowMs - time) / 86400000));
}

function freshnessScore(project, nowMs) {
  const days = daysSince(project.lastUpdated, nowMs);
  if (days <= 7) return 100;
  if (days <= 30) return 90;
  if (days <= 90) return 76;
  if (days <= 180) return 58;
  if (days <= 365) return 38;
  return 20;
}

function newnessScore(project, nowMs) {
  const days = daysSince(project.addedAt, nowMs);
  if (days <= 14) return 100;
  if (days <= 45) return 78;
  if (days <= 90) return 52;
  if (days <= 180) return 24;
  return 0;
}

function focusScore(project) {
  const tags = project.tags || [];
  const topics = project.topics || [];
  const signalCount = tags.length + topics.length;
  const density =
    signalCount >= 5 && signalCount <= 18
      ? 100
      : signalCount > 0
        ? Math.max(35, 100 - Math.abs(signalCount - 11) * 5)
        : 25;
  const hasSubcategory = project.subcategory ? 12 : 0;
  return Math.min(100, density + hasSubcategory);
}

function topicSignalScore(project) {
  const values = [...(project.tags || []), ...(project.topics || [])].map(normalizeText);
  if (!values.length) return 25;
  let hits = 0;
  for (const value of values) {
    if (AI_TOPIC_HINTS.has(value)) hits += 1;
    else if (value.includes('agent') || value.includes('llm') || value.includes('rag')) hits += 1;
  }
  return Math.min(100, 35 + hits * 14);
}

function starScore(stars, maxStars) {
  const safeMax = Math.max(10, maxStars || 10);
  return Math.round((Math.log10((stars || 0) + 1) / Math.log10(safeMax + 1)) * 100);
}

function formatCategory(category) {
  const { icon, cleanName } = splitCategoryName(category.name);
  return {
    id: category.id,
    name: category.name,
    cleanName,
    icon,
    description: category.description || '',
    subcategories: category.subcategories || []
  };
}

function compactProject(project) {
  return {
    id: project.id,
    name: project.name,
    owner: project.owner,
    repo: project.repo,
    url: project.url,
    description: project.description,
    categoryId: project.categoryId,
    categoryName: project.categoryName,
    categoryCleanName: project.categoryCleanName,
    categoryIcon: project.categoryIcon,
    subcategory: project.subcategory,
    tags: project.tags.slice(0, 8),
    topics: project.topics.slice(0, 10),
    stars: project.stars,
    lastUpdated: project.lastUpdated,
    addedAt: project.addedAt,
    health: project.health,
    scores: project.scores
  };
}

function countValues(records, getValues) {
  const counts = new Map();
  for (const record of records) {
    for (const value of getValues(record)) {
      const key = normalizeText(value);
      if (!key) continue;
      const label = String(value).trim();
      const current = counts.get(key) || { id: key, label, count: 0 };
      current.count += 1;
      counts.set(key, current);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function balancedTop(records, sortFn, perCategory = 3, total = 24) {
  const byCategory = new Map();
  for (const record of [...records].sort(sortFn)) {
    if (!byCategory.has(record.categoryId)) byCategory.set(record.categoryId, []);
    byCategory.get(record.categoryId).push(record);
  }

  const result = [];
  for (const items of byCategory.values()) {
    result.push(...items.slice(0, perCategory));
  }

  return result.sort(sortFn).slice(0, total).map(compactProject);
}

function buildRelated(records) {
  const tokenIndex = new Map();

  const addToken = (token, recordId, weight) => {
    if (!token) return;
    const list = tokenIndex.get(token) || [];
    list.push([recordId, weight]);
    tokenIndex.set(token, list);
  };

  for (const record of records) {
    addToken(`sub:${normalizeText(record.subcategory)}`, record.id, 7);
    for (const tag of record.tags) addToken(`tag:${normalizeText(tag)}`, record.id, 5);
    for (const topic of record.topics) addToken(`topic:${normalizeText(topic)}`, record.id, 3);
  }

  const byId = new Map(records.map(record => [record.id, record]));
  const related = {};

  for (const record of records) {
    const scores = new Map();
    const tokens = [
      [`sub:${normalizeText(record.subcategory)}`, 7],
      ...record.tags.map(tag => [`tag:${normalizeText(tag)}`, 5]),
      ...record.topics.map(topic => [`topic:${normalizeText(topic)}`, 3])
    ];

    for (const [token, baseWeight] of tokens) {
      const matches = tokenIndex.get(token) || [];
      if (matches.length > 1600) continue;
      for (const [candidateId, candidateWeight] of matches) {
        if (candidateId === record.id) continue;
        scores.set(candidateId, (scores.get(candidateId) || 0) + baseWeight + candidateWeight);
      }
    }

    related[record.id] = [...scores.entries()]
      .map(([id, score]) => {
        const candidate = byId.get(id);
        const sameCategory = candidate?.categoryId === record.categoryId ? 8 : 0;
        const sameSubcategory = candidate?.subcategory === record.subcategory ? 10 : 0;
        const quality = ((candidate?.scores?.potential || 0) / 100) * 3;
        return [id, score + sameCategory + sameSubcategory + quality];
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id);
  }

  return related;
}

function taskMatchScore(record, task) {
  const haystack = [
    record.name,
    record.description,
    record.categoryId,
    record.subcategory,
    ...(record.tags || []),
    ...(record.topics || [])
  ]
    .map(normalizeText)
    .join(' ');
  const taskTerms = [...(task.tags || []), ...(task.query || '').split(/\s+/)].map(normalizeText).filter(Boolean);
  let score = task.categories?.includes(record.categoryId) ? 28 : 0;

  for (const term of taskTerms) {
    if (haystack.includes(term)) score += 9;
  }

  return score + (record.scores?.potential || 0) * 0.45 + Math.log10((record.stars || 0) + 1) * 4;
}

function topForTask(records, task, filterFn, limit = 4) {
  return records
    .map(record => [record, taskMatchScore(record, task)])
    .filter(([record, score]) => score > 38 && (!filterFn || filterFn(record)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([record]) => compactProject(record));
}

function buildTaskPaths(records) {
  return TASKS.map(task => {
    const starter = topForTask(records, task, null, 4);
    const production = topForTask(records, task, record => record.stars >= 5000 || (record.scores?.maturity || 0) >= 80, 4);
    const fresh = topForTask(records, task, record => daysSince(record.lastUpdated, Date.now()) <= 45, 4);
    const seen = new Set();
    const compactUnique = projects =>
      projects.filter(project => {
        if (seen.has(project.id)) return false;
        seen.add(project.id);
        return true;
      });

    return {
      ...task,
      total: records.filter(record => taskMatchScore(record, task) > 38).length,
      tracks: [
        { id: 'starter', label: '优先试用', projects: compactUnique(starter) },
        { id: 'production', label: '生产候选', projects: compactUnique(production) },
        { id: 'fresh', label: '近期活跃', projects: compactUnique(fresh) }
      ]
    };
  });
}

function buildCategoryInsights(records, categories) {
  return categories
    .filter(category => category.id !== 'trending')
    .map(category => {
      const items = records.filter(record => record.categoryId === category.id);
      const topTags = countValues(items, record => record.tags).slice(0, 6);
      const subcategories = countValues(items, record => [record.subcategory]).slice(0, 4);
      const leaders = [...items]
        .sort((a, b) => (b.scores?.potential || 0) - (a.scores?.potential || 0) || b.stars - a.stars)
        .slice(0, 3)
        .map(compactProject);
      const freshCount = items.filter(record => daysSince(record.lastUpdated, Date.now()) <= 30).length;
      const avgPotential = items.length
        ? Math.round(items.reduce((sum, record) => sum + (record.scores?.potential || 0), 0) / items.length)
        : 0;

      return {
        categoryId: category.id,
        name: category.name,
        cleanName: category.cleanName,
        icon: category.icon,
        count: items.length,
        freshCount,
        avgPotential,
        topTags,
        subcategories,
        leaders
      };
    })
    .sort((a, b) => b.count - a.count);
}

function describeFit(record) {
  const category = record.categoryId;
  const tags = [...record.tags, ...record.topics].map(normalizeText);
  if (category === 'agents') return '适合评估智能体框架、工具调用、自动化工作流或多智能体编排。';
  if (category === 'rag_data') return '适合做知识库、文档检索、GraphRAG、数据解析或语义搜索选型。';
  if (category === 'llms') return '适合关注模型能力、开源权重、模型架构或本地推理基础。';
  if (category === 'infrastructure') return '适合作为部署、推理、观测、模型服务或工程基础设施候选。';
  if (category === 'devtools') return '适合提升开发效率、搭建 AI 编程流、集成 SDK 或构建内部工具。';
  if (category === 'multimodal') return '适合图像、语音、视频、视觉理解或多模态生成应用。';
  if (category === 'learning' || tags.includes('tutorial') || tags.includes('awesome-list')) {
    return '适合作为学习路径、调研入口、案例库或团队知识补齐材料。';
  }
  return '适合进入同类项目对比，结合活跃度、成熟度和标签判断是否值得试用。';
}

function describeCaution(record) {
  const cautions = [];
  if ((record.stars || 0) < 1000) cautions.push('星标较少，建议先看 issue、release 和 README 完整度。');
  if (daysSince(record.lastUpdated, Date.now()) > 90) cautions.push('最近更新不算频繁，适合作为备选或学习参考。');
  if (!record.topics?.length) cautions.push('GitHub topics 缺失，相关性主要来自描述和人工标签。');
  if ((record.tags || []).length <= 2) cautions.push('标签较少，建议打开 GitHub 进一步确认实际边界。');
  return cautions.slice(0, 3);
}

function describeNextSteps(record) {
  const steps = ['打开 GitHub 快速检查 README、示例和最近提交。'];
  if (record.categoryId === 'agents' || record.categoryId === 'rag_data') {
    steps.push('加入对比，和同类框架一起看集成复杂度和生态。');
  } else {
    steps.push('查看相关项目，判断它是主方案、替代品还是配套组件。');
  }
  if ((record.tags || []).length) {
    steps.push(`用标签 ${record.tags.slice(0, 2).join(' / ')} 继续缩小搜索范围。`);
  }
  return steps;
}

function main() {
  const data = readJson(projectsPath);
  if (!data?.categories) {
    console.error('data/projects.json is missing categories.');
    process.exit(1);
  }

  const existingStats = readJson(statsPath, {});
  const recencyThresholdMonths = Number(
    process.env.EXPLORE_RECENCY_MONTHS || existingStats.recencyThresholdMonths || 6
  );
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - recencyThresholdMonths);
  const cutoffTime = cutoff.getTime();

  const categories = data.categories.map(formatCategory);
  const categoryMap = new Map(categories.map(category => [category.id, category]));
  const usedIds = new Set();
  const bySourceKey = new Map();
  const records = [];

  for (const category of data.categories) {
    const categoryMeta = categoryMap.get(category.id);
    for (const rawProject of category.projects || []) {
      if (!rawProject?.url && !rawProject?.name) continue;

      const sourceKey = normalizeText(rawProject.url || rawProject.name);
      const { owner, repo } = parseRepo(rawProject.url);
      const existing = bySourceKey.get(sourceKey);
      const shouldReplace = existing && existing.categoryId === 'trending' && category.id !== 'trending';
      if (existing && !shouldReplace) continue;

      const record = {
        id: existing?.id || safeId(rawProject._owner || owner, rawProject._name || repo, usedIds),
        name: String(rawProject.name || repo),
        owner: rawProject._owner || owner,
        repo: rawProject._name || repo,
        url: rawProject.url || '',
        description: String(rawProject.description || '').trim(),
        categoryId: category.id,
        categoryName: categoryMeta?.name || category.name,
        categoryCleanName: categoryMeta?.cleanName || category.name,
        categoryIcon: categoryMeta?.icon || '',
        subcategory: rawProject.subcategory || '未分类',
        tags: uniqueTextList(rawProject.tags, 16),
        topics: uniqueTextList(rawProject.topics, 32),
        stars: Number(rawProject.stars || 0),
        lastUpdated: rawProject.lastUpdated || '',
        addedAt: rawProject.addedAt || '',
        health: rawProject.health || 'Unknown',
        _sourceKey: sourceKey
      };

      if (shouldReplace) {
        const index = records.findIndex(item => item._sourceKey === sourceKey);
        if (index >= 0) records[index] = record;
      } else {
        records.push(record);
      }
      bySourceKey.set(sourceKey, record);
    }
  }

  const activeRecords = records.filter(record => isActiveProject(record, cutoffTime));
  const maxStars = Math.max(...activeRecords.map(record => record.stars), 0);

  const categoryStarRanks = new Map();
  for (const category of categories) {
    const sorted = activeRecords
      .filter(record => record.categoryId === category.id)
      .sort((a, b) => b.stars - a.stars);
    sorted.forEach((record, index) => {
      const percentile = sorted.length <= 1 ? 100 : 100 - (index / (sorted.length - 1)) * 100;
      categoryStarRanks.set(record.id, Math.max(15, Math.round(percentile)));
    });
  }

  for (const record of activeRecords) {
    const freshness = freshnessScore(record, now.getTime());
    const focus = focusScore(record);
    const stars = starScore(record.stars, maxStars);
    const categoryBalance = categoryStarRanks.get(record.id) || 40;
    const topicSignal = topicSignalScore(record);
    const newness = newnessScore(record, now.getTime());
    const potential = Math.round(
      freshness * 0.3 +
      focus * 0.2 +
      stars * 0.2 +
      categoryBalance * 0.15 +
      topicSignal * 0.1 +
      newness * 0.05
    );

    record.scores = {
      potential,
      freshness,
      maturity: Math.round(stars * 0.65 + (record.health === 'Active' ? 35 : 15)),
      focus,
      topicSignal
    };
  }

  const tags = countValues(activeRecords, record => record.tags);
  const topics = countValues(activeRecords, record => record.topics);
  const subcategories = countValues(activeRecords, record => [record.subcategory]);

  const categoryCounts = new Map();
  const rawCategoryCounts = new Map();
  for (const category of categories) {
    categoryCounts.set(category.id, activeRecords.filter(record => record.categoryId === category.id).length);
    rawCategoryCounts.set(
      category.id,
      records.filter(record => record.categoryId === category.id).length
    );
  }

  const enrichedCategories = categories.map(category => ({
    ...category,
    count: categoryCounts.get(category.id) || 0,
    rawCount: rawCategoryCounts.get(category.id) || 0
  }));

  const catalogLite = activeRecords.map(compactProject);
  const detailMap = Object.fromEntries(
    activeRecords.map(record => [
      record.id,
      {
        tags: record.tags,
        topics: record.topics,
        github: {
          owner: record.owner,
          repo: record.repo
        },
        signals: {
          potential: '综合近期活跃、主题聚焦、分类内表现与项目热度得到的探索信号。',
          freshness: '基于最近一次更新日期。',
          focus: '基于 tags、topics 与子分类完整度。'
        },
        decision: {
          fit: describeFit(record),
          caution: describeCaution(record),
          nextSteps: describeNextSteps(record)
        }
      }
    ])
  );

  const related = buildRelated(activeRecords);
  const taskPaths = buildTaskPaths(activeRecords);
  const categoryInsights = buildCategoryInsights(activeRecords, enrichedCategories);
  const generatedAt = new Date().toISOString();

  writeJson('stats.json', {
    generatedAt,
    recencyThresholdMonths,
    totalRawProjects: records.length,
    totalActiveProjects: activeRecords.length,
    categories: Object.fromEntries(
      enrichedCategories.map(category => [
        category.id,
        {
          name: category.name,
          cleanName: category.cleanName,
          count: category.count,
          rawCount: category.rawCount
        }
      ])
    )
  });

  writeJson('facets.json', {
    generatedAt,
    categories: enrichedCategories,
    tags: tags.slice(0, 120),
    topics: topics.slice(0, 160),
    subcategories: subcategories.slice(0, 120),
    tasks: TASKS
  });

  writeJson('radar.json', {
    generatedAt,
    hero: {
      totalActiveProjects: activeRecords.length,
      totalRawProjects: records.length,
      recencyThresholdMonths
    },
    taskPaths,
    categoryInsights,
    lists: {
      recent: [...activeRecords]
        .filter(record => record.stars >= 100)
        .sort((a, b) => dateValue(b.lastUpdated) - dateValue(a.lastUpdated) || b.stars - a.stars)
        .slice(0, 24)
        .map(compactProject),
      potential: balancedTop(activeRecords, (a, b) => b.scores.potential - a.scores.potential || b.stars - a.stars, 3, 24),
      highStar: balancedTop(activeRecords, (a, b) => b.stars - a.stars, 3, 24),
      newProjects: [...activeRecords]
        .filter(record => dateValue(record.addedAt))
        .sort((a, b) => dateValue(b.addedAt) - dateValue(a.addedAt) || b.scores.potential - a.scores.potential)
        .slice(0, 24)
        .map(compactProject)
    },
    categorySpotlights: enrichedCategories.map(category => ({
      categoryId: category.id,
      name: category.name,
      cleanName: category.cleanName,
      icon: category.icon,
      count: category.count,
      projects: activeRecords
        .filter(record => record.categoryId === category.id)
        .sort((a, b) => b.scores.potential - a.scores.potential || b.stars - a.stars)
        .slice(0, 4)
        .map(compactProject)
    })),
    tasks: taskPaths
  });

  writeJson('catalog-lite.json', catalogLite);
  writeJson('project-details.json', detailMap);
  writeJson('related.json', related);
  writeJson('search-index.json', {
    generatedAt,
    quickQueries: TASKS.map(task => ({
      id: task.id,
      title: task.title,
      summary: task.summary,
      query: task.query,
      categories: task.categories,
      tags: task.tags
    })),
    synonyms: {
      智能体: ['agent', 'agents', 'ai-agent', 'autonomous-agent', 'tool-use'],
      知识库: ['rag', 'retrieval', 'embedding', 'vector database'],
      本地模型: ['local llm', 'ollama', 'inference', 'model serving'],
      微调: ['finetuning', 'fine-tuning', 'training', 'lora'],
      多模态: ['multimodal', 'image', 'video', 'audio', 'diffusion'],
      开发工具: ['developer tools', 'sdk', 'code assistant', 'claude-code']
    }
  });

  console.log(`Explore data built from ${records.length} unique projects (${activeRecords.length} active).`);
  console.log('Source files were read only; data/projects.json was not modified.');
}

main();
