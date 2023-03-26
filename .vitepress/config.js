import zhNav from './nav/zh'
import zhSidebar from './sidebar/zh'

export default {
  title: 'Hello-AI',
  description: '这个是个帮助自己链接到广阔AI世界的项目，也希望能帮助到你。',
  lang: 'zh-CN',
  base: '/',
  outDir: './docs',
  head: [
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
    ],
  ],
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
}
