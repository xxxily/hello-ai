import DefaultTheme from 'vitepress/theme'
import './custom.css'
import { watch, nextTick } from 'vue'
import { useRoute, useRouter, withBase } from 'vitepress'

let mermaidLoading = null
let colorModeObserver = null
const nativeExplorePath = withBase('/explore/')
const mermaidSources = [
  'https://cdn.anzz.site/npm/mermaid@10.9.1/dist/mermaid.min.js',
  'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js',
  'https://unpkg.com/mermaid@10.9.1/dist/mermaid.min.js'
]

function getMermaidTheme() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'default'
}

function loadMermaid() {
  if (window.mermaid) {
    return Promise.resolve(window.mermaid)
  }
  if (mermaidLoading) {
    return mermaidLoading
  }

  mermaidLoading = mermaidSources.reduce((chain, src) => {
    return chain.catch(() => loadMermaidScript(src))
  }, Promise.reject()).catch((error) => {
    mermaidLoading = null
    throw error
  })

  return mermaidLoading
}

function loadMermaidScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.crossOrigin = 'anonymous'
    script.onload = () => {
      if (window.mermaid) {
        resolve(window.mermaid)
      } else {
        script.remove()
        reject(new Error('Mermaid loaded without exposing window.mermaid'))
      }
    }
    script.onerror = () => {
      script.remove()
      reject(new Error(`Failed to load Mermaid from ${src}`))
    }
    document.head.appendChild(script)
  })
}

function initAndRenderMermaid() {
  const containers = document.querySelectorAll('.language-mermaid')
  if (containers.length === 0) return

  loadMermaid().then((mermaid) => {
    const theme = getMermaidTheme()
    mermaid.initialize({ startOnLoad: false, theme })

    containers.forEach((container, index) => {
      const graphDefinition = container.dataset.mermaidSource || container.querySelector('code')?.textContent
      if (!graphDefinition) return

      if (container.dataset.processed === 'true' && container.dataset.mermaidTheme === theme) {
        return
      }

      const id = 'mermaid-render-' + Date.now() + '-' + index
      container.dataset.processed = 'true'
      container.dataset.mermaidSource = graphDefinition
      container.dataset.mermaidTheme = theme

      mermaid.render(id, graphDefinition).then(({ svg }) => {
        if (container.dataset.mermaidTheme !== theme) return
        container.innerHTML = `<div style="display:flex;justify-content:center;margin:2rem 0;">${svg}</div>`
      }).catch(e => {
        console.error('Mermaid render error', e)
        container.dataset.processed = 'false'
      })
    })
  }).catch(e => {
    console.error('Failed to load Mermaid script', e)
  })
}

function observeColorMode() {
  if (colorModeObserver) return

  let isDark = document.documentElement.classList.contains('dark')
  colorModeObserver = new MutationObserver(() => {
    const nextIsDark = document.documentElement.classList.contains('dark')
    if (nextIsDark === isDark) return

    isDark = nextIsDark
    nextTick(() => {
      initAndRenderMermaid()
    })
  })

  colorModeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
}

export default {
  ...DefaultTheme,
  setup() {
    if (typeof window !== 'undefined') {
      observeColorMode()

      const route = useRoute()
      const router = useRouter()
      router.onBeforeRouteChange = (href) => {
        const targetPath = new URL(href, window.location.href).pathname
        if (targetPath === '/explore' || targetPath === '/explore/' || targetPath === '/explore/index.html') {
          window.location.href = nativeExplorePath
          return false
        }
      }

      watch(
        () => route.path,
        () => {
          nextTick(() => {
            initAndRenderMermaid()
          })
        },
        { immediate: true }
      )
    }
  }
}
