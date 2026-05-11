const DATA_BASE = './data/';
const ROUTES = new Set(['radar', 'explore', 'compare', 'saved']);
const STORE_KEYS = {
  saved: 'hello-ai-explore-saved',
  compare: 'hello-ai-explore-compare',
  recent: 'hello-ai-explore-recent'
};

const els = {
  main: document.querySelector('#appMain'),
  search: document.querySelector('#globalSearch'),
  stats: document.querySelector('#statStrip'),
  quick: document.querySelector('#quickStrip'),
  drawer: document.querySelector('#detailDrawer'),
  backdrop: document.querySelector('#drawerBackdrop'),
  tray: document.querySelector('#compareTray'),
  toast: document.querySelector('#toast')
};

const state = {
  route: 'radar',
  query: '',
  category: 'all',
  subcategory: 'all',
  tag: 'all',
  freshness: 'all',
  stars: 'all',
  sort: 'potential',
  visible: 48,
  stats: null,
  facets: null,
  radar: null,
  catalog: null,
  catalogById: new Map(),
  details: null,
  related: null,
  results: [],
  total: 0,
  resultsStale: true,
  selectedId: null,
  saved: new Set(readStoredList(STORE_KEYS.saved)),
  compare: readStoredList(STORE_KEYS.compare).slice(0, 4),
  recent: readStoredList(STORE_KEYS.recent).slice(0, 24)
};

let catalogPromise = null;
let detailPromise = null;
let searchWorker = null;
let searchSeq = 0;
let toastTimer = null;

init();

function init() {
  readHash();
  bindEvents();
  render();
  loadBaseData();
}

async function loadBaseData() {
  try {
    const [stats, facets, radar] = await Promise.all([
      loadJson('stats.json'),
      loadJson('facets.json'),
      loadJson('radar.json')
    ]);
    state.stats = stats;
    state.facets = facets;
    state.radar = radar;
    render();
  } catch (error) {
    els.main.innerHTML = renderEmptyState('探索数据尚未生成', '请先运行 npm run explore:generate-data');
    console.error(error);
  }
}

function bindEvents() {
  window.addEventListener('hashchange', () => {
    readHash();
    state.resultsStale = true;
    render();
  });

  els.search.addEventListener('input', () => {
    state.query = els.search.value.trim();
    state.route = 'explore';
    state.visible = 48;
    state.resultsStale = true;
    writeHash(true);
    render();
  });

  document.addEventListener('keydown', event => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    const active = document.activeElement;
    if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;
    event.preventDefault();
    els.search.focus();
  });

  document.addEventListener('click', event => {
    const routeButton = event.target.closest('[data-route]');
    if (routeButton) {
      setRoute(routeButton.dataset.route);
      return;
    }

    const action = event.target.closest('[data-action]');
    if (!action) return;

    const id = action.dataset.id;
    switch (action.dataset.action) {
      case 'task':
        state.query = action.dataset.query || '';
        state.category = action.dataset.category || 'all';
        state.subcategory = 'all';
        state.tag = 'all';
        state.freshness = 'all';
        state.stars = 'all';
        setRoute('explore', { resultsStale: true, visible: 48 });
        break;
      case 'quick-query':
        state.query = action.dataset.query || '';
        state.category = action.dataset.category || 'all';
        state.subcategory = 'all';
        state.tag = action.dataset.tag || 'all';
        state.freshness = action.dataset.freshness || 'all';
        state.stars = action.dataset.stars || 'all';
        setRoute('explore', { resultsStale: true, visible: 48 });
        break;
      case 'category':
        state.category = action.dataset.value || 'all';
        state.subcategory = 'all';
        state.tag = 'all';
        state.freshness = 'all';
        state.stars = 'all';
        setRoute('explore', { resultsStale: true, visible: 48 });
        break;
      case 'filter':
        state[action.dataset.filter] = action.dataset.value || 'all';
        state.visible = 48;
        state.resultsStale = true;
        writeHash(true);
        render();
        break;
      case 'clear-filters':
        state.query = '';
        state.category = 'all';
        state.subcategory = 'all';
        state.tag = 'all';
        state.freshness = 'all';
        state.stars = 'all';
        state.sort = 'potential';
        state.visible = 48;
        state.resultsStale = true;
        writeHash(true);
        render();
        break;
      case 'sort':
        break;
      case 'load-more':
        state.visible += 48;
        render();
        break;
      case 'detail':
        if (id) openDetail(id);
        break;
      case 'save':
        if (id) toggleSaved(id);
        break;
      case 'compare':
        if (id) toggleCompare(id);
        break;
      case 'remove-compare':
        if (id) removeCompare(id);
        break;
      case 'open-compare':
        setRoute('compare');
        break;
      case 'close-drawer':
        closeDrawer();
        break;
      case 'export-saved':
        exportProjects([...state.saved], 'hello-ai-saved.md');
        break;
      case 'export-compare':
        exportProjects(state.compare, 'hello-ai-compare.md');
        break;
      case 'copy-link':
        copyCurrentLink();
        break;
      case 'copy-brief':
        copyResultBrief();
        break;
      case 'copy-project':
        if (id) copyProjectMarkdown(id);
        break;
      case 'tag':
        state.tag = action.dataset.value || 'all';
        setRoute('explore', { resultsStale: true, visible: 48 });
        break;
      default:
        break;
    }
  });

  document.addEventListener('change', event => {
    const sort = event.target.closest('#sortSelect');
    if (!sort) return;
    state.sort = sort.value;
    state.visible = 48;
    state.resultsStale = true;
    writeHash(true);
    render();
  });

  els.backdrop.addEventListener('click', closeDrawer);
}

