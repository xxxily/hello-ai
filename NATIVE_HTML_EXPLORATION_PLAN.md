# Hello-AI 原生 HTML 探索入口规划

## 1. 结论

建议新增一个独立的原生 HTML 探索入口 `/explore/`，定位不是替代 VitePress 文档站，而是把 Hello-AI 从“项目目录”升级为“AI 项目发现与决策工具”。

当前 VitePress 负责稳定的 SEO、分类文档、项目介绍和静态归档；新入口负责高交互探索、快速筛选、相似推荐、项目对比、潜力发现和任务导向的项目路线。

推荐第一阶段采用纯静态方案：

- 源码放在 `public/explore/` 或根目录 `explore/`，最终产物进入 `docs/explore/`。
- 不改 `.vitepress/config.js`、导航和主题逻辑，避免影响原站。
- 新增一个数据生成脚本，从 `data/projects.json` 提取轻量探索数据，输出给原生 HTML 使用。
- 首屏先加载小数据包，项目详情和推荐按需加载，避免一次性吃下完整 `projects.json`。

## 2. 项目现状判断

仓库已经有很好的数据资产，但呈现方式偏“文档列表”。

已具备的能力：

- `package.json:45-63` 已有 VitePress 构建、AI 发现、状态更新、文档生成、Meilisearch 索引等脚本。
- `scripts/generate-docs.js:12-87` 会把分类项目按 `subcategory` 分组，按 stars 排序，生成 `home/*.md` 文档页。
- `scripts/generate-docs.js:208-272` 会按更新时间过滤项目并写出 `data/stats.json`。
- `.vitepress/nav/zh.js:4-13` 已从 `data/categories.json` 动态读取分类导航。
- `scripts/meilisearch-index.js:84-127` 已配置 Meilisearch 搜索和过滤字段，包含 `name`、`description`、`tags`、`topics`、`subcategory`、`categoryId`、`stars`。
- `scripts/meilisearch-index.js:237-272` 已经能把 `data/projects.json` 扁平化成搜索文档。

当前数据规模：

- `data/projects.json` 当前约 17 MB，gzip 后约 3 MB。
- 当前唯一项目数约 18839。
- 当前活跃展示项目约 9090。
- 分类共 13 个，大类下基本都有 3 个子类。
- 约 5184 个项目缺少 `topics`，所以第一阶段不能完全依赖 topic 做精确推荐。

当前主要问题：

- 用户面对几千个项目时，很难知道“我现在应该看哪一个”。
- 大类和子类能帮助导航，但不能表达项目之间的替代关系、互补关系和使用场景。
- 按 stars 排序会放大老项目，新项目和垂直项目的潜力容易被淹没。
- Markdown 长列表不适合频繁筛选、对比、收藏、回看和任务流探索。
- 项目详情缺少“为什么值得看”“适合谁”“和谁类似”“下一步怎么试”的决策信息。

## 3. 新入口的产品定位

### 3.1 一句话定位

Hello-AI Explore 是一个面向 AI 开发者和工具使用者的项目雷达：帮助用户从 9000+ 活跃项目中快速找到值得试、值得学、值得集成的项目。

### 3.2 和 VitePress 的关系

| 入口 | 主要价值 | 适合内容 |
| --- | --- | --- |
| VitePress 文档站 | 稳定、可索引、可阅读、可分享 | 项目介绍、分类列表、README、部署说明 |
| `/explore/` 原生 HTML | 高交互、快速决策、任务导向 | 搜索、筛选、潜力榜、相似项目、对比、收藏、路线 |

原则：VitePress 保持原样，新入口只复用数据，不侵入原主题、不改原路由、不破坏已有发布链路。

## 4. 用户价值设计

### 4.1 用户核心问题

新入口要优先回答这些问题：

- 我想做一个 Agent / RAG / 多模态应用，该从哪些项目开始？
- 某个项目很火，但有没有更轻、更活跃、更适合生产的替代品？
- 最近有什么新项目值得关注？
- 哪些项目 stars 不算最高，但更新活跃、主题聚焦、潜力大？
- 同类项目怎么快速比较？
- 我看过一个项目后，下一步还能看什么？

### 4.2 核心用户场景

