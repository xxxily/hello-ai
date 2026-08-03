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
    summary: 'Agent 框架、工作流、浏览器自动化和 MCP 工具。',
    query: 'agent automation workflow tool-use',
    categories: ['agents', 'devtools'],
    tags: ['agent', 'ai-agents', 'automation', 'mcp', 'workflow']
  },
  {
    id: 'ship-rag',
    title: '搭建 RAG / 知识库',
    summary: 'RAG 框架、向量数据库、文档解析和检索工具。',
    query: 'rag vector database embedding retrieval',
    categories: ['rag_data', 'infrastructure'],
    tags: ['rag', 'vector-database', 'embedding', 'retrieval']
  },
  {
    id: 'local-models',
    title: '本地模型与推理',
    summary: '本地模型、推理引擎、模型服务和部署工具。',
    query: 'local llm inference ollama model serving',
    categories: ['llms', 'infrastructure'],
    tags: ['llm', 'ollama', 'inference', 'model-serving']
  },
  {
    id: 'multimodal-studio',
    title: '多模态生成',
    summary: '图像、视频、语音和多模态生成工具。',
    query: 'image video audio diffusion multimodal',
    categories: ['multimodal', 'applications'],
    tags: ['diffusion', 'image-generation', 'video', 'audio', 'multimodal']
  },
  {
    id: 'developer-stack',
    title: 'AI 开发者工具',
    summary: 'AI 编程工具、代码助手、SDK 和自动化工具。',
    query: 'developer tools sdk code assistant claude',
    categories: ['devtools', 'desktop_tools'],
    tags: ['developer-tools', 'sdk', 'code', 'claude-code']
  },
  {
    id: 'learn-ai-engineering',
    title: '学习 AI 工程',
    summary: '课程、教程、论文和工程实践资源。',
    query: 'course tutorial awesome list machine learning',
    categories: ['learning'],
    tags: ['tutorial', 'awesome-list', 'course', 'machine-learning']
  }
];

