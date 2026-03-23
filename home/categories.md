---
layout: doc
title: 分类目录
sidebar: false
editLink: false
---

<script setup>
import { computed, onMounted, ref } from 'vue'
import { withBase, useRouter } from 'vitepress'
import categoriesData from '../data/categories.json'
import stats from '../data/stats.json'

const router = useRouter()

const handleAccess = (cat, event) => {
  event.preventDefault()
  router.go(cat.link)
}

const categories = computed(() => {
  return [
    {
      id: 'index',
      icon: '🏠',
      name: '项目介绍',
      link: '/home/index.html'
    },
    ...categoriesData.map(c => {
      // 提取名字前方的 emoji，按空格分割
      const parts = c.name.split(' ')
      let icon = c.icon || '✨'
      let name = c.name
      
      // 如果名字自带了 emoji 和空格（如 "🔥 热门推荐"）
      if (parts.length > 1 && parts[0].length <= 2) {
        icon = parts[0]
        name = parts.slice(1).join(' ')
      }
      
      return {
        id: c.id,
        icon,
        name,
        link: `/home/${c.id}.html`
      }
    })
  ]
})

const isMounted = ref(false)
onMounted(() => {
  // 延迟一帧触发挂载动画
  setTimeout(() => {
    isMounted.value = true
  }, 50)
})
</script>

<div class="hud-header">
  <h1 class="hud-title">
    <span class="hud-icon">🌌</span> 核心数据节点目录
  </h1>
  <div class="hud-subtitle">
    <div class="typewriter-text">系统检测到您已连接至主网络，正在为您展开前沿维度的全景拓扑列表。
    <br><br>当前已收录 <strong style="color: var(--vp-c-brand-1)">{{ stats.totalProjects }}</strong> 个项目。请选取目标分类：<span class="cursor">_</span>
    </div>
  </div>
</div>

<div class="tech-list-wrapper">
  <!-- 科技感网格背景装饰 -->
  <div class="cyber-grid"></div>
  <div class="tech-list-container" :class="{ 'is-mounted': isMounted }">
    <div class="scan-line"></div>
    <div v-for="(cat, index) in categories" :key="cat.id" @click="handleAccess(cat, $event)" class="tech-list-item" :style="{ transitionDelay: `${index * 0.03}s` }">
      <div class="item-glass-panel"></div>
      <div class="item-border-glow"></div>
      <div class="item-content">
        <div class="item-icon-box">
          <span class="item-icon">{{ cat.icon }}</span>
          <div class="icon-glow"></div>
        </div>
        <div class="item-text">
          <span class="item-name">{{ cat.name }}</span>
          <span class="item-id">// SECTOR_ID: {{ cat.id.toUpperCase() }}</span>
        </div>
        <div class="item-data-line">
          <div class="data-dot"></div>
          <div class="data-dash"></div>
        </div>
        <div class="item-action">
          <span class="action-text">ACCESS</span>
          <span class="action-icon">→</span>
        </div>
      </div>
    </div>
  </div>
</div>

<style scoped>
/* HUD Header 样式 */
.hud-header {
  margin: 32px 0 40px;
  position: relative;
  z-index: 2;
}

.hud-title {
  margin: 0 0 16px !important;
  font-size: 2.2rem;
  letter-spacing: 2px;
  background: linear-gradient(90deg, var(--vp-c-text-1), var(--vp-c-brand-1));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  display: flex;
  align-items: center;
  border: none !important;
}

.hud-icon {
  margin-right: 12px;
  display: inline-block;
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.hud-subtitle {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.95rem;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-mute);
  padding: 12px 18px;
  border-left: 3px solid var(--vp-c-brand-1);
  display: inline-block;
  border-radius: 0 8px 8px 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.typewriter-text {
  display: inline-block;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-all;
}

.cursor {
  display: inline-block;
  width: 8px;
  color: var(--vp-c-brand-1);
  animation: blink 1s step-end infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 列表容器样式 */
.tech-list-wrapper {
  position: relative;
  margin-top: 16px;
  margin-bottom: 40px;
  padding: 24px 20px;
  border-radius: 16px;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  overflow: hidden;
  box-shadow: inset 0 0 60px rgba(0, 0, 0, 0.03), 0 10px 30px rgba(0, 0, 0, 0.05);
  transform: translateZ(0); /* 开启硬件加速 */
}

/* 高级模糊网格 */
.cyber-grid {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: linear-gradient(rgba(var(--vp-c-brand-1-rgb, 100,200,255), 0.08) 1px, transparent 1px),
  linear-gradient(90deg, rgba(var(--vp-c-brand-1-rgb, 100,200,255), 0.08) 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.4;
  pointer-events: none;
  z-index: 0;
  -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
  mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
}

.tech-list-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  z-index: 1;
}

/* 柔和扫描线 */
.scan-line {
  position: absolute;
  top: -150px;
  left: 0;
  width: 100%;
  height: 150px;
  background: linear-gradient(to bottom, transparent, rgba(var(--vp-c-brand-1-rgb, 0, 242, 254), 0.1) 80%, rgba(var(--vp-c-brand-1-rgb, 0, 242, 254), 0) 100%);
  z-index: 10;
  pointer-events: none;
  animation: scan 4s linear infinite;
  opacity: 0.6;
}

@keyframes scan {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(1200%); }
}

/* 列表项基础样式 */
.tech-list-item {
  position: relative;
  display: flex;
  align-items: center;
  text-decoration: none !important;
  color: var(--vp-c-text-1) !important;
  border-radius: 10px;
  padding: 18px 24px;
  background: var(--vp-c-bg);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  border: 1px solid var(--vp-c-divider);
  cursor: pointer;
  
  /* 动画加速 */
  will-change: transform, opacity, box-shadow;
  transform: translateX(-30px);
  opacity: 0;
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.1, 1);
}