| 场景 | 用户动作 | 新入口应该给的结果 |
| --- | --- | --- |
| 快速找工具 | 输入 `mcp`、`rag`、`claude code`、`voice agent` | 立即展示相关项目、标签筛选、同类推荐 |
| 探索趋势 | 打开首页 | 看到今日雷达、近期活跃、潜力项目、热门赛道 |
| 选型比较 | 勾选 2-4 个项目 | 并排比较 stars、更新时间、标签、场景、成熟度 |
| 深挖项目 | 点击项目卡片 | 详情抽屉展示价值摘要、信号、相似项目、GitHub 链接 |
| 主题学习 | 选择一个任务路线 | 看到从入门资源到生产工具的分层项目列表 |

## 5. 首屏吸引力设计

首屏不要再做单纯分类入口，要让用户打开后立刻看到“值得点”的内容。

推荐首屏结构：

1. 顶部命令式搜索框

   文案建议：`Search AI projects, topics, stacks, use cases...`

   行为：

   - 输入时即时返回项目、标签、分类、主题。
   - 支持快捷查询词：`agent`、`rag`、`mcp`、`voice`、`finetune`、`desktop`。
   - 搜索为空时展示热门探索路径。

2. 今日项目雷达

   用 4 个紧凑榜单抓注意力：

   - 最近活跃：`lastUpdated` 最新且 stars 达标。
   - 潜力项目：stars 不是最高，但更新近、标签聚焦、细分明确。
   - 高星必看：每个大类只取少量代表项目，避免热门榜被单一赛道占满。
   - 新收录：按 `addedAt` 展示新加入项目。

3. 任务入口

   不按分类问用户，而按意图问：

   - 构建 AI Agent
   - 搭建 RAG / 知识库
   - 找本地模型和推理工具
   - 做多模态生成
   - 寻找开发者工具
   - 学习 AI 工程

4. 可视化概览

   用一个轻量矩阵表达“赛道 x 成熟度/活跃度”，让用户感到这是项目地图，而不是长列表。

5. 精简统计条

   展示 `18839 collected / 9090 active / 13 categories / updated 2026-05-10`，让数据规模成为可信度来源。

## 6. 信息架构

建议新入口采用 5 个主要视图，全部在一个原生 HTML 应用中通过 URL hash 或 query state 切换：

### 6.1 Radar

默认页。负责吸引注意力和给出探索入口。

模块：

- 搜索框
- 今日雷达榜
- 潜力项目榜
- 新收录项目
- 分类热区
- 任务路径入口

### 6.2 Explorer

项目探索页。负责大规模筛选。

控件：

- 搜索
- 分类
- 子分类
- 标签
- topic
- stars 区间
- 更新时间
- health
- 排序：相关度、潜力、最近活跃、stars、新收录

列表：

- 使用虚拟列表或分页渲染，避免一次性挂载几千个卡片。
- 卡片只显示决策关键字段：名称、描述、stars、更新时间、分类、标签、潜力信号、操作按钮。

### 6.3 Project Detail

项目详情抽屉或详情页。

内容：

- 项目名、GitHub 链接、分类、子类
- 一句话价值摘要
- 核心标签和 topics
- Stars、最后活动、收录时间
- 适合场景
- 相似项目
- 可替代项目
- 可配套项目
- 加入对比、收藏、打开 GitHub

### 6.4 Compare

项目对比页。

字段：

- 名称
- 描述
- stars
- lastUpdated
- category / subcategory
- tags
- topics
- health
- 推荐理由
- 风险提示

第一阶段只做字段对比。第二阶段再做 AI 生成对比结论。

### 6.5 Collections

本地收藏和探索历史。

能力：

- 本地收藏项目，写入 `localStorage`。
- 最近浏览。
- 导出收藏列表为 Markdown。
- 分享当前筛选条件 URL。

## 7. 数据模型与加工方案

### 7.1 不直接加载完整 projects.json

`data/projects.json` 约 17 MB，字段包含很多生成和维护信息。新入口不能首屏直接加载完整文件，否则移动端体验会差。

建议新增 `scripts/generate-explore-data.js`，生成以下轻量文件：

| 文件 | 用途 | 首屏是否加载 |
| --- | --- | --- |
| `public/explore/data/stats.json` | 总量、更新时间、分类计数 | 是 |
| `public/explore/data/facets.json` | 分类、子类、热门 tags、热门 topics | 是 |
| `public/explore/data/radar.json` | 今日雷达、潜力榜、新收录、高星榜 | 是 |
| `public/explore/data/catalog-lite.json` | 活跃项目轻量列表 | 搜索页加载 |
| `public/explore/data/project-details.json` | 详情补充字段 | 点击详情时懒加载 |
| `public/explore/data/related.json` | 相似项目索引 | 点击详情时懒加载 |
| `public/explore/data/search-index.json` | 原生搜索倒排索引或预处理文本 | 搜索时加载 |

