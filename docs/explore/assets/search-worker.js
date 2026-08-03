let catalog = [];
let configuredSynonyms = {};

self.addEventListener('message', event => {
  const { type, catalog: nextCatalog, payload, seq, synonyms } = event.data || {};

  if (type === 'init') {
    catalog = Array.isArray(nextCatalog) ? nextCatalog : [];
    configuredSynonyms = synonyms && typeof synonyms === 'object' ? synonyms : {};
    return;
  }

  if (type !== 'search') return;

  const results = searchCatalog(catalog, payload || {});
  self.postMessage({
    type: 'results',
    seq,
    total: results.length,
    ids: results.map(project => project.id)
  });
});

function searchCatalog(records, payload) {
  const query = normalize(payload.query);
  const expandedTerms = expandTerms(query);
  const category = payload.category || 'all';
  const subcategory = normalize(payload.subcategory || 'all');
  const tag = normalize(payload.tag || 'all');
  const freshnessDays = parseFreshness(payload.freshness);
  const minStars = parseInt(payload.stars || '0', 10) || 0;

  const scored = [];
  for (const project of records) {
    if (category !== 'all' && project.categoryId !== category) continue;
    if (subcategory !== 'all' && normalize(project.subcategory) !== subcategory) continue;
    if (minStars && (project.stars || 0) < minStars) continue;
    if (freshnessDays && daysSince(project.lastUpdated) > freshnessDays) continue;
    if (tag !== 'all') {
      const hasTag = [...(project.tags || []), ...(project.topics || [])].some(value => normalize(value) === tag);
      if (!hasTag) continue;
    }

    const score = scoreProject(project, expandedTerms, query);
    if (expandedTerms.length && score <= 0) continue;
    scored.push([project, score]);
  }

  scored.sort((a, b) => sortProjects(a[0], b[0], payload.sort, b[1] - a[1], payload.lens));
  return scored.map(([project]) => project);
}

function expandTerms(query) {
  if (!query) return [];
  const terms = query.split(/\s+/).filter(Boolean);
  const expansions = {
    ...configuredSynonyms,
    智能体: ['agent', 'agents', 'ai-agent', 'autonomous-agent', 'tool-use'],
    知识库: ['rag', 'retrieval', 'embedding', 'vector'],
    本地模型: ['local', 'ollama', 'inference'],
    微调: ['finetuning', 'fine-tuning', 'training', 'lora'],
    多模态: ['multimodal', 'image', 'video', 'audio', 'diffusion'],
    开发工具: ['developer-tools', 'sdk', 'code', 'assistant']
  };

  for (const [key, values] of Object.entries(expansions)) {
    if (query.includes(key)) terms.push(...values);
  }

  return [...new Set(terms)];
}

function scoreProject(project, terms, query) {
  if (!terms.length) return 1;
  const name = normalize(project.name);
  const description = normalize(project.description);
  const category = normalize(project.categoryCleanName || project.categoryName);
  const subcategory = normalize(project.subcategory);
  const tags = (project.tags || []).map(normalize);
  const topics = (project.topics || []).map(normalize);
  const haystack = [name, description, category, subcategory, ...tags, ...topics].join(' ');
  let score = 0;

  if (name === query) score += 80;
  if (name.includes(query)) score += 38;
  if (category.includes(query) || subcategory.includes(query)) score += 12;

  for (const term of terms) {
    if (!term) continue;
    if (name.includes(term)) score += 18;
    if (tags.some(tag => tag === term || tag.includes(term))) score += 14;
    if (topics.some(topic => topic === term || topic.includes(term))) score += 10;
    if (category.includes(term) || subcategory.includes(term)) score += 7;
    if (description.includes(term)) score += 5;
    if (haystack.includes(term)) score += 2;
  }

  return score;
}

function sortProjects(a, b, sort, relevanceDelta, lens = 'balanced') {
  if (sort === 'relevance' && relevanceDelta) return relevanceDelta;
  if (sort === 'recent') return dateMs(b.lastUpdated) - dateMs(a.lastUpdated) || b.stars - a.stars;
  if (sort === 'stars') return b.stars - a.stars || dateMs(b.lastUpdated) - dateMs(a.lastUpdated);
  if (sort === 'new') return dateMs(b.addedAt) - dateMs(a.addedAt) || (b.scores?.potential || 0) - (a.scores?.potential || 0);
  return getLensScore(b, lens) - getLensScore(a, lens) || b.stars - a.stars;
}

function getLensScore(project, lens = 'balanced') {
  const scores = project.scores || {};
  const stars = Math.min(100, Math.log10((project.stars || 0) + 1) * 18);
  const freshness = scores.freshness || Math.max(0, 100 - daysSince(project.lastUpdated) * 0.65);
  const potential = scores.potential || 0;
  const maturity = scores.maturity || 0;
  const focus = scores.focus || 0;
  const topicSignal = scores.topicSignal || 0;

  if (lens === 'production') return maturity * 0.38 + freshness * 0.22 + focus * 0.16 + stars * 0.19 + potential * 0.05;
  if (lens === 'fresh') return freshness * 0.58 + potential * 0.22 + focus * 0.12 + topicSignal * 0.08;
  if (lens === 'hidden') {
    const lowExposure = Math.max(0, 100 - stars);
    return potential * 0.32 + focus * 0.25 + freshness * 0.2 + lowExposure * 0.2 + topicSignal * 0.03;
  }
  return potential * 0.4 + freshness * 0.2 + maturity * 0.18 + focus * 0.12 + stars * 0.1;
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}#+._-]+/gu, ' ')
    .trim();
}

function dateMs(value) {
  const time = new Date(value || '').getTime();
  return Number.isFinite(time) ? time : 0;
}

function daysSince(value) {
  const time = dateMs(value);
  if (!time) return 9999;
  return Math.max(0, Math.round((Date.now() - time) / 86400000));
}

function parseFreshness(value) {
  if (value === '30d') return 30;
  if (value === '90d') return 90;
  if (value === '180d') return 180;
  return 0;
}