async function loadJson(file) {
  const response = await fetch(`${DATA_BASE}${file}`);
  if (!response.ok) throw new Error(`Failed to load ${file}: ${response.status}`);
  return response.json();
}

async function ensureCatalog() {
  if (state.catalog) return state.catalog;
  if (!catalogPromise) {
    catalogPromise = loadJson('catalog-lite.json').then(catalog => {
      state.catalog = catalog;
      state.catalogById = new Map(catalog.map(project => [project.id, project]));
      setupWorker(catalog);
      return catalog;
    });
  }
  return catalogPromise;
}

async function ensureDetails() {
  if (state.details && state.related) return;
  if (!detailPromise) {
    detailPromise = Promise.all([loadJson('project-details.json'), loadJson('related.json')]).then(
      ([details, related]) => {
        state.details = details;
        state.related = related;
      }
    );
  }
  return detailPromise;
}

function setupWorker(catalog) {
  if (searchWorker || !window.Worker) return;
  try {
    searchWorker = new Worker('./assets/search-worker.js');
    searchWorker.postMessage({ type: 'init', catalog });
    searchWorker.addEventListener('message', event => {
      const { type, seq, ids, total } = event.data || {};
      if (type !== 'results' || seq !== searchSeq) return;
      state.results = ids;
      state.total = total;
      state.resultsStale = false;
      if (state.route === 'explore') render();
    });
  } catch (error) {
    searchWorker = null;
    console.warn('Search worker unavailable; using main-thread search.', error);
  }
}

function readHash() {
  const raw = window.location.hash.replace(/^#/, '');
  const [routePart, paramsPart] = raw.split('?');
  const route = ROUTES.has(routePart) ? routePart : 'radar';
  const params = new URLSearchParams(paramsPart || '');

  state.route = route;
  state.query = params.get('q') || '';
  state.category = params.get('category') || 'all';
  state.subcategory = params.get('subcategory') || 'all';
  state.tag = params.get('tag') || 'all';
  state.freshness = params.get('freshness') || 'all';
  state.stars = params.get('stars') || 'all';
  state.sort = params.get('sort') || 'potential';
  els.search.value = state.query;
}

function writeHash(replace = false) {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.category !== 'all') params.set('category', state.category);
  if (state.subcategory !== 'all') params.set('subcategory', state.subcategory);
  if (state.tag !== 'all') params.set('tag', state.tag);
  if (state.freshness !== 'all') params.set('freshness', state.freshness);
  if (state.stars !== 'all') params.set('stars', state.stars);
  if (state.sort !== 'potential') params.set('sort', state.sort);

  const nextHash = `#${state.route}${params.toString() ? `?${params}` : ''}`;
  if (window.location.hash === nextHash) return;
  if (replace) history.replaceState(null, '', nextHash);
  else history.pushState(null, '', nextHash);
}

function setRoute(route, patch = {}) {
  if (!ROUTES.has(route)) return;
  Object.assign(state, patch, { route });
  if (state.selectedId) closeDrawer();
  writeHash();
  render();
}

function render() {
  renderNav();
  renderStats();
  renderQuickStrip();
  els.search.value = state.query;

  if (!state.stats || !state.facets || !state.radar) {
    els.main.innerHTML = renderLoading('正在加载探索雷达');
    renderCompareTray();
    return;
  }

  if (state.route === 'radar') renderRadar();
  if (state.route === 'explore') renderExplorer();
  if (state.route === 'compare') renderCompare();
  if (state.route === 'saved') renderSaved();
  renderCompareTray();
}

function renderNav() {
  document.querySelectorAll('[data-route]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.route === state.route);
  });
}

function renderStats() {
  if (!state.stats) {
    els.stats.innerHTML = '';
    return;
  }

  const updated = formatDate(state.stats.generatedAt);
  els.stats.innerHTML = [
    ['Collected', formatNumber(state.stats.totalRawProjects)],
    ['Active', formatNumber(state.stats.totalActiveProjects)],
    ['Categories', Object.keys(state.stats.categories || {}).length],
    ['Updated', updated]
  ]
    .map(([label, value]) => `<span class="stat-pill">${escapeHtml(label)} <strong>${escapeHtml(value)}</strong></span>`)
    .join('');
}

function renderQuickStrip() {
  if (!els.quick) return;
  const quickQueries = [
    { label: 'MCP', query: 'mcp server agent', tag: 'MCP' },
    { label: 'RAG', query: 'rag vector database retrieval', category: 'rag_data' },
    { label: 'Claude Code', query: 'claude code coding assistant', tag: 'claude-code' },
    { label: '本地模型', query: 'local llm ollama inference', category: 'infrastructure' },
    { label: '最近 30 天', query: '', freshness: '30d' },
    { label: '高星精选', query: '', stars: '50000' }
  ];

  els.quick.innerHTML = quickQueries
    .map(
      item => `
        <button
          class="quick-chip"
          type="button"
          data-action="quick-query"
          data-query="${attr(item.query || '')}"
          data-category="${attr(item.category || 'all')}"
          data-tag="${attr(item.tag || 'all')}"
          data-freshness="${attr(item.freshness || 'all')}"
          data-stars="${attr(item.stars || 'all')}"
        >${escapeHtml(item.label)}</button>
      `
    )
    .join('');
}