const TASK_MATCHERS = {
  'build-agent': {
    primary: [
      {
        weight: 9,
        aliases: [
          'agent',
          'agents',
          'agentic',
          'ai agent',
          'ai agents',
          'autonomous agent',
          'multi agent',
          'multiagent',
          '智能体',
          '智能代理',
          '多智能体'
        ]
      },
      { weight: 8, aliases: ['mcp', 'model context protocol', '模型上下文协议'] },
      {
        weight: 8,
        aliases: [
          'tool use',
          'tool calling',
          'function calling',
          'computer use',
          'browser agent',
          '工具调用',
          '函数调用',
          '浏览器智能体'
        ]
      }
    ],
    secondary: [
      { weight: 3, aliases: ['orchestration', 'workflow', '编排', '工作流'] },
      { weight: 2, aliases: ['automation', 'browser automation', '自动化'] }
    ]
  },
  'ship-rag': {
    primary: [
      {
        weight: 10,
        aliases: ['rag', 'graphrag', 'retrieval augmented generation', '检索增强生成']
      },
      {
        weight: 9,
        aliases: [
          'vector database',
          'vector db',
          'vector store',
          'vector search',
          '向量数据库',
          '向量检索'
        ]
      },
      { weight: 8, aliases: ['embedding', 'embeddings', '嵌入模型', '向量嵌入'] },
      {
        weight: 8,
        aliases: [
          'semantic search',
          'document retrieval',
          'information retrieval',
          'knowledge base',
          '语义搜索',
          '文档检索',
          '知识库'
        ]
      }
    ],
    secondary: [
      { weight: 3, aliases: ['hybrid search', 'reranker', 'reranking', '混合检索', '重排'] },
      { weight: 2, aliases: ['document parsing', 'chunking', 'data pipeline', '文档解析', '分块'] }
    ]
  },
  'local-models': {
    primary: [
      {
        weight: 10,
        aliases: [
          'local llm',
          'local model',
          'local ai',
          '本地大模型',
          '本地模型',
          '本地部署',
          '本地运行'
        ]
      },
      {
        weight: 9,
        aliases: ['ollama', 'llama cpp', 'llamacpp', 'gguf', 'mlx', 'mlc llm']
      },
      {
        weight: 9,
        aliases: [
          'model serving',
          'model server',
          'inference server',
          'inference engine',
          'inference runtime',
          '模型服务',
          '推理服务',
          '推理引擎',
          '推理框架'
        ]
      },
      { weight: 7, aliases: ['inference', 'model inference', '模型推理'] },
      {
        weight: 9,
        aliases: ['on device ai', 'on device inference', 'edge ai', '端侧 ai', '端侧推理', '边缘 ai']
      },
      { weight: 8, aliases: ['vllm', 'sglang', 'tgi', 'tensorrt llm', 'openvino'] }
    ],
    secondary: [
      { weight: 3, aliases: ['quantization', 'gpu', 'cuda', 'accelerator', '量化', '加速'] },
      { weight: 2, aliases: ['llm', 'language model', 'serving', '大语言模型'] }
    ]
  },
  'multimodal-studio': {
    primary: [
      { weight: 10, aliases: ['multimodal', 'multi modal', 'vlm', 'vision language', '多模态', '视觉语言'] },
      {
        weight: 9,
        aliases: [
          'diffusion',
          'diffusion model',
          'image generation',
          'text to image',
          'image synthesis',
          'stable diffusion',
          '扩散模型',
          '图像生成',
          '文生图'
        ]
      },
      {
        weight: 9,
        aliases: [
          'video generation',
          'text to video',
          'image to video',
          'video synthesis',
          '视频生成',
          '文生视频',
          '图生视频'
        ]
      },
      {
        weight: 9,
        aliases: [
          'audio generation',
          'speech synthesis',
          'text to speech',
          'voice cloning',
          'music generation',
          'audio driven',
          '音频生成',
          '语音合成',
          '声音克隆',
          '音乐生成'
        ]
      }
    ],
    secondary: [
      { weight: 3, aliases: ['image', 'video', 'audio', 'speech', 'vision', '图像', '视频', '音频', '语音'] },
      { weight: 2, aliases: ['generative art', 'creative tools', '生成式艺术', '创作工具'] }
    ]
  },
  'developer-stack': {
    primary: [
      { weight: 10, aliases: ['developer tool', 'developer tools', 'devtool', 'devtools', '开发者工具', '开发工具'] },
      {
        weight: 10,
        aliases: [
          'code assistant',
          'coding assistant',
          'coding agent',
          'ai coding',
          'ai coder',
          'code generation',
          '代码助手',
          '编程助手',
          '编程智能体',
          '代码生成'
        ]
      },
      {
        weight: 9,
        aliases: ['claude code', 'cursor', 'github copilot', 'copilot', 'windsurf', 'aider', 'cline', 'codex cli']
      },
      { weight: 7, aliases: ['sdk', 'software development kit', '开发工具包'] },
      {
        weight: 8,
        aliases: ['ai ide', 'ide extension', 'vscode extension', 'jetbrains plugin', '编辑器插件', '开发环境']
      },
      { weight: 8, aliases: ['prompt engineering', 'prompt toolkit', '提示工程', '提示词工具'] }
    ],
    secondary: [
      { weight: 3, aliases: ['cli', 'api', 'automation', '命令行', '自动化'] },
      { weight: 2, aliases: ['code', 'coding', 'llm', '编程', '代码'] }
    ]
  },
  'learn-ai-engineering': {
    primary: [
      {
        weight: 10,
        aliases: ['tutorial', 'tutorials', 'course', 'courses', '教程', '课程', '入门指南', '学习路径']
      },
      {
        weight: 9,
        aliases: [
          'awesome',
          'awesome list',
          'awesome lists',
          'curated list',
          'resource list',
          '精选列表',
          '资源列表',
          '资源合集'
        ]
      },
      {
        weight: 8,
        aliases: ['cookbook', 'handbook', 'playbook', 'roadmap', 'guide', 'guides', 'book', 'books', '手册', '指南', '路线图', '教科书']
      },
      { weight: 8, aliases: ['papers', 'paper list', 'research papers', '论文合集', '论文列表', '论文资源'] },
      {
        weight: 7,
        aliases: ['examples', 'example collection', 'sample projects', '案例库', '示例项目', '实战案例']
      }
    ],
    secondary: [
      { weight: 3, aliases: ['ai engineering', 'machine learning', 'deep learning', '机器学习', '深度学习'] },
      { weight: 2, aliases: ['education', 'workshop', 'practice', '教学', '实践'] }
    ]
  }
};

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

function normalizeSemanticText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/([\p{Script=Han}])([a-z0-9])/gu, '$1 $2')
    .replace(/([a-z0-9])([\p{Script=Han}])/gu, '$1 $2')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function hasSemanticAlias(text, alias) {
  const normalizedAlias = normalizeSemanticText(alias);
  if (!text || !normalizedAlias) return false;
  if (/\p{Script=Han}/u.test(normalizedAlias)) return text.includes(normalizedAlias);
  return ` ${text} `.includes(` ${normalizedAlias} `);
}

function matchConcepts(searchFields, concepts) {
  const matches = [];

  for (const concept of concepts || []) {
    let bestMatch = null;
    for (const alias of concept.aliases || []) {
      for (const field of searchFields) {
        if (!hasSemanticAlias(field.text, alias)) continue;
        const match = {
          alias,
          score: concept.weight * field.weight
        };
        if (!bestMatch || match.score > bestMatch.score) bestMatch = match;
      }
    }
    if (bestMatch) matches.push(bestMatch);
  }

  return matches;
}