.is-mounted .tech-list-item {
  transform: translateX(0);
  opacity: 1;
}

.item-glass-panel {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(var(--vp-c-brand-1-rgb, 0, 242, 254), 0.04) 100%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.item-border-glow {
  position: absolute;
  top: -1px; left: -1px; right: -1px; bottom: -1px;
  border-radius: 10px;
  padding: 1px;
  background: linear-gradient(90deg, transparent, var(--vp-c-brand-1), transparent);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.tech-list-item:hover {
  transform: translateX(10px) scale(1.01) !important;
  border-color: transparent;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), inset 0 0 20px rgba(var(--vp-c-brand-1-rgb, 0, 242, 254), 0.05);
  background: var(--vp-c-bg-soft);
  z-index: 2;
}

.tech-list-item:hover .item-glass-panel,
.tech-list-item:hover .item-border-glow {
  opacity: 1;
}

.item-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  width: 100%;
}

.item-icon-box {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24px;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--vp-c-bg-mute);
  border: 1px solid var(--vp-c-divider);
  transition: all 0.3s ease;
}

.tech-list-item:hover .item-icon-box {
  background: transparent;
  border-color: rgba(var(--vp-c-brand-1-rgb, 0,242,254), 0.3);
}

.item-icon {
  font-size: 1.6rem;
  position: relative;
  z-index: 2;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.icon-glow {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  filter: blur(14px);
  opacity: 0;
  transition: opacity 0.4s ease;
}

.tech-list-item:hover .icon-glow {
  opacity: 0.4;
}

.tech-list-item:hover .item-icon {
  transform: scale(1.15) rotate(-8deg);
}

.item-text {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.item-name {
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--vp-c-text-1);
  transition: all 0.3s ease;
}

.tech-list-item:hover .item-name {
  background: linear-gradient(90deg, var(--vp-c-brand-1), var(--vp-c-text-1));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.item-id {
  font-size: 0.75rem;
  margin-top: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--vp-c-text-3);
  letter-spacing: 1px;
  transition: color 0.3s ease;
  display: flex;
  align-items: center;
}

.tech-list-item:hover .item-id {
  color: var(--vp-c-text-2);
}

.item-id::after {
  content: '_';
  opacity: 0;
  font-weight: bold;
  color: var(--vp-c-brand-1);
}

.tech-list-item:hover .item-id::after {
  animation: blink 1s step-end infinite;
}

/* 动态数据流行走效果 */
.item-data-line {
  display: flex;
  align-items: center;
  margin: 0 32px;
  opacity: 0;
  transform: scaleX(0);
  transform-origin: left center;
  transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
  flex-grow: 1;
  max-width: 120px;
}

.tech-list-item:hover .item-data-line {
  opacity: 1;
  transform: scaleX(1);
}

.data-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  box-shadow: 0 0 8px var(--vp-c-brand-1);
  position: relative;
  z-index: 2;
}

.data-dash {
  height: 2px;
  flex-grow: 1;
  background: linear-gradient(90deg, var(--vp-c-brand-1) 50%, transparent 50%);
  background-size: 12px 100%;
  opacity: 0.4;
  margin-left: -2px; /* 连接 dot */
}

.tech-list-item:hover .data-dash {
  animation: dataFlow 0.6s linear infinite;
  opacity: 0.8;
}

@keyframes dataFlow {
  0% { background-position: 0 0; }
  100% { background-position: 12px 0; }
}

.item-action {
  display: flex;
  align-items: center;
  opacity: 0.5;
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  transform: translateX(-15px);
}

.action-text {
  font-size: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-weight: bold;
  letter-spacing: 1.5px;
  margin-right: 12px;
  opacity: 0;
  transform: translateX(-10px);
  transition: all 0.4s ease;
}

.tech-list-item:hover .item-action {
  opacity: 1;
  transform: translateX(0);
  color: var(--vp-c-brand-1);
}

.tech-list-item:hover .action-text {
  opacity: 1;
  transform: translateX(0);
}

.action-icon {
  font-size: 1.3rem;
  font-weight: 900;
  transition: transform 0.3s ease;
}

.tech-list-item:hover .action-icon {
  transform: translateX(4px);
}

/* 移动端适配 */
@media (max-width: 640px) {
  .hud-title {
    font-size: 1.6rem;
  }
  .item-data-line, .action-text {
    display: none;
  }
  .tech-list-item {
    padding: 16px;
  }
  .item-icon-box {
    margin-right: 16px;
  }
}



</style>
