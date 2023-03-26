import { computed, inject, readonly, ref, shallowRef } from 'vue';
import siteData from '@siteData';
import { resolveSiteDataByRoute, createTitle } from '../shared';
export const dataSymbol = Symbol();
// site data is a singleton
export const siteDataRef = shallowRef((import.meta.env.PROD ? siteData : readonly(siteData)));
// hmr
if (import.meta.hot) {
    import.meta.hot.accept('/@siteData', (m) => {
        if (m) {
            siteDataRef.value = m.default;
        }
    });
}
// per-app data
export function initData(route) {
    const site = computed(() => resolveSiteDataByRoute(siteDataRef.value, route.data.relativePath));
    return {
        site,
        theme: computed(() => site.value.themeConfig),
        page: computed(() => route.data),
        frontmatter: computed(() => route.data.frontmatter),
        params: computed(() => route.data.params),
        lang: computed(() => site.value.lang),
        dir: computed(() => site.value.dir),
        localeIndex: computed(() => site.value.localeIndex || 'root'),
        title: computed(() => {
            return createTitle(site.value, route.data);
        }),
        description: computed(() => {
            return route.data.description || site.value.description;
        }),
        isDark: ref(false)
    };
}
export function useData() {
    const data = inject(dataSymbol);
    if (!data) {
        throw new Error('vitepress data not properly injected in app');
    }
    return data;
}