### 7.2 轻量项目字段

`catalog-lite.json` 建议保留：

```json
{
  "id": "owner_repo",
  "name": "project-name",
  "owner": "owner",
  "url": "https://github.com/owner/repo",
  "description": "short summary",
  "categoryId": "agents",
  "categoryName": "智能体与编排",
  "subcategory": "Agent Frameworks",
  "tags": ["agent", "automation"],
  "topics": ["ai-agents", "llm"],
  "stars": 12345,
  "lastUpdated": "2026-05-09T00:00:00Z",
  "addedAt": "2026-05-02T00:00:00Z",
  "health": "Active",
  "scores": {
    "potential": 82,
    "freshness": 94,
    "maturity": 75,
    "focus": 68
  }
}
```

### 7.3 潜力评分

不要只按 stars 排名。建议第一阶段使用可解释的启发式评分：

```text
potential =
  freshnessScore * 0.30 +
  focusScore * 0.20 +
  starScore * 0.20 +
  categoryBalanceScore * 0.15 +
  topicSignalScore * 0.10 +
  newnessBonus * 0.05
```

字段解释：

- `freshnessScore`：`lastUpdated` 越近越高。
- `focusScore`：tags/topics 数量适中且与分类一致时更高。
- `starScore`：stars 取 log，避免高星项目碾压一切。
- `categoryBalanceScore`：每个分类内部排名，避免所有榜单都被开发工具和学习资源占据。
- `topicSignalScore`：topics 命中热门 AI 词时更高；缺失 topics 时降权但不直接淘汰。
- `newnessBonus`：`addedAt` 较新时给小幅加分。

页面上不要把这个分数包装成绝对真理，建议命名为“潜力信号”或“Discovery Signal”。

### 7.4 相似推荐

已有 `PROJECT_RECOMMENDATION_PLAN.md` 规划了基于 Meilisearch 的相似推荐。新入口可以采用分层策略：

第一阶段，纯静态相似推荐：

- 基于 `categoryId`、`subcategory`、`tags`、`topics` 做 Jaccard / BM25-like 相似度。
- 每个项目只预计算 Top 8，输出 `related.json`。
- 排除自身，优先同子类，其次同大类，再允许跨类相关。

第二阶段，接入 Meilisearch：

- 复用 `scripts/meilisearch-index.js:84-127` 的 searchable/filterable 配置。
- 用项目字段组合查询，做更灵活的 “More Like This”。

第三阶段，向量化：

- 为项目描述、tags、topics 生成 embedding。
- 用向量搜索发现语义相关项目。

## 8. 原生 HTML 技术方案

### 8.1 文件组织建议

推荐直接放在 `public/explore/`：

```text
public/explore/
  index.html
  assets/
    app.js
    search-worker.js
    style.css
  data/
    stats.json
    facets.json
    radar.json
    catalog-lite.json
    project-details.json
    related.json
    search-index.json
```

原因：

- VitePress 会把 `public/` 复制到 `docs/`，因此 `/explore/` 能和现有站点一起发布。
- 不需要改 VitePress 配置。
- 原站构建失败风险最低。

如果后续希望完全独立构建，可以改成：

```text
explore/
  src/
  scripts/
  dist/
```

然后在发布阶段复制到 `public/explore/` 或 `docs/explore/`。

### 8.2 JS 架构

不引入框架时，仍然要保持模块边界：

- `app.js`：入口、路由、状态管理。
- `data.js`：数据加载和缓存。
- `search.js`：查询解析、筛选、排序。
- `render.js`：DOM 渲染。
- `components.js`：项目卡片、详情抽屉、过滤器、榜单。
- `storage.js`：收藏、浏览历史、本地偏好。
- `analytics.js`：事件埋点。
- `search-worker.js`：大列表搜索和排序放入 Web Worker。

### 8.3 性能原则

- 首屏只加载 `stats.json`、`facets.json`、`radar.json`。
- 搜索页再加载 `catalog-lite.json`。
- 详情和相似推荐点击后再加载。
- 对项目列表使用虚拟列表或分页，每次最多渲染 30-60 个卡片。
- 搜索输入 debounce 100-150ms。
- 大量排序和匹配放到 Web Worker。
- 页面状态写入 URL，方便分享和返回。
- 静态资源启用 gzip/brotli，由托管平台处理。

