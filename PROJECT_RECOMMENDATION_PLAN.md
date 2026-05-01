# AI 项目相似度推荐方案规划

## 1. 目标与背景 (Objective & Background)
**目标**：实现“输入项目名称，搜索出相关度最高的同类型项目”功能。
**背景**：在 `data/projects.json` 中包含海量 AI 项目，每个项目拥有 `name`, `description`, `tags`, `topics`, `subcategory` 等维度。项目目前已接入 **Meilisearch** 作为搜索引擎，这为实现“相似推荐”功能奠定了非常好的基础。

## 2. 方案对比 (Alternatives Considered)

针对大规模数据进行相似推荐，目前主流方案有以下三种：

| 方案 | 实现原理 | 优点 | 缺点 | 适用场景 |
| :--- | :--- | :--- | :--- | :--- |
| **方案 A：基于现有 Meilisearch 的特征检索** (More Like This) | 提取目标项目的 `tags`, `topics`, `subcategory`，利用 Meilisearch 构造组合检索词，计算得分排序。 | 完全复用现有搜索引擎，零额外成本，实现极其简单，响应极快。 | 仅基于标签字面匹配，无法理解深层语义差异。 | **短期最佳推荐**，现有基建可立即满足。 |
| **方案 B：Meilisearch 向量搜索** (Vector Search / Embeddings) | 结合 LLM 生成项目描述的向量(Embeddings)，利用 Meilisearch 1.3+ 版本的 Vector Search 功能进行余弦相似度搜索。 | 语义理解最强（如：能理解“大型语言模型”和“LLM”高度相关），准确度最高。 | 需要调用大模型 Embedding API，构建数据时有一定耗时和成本。 | **中长期最佳演进方案**，适合追求极致推荐效果时接入。 |
| **方案 C：纯前端静态映射表** (Jaccard 相似度预计算) | 构建脚本在打包期间，基于项目的 tags 和 topics 离线计算两两之间的相似度，输出一个 `related_projects.json` 文件供前端加载。 | 无需依赖后端服务检索，纯静态、部署简单。 | 随着项目库无限增长，矩阵文件体积会呈 $O(n^2)$ 级膨胀，前端性能会出问题。 | 数据量小 (<1000) 且不依赖搜索服务的纯静态站。 |

## 3. 推荐实施路径 (Proposed Solution)

综合考虑项目目前已有 Meilisearch 基建，推荐采用 **方案 A（基于 Meilisearch 特征检索）作为核心实现**，并为未来保留 **方案 B（向量检索）** 的升级空间。

### 阶段一：实现方案 A（当前阶段行动计划）

**核心逻辑 (More Like This)**：
如果用户输入了 "AutoGPT"，我们可以提取出它的属性：`tags: ["Agent", "Automation", "Autonomous"]`，`topics: ["agentic-ai", "agents", "ai", ...]`。将这些关键词组成一段查询文本语料，放进 Meilisearch 搜索，并排除 "AutoGPT" 本身。

**实施步骤**：
1. **完善搜索服务层 (后端/API 封装)**：
   - 增加一个 `getSimilarProjects(projectName)` 函数。
   - 第一步：在 Meilisearch 中根据 `name` 精确查询目标项目，获取该项目的 `description`, `tags`, `topics`, `subcategory`。
   - 第二步：拼接搜索词（权重可以通过查询字符串重复次数调整）。例如 `query = tags.join(" ") + " " + topics.join(" ") + " " + subcategory`。
   - 第三步：使用拼接好的 query 对 Meilisearch 的 `ai_projects` 索引进行搜索。并在 filter 参数中加上 `name != '目标项目名称'`，避免搜出自己。取 Top 5 ~ 10。
2. **前端集成层**：
   - 在项目详情页或搜索下拉框中，新增“相关项目 / 猜你喜欢”模块。
   - 传入用户当前点击或搜索的项目名称，调用相似度接口，将结果渲染为列表或卡片。

### 阶段二：向方案 B（向量化语义推荐）演进的准备
如果未来对推荐精准度要求极高，可以在构建时加入向量化流程：
1. 修改 `scripts/meilisearch-index.js`，增加调用类似 OpenAI 的 `text-embedding-3-small` 或免费开源的 Embedding 接口。
2. 开启 Meilisearch 的 `vectorStore` 设置。
3. 搜索时，仅需将输入的项目描述转换为向量并调用 Meilisearch 的向量检索 API。

## 4. 方案验证与测试 (Verification & Testing)

1. **功能验证**：针对已知相似度的项目（如 `AutoGPT` 和 `opencode`）进行查询，验证它们能否在彼此的相关推荐列表中处于前列。
2. **过滤验证**：验证推荐列表中是否严格排除了基准项目自身。
3. **性能验证**：基于现有的数千条数据，确保相关项目的二次查询耗时控制在几十毫秒级，不影响页面主体的渲染。