import { onMounted, onUnmounted, onUpdated } from 'vue';
import { useAside } from '../composables/aside';
import { throttleAndDebounce } from '../support/utils';
// magic number to avoid repeated retrieval
const PAGE_OFFSET = 71;
export function resolveTitle(theme) {
    return ((typeof theme.outline === 'object' &&
        !Array.isArray(theme.outline) &&
        theme.outline.label) ||
        theme.outlineTitle ||
        'On this page');
}
export function getHeaders(range) {
    const headers = [...document.querySelectorAll('.VPDoc h2,h3,h4,h5,h6')]
        .filter((el) => el.id && el.hasChildNodes())
        .map((el) => {
        const level = Number(el.tagName[1]);
        return {
            title: serializeHeader(el),
            link: '#' + el.id,
            level
        };
    });
    return resolveHeaders(headers, range);
}
function serializeHeader(h) {
    let ret = '';
    for (const node of h.childNodes) {
        if (node.nodeType === 1) {
            if (node.classList.contains('VPBadge') ||
                node.classList.contains('header-anchor')) {
                continue;
            }
            ret += node.textContent;
        }
        else if (node.nodeType === 3) {
            ret += node.textContent;
        }
    }
    return ret.trim();
}
export function resolveHeaders(headers, range) {
    if (range === false) {
        return [];
    }
    const levelsRange = (typeof range === 'object' && !Array.isArray(range)
        ? range.level
        : range) || 2;
    const [high, low] = typeof levelsRange === 'number'
        ? [levelsRange, levelsRange]
        : levelsRange === 'deep'
            ? [2, 6]
            : levelsRange;
    headers = headers.filter((h) => h.level >= high && h.level <= low);
    const ret = [];
    outer: for (let i = 0; i < headers.length; i++) {
        const cur = headers[i];
        if (i === 0) {
            ret.push(cur);
        }
        else {
            for (let j = i - 1; j >= 0; j--) {
                const prev = headers[j];
                if (prev.level < cur.level) {
                    ;
                    (prev.children || (prev.children = [])).push(cur);
                    continue outer;
                }
            }
            ret.push(cur);
        }
    }
    return ret;
}
export function useActiveAnchor(container, marker) {
    const { isAsideEnabled } = useAside();
    const onScroll = throttleAndDebounce(setActiveLink, 100);
    let prevActiveLink = null;
    onMounted(() => {
        requestAnimationFrame(setActiveLink);
        window.addEventListener('scroll', onScroll);
    });
    onUpdated(() => {
        // sidebar update means a route change
        activateLink(location.hash);
    });
    onUnmounted(() => {
        window.removeEventListener('scroll', onScroll);
    });
    function setActiveLink() {
        if (!isAsideEnabled.value) {
            return;
        }
        const links = [].slice.call(container.value.querySelectorAll('.outline-link'));
        const anchors = [].slice
            .call(document.querySelectorAll('.content .header-anchor'))
            .filter((anchor) => {
            return links.some((link) => {
                return link.hash === anchor.hash && anchor.offsetParent !== null;
            });
        });
        const scrollY = window.scrollY;
        const innerHeight = window.innerHeight;
        const offsetHeight = document.body.offsetHeight;
        const isBottom = Math.abs(scrollY + innerHeight - offsetHeight) < 1;
        // page bottom - highlight last one
        if (anchors.length && isBottom) {
            activateLink(anchors[anchors.length - 1].hash);
            return;
        }
        for (let i = 0; i < anchors.length; i++) {
            const anchor = anchors[i];
            const nextAnchor = anchors[i + 1];
            const [isActive, hash] = isAnchorActive(i, anchor, nextAnchor);
            if (isActive) {
                activateLink(hash);
                return;
            }
        }
    }
    function activateLink(hash) {
        if (prevActiveLink) {
            prevActiveLink.classList.remove('active');
        }
        if (hash !== null) {
            prevActiveLink = container.value.querySelector(`a[href="${decodeURIComponent(hash)}"]`);
        }
        const activeLink = prevActiveLink;
        if (activeLink) {
            activeLink.classList.add('active');
            marker.value.style.top = activeLink.offsetTop + 33 + 'px';
            marker.value.style.opacity = '1';
        }
        else {
            marker.value.style.top = '33px';
            marker.value.style.opacity = '0';
        }
    }
}
function getAnchorTop(anchor) {
    return anchor.parentElement.offsetTop - PAGE_OFFSET;
}
function isAnchorActive(index, anchor, nextAnchor) {
    const scrollTop = window.scrollY;
    if (index === 0 && scrollTop === 0) {
        return [true, null];
    }
    if (scrollTop < getAnchorTop(anchor)) {
        return [false, null];
    }
    if (!nextAnchor || scrollTop < getAnchorTop(nextAnchor)) {
        return [true, anchor.hash];
    }
    return [false, null];
}