function renderRadar() {
  const tasks = state.radar.taskPaths || state.radar.tasks || [];
  const categories = state.facets.categories || [];
  const lists = state.radar.lists || {};
  const insights = state.radar.categoryInsights || [];

  els.main.innerHTML = `
    <section class="section-band">
      <div class="section-heading">
        <div>
          <h2>任务路径</h2>
          <p>${formatNumber(state.stats.totalActiveProjects)} 个近期活跃项目，按目标切入并直接给出候选组合。</p>
        </div>
      </div>
      <div class="path-grid">
        ${tasks.slice(0, 6).map(task => renderPathCard(task)).join('')}
      </div>
    </section>

    <section class="section-band">
      <div class="section-heading">
        <div>
          <h2>赛道概览</h2>
          <p>按活跃项目数量排序。</p>
        </div>
      </div>
      <div class="category-grid">
        ${categories
          .filter(category => category.id !== 'trending')
          .sort((a, b) => b.count - a.count)
          .map(
            category => {
              const insight = insights.find(item => item.categoryId === category.id);
              return `
              <button class="category-tile" type="button" data-action="category" data-value="${attr(category.id)}">
                <strong>${escapeHtml(`${category.icon ? `${category.icon} ` : ''}${category.cleanName}`)}</strong>
                <span>${formatNumber(category.count)} active / ${formatNumber(category.rawCount)} total</span>
                ${
                  insight?.topTags?.length
                    ? `<small>${insight.topTags.slice(0, 3).map(tag => escapeHtml(tag.label)).join(' / ')}</small>`
                    : ''
                }
              </button>
            `;
            }
          )
          .join('')}
      </div>
    </section>

    <section class="section-band">
      <div class="section-heading">
        <div>
          <h2>今日雷达</h2>
          <p>活跃、潜力、高星和新收录项目。</p>
        </div>
        <div class="view-switch">
          <button class="chip" type="button" data-route="explore">进入 Explorer</button>
        </div>
      </div>
      <div class="radar-grid">
        ${renderListLane('潜力信号', 'Discovery Signal', lists.potential || [])}
        ${renderListLane('最近活跃', 'Fresh Activity', lists.recent || [])}
        ${renderListLane('高星必看', 'High Star Picks', lists.highStar || [])}
        ${renderListLane('新收录', 'New Entries', lists.newProjects || [])}
      </div>
    </section>
  `;
}

function renderPathCard(task) {
  const primaryCategory = task.categories?.[0] || 'all';
  return `
    <article class="path-card">
      <header>
        <div>
          <span class="eyebrow">${formatNumber(task.total || 0)} candidates</span>
          <h3>${escapeHtml(task.title)}</h3>
        </div>
        <button class="action-button" type="button" data-action="task" data-query="${attr(task.query)}" data-category="${attr(primaryCategory)}">探索</button>
      </header>
      <p>${escapeHtml(task.summary || task.query)}</p>
      <div class="path-tracks">
        ${(task.tracks || [])
          .map(track => {
            const projects = (track.projects || []).slice(0, 2);
            const overflow = Math.max(0, (track.projects || []).length - projects.length);
            return `
              <div class="path-track">
                <div class="path-track-label">
                  <span>${escapeHtml(track.label)}</span>
                  <small>${formatNumber(track.projects?.length || 0)}</small>
                </div>
                <div class="path-track-actions">
                  ${projects
                    .map(
                      project => `
                        <button type="button" data-action="detail" data-id="${attr(project.id)}">
                          ${escapeHtml(project.name)}
                        </button>
                      `
                    )
                    .join('')}
                  ${
                    overflow > 0
                      ? `<button type="button" class="path-more" data-action="task" data-query="${attr(task.query)}" data-category="${attr(primaryCategory)}">+${formatNumber(overflow)} more</button>`
                      : ''
                  }
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    </article>
  `;
}

function renderListLane(title, subtitle, projects) {
  return `
    <div class="list-lane">
      <div class="section-heading">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(subtitle)}</p>
        </div>
      </div>
      <div class="project-grid compact">
        ${projects.slice(0, 6).map(project => renderProjectCard(project)).join('')}
      </div>
    </div>
  `;
}

function renderExplorer() {
  const filterPanel = renderFilterPanel();
  let resultsHtml = renderLoading('正在加载项目索引');

  if (!state.catalog) {
    ensureCatalog().then(() => {
      state.resultsStale = true;
      render();
    });
  } else if (state.resultsStale) {
    runSearch();
    resultsHtml = renderLoading('正在计算匹配项目');
  } else {
    resultsHtml = renderResults();
  }

  els.main.innerHTML = `
    <section class="explore-layout">
      ${filterPanel}
      <div class="result-panel">
        <div class="sort-bar">
          <div>
            <div class="result-count">${escapeHtml(renderResultLabel())}</div>
            ${renderActiveFilters()}
          </div>
          <select id="sortSelect" aria-label="排序">
            ${[
              ['potential', '潜力信号'],
              ['relevance', '相关度'],
              ['recent', '最近活跃'],
              ['stars', 'Stars'],
              ['new', '新收录']
            ]
              .map(([value, label]) => `<option value="${value}" ${state.sort === value ? 'selected' : ''}>${label}</option>`)
              .join('')}
          </select>
        </div>
        ${renderResultBrief()}
        ${resultsHtml}
      </div>
    </section>
  `;
}

function renderActiveFilters() {
  const labels = [];
  if (state.query) labels.push(`q: ${state.query}`);
  if (state.category !== 'all') {
    const cat = state.facets.categories?.find(category => category.id === state.category);
    labels.push(cat?.cleanName || state.category);
  }
  if (state.subcategory !== 'all') labels.push(state.subcategory);
  if (state.tag !== 'all') labels.push(`#${state.tag}`);
  if (state.freshness !== 'all') labels.push(state.freshness.replace('d', ' 天内'));
  if (state.stars !== 'all') labels.push(`${formatStars(Number(state.stars))}+ stars`);
  if (!labels.length) return '';
  return `<div class="active-filters">${labels.map(label => `<span>${escapeHtml(label)}</span>`).join('')}</div>`;
}