function taskSemanticMatch(record, task) {
  const configuredMatcher = TASK_MATCHERS[task.id];
  const fallbackTerms = uniqueTextList([...(task.tags || []), ...(task.query || '').split(/\s+/)], 20);
  const matcher = configuredMatcher || {
    primary: fallbackTerms.map(term => ({ weight: 8, aliases: [term] })),
    secondary: []
  };
  const searchFields = [
    {
      text: normalizeSemanticText([
        record.name,
        record.subcategory,
        ...(record.tags || []),
        ...(record.topics || [])
      ].join(' ')),
      weight: 1.15
    },
    {
      text: normalizeSemanticText(record.description),
      weight: 1
    }
  ];
  const primaryMatches = matchConcepts(searchFields, matcher.primary);
  if (!primaryMatches.length) {
    return { eligible: false, score: 0, primaryHits: 0, secondaryHits: 0 };
  }

  const secondaryMatches = matchConcepts(searchFields, matcher.secondary);
  const primaryScore = primaryMatches.reduce((sum, match) => sum + match.score, 0);
  const secondaryScore = secondaryMatches.reduce((sum, match) => sum + match.score, 0);
  return {
    eligible: true,
    score: primaryScore + Math.min(7, secondaryScore) + Math.min(6, (primaryMatches.length - 1) * 2),
    primaryHits: primaryMatches.length,
    secondaryHits: secondaryMatches.length
  };
}

function taskMatchScore(record, task, semanticMatch = taskSemanticMatch(record, task)) {
  if (!semanticMatch.eligible) return 0;
  const categoryBonus = task.categories?.includes(record.categoryId) ? 7 : 0;
  const qualityBonus =
    (record.scores?.potential || 0) * 0.12 +
    (record.scores?.maturity || 0) * 0.04 +
    (record.scores?.freshness || 0) * 0.03 +
    Math.log10((record.stars || 0) + 1) * 1.5;
  return semanticMatch.score + categoryBonus + qualityBonus;
}

function chooseDiverseTaskProjects(candidates, usedIds, rankFn, preferredFilters, limit = 4) {
  const selected = [];
  const selectedIds = new Set();
  const categoryCounts = new Map();
  const subcategoryCounts = new Map();
  const ownerCounts = new Map();
  const filters = [...preferredFilters, () => true];

  for (const filterFn of filters) {
    while (selected.length < limit) {
      let best = null;
      let bestScore = -Infinity;

      for (const candidate of candidates) {
        const { record } = candidate;
        if (usedIds.has(record.id) || selectedIds.has(record.id) || !filterFn(candidate)) continue;
        const diversityPenalty =
          (categoryCounts.get(record.categoryId) || 0) * 7 +
          (subcategoryCounts.get(normalizeText(record.subcategory)) || 0) * 5 +
          (ownerCounts.get(normalizeText(record.owner)) || 0) * 10;
        const adjustedScore = rankFn(candidate) - diversityPenalty;
        if (
          adjustedScore > bestScore ||
          (adjustedScore === bestScore && record.id.localeCompare(best?.record.id || '') < 0)
        ) {
          best = candidate;
          bestScore = adjustedScore;
        }
      }

      if (!best) break;
      const { record } = best;
      selected.push(record);
      selectedIds.add(record.id);
      categoryCounts.set(record.categoryId, (categoryCounts.get(record.categoryId) || 0) + 1);
      const subcategory = normalizeText(record.subcategory);
      subcategoryCounts.set(subcategory, (subcategoryCounts.get(subcategory) || 0) + 1);
      const owner = normalizeText(record.owner);
      ownerCounts.set(owner, (ownerCounts.get(owner) || 0) + 1);
    }
    if (selected.length >= limit) break;
  }

  for (const record of selected) usedIds.add(record.id);
  return selected.map(compactProject);
}

