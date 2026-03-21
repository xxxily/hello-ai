# Hello-AI

📚 **文档地址：[https://hello-ai.anzz.top](https://hello-ai.anzz.top)**

<br />
<br />
<img alt="Hello-AI" src="https://cdn.jsdelivr.net/npm/hello-ai/assets/img/logo.png" width="96" height="96">
<br />
<br />

> 这是个帮助自己链接到广阔AI世界的项目，也希望能帮助到你。

## 概述

帮助自己也让更多人链接到AI世界，这是这个项目的初衷。  

作为AI降临派的带路者之一，在ChatGPT最火热的时候，本着拒绝被割韭菜的初心，也曾提供了一系列公益的AI服务，帮助了一部分人链接上了AI世界。
时光荏苒，如今AI已经遍地开花，曾经的公益服务也因为各种原因停止了。但是，这个项目的初衷还在：**帮助自己也让更多人链接到AI世界！**

因此，本项目迎来了全新的 **2.0 重构方案**：我们不再直接提供AI基础服务，而是将注意力转移到浩如烟海的开源世界中。
本项目现在作为一个**智能更新的 AI 项目全景地图**，通过 AI 代理自动收集、评估、分类和追踪全球最新、最热的 AI 延伸项目（涵盖基础大模型、AI基础设施、智能体编排、RAG与数据工程、多模态等）。

**核心特色：**
- 🤖 **AI 自动化维护**：项目的收集、打标、过时清理，全部由 AI 代理和定时任务自动完成，实现“让AI帮助人类连接AI”。
- 📦 **全面分类整理**：让你不再错过开源社区里优秀的 AI 新生力量。
- 🔄 **持续追踪**：及时查漏补缺，剔除停更项目，动态跟进最新热门。

欢迎你在这里探索，发现提升效率的利器！

## 🏗️ 架构与执行逻辑

本项目完全依靠自动化脚本与大语言模型协同工作。以下是系统的可视化运行架构图，展示了从数据发现到前端渲染的完整数据流向：

```mermaid
graph TD
    classDef default fill:#f9f9f9,stroke:#e0e0e0,stroke-width:1px;
    classDef database fill:#e1f5fe,stroke:#4fc3f7,stroke-width:2px;
    classDef ai fill:#fff3e0,stroke:#ffb74d,stroke-width:2px;
    classDef process fill:#e8f5e9,stroke:#81c784,stroke-width:2px;
    
    subgraph Discovery [1. 探索发现层 - Discovery]
        T[(topics.json<br/>知识主题池)]:::database -->|提供轮询关键词| Fetch[GitHub 检索脚本]:::process
        Fetch -.->|反向扩充未记录新主题| T
        Fetch -->|高星级项目入库| Q[(pending-projects.json<br/>待审队列)]:::database
    end

    subgraph Evaluation [2. AI 评估层 - Evaluation]
        Q -->|一次提取 N 个项目| P[Batch 合并提词]:::process
        DB[(projects.json<br/>核心项目库)]:::database -.->|提供最新动态大/小类| P
        P --> LLM((LLM 大语言模型<br/>打标 / 摘要 / 分类)):::ai
        LLM --> Condition{AI 评分与判决}
    end

    subgraph Storage [3. 数据隔离层 - Storage]
        Condition -->|不相关或过差项目| R[(rejected-projects.json<br/>审计垃圾桶)]:::database
        Condition -->|合格的高质量项目| DB
    end

    subgraph Frontend [4. 视图呈现层 - Views]
        DB -->|全动态映射注入| Vite[VitePress Nav与Sidebar]:::process
        DB -->|按 Subcategory 聚合| Gen[generate-docs.js 生成器]:::process
        Vite --> Site([🌍 Hello-AI 网站入口])
        Gen -->|输出各分类下 Markdown| Site
    end
```

其核心运行机制、闭环数据流与系统架构概况详细如下：

### 1. 动态自演进的数据发现层 (Discovery)
- **Topic 动态挖掘：** 借助 `data/topics.json` 中定义的主题种子列表，抓取引擎会按“最久未探索”的维度轮询 GitHub API 检索 `Stars >= 500` 的新仓库。
- **知识库自生长：** 当从爬取的项目中发现未曾见过的新 Topic，系统会自动将其登记进 `topics.json` 并标记为级别2（次级探索目标）。
- **待处理队列：** 发现的所有高可用全新仓库，都会流向待定池 `data/pending-projects.json` 准备受审。

### 2. 本地/云端 AI 批处理评估层 (Evaluation)
- **并发批量过审引擎：** 核心脚本 `discover-and-evaluate.js` 每次从待审池抽取定量批次（可通过环境变量 `EVALUATE_BATCH_SIZE` 配置，比如一次评价 5~10 个）构建出合并 Prompt 交给 LLM。这种批处理设计能复用 Token 与上下文，规避频繁的接口频率限制。
- **动态分类路由：** 系统绝不“硬编码”任何分类枚举。每次评估前都会动态读取主库 `data/projects.json` 中配置的有效 `categories` 与其子分类（Subcategories），将其注入 Prompt 指导 AI 做出归类。
- **打标与审计：** AI 自动生成短评、标签、大类小类标记并写入主数据流。对于不合格的、AI 判定无意义或无法对应分类的项，将被记录到专门的 `data/rejected-projects.json` 隔离审计库之中。
- **客观热门榜单：** 每日客观计算，强制重算最近更新、Star最高的头尾 30 名项目，自动将其覆盖到 `🔥 热门推荐` 中。

### 3. 前端自动化渲染与视图解耦 (View Generation)
- **自适应路由呈现：** 本项目采用 VitePress 框架构建，其 Navbar (`nav`) 与 Sidebar (`sidebar`) 被完全改写，不再静态录入。只要 `projects.json` 发生增加/删减分类操作，VitePress 编译器将动态分析它并精准呈递进前端侧边栏，避免数据与 UI 产生视图错乱。
- **智能 Markdown 小类折叠：** `generate-docs.js` 会自动遍历大类，并在生成各个大类文档页时，根据项目归属的 `subcategory` 将项目智能分组到 `## 标题` 之下，确保大量展示时的整洁感。

### 4. 自动化驱动引擎 (Automation Process)
- 为了追求无人值守的完美流线（比如规避访问限流），您可选用 `scripts/loop-eval.js` 等进程守护型执行器，通过内置的 `Sleep` 等轮询机制，长期维持 **发现 -> 暂存 -> AI评估 -> 静态页打包** 面向开源大海的探索闭环。

---

## 🚀 本地部署与运行指南

完全欢迎您在本地自己跑通这套基于大模型自动扩展整理的分类知识库。非常容易上手：

### 1. 环境准备与依赖安装
需要 Node.js 环境（推荐 18.x 及以上版本）。
```bash
git clone https://github.com/xxxily/hello-ai.git
cd hello-ai
npm install
```

### 2. 环境变量配置
复制一份环境配置模板并修改：
```bash
cp .env.example .env
```
用编辑器打开 `.env` 调整以下核心参数：
- **`GITHUB_TOKEN=`** `(强烈建议配置)`：搜索限流极高，不置为空很容易触发限流风控。
- **`LLM_API_KEY=`**：你的 大语言模型 API Key（用于分析和筛选项目）。
  - *💡 零成本本地提示：如果你在使用本地部署大模型（如 Ollama + llama3），可以将其设为 `local-fallback`。*
- **`LLM_BASE_URL=`**：API转发地址（例如：`https://api.openai.com/v1` 或 本地 `http://127.0.0.1:11434/v1`）。
- **`LLM_MODEL=`**：要执行推理的模型名字。
- **`DISCOVER_BATCH_SIZE`** / **`EVALUATE_BATCH_SIZE`**：可控每次探索拉取的个数，及一次批量合并扔给 AI 判断的项目个数。

### 3. 开始执行自动化作业
您可以按照需求来跑跑脚本：
- **单次试运行**：
  ```bash
  npm run ai:discover-eval
  ```
- **开启无人守护循环模式** (推荐用于长久维护)：
  ```bash
  npm run ai:loop-eval
  ```

### 4. 动态生成页面与本地阅览
等待 AI 完成打标写档后，可以一键将数据变回网站！
```bash
# 根据 projects.json 数据，生成各个大类的文档归组 Markdown
npm run ai:generate-docs

# 启动本地 VitePress Web 服务器（比如: 实时预览分类和数据）
npm run docs:dev

# 发布静态化预编译站点 (产出于 docs 目录下)
npm run docs:build
```

---

## 🌟 探索 AI 项目

请通过本站的系统导航，浏览这片由 AI 自动为你精选的开源代码绿洲。
我们的爬虫和打分模型会定期搜罗 GitHub 上的热门项目，保持这份目录的鲜活度！

📚 **在线访问：[https://hello-ai.anzz.top](https://hello-ai.anzz.top)**

## 交流群

> AI闲聊群，部分群组提供直接跟AI对聊的体验服务，可和更多志同道合的人交流讨论。  

| 加电报群（Telegram） | 加微信群（需注明：进AI群） |
| :----: | :----: |
| <img src="https://cdn.jsdelivr.net/npm/hello-ai/assets/img/tg_qun.jpg" width="280"/> | <img src="https://cdn.jsdelivr.net/npm/hello-ai/assets/img/WeChat2.png" width=280 /> |

> 微信群不注明要进群，则不会邀你入群，避免给你造成信息骚扰  
> 电报群地址：[https://t.me/auto_gpt_ai](https://t.me/auto_gpt_ai)  
