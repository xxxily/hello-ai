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
  background: #030816;
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
  background: radial-gradient(circle, rgba(0, 242, 254, 0.15) 0%, transparent 70%);
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
  border: 2px solid rgba(0, 242, 254, 0.1);
  border-top-color: #00f2fe;
  animation: spin 1s linear infinite;
}

.inner-circle {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  bottom: 10px;
  border-radius: 50%;
  border: 2px solid rgba(79, 172, 254, 0.1);
  border-bottom-color: #4facfe;
  animation: spin 2s linear reverse infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.glitch-text {
  font-size: 2.5rem;
  font-weight: 900;
  color: #fff;
  letter-spacing: 2px;
  margin-bottom: 15px;
  position: relative;
  text-shadow: 0 0 10px rgba(0, 242, 254, 0.5);
}

.status-msg {
  font-size: 0.8rem;
  color: #8a9bb3;
  margin-bottom: 5px;
  letter-spacing: 1px;
}

.cyan { color: #00f2fe; font-weight: bold; }

.action-msg {
  font-size: 1.1rem;
  color: #d1d8e0;
  margin-bottom: 30px;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
  margin-bottom: 40px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #00f2fe, #4facfe);
  box-shadow: 0 0 10px rgba(0, 242, 254, 0.5);
  animation: load 1s ease-in-out forwards;
}

@keyframes load {
  to { width: 100%; }
}

.manual-link {
  font-size: 0.9rem;
  color: #8a9bb3;
}

.manual-link a {
  color: #00f2fe;
  text-decoration: none;
  border-bottom: 1px solid rgba(0, 242, 254, 0.3);
  transition: all 0.3s ease;
}

.manual-link a:hover {
  color: #fff;
  border-bottom-color: #fff;
  text-shadow: 0 0 8px rgba(0, 242, 254, 0.8);
}
</style>
