import fs from 'fs'
import path from 'path'
import zhNav from './nav/zh'
import zhSidebar from './sidebar/zh'

const exploreHtmlPath = path.resolve(process.cwd(), 'public/explore/index.html')
const SITE_ORIGIN = 'https://hello-ai.anzz.site'
const SITE_NAME = 'Hello-AI'
const GITHUB_URL = 'https://github.com/xxxily/hello-ai'
const LOGO_URL = `${SITE_ORIGIN}/assets/img/logo.png`
const SOCIAL_IMAGE_URL = `${SITE_ORIGIN}/assets/img/social-card.png`
const DEFAULT_DESCRIPTION = 'Hello-AI 是一个持续更新的 AI 开源项目导航，帮助开发者按任务、分类和技术方向发现值得使用的项目。'

const CATEGORY_DESCRIPTIONS = {
  trending: '浏览近期值得关注的 AI 开源项目，快速了解社区中正在升温的工具和方向。',
  llms: '浏览基础大模型、语言模型和模型生态相关的 AI 开源项目，比较不同技术路线。',
  agents: '浏览智能体框架、多智能体系统、工作流编排和工具调用相关的 AI 开源项目。',
  rag_data: '浏览 RAG、向量数据库、知识库、嵌入和检索相关的 AI 开源项目。',
  infrastructure: '浏览模型部署、推理服务、云端基础设施和本地运行相关的 AI 开源项目。',
  finetuning: '浏览模型微调、训练、评测和数据处理相关的 AI 开源项目。',
  multimodal: '浏览图像、视频、语音和多模态模型相关的 AI 开源项目。',
  devtools: '浏览 AI 编程、开发工具、SDK、命令行工具和自动化工具相关的开源项目。',
  applications: '浏览面向终端用户的 AI 应用、助手、生产力工具和创作工具。',
  learning: '浏览 AI 课程、教程、论文、实践资料和学习路线相关的开源资源。',
  desktop_tools: '浏览桌面端、操作系统集成和本地 AI 应用相关的开源项目。',
  robotics_iot: '浏览机器人、具身智能、物联网和边缘设备相关的 AI 开源项目。',
  finance_business: '浏览商业分析、量化交易和金融场景相关的 AI 开源项目。'
}

function getPageRoute(page = '') {
  const normalized = String(page).replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized || normalized.toLowerCase() === 'index.md') return '/'

  const withoutExtension = normalized.replace(/\.md$/i, '')
  if (withoutExtension.toLowerCase().endsWith('/index')) {
    return `/${withoutExtension.slice(0, -'/index'.length)}/`
  }

  return `/${withoutExtension}.html`
}

function getPageDescription(page, pageData = {}, fallback = '') {
  const frontmatterDescription = pageData.frontmatter?.description
  if (typeof frontmatterDescription === 'string' && frontmatterDescription.trim()) {
    return frontmatterDescription.trim()
  }

  const normalizedPage = String(page).replace(/\\/g, '/').toLowerCase()
  if (normalizedPage === 'index.md') return DEFAULT_DESCRIPTION
  if (normalizedPage === 'home/index.md') {
    return '了解 Hello-AI 如何整理 AI 开源项目，并从任务入口、分类目录和 Explore 中开始探索。'
  }
  if (normalizedPage === 'home/categories.md') {
    return '按基础模型、智能体、RAG、多模态、开发工具等方向浏览 Hello-AI 收录的 AI 开源项目。'
  }

  const categoryMatch = normalizedPage.match(/^home\/([^/]+)\.md$/)
  if (categoryMatch && CATEGORY_DESCRIPTIONS[categoryMatch[1]]) {
    return CATEGORY_DESCRIPTIONS[categoryMatch[1]]
  }

  if (normalizedPage.startsWith('plans/')) {
    return `阅读 Hello-AI 的规划文档，了解项目发现、分类整理和产品体验的设计思路。`
  }

  if (normalizedPage === 'readme.md' || normalizedPage === 'readme-zh.md') {
    return DEFAULT_DESCRIPTION
  }

  return String(fallback || DEFAULT_DESCRIPTION).trim()
}

function getBreadcrumbs(page, title, canonical) {
  const normalizedPage = String(page).replace(/\\/g, '/').toLowerCase()
  const items = [{ name: '首页', url: `${SITE_ORIGIN}/` }]

  if (normalizedPage === 'index.md') return items

  if (normalizedPage.startsWith('home/')) {
    items.push({ name: 'AI 项目目录', url: `${SITE_ORIGIN}/home/` })
  } else if (normalizedPage.startsWith('plans/')) {
    items.push({ name: '规划文档', url: `${SITE_ORIGIN}/plans/` })
  }

  items.push({ name: title.replace(/\s*\|\s*Hello-AI$/i, ''), url: canonical })
  return items
}

