---
layout: page
title: 页面已搬迁 (Page Moved)
head:
  - - meta
    - http-equiv: refresh
      content: '0; url=/'
prev: false
next: false
sidebar: false
navbar: false
aside: false
---

<div class="redirect-wrapper">
  <div class="redirect-container">
    <div class="glow-orb"></div>
    <div class="loader">
      <div class="inner-circle"></div>
    </div>
    <h1 class="glitch-text">页面迁移通知</h1>
    <p class="status-msg">DETECTING LEGACY ROUTE... <span class="cyan">STABLE</span></p>
    <p class="action-msg">正在为您同步至最新接入点</p>
    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>
    <p class="manual-link">如果系统未自动响应，请 <a href="/">点击此处手动接入</a></p>
  </div>
</div>

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  // 虽然 head 里的 meta refresh 已经设置了 0 秒跳转，
  // 但为了确保万无一失且在 JS 环境下更顺滑，这里也加一个立即跳转
  window.location.href = '/'
})
</script>

<style scoped>
.redirect-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: var(--vp-c-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  overflow: hidden;
  font-family: 'Inter', 'Courier New', monospace;
}

.redirect-container {
  position: relative;
  text-align: center;
  z-index: 10;
  padding: 40px;
  max-width: 500px;
  width: 90%;
}

.glow-orb {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 300px;
  height: 300px;
  background: var(--hello-logo-halo);
  filter: blur(40px);
  z-index: -1;
  animation: pulse 4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
}

.loader {
  position: relative;
  width: 80px;
  height: 80px;
  margin: 0 auto 30px;
  border-radius: 50%;
  border: 2px solid var(--hello-c-brand-soft);
  border-top-color: var(--hello-c-brand);
  animation: spin 1s linear infinite;
}

.inner-circle {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  bottom: 10px;
  border-radius: 50%;
  border: 2px solid var(--hello-c-brand-soft);
  border-bottom-color: var(--hello-c-brand-2);
  animation: spin 2s linear reverse infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.glitch-text {
  font-size: 2.5rem;
  font-weight: 900;
  color: var(--vp-c-text-1);
  letter-spacing: 0;
  margin-bottom: 15px;
  position: relative;
  text-shadow: var(--hello-title-shadow);
}

.status-msg {
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
  margin-bottom: 5px;
  letter-spacing: 0;
}

.cyan { color: var(--hello-c-brand); font-weight: bold; }

.action-msg {
  font-size: 1.1rem;
  color: var(--vp-c-text-1);
  margin-bottom: 30px;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: var(--vp-c-bg-soft);
  border-radius: 2px;
  margin-bottom: 40px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, var(--hello-c-brand), var(--hello-c-brand-2));
  box-shadow: 0 0 10px var(--hello-c-brand-glow);
  animation: load 1s ease-in-out forwards;
}

@keyframes load {
  to { width: 100%; }
}

.manual-link {
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
}

.manual-link a {
  color: var(--hello-c-brand);
  text-decoration: none;
  border-bottom: 1px solid var(--hello-border-strong);
  transition: all 0.3s ease;
}

.manual-link a:hover {
  color: var(--hello-link-hover);
  border-bottom-color: var(--hello-link-hover);
  text-shadow: var(--hello-title-shadow);
}
</style>