function renderFilterPanel() {
  const categories = state.facets.categories || [];
  const activeCategory = categories.find(category => category.id === state.category);
  const subcategories =
    state.category !== 'all' && activeCategory
      ? (activeCategory.subcategories || []).map(label => ({ id: label, label, count: null }))
      : (state.facets.subcategories || []).slice(0, 18);
  const tags = (state.facets.tags || []).slice(0, 28);

  return `
    <aside class="filter-panel" aria-label="Filters">
      <div class="filter-group">
        <h3>分类</h3>
        <div class="filter-row">
          ${renderFilterChip('category', 'all', '全部', state.category === 'all')}
          ${categories
            .filter(category => category.id !== 'trending')
            .map(category =>
              renderFilterChip(
                'category',
                category.id,
                `${category.icon ? `${category.icon} ` : ''}${category.cleanName}`,
                state.category === category.id
              )
            )
            .join('')}
        </div>
      </div>

      <div class="filter-group">
        <h3>子类</h3>
        <div class="filter-row">
          ${renderFilterChip('subcategory', 'all', '全部', state.subcategory === 'all')}
          ${subcategories
            .map(item => renderFilterChip('subcategory', item.id || item.label, item.label, state.subcategory === (item.id || item.label)))
            .join('')}
        </div>
      </div>

      <div class="filter-group">
        <h3>标签</h3>
        <div class="filter-row">
          ${renderFilterChip('tag', 'all', '全部', state.tag === 'all')}
          ${tags.map(tag => renderFilterChip('tag', tag.label, tag.label, normalize(state.tag) === normalize(tag.label))).join('')}
        </div>
      </div>

      <div class="filter-group">
        <h3>活跃度</h3>
        <div class="filter-row">
          ${renderFilterChip('freshness', 'all', '全部', state.freshness === 'all')}
          ${renderFilterChip('freshness', '30d', '30 天内', state.freshness === '30d')}
          ${renderFilterChip('freshness', '90d', '90 天内', state.freshness === '90d')}
          ${renderFilterChip('freshness', '180d', '半年内', state.freshness === '180d')}
        </div>
      </div>

      <div class="filter-group">
        <h3>Stars</h3>
        <div class="filter-row">
          ${renderFilterChip('stars', 'all', '全部', state.stars === 'all')}
          ${renderFilterChip('stars', '500', '500+', state.stars === '500')}
          ${renderFilterChip('stars', '5000', '5k+', state.stars === '5000')}
          ${renderFilterChip('stars', '50000', '50k+', state.stars === '50000')}
        </div>
      </div>

      <button class="chip" type="button" data-action="clear-filters">清空条件</button>
    </aside>
  `;
}

function renderFilterChip(filter, value, label, active) {
  return `
    <button
      class="chip ${active ? 'is-active' : ''}"
      type="button"
      data-action="filter"
      data-filter="${attr(filter)}"
      data-value="${attr(value)}"
    >${escapeHtml(label)}</button>
  `;
}

function runSearch() {
  if (!state.catalog) return;
  const payload = {
    query: state.query,
    category: state.category,
    subcategory: state.subcategory,
    tag: state.tag,
    freshness: state.freshness,
    stars: state.stars,
    sort: state.sort
  };

  const seq = ++searchSeq;
  if (searchWorker) {
    searchWorker.postMessage({ type: 'search', seq, payload });
    return;
  }

  const ids = searchCatalog(state.catalog, payload).map(project => project.id);
  if (seq !== searchSeq) return;
  state.results = ids;
  state.total = ids.length;
  state.resultsStale = false;
  render();
}

function renderResults() {
  const visibleIds = state.results.slice(0, state.visible);
  const projects = visibleIds.map(id => state.catalogById.get(id)).filter(Boolean);
  if (!projects.length) {
    return renderEmptyState('没有匹配项目', '换一个关键词或减少筛选条件。');
  }

  const more = state.visible < state.results.length;
  return `
    <div class="project-grid">
      ${projects.map(project => renderProjectCard(project, { showMatchHints: true })).join('')}
    </div>
    ${more ? '<button class="load-more" type="button" data-action="load-more">加载更多</button>' : ''}
  `;
}

function renderResultLabel() {
  if (!state.catalog) return '索引加载中';
  if (state.resultsStale) return '匹配中';
  return `${formatNumber(state.total)} 个匹配项目`;
}

function renderResultBrief() {
  if (!state.catalog || state.resultsStale || !state.results.length) return '';

  const projects = getCurrentResultProjects();
  const highlights = pickResultHighlights(projects);
  if (!highlights.length) return '';

  const filterSummary = renderReadableFilterSummary();
  return `
    <section class="brief-panel" aria-label="Explorer result brief">
      <div class="brief-header">
        <div>
          <span class="eyebrow">SELECTION BRIEF</span>
          <h2>选型简报</h2>
          <p>${escapeHtml(filterSummary || '从当前匹配结果中提取最值得先看的项目。')}</p>
        </div>
        <div class="brief-actions">
          <button class="action-button" type="button" data-action="copy-link">复制链接</button>
          <button class="action-button" type="button" data-action="copy-brief">复制简报</button>
        </div>
      </div>
      <div class="brief-grid">
        ${highlights.map(renderBriefCard).join('')}
      </div>
    </section>
  `;
}