function createStructuredData({ page, title, description, canonical, pageData }) {
  const isHome = getPageRoute(page) === '/'
  const isCategory = /^home\/(?!index\.md$|categories\.md$)[^/]+\.md$/i.test(String(page))
  const breadcrumbs = getBreadcrumbs(page, title, canonical)

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_ORIGIN}/#organization`,
        name: SITE_NAME,
        url: SITE_ORIGIN,
        logo: {
          '@type': 'ImageObject',
          url: LOGO_URL,
          width: 505,
          height: 512
        },
        sameAs: [GITHUB_URL]
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        name: SITE_NAME,
        url: SITE_ORIGIN,
        inLanguage: 'zh-CN',
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_ORIGIN}/explore/#explore?q={search_term_string}`
          },
          'query-input': 'required name=search_term_string'
        }
      },
      {
        '@type': isHome || isCategory ? 'CollectionPage' : 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        inLanguage: 'zh-CN',
        isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        about: {
          '@type': 'Thing',
          name: 'AI 开源项目与开发资源'
        },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: SOCIAL_IMAGE_URL,
          width: 1200,
          height: 630
        },
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        dateModified: pageData.lastUpdated ? new Date(pageData.lastUpdated).toISOString() : undefined
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url
        }))
      }
    ]
  }
}

