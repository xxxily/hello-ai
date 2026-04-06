import{_ as a,o as n,c as t,ae as i}from"./chunks/framework.AIcMzs3L.js";const c=JSON.parse('{"title":"Hello-AI 重构计划","description":"","frontmatter":{},"headers":[],"relativePath":"REFACTOR_PLAN/index.md","filePath":"REFACTOR_PLAN/index.md"}'),p={name:"REFACTOR_PLAN/index.md"};function l(e,s,h,d,o,r){return n(),t("div",null,[...s[0]||(s[0]=[i(`<h1 id="hello-ai-重构计划" tabindex="-1">Hello-AI 重构计划 <a class="header-anchor" href="#hello-ai-重构计划" aria-label="Permalink to &quot;Hello-AI 重构计划&quot;">​</a></h1><blockquote><p>从&quot;静态目录&quot;到&quot;智能决策平台&quot;的升级方案</p></blockquote><h2 id="原始用户需求" tabindex="-1">原始用户需求 <a class="header-anchor" href="#原始用户需求" aria-label="Permalink to &quot;原始用户需求&quot;">​</a></h2><p>我用AI收集了1w+个跟AI相关的优质开源项目,创造了当前这个项目,但目前只是使用vitepress进行项目的静态展示, 感觉有点缺乏新意,或者并没有把这一万多个开源项目的价值体现出来,所以并没有获得太多人的青睐。 我想对呈现展示方式进行重构或重写,但目前还没有什么好的思路。 projects.json 下存的是原始数据,数据量有点大,直接平铺直叙地展示确实没啥价值,看着也很无感； 请帮我认真细节地深入分析下,看采用怎样的呈现方式,才更能把这1w+的优质项目,更清晰,更有层次,体检更佳地呈现出来,并且能抓住用户痛点,更好地迎合用户需求,更好地留住用户,拓宽用户等。</p><h2 id="一、当前问题诊断" tabindex="-1">一、当前问题诊断 <a class="header-anchor" href="#一、当前问题诊断" aria-label="Permalink to &quot;一、当前问题诊断&quot;">​</a></h2><h3 id="_1-数据呈现的核心问题" tabindex="-1">1. 数据呈现的核心问题 <a class="header-anchor" href="#_1-数据呈现的核心问题" aria-label="Permalink to &quot;1. 数据呈现的核心问题&quot;">​</a></h3><table tabindex="0"><thead><tr><th>问题</th><th>具体表现</th></tr></thead><tbody><tr><td><strong>信息过载</strong></td><td>单页面平铺1000+项目(如agents 1067个、devtools 1667个)，用户看几页就放弃</td></tr><tr><td><strong>缺乏层次</strong></td><td>只有大类→小类→项目列表三级，无更细的筛选维度</td></tr><tr><td><strong>静态展示</strong></td><td>纯Markdown静态页面，无法交互筛选、排序、搜索</td></tr><tr><td><strong>价值未挖掘</strong></td><td>topics、stars、health、tags等数据字段未被充分利用</td></tr><tr><td><strong>无用户视角</strong></td><td>没有&quot;我想做XX，用什么工具&quot;的引导路径</td></tr></tbody></table><h3 id="_2-用户体验痛点" tabindex="-1">2. 用户体验痛点 <a class="header-anchor" href="#_2-用户体验痛点" aria-label="Permalink to &quot;2. 用户体验痛点&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>典型用户场景：</span></span>
<span class="line"><span></span></span>
<span class="line"><span>开发者A: &quot;我想找个RAG框架，支持中文，容易上手&quot;</span></span>
<span class="line"><span>         → 当前：翻阅350个项目列表，逐个点开看 → 放弃</span></span>
<span class="line"><span></span></span>
<span class="line"><span>开发者B: &quot;LangChain和Dify哪个更适合我？&quot;</span></span>
<span class="line"><span>         → 当前：分别找到两个项目看描述 → 无法对比 → 去Google搜</span></span>
<span class="line"><span></span></span>
<span class="line"><span>初学者C: &quot;我想入门AI开发，从哪开始？&quot;</span></span>
<span class="line"><span>         → 当前：1086个学习资源，无从下手 → 离开</span></span></code></pre></div><h3 id="_3-数据价值未被释放" tabindex="-1">3. 数据价值未被释放 <a class="header-anchor" href="#_3-数据价值未被释放" aria-label="Permalink to &quot;3. 数据价值未被释放&quot;">​</a></h3><p>现有数据包含丰富字段，但当前只展示了：</p><ul><li>✅ 使用了：name, description, stars, tags, lastUpdated</li><li>❌ 未利用：<strong>topics</strong>(技术栈关键词)、<strong>health</strong>(活跃度)、<strong>subcategory</strong>(细分归类潜力)</li></ul><hr><h2 id="二、重构方向-从-目录-到-智能决策平台" tabindex="-1">二、重构方向：从&quot;目录&quot;到&quot;智能决策平台&quot; <a class="header-anchor" href="#二、重构方向-从-目录-到-智能决策平台" aria-label="Permalink to &quot;二、重构方向：从&quot;目录&quot;到&quot;智能决策平台&quot;&quot;">​</a></h2><h3 id="核心定位转变" tabindex="-1">核心定位转变 <a class="header-anchor" href="#核心定位转变" aria-label="Permalink to &quot;核心定位转变&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>当前定位: AI开源项目目录 → 被动查阅</span></span>
<span class="line"><span>新定位:   AI工具选型决策平台 → 主动引导用户找到最适合的工具</span></span></code></pre></div><h3 id="关键设计理念" tabindex="-1">关键设计理念 <a class="header-anchor" href="#关键设计理念" aria-label="Permalink to &quot;关键设计理念&quot;">​</a></h3><p><strong>1. 从&quot;展示&quot;转向&quot;决策支持&quot;</strong></p><ul><li>用户不是来&quot;浏览项目&quot;，而是来&quot;解决问题&quot;</li><li>每个交互都要帮助用户缩小选择范围</li></ul><p><strong>2. 从&quot;平铺&quot;转向&quot;多层次引导&quot;</strong></p><ul><li>大类 → 小类 → 标签过滤 → 项目卡片 → 详情 → 对比</li><li>每一层都提供筛选和导航</li></ul><p><strong>3. 从&quot;静态&quot;转向&quot;交互式&quot;</strong></p><ul><li>实时筛选、排序、收藏、对比</li><li>动态聚合统计</li></ul><hr><h2 id="三、方案一-交互式筛选平台" tabindex="-1">三、方案一：交互式筛选平台 <a class="header-anchor" href="#三、方案一-交互式筛选平台" aria-label="Permalink to &quot;三、方案一：交互式筛选平台&quot;">​</a></h2><p>将VitePress替换为<strong>现代化前端框架</strong>（Vue/React），构建真正的交互式平台。</p><h3 id="核心功能模块" tabindex="-1">核心功能模块 <a class="header-anchor" href="#核心功能模块" aria-label="Permalink to &quot;核心功能模块&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│                     Hello-AI 平台架构                        │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────┐  ┌─────────────────┐                  │</span></span>
<span class="line"><span>│  │   智能首页       │  │   决策导航      │                  │</span></span>
<span class="line"><span>│  │  - 趋势卡片      │  │ &quot;我想做XX&quot;     │                  │</span></span>
<span class="line"><span>│  │  - 快速入口      │  │ → 推荐工具     │                  │</span></span>
<span class="line"><span>│  └─────────────────┘  └─────────────────┘                  │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌───────────────────────────────────────────────────────┐ │</span></span>
<span class="line"><span>│  │                    项目筛选引擎                         │ │</span></span>
<span class="line"><span>│  │  [分类] [小类] [编程语言] [活跃度] [Star范围] [标签]   │ │</span></span>
<span class="line"><span>│  │  → 实时过滤 → 动态统计 → 结果展示                      │ │</span></span>
<span class="line"><span>│  └───────────────────────────────────────────────────────┘ │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────┐ ┌─────────────┐ ┌───────────────────────┐ │</span></span>
<span class="line"><span>│  │ 项目卡片    │ │ 项目详情页  │ │ 对比功能              │ │</span></span>
<span class="line"><span>│  │ - 核心指标  │ │ - 深度信息  │ │ - 多选对比            │ │</span></span>
<span class="line"><span>│  │ - 快速评估  │ │ - 相关推荐  │ │ - 生成对比报告        │ │</span></span>
<span class="line"><span>│  └─────────────┘ └─────────────┘ └───────────────────────┘ │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌───────────────────────────────────────────────────────┐ │</span></span>
<span class="line"><span>│  │                    特色功能                             │ │</span></span>
<span class="line"><span>│  │  • 每周趋势报告  • 技术栈图谱  • 学习路径规划           │ │</span></span>
<span class="line"><span>│  │  • 个人收藏夹    • 使用场景匹配                         │ │</span></span>
<span class="line"><span>│  └───────────────────────────────────────────────────────┘ │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span></code></pre></div><h3 id="a-智能首页-30秒内让用户找到方向" tabindex="-1">A. 智能首页 - 30秒内让用户找到方向 <a class="header-anchor" href="#a-智能首页-30秒内让用户找到方向" aria-label="Permalink to &quot;A. 智能首页 - 30秒内让用户找到方向&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│  🔍 我想要...                           [搜索框: 输入需求] │</span></span>
<span class="line"><span>├────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │</span></span>
<span class="line"><span>│  │ 构建聊天  │ │ 开发Agent│ │ 训练模型 │ │ 部署应用 │      │</span></span>
<span class="line"><span>│  │ 机器人   │ │ 智能体   │ │ 微调LLM │ │ 生产环境│      │</span></span>
<span class="line"><span>│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  🔥 本周热门趋势                                           │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐  │</span></span>
<span class="line"><span>│  │ [卡片] Agent框架热度上升 35%  → 查看Agent分类        │  │</span></span>
<span class="line"><span>│  │ [卡片] RAG工具新增 12 个   → 探索RAG工具             │  │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘  │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  📊 快速统计: 16,407项目 | 13分类 | 7,661活跃             │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>└────────────────────────────────────────────────────────────┘</span></span></code></pre></div><h3 id="b-分类页面-多维度筛选而非平铺列表" tabindex="-1">B. 分类页面 - 多维度筛选而非平铺列表 <a class="header-anchor" href="#b-分类页面-多维度筛选而非平铺列表" aria-label="Permalink to &quot;B. 分类页面 - 多维度筛选而非平铺列表&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│  🤖 智能体与编排                            1,067 个项目   │</span></span>
<span class="line"><span>├────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  筛选器:                                                    │</span></span>
<span class="line"><span>│  [▼小类] [▼语言: Python/JS/Go...] [▼活跃度] [▼Star范围]   │</span></span>
<span class="line"><span>│  [标签搜索: 输入关键词...]                    [重置] [应用] │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  当前筛选: Autonomous Agents × Python × Active            │</span></span>
<span class="line"><span>│  结果: 47 个项目                                           │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  ┌──────────────────────────────────────────────────────┐ │</span></span>
<span class="line"><span>│  │ 按Star排序 ▼ | 按更新时间 ▼ | 按活跃度 ▼ | 卡片/列表  │ │</span></span>
<span class="line"><span>│  └──────────────────────────────────────────────────────┘ │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │</span></span>
<span class="line"><span>│  │ AutoGPT      │ │ LangChain    │ │ CrewAI       │       │</span></span>
<span class="line"><span>│  │ ⭐ 183k      │ │ ⭐ 105k      │ │ ⭐ 28k       │       │</span></span>
<span class="line"><span>│  │ Python       │ │ Python       │ │ Python       │       │</span></span>
<span class="line"><span>│  │ 🟢 Active    │ │ 🟢 Active    │ │ 🟢 Active    │       │</span></span>
<span class="line"><span>│  │ 自主AI智能体 │ │ LLM应用框架  │ │ 多Agent协作  │       │</span></span>
<span class="line"><span>│  │ [详情] [对比]│ │ [详情] [对比]│ │ [详情] [对比]│       │</span></span>
<span class="line"><span>│  └──────────────┘ └──────────────┘ └──────────────┘       │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│                    [加载更多...]                            │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>└────────────────────────────────────────────────────────────┘</span></span></code></pre></div><h3 id="c-项目详情页-决策级信息" tabindex="-1">C. 项目详情页 - 决策级信息 <a class="header-anchor" href="#c-项目详情页-决策级信息" aria-label="Permalink to &quot;C. 项目详情页 - 决策级信息&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│  AutoGPT                                     ⭐ 183,074    │</span></span>
<span class="line"><span>│  https://github.com/Significant-Gravitas/AutoGPT          │</span></span>
<span class="line"><span>├────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  📊 核心指标                                                │</span></span>
<span class="line"><span>│  ┌──────────────────────────────────────────────────────┐ │</span></span>
<span class="line"><span>│  │ Stars: 183k  |  Forks: 45k  |  Issues: 320           │ │</span></span>
<span class="line"><span>│  │ 最后更新: 2026-04-03  |  创建于: 2023-03             │ │</span></span>
<span class="line"><span>│  │ 活跃度: 🟢 高  |  语言: Python 94%                   │ │</span></span>
<span class="line"><span>│  └──────────────────────────────────────────────────────┘ │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  📝 描述                                                   │</span></span>
<span class="line"><span>│  开源自主AI智能体，让LLM完全自主运行以完成复杂任务。        │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  🏷️ 标签                                                   │</span></span>
<span class="line"><span>│  Agent  Automation  Autonomous  AI  LLM  Python          │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  📂 分类                                                   │</span></span>
<span class="line"><span>│  智能体与编排 &gt; Autonomous Agents                          │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  🔄 相关对比                                               │</span></span>
<span class="line"><span>│  ┌──────────────────────────────────────────────────────┐ │</span></span>
<span class="line"><span>│  │ 与LangChain对比:                                      │ │</span></span>
<span class="line"><span>│  │ AutoGPT: 更强调自主性，适合复杂任务自动化             │ │</span></span>
<span class="line"><span>│  │ LangChain: 更强调流程编排，适合可控的LLM应用开发      │ │</span></span>
<span class="line"><span>│  │ → [查看详细对比]                                      │ │</span></span>
<span class="line"><span>│  └──────────────────────────────────────────────────────┘ │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  🎯 适用场景                                               │</span></span>
<span class="line"><span>│  • 自动化复杂多步骤任务                                    │</span></span>
<span class="line"><span>│  • 研究型AI自主探索                                        │</span></span>
<span class="line"><span>│  • 无需人工干预的智能体                                    │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  📈 趋势                                                   │</span></span>
<span class="line"><span>│  [迷你图表: Star增长曲线 - 显示近6个月趋势]                │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  🔗 快速链接                                               │</span></span>
<span class="line"><span>│  [GitHub] [文档] [示例] [教程]                             │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  [+ 加入对比列表] [⭐ 收藏]                                │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>└────────────────────────────────────────────────────────────┘</span></span></code></pre></div><h3 id="d-对比功能-核心差异化能力" tabindex="-1">D. 对比功能 - 核心差异化能力 <a class="header-anchor" href="#d-对比功能-核心差异化能力" aria-label="Permalink to &quot;D. 对比功能 - 核心差异化能力&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│  项目对比 (已选3个)                          [导出报告]    │</span></span>
<span class="line"><span>├────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  ┌────────────────┬────────────┬────────────┬────────────┐│</span></span>
<span class="line"><span>│  │ 指标           │ AutoGPT    │ LangChain  │ CrewAI     ││</span></span>
<span class="line"><span>│  ├────────────────┼────────────┼────────────┼────────────┤│</span></span>
<span class="line"><span>│  │ Stars          │ 183k ✓     │ 105k       │ 28k        ││</span></span>
<span class="line"><span>│  │ 活跃度         │ 高 ✓       │ 高 ✓       │ 中         ││</span></span>
<span class="line"><span>│  │ 主要语言       │ Python     │ Python     │ Python     ││</span></span>
<span class="line"><span>│  │ 更新频率       │ 每日       │ 每日       │ 每周       ││</span></span>
<span class="line"><span>│  │ 学习难度       │ 中         │ 低 ✓       │ 中         ││</span></span>
<span class="line"><span>│  │ 文档质量       │ 良好       │ 优秀 ✓     │ 良好       ││</span></span>
<span class="line"><span>│  │ 社区规模       │ 大 ✓       │ 大 ✓       │ 中         ││</span></span>
<span class="line"><span>│  ├────────────────┼────────────┼────────────┼────────────┤│</span></span>
<span class="line"><span>│  │ 核心特点       │            │            │            ││</span></span>
<span class="line"><span>│  │                │ 自主性强   │ 灵活编排   │ 多Agent    ││</span></span>
<span class="line"><span>│  │                │ 适合自动化 │ 易于上手   │ 团队协作   ││</span></span>
<span class="line"><span>│  ├────────────────┼────────────┼────────────┼────────────┤│</span></span>
<span class="line"><span>│  │ 最佳场景       │            │            │            ││</span></span>
<span class="line"><span>│  │                │ 复杂任务   │ 应用开发   │ 多Agent    ││</span></span>
<span class="line"><span>│  │                │ 自动执行   │ 流程控制   │ 系统构建   ││</span></span>
<span class="line"><span>│  └────────────────┴────────────┴────────────┴────────────┘│</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>│  💡 AI推荐:                                                │</span></span>
<span class="line"><span>│  • 初学者入门: 推荐 LangChain                              │</span></span>
<span class="line"><span>│  • 企业级应用: 推荐 LangChain + CrewAI组合                 │</span></span>
<span class="line"><span>│  • 研究型自主Agent: 推荐 AutoGPT                           │</span></span>
<span class="line"><span>│                                                            │</span></span>
<span class="line"><span>└────────────────────────────────────────────────────────────┘</span></span></code></pre></div><hr><h2 id="四、数据增强建议" tabindex="-1">四、数据增强建议 <a class="header-anchor" href="#四、数据增强建议" aria-label="Permalink to &quot;四、数据增强建议&quot;">​</a></h2><h3 id="_1-提取更多维度字段" tabindex="-1">1. 提取更多维度字段 <a class="header-anchor" href="#_1-提取更多维度字段" aria-label="Permalink to &quot;1. 提取更多维度字段&quot;">​</a></h3><p>从现有数据提取/计算：</p><div class="language-json vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">json</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">{</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;name&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;AutoGPT&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  // 新增字段 ↓</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;primaryLanguage&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Python&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// 从topics或URL提取</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;languageRatio&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: { </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">&quot;Python&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">94</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">&quot;JavaScript&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">6</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> },</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;maturityScore&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">85</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// 基于stars/forks/issues/更新频率综合计算</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;activityLevel&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;high&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// high/medium/low/stale</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;weeklyGrowth&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;+2.3%&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// Star增长趋势</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;documentationQuality&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;good&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// 可通过是否有wiki/docs文件夹判断</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;alternatives&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;LangChain&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;CrewAI&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">],  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// AI计算相似项目</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;useCases&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;自动化任务&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;智能体研究&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;流程编排&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">],</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;difficultyLevel&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;intermediate&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// beginner/intermediate/advanced</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;companyBacking&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">false</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// 是否有公司背书</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;license&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;MIT&quot;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span></code></pre></div><h3 id="_2-构建关系图谱" tabindex="-1">2. 构建关系图谱 <a class="header-anchor" href="#_2-构建关系图谱" aria-label="Permalink to &quot;2. 构建关系图谱&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>项目关系:</span></span>
<span class="line"><span>- 同类项目(竞争关系)</span></span>
<span class="line"><span>- 依赖项目(互补关系)</span></span>
<span class="line"><span>- 替代项目(选择关系)</span></span>
<span class="line"><span>- 扩展项目(增强关系)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>示例:</span></span>
<span class="line"><span>AutoGPT → 同类: [LangChain, CrewAI, AgentGPT]</span></span>
<span class="line"><span>       → 依赖: [OpenAI API, Python]</span></span>
<span class="line"><span>       → 替代: [手动API调用]</span></span>
<span class="line"><span>       → 扩展: [LangChain插件]</span></span></code></pre></div><h3 id="_3-预计算聚合数据" tabindex="-1">3. 预计算聚合数据 <a class="header-anchor" href="#_3-预计算聚合数据" aria-label="Permalink to &quot;3. 预计算聚合数据&quot;">​</a></h3><div class="language-json vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">json</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// data/aggregations.json</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">{</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;trends&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: {</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    &quot;weekly&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: {</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">      &quot;hotCategories&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;agents&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;rag_data&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">],</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">      &quot;risingProjects&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: [</span><span style="--shiki-light:#B31D28;--shiki-light-font-style:italic;--shiki-dark:#FDAEB7;--shiki-dark-font-style:italic;">...</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">],</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">      &quot;newProjects&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: [</span><span style="--shiki-light:#B31D28;--shiki-light-font-style:italic;--shiki-dark:#FDAEB7;--shiki-dark-font-style:italic;">...</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  },</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;languageDistribution&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: {</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    &quot;Python&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">4521</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    &quot;JavaScript&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">1203</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    &quot;Go&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">312</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#B31D28;--shiki-light-font-style:italic;--shiki-dark:#FDAEB7;--shiki-dark-font-style:italic;">    ...</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  },</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;tagCooccurrence&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: {</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    &quot;Agent+LLM&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">156</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    &quot;RAG+Vector&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">89</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#B31D28;--shiki-light-font-style:italic;--shiki-dark:#FDAEB7;--shiki-dark-font-style:italic;">    ...</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span></code></pre></div><hr><h2 id="五、技术栈建议" tabindex="-1">五、技术栈建议 <a class="header-anchor" href="#五、技术栈建议" aria-label="Permalink to &quot;五、技术栈建议&quot;">​</a></h2><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>前端框架: Vue 3 + Vite (已熟悉Vue)</span></span>
<span class="line"><span>UI组件库: Element Plus / Naive UI</span></span>
<span class="line"><span>状态管理: Pinia</span></span>
<span class="line"><span>搜索/筛选: FlexSearch (轻量全文搜索)</span></span>
<span class="line"><span>图表: ECharts (趋势图、分布图)</span></span>
<span class="line"><span>SSG: vite-plugin-ssg 或改用 Nuxt 3</span></span></code></pre></div><hr><h2 id="六、实施路线图" tabindex="-1">六、实施路线图 <a class="header-anchor" href="#六、实施路线图" aria-label="Permalink to &quot;六、实施路线图&quot;">​</a></h2><h3 id="phase-1-数据层增强-1-2周" tabindex="-1">Phase 1: 数据层增强 (1-2周) <a class="header-anchor" href="#phase-1-数据层增强-1-2周" aria-label="Permalink to &quot;Phase 1: 数据层增强 (1-2周)&quot;">​</a></h3><p><strong>目标</strong>: 丰富数据维度，为前端交互提供基础</p><table tabindex="0"><thead><tr><th>任务</th><th>说明</th><th>输出</th></tr></thead><tbody><tr><td>1.1 提取语言字段</td><td>从topics/URL推断主要编程语言</td><td><code>primaryLanguage</code> 字段</td></tr><tr><td>1.2 计算活跃度评分</td><td>综合stars/更新频率/issues计算</td><td><code>activityScore</code>, <code>activityLevel</code></td></tr><tr><td>1.3 预生成筛选索引</td><td>生成各分类的筛选维度数据</td><td><code>data/filter-index.json</code></td></tr><tr><td>1.4 构建项目相似度</td><td>AI计算同类/替代项目关系</td><td><code>alternatives</code>, <code>related</code> 字段</td></tr><tr><td>1.5 提取难度等级</td><td>根据项目复杂度判断</td><td><code>difficultyLevel</code> 字段</td></tr></tbody></table><p><strong>验收标准</strong>:</p><ul><li>projects.json 包含新增字段</li><li>生成 filter-index.json 供前端使用</li><li>数据脚本可复用现有LLM评估流程</li></ul><h3 id="phase-2-交互式筛选页面-2-3周" tabindex="-1">Phase 2: 交互式筛选页面 (2-3周) <a class="header-anchor" href="#phase-2-交互式筛选页面-2-3周" aria-label="Permalink to &quot;Phase 2: 交互式筛选页面 (2-3周)&quot;">​</a></h3><p><strong>目标</strong>: 实现核心筛选交互，替代静态列表</p><table tabindex="0"><thead><tr><th>任务</th><th>说明</th><th>输出</th></tr></thead><tbody><tr><td>2.1 项目初始化</td><td>Vue3 + Vite + UI库搭建</td><td>基础项目结构</td></tr><tr><td>2.2 分类筛选组件</td><td>多维度下拉筛选器</td><td><code>&lt;CategoryFilter&gt;</code></td></tr><tr><td>2.3 项目卡片组件</td><td>紧凑信息展示卡片</td><td><code>&lt;ProjectCard&gt;</code></td></tr><tr><td>2.4 筛选逻辑实现</td><td>前端实时过滤 + 分页</td><td>筛选引擎</td></tr><tr><td>2.5 移动端适配</td><td>响应式设计</td><td>移动端友好界面</td></tr><tr><td>2.6 URL状态同步</td><td>筛选条件持久化到URL</td><td>分享/收藏支持</td></tr></tbody></table><p><strong>验收标准</strong>:</p><ul><li>用户可按语言/活跃度/Star范围筛选</li><li>筛选结果实时更新(无页面刷新)</li><li>移动端体验流畅</li></ul><h3 id="phase-3-详情页-对比功能-1-2周" tabindex="-1">Phase 3: 详情页+对比功能 (1-2周) <a class="header-anchor" href="#phase-3-详情页-对比功能-1-2周" aria-label="Permalink to &quot;Phase 3: 详情页+对比功能 (1-2周)&quot;">​</a></h3><p><strong>目标</strong>: 提供决策级信息展示</p><table tabindex="0"><thead><tr><th>任务</th><th>说明</th><th>输出</th></tr></thead><tbody><tr><td>3.1 项目详情页</td><td>单项目深度信息展示</td><td><code>/project/:id</code> 页面</td></tr><tr><td>3.2 对比选择器</td><td>多选加入对比列表</td><td><code>&lt;CompareSelector&gt;</code></td></tr><tr><td>3.3 对比表格</td><td>多项目指标对比视图</td><td><code>&lt;CompareTable&gt;</code></td></tr><tr><td>3.4 相关推荐</td><td>同类/替代项目推荐</td><td>详情页推荐区块</td></tr><tr><td>3.5 导出对比报告</td><td>生成Markdown/PDF报告</td><td>导出功能</td></tr></tbody></table><p><strong>验收标准</strong>:</p><ul><li>详情页展示完整决策信息</li><li>可同时对比3-5个项目</li><li>支持导出对比结果</li></ul><h3 id="phase-4-特色功能-持续迭代" tabindex="-1">Phase 4: 特色功能 (持续迭代) <a class="header-anchor" href="#phase-4-特色功能-持续迭代" aria-label="Permalink to &quot;Phase 4: 特色功能 (持续迭代)&quot;">​</a></h3><p><strong>目标</strong>: 打造差异化竞争力</p><table tabindex="0"><thead><tr><th>任务</th><th>说明</th><th>输出</th></tr></thead><tbody><tr><td>4.1 每周趋势报告</td><td>自动生成周报</td><td><code>/weekly-report</code> 页面</td></tr><tr><td>4.2 学习路径规划</td><td>按用户水平推荐学习顺序</td><td>学习路径功能</td></tr><tr><td>4.3 用户收藏功能</td><td>本地收藏项目列表</td><td>收藏夹功能</td></tr><tr><td>4.4 使用场景匹配</td><td>&quot;我想做XX&quot;智能推荐</td><td>场景导航功能</td></tr><tr><td>4.5 技术栈图谱</td><td>项目间关系可视化</td><td>关系图谱页面</td></tr></tbody></table><p><strong>验收标准</strong>:</p><ul><li>特色功能可独立使用</li><li>增强用户粘性和回访率</li></ul><hr><h2 id="七、预期效果对比" tabindex="-1">七、预期效果对比 <a class="header-anchor" href="#七、预期效果对比" aria-label="Permalink to &quot;七、预期效果对比&quot;">​</a></h2><table tabindex="0"><thead><tr><th>维度</th><th>当前</th><th>改进后</th></tr></thead><tbody><tr><td><strong>信息密度</strong></td><td>1000+项目平铺</td><td>筛选后20-50个精准结果</td></tr><tr><td><strong>决策时间</strong></td><td>30分钟+翻阅</td><td>3分钟找到合适工具</td></tr><tr><td><strong>用户留存</strong></td><td>看2页就离开</td><td>筛选→详情→对比→收藏</td></tr><tr><td><strong>差异化</strong></td><td>和其他目录站一样</td><td>独特的对比/推荐功能</td></tr><tr><td><strong>SEO</strong></td><td>基础</td><td>动态页面+结构化数据</td></tr><tr><td><strong>口碑传播</strong></td><td>&quot;又一个导航站&quot;</td><td>&quot;帮我选工具的决策平台&quot;</td></tr></tbody></table><hr><h2 id="八、风险与应对" tabindex="-1">八、风险与应对 <a class="header-anchor" href="#八、风险与应对" aria-label="Permalink to &quot;八、风险与应对&quot;">​</a></h2><table tabindex="0"><thead><tr><th>风险</th><th>影响</th><th>应对策略</th></tr></thead><tbody><tr><td>技术迁移成本</td><td>需重新学习框架</td><td>保留Vue(已熟悉)，渐进迁移</td></tr><tr><td>数据处理复杂度</td><td>需新增脚本</td><td>复用现有LLM评估流程</td></tr><tr><td>SEO下降</td><td>动态页面SEO差</td><td>使用SSG预渲染关键页面</td></tr><tr><td>首次加载慢</td><td>JSON数据量大</td><td>分片加载+懒加载</td></tr></tbody></table><hr><h2 id="九、下一步行动" tabindex="-1">九、下一步行动 <a class="header-anchor" href="#九、下一步行动" aria-label="Permalink to &quot;九、下一步行动&quot;">​</a></h2><ol><li><strong>确认方案</strong>: 决定采用完整重构还是渐进式改进</li><li><strong>优先级排序</strong>: 从Phase 1开始还是先实现核心筛选功能</li><li><strong>技术选型</strong>: 确认UI组件库和状态管理方案</li><li><strong>原型设计</strong>: 可先用纸面原型验证交互流程</li></ol><hr><p><em>文档创建时间: 2026-04-03</em><em>最后更新: 2026-04-03</em></p>`,81)])])}const g=a(p,[["render",l]]);export{c as __pageData,g as default};
