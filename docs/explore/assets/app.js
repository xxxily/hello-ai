const DATA_BASE = './data/';
const ROUTES = new Set(['radar', 'explore', 'compare', 'saved']);
const MOBILE_HEADER_QUERY = '(max-width: 760px)';
const STORE_KEYS = {
  saved: 'hello-ai-explore-saved',
  compare: 'hello-ai-explore-compare',
  recent: 'hello-ai-explore-recent'
};

const LENS_OPTIONS = [
  { id: 'balanced', label: '推荐', shortLabel: '推荐', description: '综合排序' },
  { id: 'production', label: '成熟项目', shortLabel: '成熟', description: '维护稳定、使用较多' },
  { id: 'fresh', label: '最近更新', shortLabel: '更新', description: '近期有更新' },
  { id: 'hidden', label: '小众项目', shortLabel: '小众', description: '关注度较低但仍活跃' }
];

const GENERIC_REFINEMENT_TERMS = new Set([
  'ai',
  'ai-tools',
  'artificial-intelligence',
  'awesome',
  'awesome-list',
  'deep-learning',
  'generative-ai',
  'javascript',
  'large-language-model',
  'llm',
  'machine-learning',
  'ml',
  'open-source',
  'python',
  'typescript'
]);

const els = {
  main: document.querySelector('#appMain'),
  search: document.querySelector('#globalSearch'),
  stats: document.querySelector('#statStrip'),
  quick: document.querySelector('#quickStrip'),
  drawer: document.querySelector('#detailDrawer'),
  backdrop: document.querySelector('#drawerBackdrop'),
  filterSheet: document.querySelector('#filterSheet'),
  filterBackdrop: document.querySelector('#filterBackdrop'),
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
  lens: 'balanced',
  selectedTask: 'build-agent',
  visible: 48,
  stats: null,
  facets: null,
  radar: null,
  searchConfig: null,
  catalog: null,
  catalogById: new Map(),
  details: null,
  related: null,
  results: [],
  total: 0,
  resultsStale: true,
  filtersOpen: false,
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
let filterPanelScrollTimer = null;
let lastFocusedElement = null;
let drawerOriginId = null;
let renderedStatsSignature = '';

init();

function init() {
  readHash();
  bindEvents();
  updateMobileHeaderState();
  render();
  loadBaseData();
}

async function loadBaseData() {
  try {
    const [stats, facets, radar, searchConfig] = await Promise.all([
      loadJson('stats.json'),
      loadJson('facets.json'),
      loadJson('radar.json'),
      loadJson('search-index.json')
    ]);
    state.stats = stats;
    state.facets = facets;
    state.radar = radar;
    state.searchConfig = searchConfig;
    render();
  } catch (error) {
    els.main.innerHTML = renderEmptyState('项目数据暂不可用', '请稍后再试。');
    console.error(error);
  }
}

function bindEvents() {
  window.addEventListener('hashchange', () => {
    readHash();
    state.resultsStale = true;
    render();
  });

  window.addEventListener('scroll', updateMobileHeaderState, { passive: true });
  window.addEventListener('resize', updateMobileHeaderState);
  document.addEventListener('scroll', updateFilterPanelScrollState, { passive: true, capture: true });

  els.search.addEventListener('input', () => {
    state.query = els.search.value.trim();
    state.route = 'explore';
    state.visible = 48;
    state.resultsStale = true;
    writeHash(true);
    render();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      const activeOverlay = state.selectedId ? els.drawer : state.filtersOpen ? els.filterSheet : null;
      if (activeOverlay) {
        trapFocus(event, activeOverlay);
        return;
      }
    }
    if (event.key === 'Escape') {
      if (state.selectedId) closeDrawer();
      else if (state.filtersOpen) closeFilters();
      return;
    }
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
      case 'select-task':
        state.selectedTask = action.dataset.value || 'build-agent';
        writeHash(true);
        render();
        break;
      case 'lens':
        state.lens = action.dataset.value || 'balanced';
        state.sort = lensToSort(state.lens);
        state.visible = 48;
        state.resultsStale = true;
        writeHash(true);
        render();
        break;
      case 'open-task-results':
        applySelectedTask();
        break;
      case 'compare-task':
        addTaskShortlistToCompare();
        break;
      case 'add-shortlist':
        addCurrentShortlistToCompare();
        break;
      case 'open-filters':
        openFilters();
        break;
      case 'close-filters':
        closeFilters();
        break;
      case 'quick-query':
        state.query = action.dataset.query || '';
        state.category = action.dataset.category || 'all';
        state.subcategory = 'all';
        state.tag = action.dataset.tag || 'all';
        state.freshness = action.dataset.freshness || 'all';
        state.stars = action.dataset.stars || 'all';
        state.lens = 'balanced';
        state.sort = 'potential';
        setRoute('explore', { resultsStale: true, visible: 48 });
        break;
      case 'category':
        state.category = action.dataset.value || 'all';
        state.subcategory = 'all';
        state.tag = 'all';
        state.freshness = 'all';
        state.stars = 'all';
        state.lens = 'balanced';
        state.sort = 'potential';
        setRoute('explore', { resultsStale: true, visible: 48 });
        break;
      case 'filter':
        state[action.dataset.filter] = action.dataset.value || 'all';
        state.visible = 48;
        state.resultsStale = true;
        writeHash(true);
        render();
        break;
      case 'remove-filter':
        if (action.dataset.filter === 'query') state.query = '';
        else state[action.dataset.filter] = 'all';
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
        state.lens = 'balanced';
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
  els.filterBackdrop.addEventListener('click', closeFilters);
}

function updateMobileHeaderState() {
  const isCompact = window.matchMedia(MOBILE_HEADER_QUERY).matches && window.scrollY > 18;
  document.body.classList.toggle('is-mobile-scrolled', isCompact);
}

function updateFilterPanelScrollState(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains('filter-panel')) return;

  target.classList.add('is-scrolling');
  clearTimeout(filterPanelScrollTimer);
  filterPanelScrollTimer = setTimeout(() => {
    document.querySelector('.filter-panel')?.classList.remove('is-scrolling');
  }, 160);
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
    searchWorker.postMessage({ type: 'init', catalog, synonyms: state.searchConfig?.synonyms || {} });
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
  state.lens = params.get('lens') || sortToLens(state.sort);
  state.selectedTask = params.get('intent') || state.selectedTask || 'build-agent';
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
  if (state.lens !== 'balanced') params.set('lens', state.lens);
  if (state.route === 'radar' && state.selectedTask) params.set('intent', state.selectedTask);

  const nextHash = `#${state.route}${params.toString() ? `?${params}` : ''}`;
  if (window.location.hash === nextHash) return;
  if (replace) history.replaceState(null, '', nextHash);
  else history.pushState(null, '', nextHash);
}

function setRoute(route, patch = {}) {
  if (!ROUTES.has(route)) return;
  Object.assign(state, patch, { route });
  const hadOverlay = Boolean(state.selectedId || state.filtersOpen);
  if (state.selectedId) closeDrawer(false);
  if (state.filtersOpen) closeFilters(false);
  writeHash();
  render();
  if (hadOverlay) requestAnimationFrame(() => els.main.focus());
}

function render() {
  renderNav();
  renderStats();
  renderQuickStrip();
  els.search.value = state.query;

  if (!state.stats || !state.facets || !state.radar) {
    els.main.innerHTML = renderLoading('正在加载项目推荐');
    renderCompareTray();
    return;
  }

  if (state.route === 'radar') renderRadar();
  if (state.route === 'explore') renderExplorer();
  if (state.route === 'compare') renderCompare();
  if (state.route === 'saved') renderSaved();
  renderCompareTray();
  renderFilterSheet();
}

function renderNav() {
  document.querySelectorAll('[data-route]').forEach(button => {
    const active = button.dataset.route === state.route;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.body.classList.forEach(name => {
    if (name.startsWith('route-')) document.body.classList.remove(name);
  });
  document.body.classList.add(`route-${state.route}`);
}

function renderStats() {
  if (!state.stats) {
    renderedStatsSignature = '';
    return;
  }

  const totalProjects = Number(state.stats.totalRawProjects || 0);
  const activeProjects = Number(state.stats.totalActiveProjects || 0);
  const categoryCount = Object.keys(state.stats.categories || {}).length;
  const updated = formatDate(state.stats.generatedAt);
  const signature = `${totalProjects}:${activeProjects}:${categoryCount}:${updated}`;
  if (signature === renderedStatsSignature) return;
  renderedStatsSignature = signature;

  els.stats.innerHTML = `
    <article class="stat-card stat-card-total" aria-label="已收录 ${formatNumber(totalProjects)} 个 AI 开源项目">
      <span class="stat-card-label">已收录</span>
      <strong class="stat-number" data-count="${totalProjects}" aria-hidden="true">${formatNumber(totalProjects)}</strong>
      <span class="stat-card-unit">个 AI 开源项目</span>
    </article>
    <article class="stat-card stat-card-active" aria-label="其中 ${formatNumber(activeProjects)} 个项目近期活跃">
      <span class="stat-card-label"><i aria-hidden="true"></i>近期活跃</span>
      <strong class="stat-number" data-count="${activeProjects}" aria-hidden="true">${formatNumber(activeProjects)}</strong>
      <span class="stat-card-unit">个项目持续更新</span>
    </article>
    <div class="stat-meta" aria-label="共 ${categoryCount} 个分类，数据更新于 ${updated}">
      <span><strong>${categoryCount}</strong> 个分类</span>
      <span>更新于 <strong>${escapeHtml(updated)}</strong></span>
    </div>
  `;

  animateStatNumbers();
}

function animateStatNumbers() {
  const numbers = [...els.stats.querySelectorAll('[data-count]')];
  if (!numbers.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  numbers.forEach((element, index) => {
    const target = Number(element.dataset.count || 0);
    const duration = 820 + index * 140;
    const startTime = performance.now();
    element.textContent = '0';

    const update = now => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      element.textContent = formatNumber(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
  });
}

function renderQuickStrip() {
  if (!els.quick) return;
  const configuredQueries = (state.searchConfig?.quickQueries || []).slice(0, 4).map(item => ({
    label: item.title,
    query: item.query,
    category: item.categories?.[0] || 'all'
  }));
  const quickQueries = [
    ...(configuredQueries.length
      ? configuredQueries
      : [
          { label: 'MCP', query: 'mcp server agent', tag: 'MCP' },
          { label: 'RAG', query: 'rag vector database retrieval', category: 'rag_data' },
          { label: 'Claude Code', query: 'claude code coding assistant', tag: 'claude-code' },
          { label: '本地模型', query: 'local llm ollama inference', category: 'infrastructure' }
        ]),
    { label: '最近 30 天', query: '', freshness: '30d' },
    { label: '50k+ Stars', query: '', stars: '50000' }
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
  const selectedTask = tasks.find(task => task.id === state.selectedTask) || tasks[0];
  const categories = state.facets.categories || [];
  const lists = state.radar.lists || {};
  const insights = state.radar.categoryInsights || [];

  els.main.innerHTML = `
    <section class="section-band">
      <div class="section-heading">
        <div>
          <h2>你想找什么？</h2>
        </div>
      </div>
      ${renderDiscoveryWorkbench(tasks)}
    </section>

    <section class="section-band">
      <div class="section-heading">
        <div>
          <h2>按分类浏览</h2>
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
                <span>${formatNumber(category.count)} 个项目</span>
                ${
                  insight
                    ? `<div class="category-signal-row"><small>${formatPercent(insight.freshCount, category.count)} 近 30 天更新</small><small>${insight.topTags?.slice(0, 3).map(tag => escapeHtml(tag.label)).join(' / ') || '查看项目'}</small></div>`
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
        </div>
        <div class="view-switch">
          <button class="chip" type="button" data-route="explore">进入 Explorer</button>
        </div>
      </div>
      <div class="radar-grid">
        ${renderListLane('推荐项目', '', lists.potential || [])}
        ${renderListLane('最近更新', '', lists.recent || [])}
        ${renderListLane('热门项目', '', lists.highStar || [])}
        ${renderListLane('新收录', '', lists.newProjects || [])}
      </div>
    </section>

    <section class="explorer-endcap" aria-label="查看全部项目">
      <div>
        <h2>查看更多项目</h2>
        <p>查看“${escapeHtml(selectedTask?.title || '当前方向')}”的全部项目。</p>
      </div>
      <button class="endcap-action" type="button" data-action="open-task-results">
        查看全部项目
        <span aria-hidden="true">→</span>
      </button>
    </section>
  `;
}

function renderDiscoveryWorkbench(tasks) {
  const selectedTask = tasks.find(task => task.id === state.selectedTask) || tasks[0];
  if (!selectedTask) return renderEmptyState('暂无推荐项目', '重新生成项目数据后再试。');
  const shortlist = getTaskShortlist(selectedTask, state.lens, 3);

  return `
    <div class="discovery-workbench">
      <div class="intent-panel">
        <div class="workbench-step">
          <span>01</span>
          <div>
            <strong>选择方向</strong>
          </div>
        </div>
        <div class="intent-list" role="list">
          ${tasks
            .slice(0, 6)
            .map(
              task => `
                <button
                  class="intent-option ${task.id === selectedTask.id ? 'is-active' : ''}"
                  type="button"
                  data-action="select-task"
                  data-value="${attr(task.id)}"
                >
                  <span>${escapeHtml(task.title)}</span>
                  <small>${formatNumber(task.total || 0)} 个项目</small>
                </button>
              `
            )
            .join('')}
        </div>

        <div class="workbench-step lens-step">
          <span>02</span>
          <div>
            <strong>优先显示</strong>
          </div>
        </div>
        <div class="lens-list">
          ${LENS_OPTIONS.map(
            lens => `
              <button
                class="lens-option ${lens.id === state.lens ? 'is-active' : ''}"
                type="button"
                data-action="lens"
                data-value="${attr(lens.id)}"
                aria-pressed="${lens.id === state.lens}"
              >
                <strong>${escapeHtml(lens.label)}</strong>
                <small>${escapeHtml(lens.description)}</small>
              </button>
            `
          ).join('')}
        </div>
      </div>

      <div class="shortlist-panel">
        <div class="shortlist-header">
          <div>
            <span class="eyebrow">${formatNumber(selectedTask.total || 0)} 个项目</span>
            <h3>${escapeHtml(selectedTask.title)}</h3>
            <p>${escapeHtml(selectedTask.summary)}</p>
          </div>
          <span class="shortlist-count">${shortlist.length}<small>个</small></span>
        </div>
        <div class="shortlist-list">
          ${shortlist.map((project, index) => renderShortlistItem(project, index)).join('')}
        </div>
        <div class="shortlist-actions">
          <button class="action-button primary-action" type="button" data-action="open-task-results">查看全部</button>
          <button class="action-button" type="button" data-action="compare-task" ${shortlist.length < 2 ? 'disabled' : ''}>加入对比</button>
        </div>
      </div>
    </div>
  `;
}

function renderShortlistItem(project, index) {
  const compared = state.compare.includes(project.id);
  return `
    <article class="shortlist-item">
      <button class="shortlist-main" type="button" data-action="detail" data-id="${attr(project.id)}">
        <span class="shortlist-rank">0${index + 1}</span>
        <span class="shortlist-copy">
          <strong>${escapeHtml(project.name)}</strong>
          <small>${escapeHtml(buildShortlistReason(project, state.lens))}</small>
        </span>
        <span class="shortlist-score">${formatStars(project.stars)} Stars</span>
      </button>
      <button
        class="icon-button ${compared ? 'is-active' : ''}"
        type="button"
        data-action="compare"
        data-id="${attr(project.id)}"
        aria-label="${compared ? '从对比中移除' : '加入对比'} ${attr(project.name)}"
        title="${compared ? '移出对比' : '加入对比'}"
      >${compared ? '✓' : '＋'}</button>
    </article>
  `;
}

function renderPathCard(task) {
  const primaryCategory = task.categories?.[0] || 'all';
  return `
    <article class="path-card">
      <header>
        <div>
          <span class="eyebrow">${formatNumber(task.total || 0)} 个项目</span>
          <h3>${escapeHtml(task.title)}</h3>
        </div>
        <button class="action-button" type="button" data-action="task" data-query="${attr(task.query)}" data-category="${attr(primaryCategory)}">查看项目</button>
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
          ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
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
  let resultsHtml = renderLoading('正在加载项目');

  if (!state.catalog) {
    ensureCatalog().then(() => {
      state.resultsStale = true;
      render();
    });
  } else if (state.resultsStale) {
    runSearch();
    resultsHtml = renderLoading('正在查找项目');
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
          <div class="result-tools">
            <button class="filter-trigger" type="button" data-action="open-filters">
              筛选${countActiveFilters() ? ` · ${countActiveFilters()}` : ''}
            </button>
            <select id="sortSelect" aria-label="排列顺序">
              ${[
                ['potential', '推荐'],
                ['relevance', '相关度'],
                ['recent', '最近更新'],
                ['stars', 'Stars'],
                ['new', '新收录']
              ]
                .map(([value, label]) => `<option value="${value}" ${state.sort === value ? 'selected' : ''}>${label}</option>`)
                .join('')}
            </select>
          </div>
        </div>
        ${renderLensBar()}
        ${renderResultBrief()}
        ${renderRefinementPanel()}
        ${resultsHtml}
      </div>
    </section>
  `;
}

function renderActiveFilters() {
  const labels = [];
  if (state.query) labels.push({ filter: 'query', label: `q: ${state.query}` });
  if (state.category !== 'all') {
    const cat = state.facets.categories?.find(category => category.id === state.category);
    labels.push({ filter: 'category', label: cat?.cleanName || state.category });
  }
  if (state.subcategory !== 'all') labels.push({ filter: 'subcategory', label: state.subcategory });
  if (state.tag !== 'all') labels.push({ filter: 'tag', label: `#${state.tag}` });
  if (state.freshness !== 'all') labels.push({ filter: 'freshness', label: state.freshness.replace('d', ' 天内') });
  if (state.stars !== 'all') labels.push({ filter: 'stars', label: `${formatStars(Number(state.stars))}+ stars` });
  if (!labels.length) return '';
  return `<div class="active-filters">${labels
    .map(
      item => `<button type="button" data-action="remove-filter" data-filter="${attr(item.filter)}">${escapeHtml(item.label)} <span aria-hidden="true">×</span></button>`
    )
    .join('')}</div>`;
}

function renderFilterPanel() {
  return renderFilterContent('filter-panel');
}

function renderFilterContent(className = 'filter-panel') {
  const categories = state.facets.categories || [];
  const activeCategory = categories.find(category => category.id === state.category);
  const subcategories =
    state.category !== 'all' && activeCategory
      ? (activeCategory.subcategories || []).map(label => ({ id: label, label, count: null }))
      : (state.facets.subcategories || []).slice(0, 18);
  const tags = (state.facets.tags || []).slice(0, 28);

  return `
    <aside class="${attr(className)}" aria-label="项目筛选">
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

function renderLensBar() {
  return `
    <section class="lens-bar" aria-label="优先显示">
      <div>
        <strong>优先显示</strong>
      </div>
      <div class="lens-chips">
        ${LENS_OPTIONS.map(
          lens => `
            <button
              class="lens-chip ${lens.id === state.lens ? 'is-active' : ''}"
              type="button"
              data-action="lens"
              data-value="${attr(lens.id)}"
              aria-pressed="${lens.id === state.lens}"
            >${escapeHtml(lens.label)}</button>
          `
        ).join('')}
      </div>
    </section>
  `;
}

function renderRefinementPanel() {
  if (!state.catalog || state.resultsStale || state.results.length < 8) return '';
  const refinements = getResultRefinements();
  if (!refinements.length) return '';

  return `
    <section class="refinement-panel" aria-label="相关分类和标签">
      <div>
        <strong>相关分类和标签</strong>
      </div>
      <div class="refinement-list">
        ${refinements
          .map(
            item => `
              <button
                class="refinement-chip"
                type="button"
                data-action="filter"
                data-filter="${attr(item.filter)}"
                data-value="${attr(item.value)}"
              >
                <span>${escapeHtml(item.label)}</span>
                <strong>${formatNumber(item.count)}</strong>
              </button>
            `
          )
          .join('')}
      </div>
    </section>
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
    sort: state.sort,
    lens: state.lens,
    synonyms: state.searchConfig?.synonyms || {}
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
    return renderNoResults();
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
  if (!state.catalog) return '项目加载中';
  if (state.resultsStale) return '查找中';
  return `${formatNumber(state.total)} 个项目`;
}

function renderResultBrief() {
  if (!state.catalog || state.resultsStale || !state.results.length) return '';

  const projects = getCurrentResultProjects();
  const highlights = pickResultHighlights(projects);
  if (!highlights.length) return '';

  const filterSummary = renderReadableFilterSummary();
  return `
    <section class="brief-panel" aria-label="推荐项目">
      <div class="brief-header">
        <div>
          <h2>推荐项目</h2>
          ${filterSummary ? `<p>${escapeHtml(filterSummary)}</p>` : ''}
        </div>
        <div class="brief-actions">
          <button class="action-button" type="button" data-action="copy-link">复制链接</button>
          <button class="action-button" type="button" data-action="copy-brief">复制结果</button>
          <button class="action-button primary-action" type="button" data-action="add-shortlist">加入对比</button>
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
  const usedSubcategories = new Set();
  const picks = [];
  const addPick = (label, reason, sortedProjects) => {
    const project =
      sortedProjects.find(item => !used.has(item.id) && !usedSubcategories.has(normalize(item.subcategory))) ||
      sortedProjects.find(item => !used.has(item.id));
    if (!project) return;
    used.add(project.id);
    usedSubcategories.add(normalize(project.subcategory));
    picks.push({ label, reason: reason(project), project });
  };

  const sorted = [...projects].sort((a, b) => getLensScore(b, state.lens) - getLensScore(a, state.lens));
  addPick('推荐', project => buildRecommendationReason(project, state.lens), sorted);
  addPick('同类项目', project => buildComplementReason(project), sorted);
  addPick('更多选择', project => buildRecommendationReason(project, 'balanced'), sorted);

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
  if (state.query) labels.push(`“${state.query}”`);
  if (state.category !== 'all') {
    const category = state.facets.categories?.find(item => item.id === state.category);
    labels.push(category?.cleanName || state.category);
  }
  if (state.subcategory !== 'all') labels.push(state.subcategory);
  if (state.tag !== 'all') labels.push(`#${state.tag}`);
  if (state.freshness !== 'all') labels.push(state.freshness.replace('d', ' 天内更新'));
  if (state.stars !== 'all') labels.push(`${formatStars(Number(state.stars))}+ stars`);
  return labels.length ? `${labels.join(' / ')}，共 ${formatNumber(state.total)} 个项目。` : '';
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
          aria-label="${saved ? '取消收藏' : '收藏'} ${attr(project.name)}"
          title="${saved ? '取消收藏' : '收藏'}"
        >${saved ? '★' : '☆'}</button>
      </header>

      <p>${escapeHtml(project.description || 'No description')}</p>

      ${options.recommendationReason ? `<p class="recommendation-note">${escapeHtml(options.recommendationReason)}</p>` : ''}

      <div class="tag-row">
        ${tags
          .map(tag => `<button class="tag" type="button" data-action="tag" data-value="${attr(tag)}">${escapeHtml(tag)}</button>`)
          .join('')}
      </div>

      ${
        matchHints.length
          ? `
            <div class="match-row" aria-label="匹配信息">
              <span class="match-label">相关</span>
              ${matchHints.map(hint => `<span class="match-chip">${escapeHtml(hint)}</span>`).join('')}
            </div>
          `
          : ''
      }

      <div class="metric-row">
        <span class="metric"><strong>${formatStars(project.stars)}</strong> stars</span>
        <span class="metric"><strong>${formatDate(project.lastUpdated)}</strong> 更新</span>
        <span class="metric"><strong>${escapeHtml(project.subcategory || '未分类')}</strong> 类型</span>
      </div>

      <div class="card-actions">
        <button
          class="icon-button ${compared ? 'is-active' : ''}"
          type="button"
          data-action="compare"
          data-id="${attr(project.id)}"
          aria-label="${compared ? '从对比中移除' : '加入对比'} ${attr(project.name)}"
          title="${compared ? '移出对比' : '加入对比'}"
        >⇄</button>
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

    if (name.includes(term)) hints.push(`名称含 ${term}`);
    else if (tags.some(tag => tag === term || tag.includes(term)) || topics.some(topic => topic === term || topic.includes(term))) {
      hints.push(`标签含 ${term}`);
    } else if (category.includes(term) || subcategory.includes(term)) {
      hints.push(`分类含 ${term}`);
    } else if (description.includes(term)) {
      hints.push(`简介含 ${term}`);
    }

    if (hints.length >= 2) break;
  }

  return [...new Set(hints)];
}

function getLens(id) {
  return LENS_OPTIONS.find(option => option.id === id) || LENS_OPTIONS[0];
}

function lensToSort(lens) {
  if (lens === 'fresh') return 'recent';
  return 'potential';
}

function sortToLens(sort) {
  if (sort === 'recent' || sort === 'new') return 'fresh';
  return 'balanced';
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

function buildRecommendationReason(project, lens = 'balanced', matchHints = []) {
  if (matchHints.length) return matchHints.join('，');
  const updatedRecently = daysSince(project.lastUpdated) <= 45;
  const category = project.subcategory || project.categoryCleanName || project.categoryName || '相关项目';
  if (lens === 'production') {
    return `${formatStars(project.stars)} Stars${updatedRecently ? '，近期有更新' : ''}`;
  }
  if (lens === 'fresh') {
    return `${formatDate(project.lastUpdated)} 更新`;
  }
  if (lens === 'hidden') {
    return `${category} · ${formatStars(project.stars)} Stars${updatedRecently ? ' · 近期有更新' : ''}`;
  }
  return `${category}${updatedRecently ? ' · 近期有更新' : ''} · ${formatStars(project.stars)} Stars`;
}

function buildShortlistReason(project, lens = 'balanced') {
  const updatedRecently = daysSince(project.lastUpdated) <= 45;
  const category = project.subcategory || project.categoryCleanName || project.categoryName || '相关项目';
  if (lens === 'fresh') return `${formatDate(project.lastUpdated)} 更新`;
  return `${category}${updatedRecently ? ' · 近期有更新' : ''}`;
}

function buildComplementReason(project) {
  const category = project.categoryCleanName || project.categoryName || '同类项目';
  return `${category} / ${project.subcategory || '未分类'}`;
}

function buildRelatedReason(source, candidate) {
  if (!source || !candidate) return '相似项目';
  const sharedTags = intersectNormalized(source.tags || [], candidate.tags || []);
  const sharedTopics = intersectNormalized(source.topics || [], candidate.topics || []);
  if (source.subcategory && source.subcategory === candidate.subcategory) {
    const shared = [...sharedTags, ...sharedTopics].slice(0, 2);
    return `同属 ${source.subcategory}${shared.length ? `，共享 ${shared.join(' / ')}` : ''}`;
  }
  const shared = [...sharedTags, ...sharedTopics].slice(0, 3);
  if (shared.length) return `共享 ${shared.join(' / ')} 标签`;
  if (source.categoryId === candidate.categoryId) return `同属 ${candidate.categoryCleanName || candidate.categoryName}`;
  return '分类相近';
}

function intersectNormalized(left, right) {
  const rightMap = new Map(right.map(value => [normalize(value), value]));
  return left.map(value => rightMap.get(normalize(value))).filter(Boolean);
}

function getResultRefinements() {
  const projects = getCurrentResultProjects(Math.min(state.results.length, 1200));
  const candidates = [];
  if (state.subcategory === 'all') {
    candidates.push(
      ...countProjectValues(projects, project => [project.subcategory])
        .filter(item => item.value && item.count < projects.length * 0.86)
        .slice(0, 4)
        .map(item => ({ ...item, filter: 'subcategory' }))
    );
  }
  if (state.tag === 'all') {
    candidates.push(
      ...countProjectValues(projects, project => [...(project.tags || []), ...(project.topics || [])])
        .filter(
          item =>
            item.count >= 3 &&
            item.count < projects.length * 0.78 &&
            !GENERIC_REFINEMENT_TERMS.has(normalize(item.value))
        )
        .slice(0, 8)
        .map(item => ({ ...item, filter: 'tag' }))
    );
  }

  const seen = new Set();
  return candidates
    .sort((a, b) => refinementScore(b.count, projects.length) - refinementScore(a.count, projects.length))
    .filter(item => {
      const key = normalize(item.value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function countProjectValues(projects, getValues) {
  const counts = new Map();
  for (const project of projects) {
    const seen = new Set();
    for (const rawValue of getValues(project)) {
      const value = String(rawValue || '').trim();
      const key = normalize(value);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const current = counts.get(key) || { value, label: value, count: 0 };
      current.count += 1;
      counts.set(key, current);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function refinementScore(count, total) {
  if (!total) return 0;
  const ratio = count / total;
  return count * (1 - Math.abs(ratio - 0.28));
}

function countActiveFilters() {
  return [state.query, state.category !== 'all', state.subcategory !== 'all', state.tag !== 'all', state.freshness !== 'all', state.stars !== 'all'].filter(Boolean).length;
}

function renderNoResults() {
  const actions = [];
  if (state.tag !== 'all') actions.push({ filter: 'tag', label: `移除 #${state.tag}` });
  if (state.subcategory !== 'all') actions.push({ filter: 'subcategory', label: `移除 ${state.subcategory}` });
  if (state.stars !== 'all') actions.push({ filter: 'stars', label: '取消 Stars 门槛' });
  if (state.freshness !== 'all') actions.push({ filter: 'freshness', label: '放宽更新时间' });
  if (state.query) actions.push({ filter: 'query', label: '清除关键词' });

  return `
    <div class="empty-state empty-result">
      <strong>没有找到项目</strong>
      <p>试试清除一个条件，或换个关键词。</p>
      <div class="empty-actions">
        ${actions
          .slice(0, 3)
          .map(
            item => `<button class="action-button" type="button" data-action="remove-filter" data-filter="${attr(item.filter)}">${escapeHtml(item.label)}</button>`
          )
          .join('')}
        <button class="action-button primary-action" type="button" data-action="clear-filters">清空全部条件</button>
      </div>
    </div>
  `;
}

function formatPercent(value, total) {
  if (!total) return '0%';
  return `${Math.round((Number(value || 0) / total) * 100)}%`;
}

function renderCompare() {
  if (!state.catalog) {
    els.main.innerHTML = renderLoading('正在加载对比项目');
    ensureCatalog().then(render);
    return;
  }

  const projects = state.compare.map(id => state.catalogById.get(id)).filter(Boolean);
  if (!projects.length) {
    els.main.innerHTML = renderEmptyState('还没有对比项目', '从发现或全部项目中加入 2–4 个项目。');
    return;
  }
  const mostStars = [...projects].sort((a, b) => b.stars - a.stars)[0];
  const freshest = [...projects].sort((a, b) => dateMs(b.lastUpdated) - dateMs(a.lastUpdated))[0];

  const rows = [
    ['分类', project => `${project.categoryCleanName || project.categoryName} / ${project.subcategory}`],
    ['Stars', project => formatStars(project.stars)],
    ['最近更新', project => formatDate(project.lastUpdated)],
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
        ${renderCompareSignal('最多 Stars', mostStars)}
        ${renderCompareSignal('最近更新', freshest)}
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
                      <button class="icon-button" type="button" data-action="remove-compare" data-id="${attr(project.id)}" aria-label="从对比中移除 ${attr(project.name)}">×</button>
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
    els.main.innerHTML = renderLoading('正在加载收藏项目');
    ensureCatalog().then(render);
    return;
  }

  if ((state.saved.size || state.recent.length) && !state.related) {
    els.main.innerHTML = renderLoading('正在加载相关推荐');
    ensureDetails().then(render);
    return;
  }

  const projects = [...state.saved].map(id => state.catalogById.get(id)).filter(Boolean);
  const recent = state.recent.map(id => state.catalogById.get(id)).filter(Boolean);
  const continuation = buildContinuationRecommendations(projects, recent);

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

    ${
      continuation.length
        ? `
          <section class="section-band continuation-section">
            <div class="section-heading">
              <div>
                <h2>你可能还喜欢</h2>
              </div>
            </div>
            <div class="project-grid">
              ${continuation.map(item => renderProjectCard(item.project, { recommendationReason: item.reason })).join('')}
            </div>
          </section>
        `
        : ''
    }
  `;
}

async function openDetail(id) {
  if (!state.selectedId) {
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    drawerOriginId = id;
  }
  state.selectedId = id;
  els.drawer.classList.add('is-open');
  els.drawer.setAttribute('aria-hidden', 'false');
  els.drawer.removeAttribute('inert');
  els.drawer.setAttribute('role', 'dialog');
  els.drawer.setAttribute('aria-modal', 'true');
  els.backdrop.hidden = false;
  document.body.classList.add('has-overlay');
  els.drawer.innerHTML = renderLoading('正在打开项目详情');

  await Promise.all([ensureCatalog(), ensureDetails()]);
  addRecent(id);
  renderDrawer();
  requestAnimationFrame(() => els.drawer.querySelector('.close-button')?.focus());
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
      ${renderSignal('分类', detail.categoryCleanName || detail.categoryName || '-')}
      ${renderSignal('类型', detail.subcategory || '-')}
    </div>

    <section class="decision-panel">
      <h2>适用方向</h2>
      <p>${escapeHtml(detail.decision?.fit || '查看项目简介、标签和相关项目。')}</p>
      <div class="decision-grid">
        <div>
          <strong>注意</strong>
          <ul>
            ${(detail.decision?.caution?.length ? detail.decision.caution : ['打开 GitHub 后先检查 README、示例、issue 和最近提交。'])
              .map(item => `<li>${escapeHtml(item)}</li>`)
              .join('')}
          </ul>
        </div>
        <div>
          <strong>建议</strong>
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
          <p>${relatedProjects.length} 个项目。</p>
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
                      <small>${escapeHtml(buildRelatedReason(detail, project))}</small>
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

function renderFilterSheet() {
  if (!els.filterSheet || !els.filterBackdrop) return;
  if (!state.filtersOpen) {
    els.filterSheet.classList.remove('is-open');
    els.filterSheet.setAttribute('aria-hidden', 'true');
    els.filterSheet.setAttribute('inert', '');
    els.filterBackdrop.hidden = true;
    return;
  }

  const activeElement = document.activeElement;
  const activeAction = activeElement?.closest?.('[data-action]')?.dataset.action;
  const activeFilter = activeElement?.dataset?.filter;
  const activeValue = activeElement?.dataset?.value;
  const shouldRestoreFilterFocus = activeAction === 'filter' && activeFilter && activeValue;
  const markup = `
    <div class="filter-sheet-header">
      <div>
        <h2>筛选项目</h2>
      </div>
      <button class="close-button" type="button" data-action="close-filters" aria-label="关闭筛选">×</button>
    </div>
    <div class="filter-sheet-body">
      ${renderFilterContent('filter-sheet-content')}
    </div>
    <div class="filter-sheet-footer">
      <button class="action-button primary-action" type="button" data-action="close-filters">查看 ${formatNumber(state.total || state.catalog?.length || 0)} 个项目</button>
    </div>
  `;
  if (els.filterSheet.innerHTML !== markup) els.filterSheet.innerHTML = markup;
  els.filterSheet.classList.add('is-open');
  els.filterSheet.setAttribute('aria-hidden', 'false');
  els.filterSheet.removeAttribute('inert');
  els.filterSheet.setAttribute('role', 'dialog');
  els.filterSheet.setAttribute('aria-modal', 'true');
  els.filterBackdrop.hidden = false;
  if (shouldRestoreFilterFocus) {
    requestAnimationFrame(() => {
      els.filterSheet
        .querySelector(`[data-action="filter"][data-filter="${CSS.escape(activeFilter)}"][data-value="${CSS.escape(activeValue)}"]`)
        ?.focus();
    });
  }
}

function openFilters() {
  if (!window.matchMedia('(max-width: 1040px)').matches) {
    document.querySelector('.filter-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  state.filtersOpen = true;
  document.body.classList.add('has-overlay');
  renderFilterSheet();
  requestAnimationFrame(() => els.filterSheet.querySelector('.close-button')?.focus());
}

function closeFilters(restoreFocus = true) {
  state.filtersOpen = false;
  renderFilterSheet();
  document.body.classList.toggle('has-overlay', Boolean(state.selectedId));
  if (restoreFocus) restoreFocusAfterOverlay('[data-action="open-filters"]');
  lastFocusedElement = null;
}

function closeDrawer(restoreFocus = true) {
  const originId = drawerOriginId;
  state.selectedId = null;
  els.drawer.classList.remove('is-open');
  els.drawer.setAttribute('aria-hidden', 'true');
  els.drawer.setAttribute('inert', '');
  els.backdrop.hidden = true;
  document.body.classList.toggle('has-overlay', state.filtersOpen);
  if (restoreFocus) {
    const fallbackSelector = originId
      ? `[data-action="detail"][data-id="${CSS.escape(originId)}"]`
      : null;
    restoreFocusAfterOverlay(fallbackSelector);
  }
  lastFocusedElement = null;
  drawerOriginId = null;
}

function restoreFocusAfterOverlay(fallbackSelector) {
  const storedTarget = lastFocusedElement?.isConnected ? lastFocusedElement : null;
  const fallbackTarget = fallbackSelector ? document.querySelector(fallbackSelector) : null;
  const target = storedTarget || fallbackTarget || els.main;
  requestAnimationFrame(() => target?.focus?.());
}

function trapFocus(event, container) {
  const focusable = [...container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter(element => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
  if (!focusable.length) {
    event.preventDefault();
    container.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault();
    first.focus();
  }
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
              <button class="icon-button" type="button" data-action="remove-compare" data-id="${attr(project.id)}" aria-label="从对比中移除 ${attr(project.name)}">×</button>
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

function applySelectedTask() {
  const tasks = state.radar?.taskPaths || state.radar?.tasks || [];
  const task = tasks.find(item => item.id === state.selectedTask) || tasks[0];
  if (!task) return;
  state.query = task.query || '';
  state.category = 'all';
  state.subcategory = 'all';
  state.tag = 'all';
  state.freshness = 'all';
  state.stars = 'all';
  state.sort = lensToSort(state.lens);
  setRoute('explore', { resultsStale: true, visible: 48 });
}

function getTaskShortlist(task, lens = 'balanced', limit = 4) {
  const preferredTrackIds = {
    balanced: ['balanced', 'starter', 'production', 'fresh', 'hidden'],
    production: ['production', 'balanced', 'starter', 'fresh', 'hidden'],
    fresh: ['fresh', 'balanced', 'starter', 'hidden', 'production'],
    hidden: ['hidden', 'balanced', 'starter', 'fresh', 'production']
  }[lens] || ['balanced', 'starter', 'production', 'fresh', 'hidden'];
  const tracks = task?.tracks || [];
  const rankedCandidates = [];
  for (const trackId of preferredTrackIds) {
    const track = tracks.find(item => item.id === trackId);
    if (!track?.projects?.length) continue;
    track.projects.forEach((project, index) => {
      rankedCandidates.push({ project, trackId, trackRank: index });
    });
  }
  const unique = [...new Map(rankedCandidates.map(item => [item.project.id, item])).values()];
  const selected = [];
  const usedSubcategories = new Set();
  const sorted = unique.sort(
    (a, b) =>
      preferredTrackIds.indexOf(a.trackId) - preferredTrackIds.indexOf(b.trackId) ||
      a.trackRank - b.trackRank ||
      getLensScore(b.project, lens) - getLensScore(a.project, lens)
  );

  for (const { project } of sorted) {
    const subcategory = normalize(project.subcategory);
    if (subcategory && usedSubcategories.has(subcategory)) continue;
    selected.push(project);
    if (subcategory) usedSubcategories.add(subcategory);
    if (selected.length >= limit) return selected;
  }

  for (const { project } of sorted) {
    if (selected.some(item => item.id === project.id)) continue;
    selected.push(project);
    if (selected.length >= limit) break;
  }
  return selected;
}

function addTaskShortlistToCompare() {
  const tasks = state.radar?.taskPaths || state.radar?.tasks || [];
  const task = tasks.find(item => item.id === state.selectedTask) || tasks[0];
  addProjectsToCompare(getTaskShortlist(task, state.lens, 3));
}

function addCurrentShortlistToCompare() {
  addProjectsToCompare(pickResultHighlights(getCurrentResultProjects()).map(item => item.project));
}

function addProjectsToCompare(projects) {
  const ids = projects.map(project => project?.id).filter(Boolean);
  if (ids.length < 2) {
    showToast('项目不足，请先放宽筛选条件');
    return;
  }
  state.compare = [...new Set([...state.compare, ...ids])].slice(-4);
  writeStoredList(STORE_KEYS.compare, state.compare);
  showToast(`已将 ${state.compare.length} 个项目加入对比`);
  ensureCatalog().then(render);
}

function buildContinuationRecommendations(savedProjects, recentProjects) {
  if (!state.catalog || !state.related) return [];
  const sources = [...savedProjects, ...recentProjects].filter(Boolean).slice(0, 12);
  if (!sources.length) return [];
  const excluded = new Set([...state.saved, ...state.recent]);
  const candidates = new Map();

  for (const source of sources) {
    for (const relatedId of state.related[source.id] || []) {
      if (excluded.has(relatedId)) continue;
      const project = state.catalogById.get(relatedId);
      if (!project) continue;
      const current = candidates.get(relatedId) || { project, sources: [], score: 0 };
      current.sources.push(source);
      current.score += 30 + getLensScore(project, 'balanced');
      candidates.set(relatedId, current);
    }
  }

  return [...candidates.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(item => ({
      project: item.project,
      reason: `因为你看过 ${item.sources.slice(0, 2).map(source => source.name).join(' / ')}；${buildRelatedReason(item.sources[0], item.project)}`
    }));
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
    `- Suitable for: ${detail.decision?.fit || '-'}`,
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
    '# Hello-AI Explore 项目列表',
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
      `- Category: ${project.categoryCleanName || project.categoryName} / ${project.subcategory}`,
      `- Tags: ${(project.tags || []).slice(0, 8).join(', ') || '-'}`,
      ''
    ])
  ].join('\n');

  await copyText(markdown, '项目列表已复制');
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

  scored.sort((a, b) => sortProjects(a[0], b[0], payload.sort, b[1] - a[1], payload.lens));
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
    开发工具: ['developer-tools', 'sdk', 'code', 'assistant'],
    ...(state.searchConfig?.synonyms || {})
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
  if (sort === 'new') return dateMs(b.addedAt) - dateMs(a.addedAt) || b.scores.potential - a.scores.potential;
  return getLensScore(b, lens) - getLensScore(a, lens) || b.stars - a.stars;
}

function renderLoading(label) {
  return `<div class="loading-state">${escapeHtml(label)}…</div>`;
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
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(time))
    .replaceAll('/', '-');
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
