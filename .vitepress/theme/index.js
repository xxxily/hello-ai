import DefaultTheme from 'vitepress/theme'
import './custom.css'
import { watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'

export default {
  ...DefaultTheme,
  setup() {
    if (typeof window !== 'undefined') {
      const route = useRoute()
      watch(
        () => route.path,
        () => {
          nextTick(() => {
            if (window.mermaid) {
              window.mermaid.initialize({ startOnLoad: false, theme: 'dark' })
              const elements = document.querySelectorAll('.language-mermaid code, .language-mermaid pre code')
              elements.forEach((el, index) => {
                if (el.closest('.language-mermaid') && !el.getAttribute('data-processed')) {
                  const id = 'mermaid-render-' + Date.now() + '-' + index
                  const graphDefinition = el.textContent
                  window.mermaid.render(id, graphDefinition).then(({ svg }) => {
                    const parent = el.closest('.language-mermaid')
                    if (parent) {
                      parent.innerHTML = `<div style="display:flex;justify-content:center;margin:2rem 0;">${svg}</div>`
                    }
                  }).catch(e => console.error('Mermaid render error', e))
                  el.setAttribute('data-processed', 'true')
                }
              })
            }
          })
        },
        { immediate: true }
      )
    }
  }
}