function renderBriefCard(item) {
  const project = item.project;
  return `
    <button class="brief-card" type="button" data-action="detail" data-id="${attr(project.id)}">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(project.name)}</strong>
      <small>${escapeHtml(item.reason)}</small>
    </button>
  `;
}

function pickResultHighlights(projects) {
  const used = new Set();
  const picks = [];
  const addPick = (label, reason, sortedProjects) => {
    const project = sortedProjects.find(item => !used.has(item.id));
    if (!project) return;
    used.add(project.id);
    picks.push({ label, reason: reason(project), project });
  };

  addPick(
    '最值得先试',
    project => `${project.scores?.potential ?? '-'} signal / ${formatStars(project.stars)} stars`,
    [...projects].sort((a, b) => (b.scores?.potential || 0) - (a.scores?.potential || 0) || b.stars - a.stars)
  );
  addPick(
    '最近还在动',
    project => `${formatDate(project.lastUpdated)} 更新 / ${formatStars(project.stars)} stars`,
    [...projects].sort((a, b) => dateMs(b.lastUpdated) - dateMs(a.lastUpdated) || (b.scores?.potential || 0) - (a.scores?.potential || 0))
  );
  addPick(
    '成熟样本',
    project => `${formatStars(project.stars)} stars / ${project.categoryCleanName || project.categoryName}`,
    [...projects].sort((a, b) => b.stars - a.stars || dateMs(b.lastUpdated) - dateMs(a.lastUpdated))
  );

  return picks;
}

function getCurrentResultProjects(limit = state.results.length) {
  return state.results
    .slice(0, limit)
    .map(id => state.catalogById.get(id))
    .filter(Boolean);
}

function renderReadableFilterSummary() {
  const labels = [];
  if (state.query) labels.push(`关键词 ${state.query}`);
  if (state.category !== 'all') {
    const category = state.facets.categories?.find(item => item.id === state.category);
    labels.push(category?.cleanName || state.category);
  }
  if (state.subcategory !== 'all') labels.push(state.subcategory);
  if (state.tag !== 'all') labels.push(`#${state.tag}`);
  if (state.freshness !== 'all') labels.push(state.freshness.replace('d', ' 天内更新'));
  if (state.stars !== 'all') labels.push(`${formatStars(Number(state.stars))}+ stars`);
  return labels.length ? `${labels.join(' / ')}，共 ${formatNumber(state.total)} 个匹配项目。` : '';
}

function renderProjectCard(project, options = {}) {
  const saved = state.saved.has(project.id);
  const compared = state.compare.includes(project.id);
  const tags = (project.tags || []).slice(0, 3);
  const matchHints = options.showMatchHints ? buildMatchHints(project, state.query) : [];
  const category = [project.categoryIcon, project.categoryCleanName || project.categoryName, project.subcategory]
    .filter(Boolean)
    .join(' / ');

  return `
    <article class="project-card">
      <header>
        <div>
          <span class="eyebrow">${escapeHtml(category)}</span>
          <h3>${escapeHtml(project.name)}</h3>
        </div>
        <button
          class="icon-button ${saved ? 'is-active' : ''}"
          type="button"
          data-action="save"
          data-id="${attr(project.id)}"
          aria-label="收藏 ${attr(project.name)}"
          title="收藏"
        >${saved ? '★' : '☆'}</button>
      </header>

      <p>${escapeHtml(project.description || 'No description')}</p>

      <div class="tag-row">
        ${tags
          .map(tag => `<button class="tag" type="button" data-action="tag" data-value="${attr(tag)}">${escapeHtml(tag)}</button>`)
          .join('')}
      </div>

      ${
        matchHints.length
          ? `
            <div class="match-row" aria-label="匹配线索">
              <span class="match-label">命中</span>
              ${matchHints.map(hint => `<span class="match-chip">${escapeHtml(hint)}</span>`).join('')}
            </div>
          `
          : ''
      }

      <div class="metric-row">
        <span class="metric"><strong>${formatStars(project.stars)}</strong> stars</span>
        <span class="metric"><strong>${formatDate(project.lastUpdated)}</strong> updated</span>
        <span class="metric"><strong>${project.scores?.potential ?? '-'}</strong> signal</span>
      </div>

      <div class="card-actions">
        <button class="icon-button ${compared ? 'is-active' : ''}" type="button" data-action="compare" data-id="${attr(project.id)}" aria-label="加入对比" title="对比">⇄</button>
        <button class="action-button" type="button" data-action="detail" data-id="${attr(project.id)}">详情</button>
        <a class="action-button" href="${attr(project.url)}" target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>
    </article>
  `;
}

function buildMatchHints(project, query) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const terms = expandTerms(normalizedQuery);
  if (!terms.length) return [];

  const name = normalize(project.name);
  const description = normalize(project.description);
  const category = normalize(project.categoryCleanName || project.categoryName);
  const subcategory = normalize(project.subcategory);
  const tags = (project.tags || []).map(normalize);
  const topics = (project.topics || []).map(normalize);
  const hints = [];

  for (const term of terms) {
    if (!term) continue;

    if (name.includes(term)) hints.push(`标题 ${term}`);
    else if (tags.some(tag => tag === term || tag.includes(term)) || topics.some(topic => topic === term || topic.includes(term))) {
      hints.push(`标签 ${term}`);
    } else if (category.includes(term) || subcategory.includes(term)) {
      hints.push(`赛道 ${term}`);
    } else if (description.includes(term)) {
      hints.push(`简介 ${term}`);
    }

    if (hints.length >= 2) break;
  }

  return [...new Set(hints)];
}