目标指标：

- 首屏 HTML + CSS + JS + radar 数据 gzip 后控制在 300 KB 内。
- 首屏可交互时间小于 2 秒。
- 搜索输入到结果刷新 p95 小于 150ms。
- 移动端列表滚动不明显卡顿。

## 9. 视觉与交互方向

不要做纯营销页，要做工具第一屏。视觉应该体现“雷达 / 控制台 / 地图”，但信息密度要高，避免只有酷炫没有用。

### 9.1 推荐视觉语言

- 黑白浅色优先，支持暗色。
- 主色可以沿用 Hello-AI 的科技蓝，但减少大面积渐变。
- 卡片圆角控制在 8px 左右。
- 重要操作用图标按钮加 tooltip。
- 项目卡片强调可扫描：标题、描述、标签、指标、动作一屏内完成。

### 9.2 关键交互

- 命令式搜索：任何时候按 `/` 聚焦搜索。
- 筛选器可折叠，移动端用底部抽屉。
- 项目卡片支持：打开详情、加入对比、收藏、访问 GitHub。
- 详情抽屉内显示相似项目，形成连续探索。
- Compare Tray 固定在底部，用户可随时进入对比。
- 所有筛选状态同步到 URL。

### 9.3 注意力抓手

比“漂亮”更重要的是制造探索动机：

- 用“今日雷达”而不是“热门推荐”。
- 用“潜力信号”突出非头部项目。
- 用“替代品”和“配套项目”让每次点击都能继续探索。
- 用“任务路径”把用户从分类选择转为目标选择。
- 用“新收录”和“最近活跃”制造新鲜感。

## 10. 分阶段路线

### Phase 0：数据体检与页面原型

目标：确认数据可用性，画出最小交互模型。

任务：

- 写一个只读分析脚本，统计字段缺失、分类分布、更新时间分布、tag/topic 热度。
- 确定 `catalog-lite` 字段。
- 做 `/explore/index.html` 静态原型，不接全量数据。
- 确认 `public/explore/` 能被 VitePress 构建复制到 `docs/explore/`。

验收：

- 原 VitePress 页面和构建结果不变。
- `/explore/` 可访问。
- 原型能展示 radar mock 数据。

### Phase 1：MVP 探索入口

目标：让用户能真正搜索、筛选、打开详情。

任务：

- 新增 `scripts/generate-explore-data.js`。
- 输出 `stats.json`、`facets.json`、`radar.json`、`catalog-lite.json`。
- 实现 Radar 和 Explorer 两个视图。
- 支持搜索、分类、子类、tags、stars、更新时间筛选。
- 实现项目详情抽屉。
- 实现收藏和最近浏览。

验收：

- 首屏不加载完整 `data/projects.json`。
- 能在 9000+ 活跃项目中流畅搜索和筛选。
- 项目卡片能跳转 GitHub。
- 所有筛选条件可通过 URL 分享。

### Phase 2：潜力榜、相似推荐与对比

目标：从“能找”升级为“能判断”。

任务：

- 加入潜力评分。
- 生成 `related.json`。
- 项目详情加入相似项目、替代项目、配套项目。
- 实现 Compare Tray 和 Compare 视图。
- 支持导出收藏/对比为 Markdown。

验收：

- 任意项目详情都能给出 5-8 个相关项目。
- 用户能并排比较 2-4 个项目。
- Radar 页每个榜单不会被单一大类垄断。

### Phase 3：搜索增强

目标：提升搜索质量。

任务：

- 第一选择：继续优化前端倒排索引和排序。
- 可选增强：接入 Meilisearch 搜索 API。
- 添加查询建议和同义词映射，如 `agent`、`agents`、`ai-agent`、`autonomous-agent`。
- 对中文查询做常见映射，如“智能体”“知识库”“本地模型”“微调”。

验收：

- 输入常见英文/中文关键词都能返回合理结果。
- 搜索结果能解释命中原因：name、tag、topic、description。
- 搜索空结果时给出替代查询建议。

### Phase 4：AI 选型助手

目标：让 Hello-AI 不只是目录，而是用户的 AI 项目选型助手。

任务：

- 为项目生成更结构化的 AI 摘要：适合场景、主要风险、上手路径。
- 添加“我想做什么”表单，例如“我要做客服 Agent，需要 Node.js，最好本地可跑”。
- 输出推荐项目组，而不是单个项目。
- 支持把推荐结果导出为 Markdown。

验收：

