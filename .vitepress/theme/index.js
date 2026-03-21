import DefaultTheme from 'vitepress/theme'
import './custom.css'
import { watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'

let mermaidLoading = null

function loadMermaid() {
  if (window.mermaid) {
    return Promise.resolve(window.mermaid)
  }
  if (mermaidLoading) {
    return mermaidLoading
  }
  mermaidLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.anzz.site/npm/mermaid@10.9.1/dist/mermaid.min.js'
    script.async = true
    script.onload = () => {
      resolve(window.mermaid)
    }
    script.onerror = (e) => {
      mermaidLoading = null
      reject(e)
    }
    document.head.appendChild(script)
  })
  return mermaidLoading
}

function initAndRenderMermaid() {
  const elements = document.querySelectorAll('.language-mermaid code, .language-mermaid pre code')
  if (elements.length === 0) return

  loadMermaid().then((mermaid) => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark' })
    elements.forEach((el, index) => {
      if (el.closest('.language-mermaid') && !el.getAttribute('data-processed')) {
        const id = 'mermaid-render-' + Date.now() + '-' + index
        const graphDefinition = el.textContent
        el.setAttribute('data-processed', 'true')
        mermaid.render(id, graphDefinition).then(({ svg }) => {
          const parent = el.closest('.language-mermaid')
          if (parent) {
            parent.innerHTML = `<div style="display:flex;justify-content:center;margin:2rem 0;">${svg}</div>`
          }
        }).catch(e => {
          console.error('Mermaid render error', e)
          el.removeAttribute('data-processed')
        })
      }
    })
  }).catch(e => {
    console.error('Failed to load Mermaid script', e)
  })
}

export default {
  ...DefaultTheme,
  setup() {
    if (typeof window !== 'undefined') {
      const route = useRoute()
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