function renderCompare() {
  if (!state.catalog) {
    els.main.innerHTML = renderLoading('正在加载对比索引');
    ensureCatalog().then(render);
    return;
  }

  const projects = state.compare.map(id => state.catalogById.get(id)).filter(Boolean);
  if (!projects.length) {
    els.main.innerHTML = renderEmptyState('还没有对比项目', '从 Radar 或 Explorer 中加入 2-4 个项目。');
    return;
  }
  const bestSignal = [...projects].sort((a, b) => (b.scores?.potential || 0) - (a.scores?.potential || 0))[0];
  const mostStars = [...projects].sort((a, b) => b.stars - a.stars)[0];
  const freshest = [...projects].sort((a, b) => dateMs(b.lastUpdated) - dateMs(a.lastUpdated))[0];

  const rows = [
    ['分类', project => `${project.categoryCleanName || project.categoryName} / ${project.subcategory}`],
    ['Stars', project => formatStars(project.stars)],
    ['最近更新', project => formatDate(project.lastUpdated)],
    ['潜力信号', project => project.scores?.potential ?? '-'],
    ['成熟度', project => project.scores?.maturity ?? '-'],
    ['标签', project => (project.tags || []).slice(0, 8).join(', ') || '-'],
    ['描述', project => project.description || '-']
  ];

  els.main.innerHTML = `
    <section class="section-band">
      <div class="section-heading">
        <div>
          <h2>项目对比</h2>
          <p>${projects.length} 个项目。</p>
        </div>
        <button class="export-button" type="button" data-action="export-compare">导出 Markdown</button>
      </div>
      <div class="compare-summary">
        ${renderCompareSignal('最高潜力', bestSignal)}
        ${renderCompareSignal('最多 Stars', mostStars)}
        ${renderCompareSignal('最新活跃', freshest)}
      </div>
      <div class="table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th>字段</th>
              ${projects
                .map(
                  project => `
                    <th>
                      ${escapeHtml(project.name)}
                      <button class="icon-button" type="button" data-action="remove-compare" data-id="${attr(project.id)}" aria-label="移除">×</button>
                    </th>
                  `
                )
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                ([label, getter]) => `
                  <tr>
                    <th>${escapeHtml(label)}</th>
                    ${projects.map(project => `<td>${escapeHtml(getter(project))}</td>`).join('')}
                  </tr>
                `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCompareSignal(label, project) {
  if (!project) return '';
  return `
    <button class="compare-signal" type="button" data-action="detail" data-id="${attr(project.id)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(project.name)}</strong>
    </button>
  `;
}

function renderSaved() {
  if (!state.catalog) {
    els.main.innerHTML = renderLoading('正在加载收藏索引');
    ensureCatalog().then(render);
    return;
  }

  const projects = [...state.saved].map(id => state.catalogById.get(id)).filter(Boolean);
  const recent = state.recent.map(id => state.catalogById.get(id)).filter(Boolean);

  els.main.innerHTML = `
    <section class="section-band">
      <div class="section-heading">
        <div>
          <h2>收藏项目</h2>
          <p>${projects.length} 个项目。</p>
        </div>
        ${projects.length ? '<button class="export-button" type="button" data-action="export-saved">导出 Markdown</button>' : ''}
      </div>
      ${
        projects.length
          ? `<div class="project-grid">${projects.map(project => renderProjectCard(project)).join('')}</div>`
          : renderEmptyState('还没有收藏项目', '在项目卡片上点星标即可加入收藏。')
      }
    </section>

    <section class="section-band">
      <div class="section-heading">
        <div>
          <h2>最近浏览</h2>
          <p>${recent.length} 个项目。</p>
        </div>
      </div>
      ${
        recent.length
          ? `<div class="project-grid">${recent.slice(0, 12).map(project => renderProjectCard(project)).join('')}</div>`
          : renderEmptyState('暂无浏览记录', '打开任意项目详情后会显示在这里。')
      }
    </section>
  `;
}

async function openDetail(id) {
  state.selectedId = id;
  els.drawer.classList.add('is-open');
  els.drawer.setAttribute('aria-hidden', 'false');
  els.backdrop.hidden = false;
  els.drawer.innerHTML = renderLoading('正在打开项目详情');

  await Promise.all([ensureCatalog(), ensureDetails()]);
  addRecent(id);
  renderDrawer();
}

function renderDrawer() {
  const id = state.selectedId;
  const baseProject = state.catalogById.get(id);
  const detail = baseProject ? { ...baseProject, ...(state.details?.[id] || {}) } : state.details?.[id];
  if (!detail) {
    els.drawer.innerHTML = renderEmptyState('找不到项目详情', '');
    return;
  }

  const relatedProjects = (state.related?.[id] || [])
    .map(relatedId => state.catalogById.get(relatedId))
    .filter(Boolean)
    .slice(0, 8);
  const saved = state.saved.has(id);
  const compared = state.compare.includes(id);

  els.drawer.innerHTML = `
    <div class="drawer-header">
      <div>
        <span class="eyebrow">${escapeHtml(
          [detail.categoryIcon, detail.categoryCleanName || detail.categoryName, detail.subcategory].filter(Boolean).join(' / ')
        )}</span>
        <h2>${escapeHtml(detail.name)}</h2>
      </div>
      <button class="close-button" type="button" data-action="close-drawer" aria-label="关闭">×</button>
    </div>

    <p class="detail-summary">${escapeHtml(detail.description || 'No description')}</p>

    <div class="detail-actions">
      <a class="action-button" href="${attr(detail.url)}" target="_blank" rel="noopener noreferrer">打开 GitHub</a>
      <button class="action-button ${saved ? 'is-active' : ''}" type="button" data-action="save" data-id="${attr(id)}">${saved ? '已收藏' : '收藏'}</button>
      <button class="action-button ${compared ? 'is-active' : ''}" type="button" data-action="compare" data-id="${attr(id)}">${compared ? '已加入对比' : '加入对比'}</button>
      <button class="action-button" type="button" data-action="copy-project" data-id="${attr(id)}">复制摘要</button>
    </div>

    <div class="signal-grid">
      ${renderSignal('Stars', formatStars(detail.stars))}
      ${renderSignal('更新', formatDate(detail.lastUpdated))}
      ${renderSignal('潜力信号', detail.scores?.potential ?? '-')}
      ${renderSignal('主题聚焦', detail.scores?.focus ?? '-')}
    </div>

    <section class="decision-panel">
      <h2>选型判断</h2>
      <p>${escapeHtml(detail.decision?.fit || '适合进入同类项目对比，结合活跃度、成熟度和标签判断是否值得试用。')}</p>
      <div class="decision-grid">
        <div>
          <strong>注意点</strong>
          <ul>
            ${(detail.decision?.caution?.length ? detail.decision.caution : ['打开 GitHub 后先检查 README、示例、issue 和最近提交。'])
              .map(item => `<li>${escapeHtml(item)}</li>`)
              .join('')}
          </ul>
        </div>
        <div>
          <strong>下一步</strong>
          <ul>
            ${(detail.decision?.nextSteps || [])
              .map(item => `<li>${escapeHtml(item)}</li>`)
              .join('')}
          </ul>
        </div>
      </div>
    </section>

    <section class="section-band">
      <div class="section-heading">
        <div>
          <h2>标签</h2>
          <p>${escapeHtml(detail.owner || '')}/${escapeHtml(detail.repo || '')}</p>
        </div>
      </div>
      <div class="tag-row">
        ${(detail.tags || [])
          .map(tag => `<button class="tag" type="button" data-action="tag" data-value="${attr(tag)}">${escapeHtml(tag)}</button>`)
          .join('')}
        ${(detail.topics || [])
          .slice(0, 12)
          .map(topic => `<button class="tag" type="button" data-action="tag" data-value="${attr(topic)}">${escapeHtml(topic)}</button>`)
          .join('')}
      </div>
    </section>

    <section class="section-band">
      <div class="section-heading">
        <div>
          <h2>相关项目</h2>
          <p>${relatedProjects.length} 个候选。</p>
        </div>
      </div>
      <div class="related-list">
        ${
          relatedProjects.length
            ? relatedProjects
                .map(
                  project => `
                    <button class="related-item" type="button" data-action="detail" data-id="${attr(project.id)}">
                      <strong>${escapeHtml(project.name)}</strong>
                      <span>${escapeHtml(project.description || '')}</span>
                    </button>
                  `
                )
                .join('')
            : '<div class="empty-state">暂无相关项目</div>'
        }
      </div>
    </section>
  `;
}

function renderSignal(label, value) {
  return `
    <div class="signal">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function closeDrawer() {
  state.selectedId = null;
  els.drawer.classList.remove('is-open');
  els.drawer.setAttribute('aria-hidden', 'true');
  els.backdrop.hidden = true;
}

function toggleSaved(id) {
  if (state.saved.has(id)) {
    state.saved.delete(id);
    showToast('已从收藏移除');
  } else {
    state.saved.add(id);
    showToast('已加入收藏');
  }
  writeStoredList(STORE_KEYS.saved, [...state.saved]);
  render();
  if (state.selectedId) renderDrawer();
}

function toggleCompare(id) {
  if (state.compare.includes(id)) {
    removeCompare(id);
    return;
  }
  if (state.compare.length >= 4) state.compare.shift();
  state.compare.push(id);
  writeStoredList(STORE_KEYS.compare, state.compare);
  showToast('已加入对比');
  render();
  if (state.selectedId) renderDrawer();
}

function removeCompare(id) {
  state.compare = state.compare.filter(item => item !== id);
  writeStoredList(STORE_KEYS.compare, state.compare);
  render();
  if (state.selectedId) renderDrawer();
}

function renderCompareTray() {
  if (!state.compare.length || !state.catalog) {
    els.tray.hidden = true;
    return;
  }
  const projects = state.compare.map(id => state.catalogById.get(id)).filter(Boolean);
  if (!projects.length) {
    els.tray.hidden = true;
    return;
  }

  els.tray.hidden = false;
  els.tray.innerHTML = `
    <div class="tray-items">
      ${projects
        .map(
          project => `
            <span class="tray-pill">
              <span>${escapeHtml(project.name)}</span>
              <button class="icon-button" type="button" data-action="remove-compare" data-id="${attr(project.id)}" aria-label="移除">×</button>
            </span>
          `
        )
        .join('')}
    </div>
    <button class="action-button" type="button" data-action="open-compare">查看对比</button>
  `;
}

function addRecent(id) {
  state.recent = [id, ...state.recent.filter(item => item !== id)].slice(0, 24);
  writeStoredList(STORE_KEYS.recent, state.recent);
}

async function exportProjects(ids, fileName) {
  await ensureCatalog();
  const projects = ids.map(id => state.catalogById.get(id)).filter(Boolean);
  if (!projects.length) {
    showToast('没有可导出的项目');
    return;
  }

  const markdown = [
    '# Hello-AI Explore',
    '',
    ...projects.flatMap(project => [
      `## ${project.name}`,
      '',
      project.description || '',
      '',
      `- GitHub: ${project.url}`,
      `- Stars: ${project.stars}`,
      `- Category: ${project.categoryCleanName || project.categoryName} / ${project.subcategory}`,
      `- Updated: ${formatDate(project.lastUpdated)}`,
      `- Tags: ${(project.tags || []).join(', ') || '-'}`,
      ''
    ])
  ].join('\n');

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyProjectMarkdown(id) {
  await ensureCatalog();
  await ensureDetails();
  const baseProject = state.catalogById.get(id);
  const detail = baseProject ? { ...baseProject, ...(state.details?.[id] || {}) } : null;
  if (!detail) return;

  const markdown = [
    `## ${detail.name}`,
    '',
    detail.description || '',
    '',
    `- GitHub: ${detail.url}`,
    `- Category: ${detail.categoryCleanName || detail.categoryName} / ${detail.subcategory}`,
    `- Stars: ${detail.stars}`,
    `- Updated: ${formatDate(detail.lastUpdated)}`,
    `- Signal: ${detail.scores?.potential ?? '-'}`,
    `- Fit: ${detail.decision?.fit || '-'}`,
    `- Tags: ${(detail.tags || []).join(', ') || '-'}`
  ].join('\n');

  await copyText(markdown, '项目摘要已复制');
}

async function copyCurrentLink() {
  await copyText(window.location.href, '筛选链接已复制');
}

async function copyResultBrief() {
  await ensureCatalog();
  const projects = getCurrentResultProjects(8);
  if (!projects.length) {
    showToast('没有可复制的结果');
    return;
  }

  const markdown = [
    '# Hello-AI Explore 选型简报',
    '',
    renderReadableFilterSummary() || '当前 Explorer 结果',
    '',
    `链接: ${window.location.href}`,
    '',
    ...projects.flatMap((project, index) => [
      `## ${index + 1}. ${project.name}`,
      '',
      project.description || '',
      '',
      `- GitHub: ${project.url}`,
      `- Stars: ${formatStars(project.stars)}`,
      `- Updated: ${formatDate(project.lastUpdated)}`,
      `- Signal: ${project.scores?.potential ?? '-'}`,
      `- Category: ${project.categoryCleanName || project.categoryName} / ${project.subcategory}`,
      `- Tags: ${(project.tags || []).slice(0, 8).join(', ') || '-'}`,
      ''
    ])
  ].join('\n');

  await copyText(markdown, '选型简报已复制');
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    showToast(successMessage);
  }
}

function searchCatalog(catalog, payload) {
  const query = normalize(payload.query);
  const terms = expandTerms(query);
  const category = payload.category || 'all';
  const subcategory = normalize(payload.subcategory || 'all');
  const tag = normalize(payload.tag || 'all');
  const freshnessDays = parseFreshness(payload.freshness);
  const minStars = parseInt(payload.stars || '0', 10) || 0;

  const scored = [];
  for (const project of catalog) {
    if (category !== 'all' && project.categoryId !== category) continue;
    if (subcategory !== 'all' && normalize(project.subcategory) !== subcategory) continue;
    if (minStars && (project.stars || 0) < minStars) continue;
    if (freshnessDays && daysSince(project.lastUpdated) > freshnessDays) continue;
    if (tag !== 'all') {
      const hasTag = [...(project.tags || []), ...(project.topics || [])].some(value => normalize(value) === tag);
      if (!hasTag) continue;
    }

    const score = scoreProject(project, terms, query);
    if (terms.length && score <= 0) continue;
    scored.push([project, score]);
  }

  scored.sort((a, b) => sortProjects(a[0], b[0], payload.sort, b[1] - a[1]));
  return scored.map(([project]) => project);
}

function expandTerms(query) {
  if (!query) return [];

  const terms = query.split(/\s+/).filter(Boolean);
  const expansions = {
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
  const tags = (project.tags || []).map(normalize);
  const topics = (project.topics || []).map(normalize);
  const haystack = [name, description, project.categoryCleanName, project.subcategory, ...tags, ...topics].map(normalize).join(' ');
  let score = 0;

  if (name === query) score += 80;
  if (name.includes(query)) score += 38;
  for (const term of terms) {
    if (name.includes(term)) score += 18;
    if (tags.some(tag => tag === term || tag.includes(term))) score += 14;
    if (topics.some(topic => topic === term || topic.includes(term))) score += 10;
    if (description.includes(term)) score += 5;
    if (haystack.includes(term)) score += 2;
  }
  return score;
}

function sortProjects(a, b, sort, relevanceDelta) {
  if (sort === 'relevance' && relevanceDelta) return relevanceDelta;
  if (sort === 'recent') return dateMs(b.lastUpdated) - dateMs(a.lastUpdated) || b.stars - a.stars;
  if (sort === 'stars') return b.stars - a.stars || dateMs(b.lastUpdated) - dateMs(a.lastUpdated);
  if (sort === 'new') return dateMs(b.addedAt) - dateMs(a.addedAt) || b.scores.potential - a.scores.potential;
  return (b.scores?.potential || 0) - (a.scores?.potential || 0) || b.stars - a.stars;
}

function renderLoading(label) {
  return `<div class="loading-state">${escapeHtml(label)}...</div>`;
}

function renderEmptyState(title, detail) {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      ${detail ? `<p>${escapeHtml(detail)}</p>` : ''}
    </div>
  `;
}

function readStoredList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeStoredList(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.hidden = false;
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 1800);
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

function formatDate(value) {
  const time = dateMs(value);
  if (!time) return 'unknown';
  return new Date(time).toISOString().slice(0, 10);
}

function formatStars(value) {
  const stars = Number(value || 0);
  if (stars >= 1000000) return `${(stars / 1000000).toFixed(1)}m`;
  if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`;
  return String(stars);
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return map[char];
  });
}

function attr(value) {
  return escapeHtml(value);
}
