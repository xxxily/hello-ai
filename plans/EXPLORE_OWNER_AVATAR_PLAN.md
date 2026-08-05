# Explore 项目 Owner 头像评估与开发计划

更新日期：2026-08-05  
范围：`public/explore/` 项目列表左侧 `row-badge` 及其派生构建产物

## 1. 背景与现状

当前项目列表的 `row-badge` 使用项目名称生成 1–2 个字符的 monogram。项目采集数据中没有 `avatarUrl`，但每条有效项目记录都保留了 GitHub Owner 名称（`owner`），因此可以在前端根据 Owner 构造 GitHub 头像地址。

数据规模约为 11,042 个项目、8,093 个唯一 Owner。直接把头像地址写入每条项目记录会增加静态数据体积，且头像本身属于可变的外部资源；使用 GitHub 的公开头像端点 `https://github.com/{owner}.png?size=64` 可以避免 GitHub API 调用和配额消耗。

## 2. 可行方案比较

| 方案 | 做法 | 优点 | 代价与风险 |
| --- | --- | --- | --- |
| 1. 前端派生 URL（本轮） | 使用 `owner` 生成 GitHub `.png` 地址，图片加载成功后显示，失败回退 monogram | 改动小，不改数据生成链路，不占 API 配额，头像天然跟随 GitHub 更新 | 首次访问会产生外部图片请求；依赖 GitHub 可访问性；列表较长时会有一定请求量 |
| 2. 数据持久化 `avatarUrl` | 在 GraphQL 状态更新或采集阶段写入 Owner 头像地址 | 渲染更直接，可统一离线快照；可使用 GraphQL 返回的 `avatarUrl(size: 64)` | 增加快照字段和构建体积；头像地址可能失效，仍需前端失败回退；需要改采集/更新脚本 |
| 3. 本地头像缓存 | 定期下载头像并托管到 `public/` 或对象存储 | 不依赖用户侧访问 GitHub，加载稳定、可控缓存和隐私策略 | 下载、去重、失效更新和存储成本明显增加；需要处理版权、缓存清理和失败重试 |
| 4. 边缘代理/CDN | 通过自有图片代理或 CDN 转发/缓存 GitHub 头像 | 可以统一缓存、超时和可用性策略，跨网络环境更稳定 | 需要部署和运维代理，增加请求链路、带宽费用及安全防护面 |

## 3. 当前选择：方案 1

先采用前端派生 URL，原因是它能用最小的代码和数据面改动验证真实视觉收益。实现限定在 `row-badge`，不修改 `catalog-lite.json`、采集脚本或 GitHub API 请求。每个徽标都保留 monogram；图片仅在 `load` 事件确认成功后显示，`error` 时隐藏图片并继续显示 monogram。

头像请求使用：

```text
https://github.com/{owner}.png?size=64
```

Owner 只接受 GitHub 用户名允许的 ASCII 字符（字母、数字和连字符），避免把未经校验的数据拼入 URL。图片使用懒加载、异步解码和低优先级，并通过 `referrerpolicy="no-referrer"` 减少无关的来源信息传递。

## 4. 实施步骤

1. 在 `app.js` 增加 Owner 头像 URL 派生函数和共享徽标渲染函数。
2. 将项目行的静态 monogram 替换为“monogram fallback + avatar image”结构。
3. 在全局捕获阶段监听头像 `load/error`，切换 `has-avatar` 状态；不让失败图片遮挡 fallback。
4. 在 `style.css` 中增加固定尺寸、裁切、淡入淡出和失败回退样式，同时保留分类色边框。
5. 构建 `docs/` 派生产物并在开发页检查桌面、移动端和深色模式。

## 5. 风险、回退与后续演进

- GitHub 头像请求失败、被网络拦截或跨域环境不可达时，视觉上自动回退到当前 monogram，不影响列表操作。
- Owner 缺失或格式非法时不发起请求，直接使用 monogram。
- 外部图片加载只影响徽标内容，不阻塞项目数据、搜索或详情加载。
- 如果方案 1 的请求量或可用性不满足生产要求，再升级到方案 2：在 `update-status.js` 的 GraphQL 查询中获取 `owner.avatarUrl(size: 64)`，把字段写入派生快照，并继续保留前端失败回退。
- 只有在需要跨网络稳定性、离线可用或统一缓存策略时，才考虑方案 3 或 4。

## 6. 验收标准

- 至少一个真实 GitHub Owner 的头像在列表中加载成功，并显示 `.has-avatar` 状态。
- 人为拦截/失败头像请求时，徽标仍显示原有 monogram，且没有破图图标或布局跳动。
- 徽标尺寸、分类色边框和行高保持稳定；桌面和移动端无水平溢出。
- 深色模式、`prefers-reduced-motion` 和键盘/屏幕阅读器语义不回归。
- `node --check`、`git diff --check`、`npm run docs:build` 均通过，构建产物与源资产一致。