function buildTaskPaths(records, nowMs = Date.now()) {
  return TASKS.map(task => {
    const candidates = records
      .map(record => {
        const semanticMatch = taskSemanticMatch(record, task);
        return {
          record,
          semanticMatch,
          score: taskMatchScore(record, task, semanticMatch)
        };
      })
      .filter(candidate => candidate.semanticMatch.eligible);
    const rankBalanced = candidate =>
      candidate.score +
      (candidate.record.scores?.potential || 0) * 0.32 +
      (candidate.record.scores?.focus || 0) * 0.08;
    const rankProduction = candidate =>
      candidate.score +
      (candidate.record.scores?.maturity || 0) * 0.46 +
      (candidate.record.scores?.freshness || 0) * 0.08 +
      Math.log10((candidate.record.stars || 0) + 1) * 5;
    const rankFresh = candidate =>
      candidate.score +
      (candidate.record.scores?.freshness || 0) * 0.48 +
      newnessScore(candidate.record, nowMs) * 0.18 +
      (candidate.record.scores?.potential || 0) * 0.12;
    const rankHidden = candidate => {
      const popularityDiscount = Math.max(0, 32 - Math.log10((candidate.record.stars || 0) + 10) * 7);
      return (
        candidate.score +
        (candidate.record.scores?.potential || 0) * 0.34 +
        (candidate.record.scores?.freshness || 0) * 0.22 +
        (candidate.record.scores?.focus || 0) * 0.12 +
        popularityDiscount
      );
    };

    const inTaskCategory = candidate => task.categories?.includes(candidate.record.categoryId);
    const usedIds = new Set();
    const balanced = chooseDiverseTaskProjects(candidates, usedIds, rankBalanced, [() => true]);
    const production = chooseDiverseTaskProjects(
      candidates,
      usedIds,
      rankProduction,
      [
        candidate =>
          inTaskCategory(candidate) &&
          candidate.record.health === 'Active' &&
          (candidate.record.stars >= 5000 || (candidate.record.scores?.maturity || 0) >= 80),
        candidate =>
          candidate.record.health === 'Active' &&
          (candidate.record.stars >= 5000 || (candidate.record.scores?.maturity || 0) >= 80),
        candidate => candidate.record.stars >= 1000 || (candidate.record.scores?.maturity || 0) >= 72
      ]
    );
    const fresh = chooseDiverseTaskProjects(
      candidates,
      usedIds,
      rankFresh,
      [
        candidate => inTaskCategory(candidate) && daysSince(candidate.record.lastUpdated, nowMs) <= 30,
        candidate => daysSince(candidate.record.lastUpdated, nowMs) <= 30,
        candidate => daysSince(candidate.record.lastUpdated, nowMs) <= 60
      ]
    );
    const hidden = chooseDiverseTaskProjects(
      candidates,
      usedIds,
      rankHidden,
      [
        candidate =>
          inTaskCategory(candidate) &&
          candidate.record.stars < 5000 &&
          (candidate.record.scores?.potential || 0) >= 58 &&
          (candidate.record.scores?.freshness || 0) >= 58,
        candidate =>
          candidate.record.stars < 5000 &&
          (candidate.record.scores?.potential || 0) >= 58 &&
          (candidate.record.scores?.freshness || 0) >= 58,
        candidate => candidate.record.stars < 15000 && (candidate.record.scores?.potential || 0) >= 50
      ]
    );

    return {
      ...task,
      total: candidates.length,
      tracks: [
        {
          id: 'balanced',
          label: '推荐',
          description: '综合排序。',
          projects: balanced
        },
        {
          id: 'production',
          label: '成熟项目',
          description: '维护稳定、使用较多。',
          projects: production
        },
        {
          id: 'fresh',
          label: '最近更新',
          description: '近期有更新。',
          projects: fresh
        },
        {
          id: 'hidden',
          label: '小众项目',
          description: '关注度较低但仍活跃。',
          projects: hidden
        }
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
  if (category === 'agents') return '智能体框架、工具调用和自动化工作流。';
  if (category === 'rag_data') return '知识库、文档检索和 GraphRAG。';
  if (category === 'llms') return '模型、开源权重和本地推理。';
  if (category === 'infrastructure') return '部署、推理和模型服务。';
  if (category === 'devtools') return 'AI 编程、SDK 和开发自动化。';
  if (category === 'multimodal') return '图像、语音、视频和多模态生成。';
  if (category === 'learning' || tags.includes('tutorial') || tags.includes('awesome-list')) {
    return '课程、教程、案例和学习资源。';
  }
  return '查看同类项目，比较功能和更新。';
}

function describeCaution(record) {
  const cautions = [];
  if ((record.stars || 0) < 1000) cautions.push('Stars 较少，先看 README、issue 和 release。');
  if (daysSince(record.lastUpdated, Date.now()) > 90) cautions.push('最近更新较少，可作为备选。');
  if (!record.topics?.length) cautions.push('GitHub topics 较少，结合简介判断。');
  if ((record.tags || []).length <= 2) cautions.push('标签较少，打开 GitHub 确认项目范围。');
  return cautions.slice(0, 3);
}

function describeNextSteps(record) {
  const steps = ['先看 README、示例和最近提交。'];
  if (record.categoryId === 'agents' || record.categoryId === 'rag_data') {
    steps.push('和同类项目比较集成难度。');
  } else {
    steps.push('看看相关项目，了解项目定位。');
  }
  if ((record.tags || []).length) {
    steps.push(`点击 ${record.tags.slice(0, 2).join(' / ')} 查看同类项目。`);
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