- 用户输入一个任务目标后，能得到 5-10 个分层推荐。
- 推荐结果包含主项目、替代品、配套库、学习资源。
- 每条推荐有可解释理由。

## 11. 内容与增长策略

新入口要吸引用户注意，需要有可反复访问的理由。

建议做 5 类可持续内容：

- Weekly Radar：每周值得关注的项目自动生成。
- Rising by Category：每个分类的潜力项目。
- Toolchain Recipes：任务配方，例如“本地 RAG 栈”“Claude Code 周边”“MCP Server 开发”。
- Alternatives：热门项目替代品，例如“AutoGPT alternatives”。
- New & Active：新收录且近期活跃项目。

这些内容不一定都要人工维护，可以用数据脚本生成初稿，再逐步加入人工精选。

## 12. 数据埋点建议

现有 VitePress 已有统计脚本配置，见 `.vitepress/config.js` 的 `head` 配置。新入口可以复用同类统计，但应重点记录产品事件。

建议事件：

- `explore_view_radar`
- `explore_search`
- `explore_filter_change`
- `explore_open_project`
- `explore_open_github`
- `explore_add_compare`
- `explore_add_favorite`
- `explore_view_related`
- `explore_export_markdown`

核心指标：

- 搜索使用率。
- 项目详情打开率。
- GitHub 出站点击率。
- 相似推荐点击率。
- 对比功能使用率。
- 收藏功能使用率。
- 首屏跳出率。

## 13. 风险与应对

| 风险 | 表现 | 应对 |
| --- | --- | --- |
| 数据包过大 | 移动端加载慢 | 拆分数据，首屏只加载 radar |
| 原生 JS 失控 | 文件越来越难维护 | 从第一天按模块组织 |
| 推荐不准 | 用户不信潜力榜 | 展示命中原因和信号，不展示伪精确结论 |
| stars 垄断榜单 | 长尾项目没有曝光 | 榜单按分类配额和 log stars 排序 |
| topics 缺失 | 相似推荐质量不稳 | tags、subcategory、description 共同参与 |
| 影响原站发布 | docs 被覆盖或路由冲突 | 放 `public/explore/`，不改 VitePress 配置 |
| SEO 变弱 | SPA 内容不可索引 | VitePress 保持 SEO，Explore 负责工具体验 |

## 14. ADR

### Decision

新增 `/explore/` 原生 HTML 静态探索入口，作为 VitePress 之外的独立用户体验层。

### Drivers

- 当前数据规模已经超过普通 Markdown 目录的舒适浏览范围。
- 用户需要搜索、筛选、对比、推荐，而不是只看分类长列表。
- 原 VitePress 已承担文档与 SEO，不应该被高交互需求拖复杂。
- 纯静态原生 HTML 可以低成本部署，适合当前仓库。

### Alternatives Considered

1. 继续增强 VitePress 页面

   优点：复用当前栈。

   缺点：几千项目的交互、虚拟列表、复杂状态和搜索体验会和文档站模型冲突。

2. 新建完整前端应用

   优点：工程能力强，后续可扩展。

   缺点：引入构建链和依赖，第一阶段成本偏高。

3. 原生 HTML 静态入口

   优点：轻量、独立、可直接发布、不会破坏原站。

   缺点：需要控制 JS 模块复杂度，复杂 UI 需要自己维护。

### Why Chosen

原生 HTML 静态入口最符合当前目标：先开辟新的探索展示方式，验证用户价值，不动原 VitePress。等功能被验证后，再决定是否升级为独立前端应用。

### Consequences

- 需要新增数据生成脚本和一套静态资源。
- 需要明确数据拆分策略，不能直接加载完整 `projects.json`。
- 需要为原生 JS 制定模块边界，避免后续维护困难。

### Follow-ups

- 实施前先确认最终源码目录采用 `public/explore/` 还是 `explore/` + copy。
- Phase 1 完成后用真实页面性能决定是否继续纯前端搜索，或接入 Meilisearch。
- Phase 2 后根据用户点击数据调整潜力评分。

## 15. 下一步建议

建议后续按这个顺序实施：

1. 先做 `scripts/generate-explore-data.js`，把数据拆成小包。
2. 再做 `/explore/` 首屏 Radar，验证视觉方向和发布链路。
3. 接着做 Explorer 搜索筛选和项目详情。
4. 最后做相似推荐、对比、收藏和导出。

第一版不要追求 AI 助手。先把“几千项目能被快速探索”这件事做好，用户才会相信后续推荐和选型能力。