function createPageHead(pageData) {
  const page = pageData.relativePath
  const pageDescription = getPageDescription(page, pageData, pageData.description)
  const pageTitle = pageData.title && pageData.title !== SITE_NAME
    ? `${pageData.title} | ${SITE_NAME}`
    : SITE_NAME
  const route = getPageRoute(page)
  const isNotFound = Boolean(pageData.isNotFound)
  const isLegacyRedirect = ['home/navigation.md', 'home/chatgptprompts.md', 'home/freechatgptsitelist.md']
    .includes(String(page).replace(/\\/g, '/').toLowerCase())
  const canonical = isLegacyRedirect
    ? `${SITE_ORIGIN}/`
    : isNotFound
      ? `${SITE_ORIGIN}/404.html`
      : new URL(route, SITE_ORIGIN).href
  const keywords = [
    'AI 开源项目',
    '人工智能',
    '机器学习',
    'GitHub',
    '开源工具',
    'AI Agent',
    'RAG',
    pageData.title
  ].filter(Boolean).join(',')

  return [
    ['link', { rel: 'canonical', href: canonical }],
    ['meta', { name: 'keywords', content: keywords }],
    ['meta', { name: 'robots', content: isLegacyRedirect || isNotFound ? 'noindex, follow' : 'index, follow, max-image-preview:large' }],
    ['meta', { property: 'og:site_name', content: SITE_NAME }],
    ['meta', { property: 'og:locale', content: 'zh_CN' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: pageTitle }],
    ['meta', { property: 'og:description', content: pageDescription }],
    ['meta', { property: 'og:url', content: canonical }],
    ['meta', { property: 'og:image', content: SOCIAL_IMAGE_URL }],
    ['meta', { property: 'og:image:secure_url', content: SOCIAL_IMAGE_URL }],
    ['meta', { property: 'og:image:type', content: 'image/png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: `${SITE_NAME} 开源项目导航` }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: pageTitle }],
    ['meta', { name: 'twitter:description', content: pageDescription }],
    ['meta', { name: 'twitter:image', content: SOCIAL_IMAGE_URL }],
    ['meta', { name: 'twitter:image:alt', content: `${SITE_NAME} 开源项目导航` }],
    ['meta', { itemprop: 'name', content: pageTitle }],
    ['meta', { itemprop: 'description', content: pageDescription }],
    ['meta', { itemprop: 'image', content: SOCIAL_IMAGE_URL }],
    ['script', { type: 'application/ld+json' }, JSON.stringify(createStructuredData({
      page,
      title: pageTitle,
      description: pageDescription,
      canonical,
      pageData
    }))]
  ]
}

function nativeExploreRoutePlugin() {
  const serveExplore = (req, res, next) => {
    const pathname = req.url ? new URL(req.url, 'http://localhost').pathname : ''

    if (pathname === '/explore' || pathname === '/explore/' || pathname === '/explore/index.html') {
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(fs.readFileSync(exploreHtmlPath, 'utf-8'))
      return
    }

    next()
  }

  return {
    name: 'native-explore-route',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(serveExplore)
    },
  }
}

export default {
  appearance: { initialValue: 'light' },
  title: 'Hello-AI',
  description: DEFAULT_DESCRIPTION,
  lang: 'zh-CN',
  base: '/',
  outDir: './docs',
  ignoreDeadLinks: true,
  sitemap: {
    hostname: SITE_ORIGIN,
    transformItems(items) {
      const legacyRoutes = new Set([
        'home/navigation.html',
        'home/chatgptPrompts.html',
        'home/FreeChatGPTSiteList.html'
      ])
      const filteredItems = items.filter((item) => !legacyRoutes.has(String(item.url).replace(/^\//, '')))
      const exploreUrl = `${SITE_ORIGIN}/explore/`
      if (!filteredItems.some((item) => item.url === exploreUrl)) {
        filteredItems.push({ url: exploreUrl, changefreq: 'daily', priority: 1 })
      }
      return filteredItems
    }
  },
  head: [
    ['meta', { name: 'author', content: 'Hello-AI Contributors' }],
    ['meta', { name: 'application-name', content: SITE_NAME }],
    ['meta', { name: 'theme-color', content: '#ffffff' }],
    ['meta', { name: 'format-detection', content: 'telephone=no' }],
    ['link', { rel: 'icon', href: '/favicon-v2.ico', sizes: 'any' }],
    ['link', { rel: 'shortcut icon', href: '/favicon-v2.ico' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
    ['link', { rel: 'image_src', href: SOCIAL_IMAGE_URL }],
    ['link', { rel: 'manifest', href: '/site.webmanifest' }],
    ['link', { rel: 'sitemap', type: 'application/xml', href: '/sitemap.xml' }],
    ['link', { rel: 'alternate', type: 'text/plain', title: 'LLM-friendly site summary', href: '/llms.txt' }],
    [
      'script',
      { defer: '', src: 'https://msc.anzz.site/script.js', 'data-website-id': '20b6a59e-90f5-4998-940e-a708c9972bac' }
    ],
    [
      'script',
      {},
      `
        var _hmt = _hmt || [];
        (function() {
          var hm = document.createElement("script");
          hm.src = "https://hm.baidu.com/hm.js?fccc710dc874350e7d5ba2e39b487954";
          var s = document.getElementsByTagName("script")[0];
          s.parentNode.insertBefore(hm, s);
        })();
      `,
    ]
  ],
  transformPageData(pageData) {
    const existingHead = Array.isArray(pageData.frontmatter?.head) ? pageData.frontmatter.head : []
    return {
      description: getPageDescription(pageData.relativePath, pageData, pageData.description),
      frontmatter: {
        ...pageData.frontmatter,
        head: [...existingHead, ...createPageHead(pageData)]
      }
    }
  },
  transformHtml(code) {
    if (!code.includes('<title>404 | Hello-AI</title>')) return code

    return code.replace(
      '</head>',
      `    <link rel="canonical" href="${SITE_ORIGIN}/404.html">\n    <meta name="robots" content="noindex, follow">\n  </head>`
    )
  },
  themeConfig: {
    siteTitle: 'Hello-AI',
    outlineTitle: '目录',
    outline: [2, 3],
    logo: '/assets/img/logo.png',
    nav: zhNav,
    // navbar: true,
    // sidebar: 'auto',
    sidebar: zhSidebar,
    socialLinks: [{ icon: 'github', link: 'https://github.com/xxxily/hello-ai' }],
    // search: {
    //   provider: 'local',
    //   options: {
    //     locales: {
    //       zh: {
    //         translations: {
    //           button: {
    //             buttonText: '搜索文档',
    //             buttonAriaLabel: '搜索文档'
    //           },
    //           modal: {
    //             noResultsText: '无法找到相关结果',
    //             resetButtonTitle: '清除查询条件',
    //             footer: {
    //               selectText: '选择',
    //               navigateText: '切换'
    //             }
    //           }
    //         }
    //       }
    //     }
    //   }
    // }
    // displayAllHeaders: true,
    // sidebarDepth: 5,
    // lastUpdated: 'Last Updated',

    // 默认值是 true 。设置为 false 来禁用所有页面的 下一篇 链接
    // nextLinks: true,
    // prevLinks: true,

    // smoothScroll: true,
  },
  /* 显示代码的行号 */
  // markdown: {
  //   lineNumbers: true,
  // },
  /* 只需兼容现代浏览器 */
  // evergreen: true,
  plugins: [],
  vite: {
    plugins: [nativeExploreRoutePlugin()],
  },
}
