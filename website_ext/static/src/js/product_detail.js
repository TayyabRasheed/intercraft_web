/** Product case study portals: each tab has its own <img>; show/hide by tab */
(function () {
    'use strict';

    var TAB_MS = 4000;

    function moveIndicator(indicator, tab, tabsRoot) {
        if (!indicator || !tab || !tabsRoot) {
            return;
        }
        var rootRect = tabsRoot.getBoundingClientRect();
        var tabRect = tab.getBoundingClientRect();
        var x = tabRect.left - rootRect.left + tabsRoot.scrollLeft;
        indicator.style.opacity = '1';
        indicator.style.width = Math.max(tabRect.width, 40) + 'px';
        requestAnimationFrame(function () {
            indicator.style.transform = 'translateX(' + x + 'px)';
        });
    }

    function resetProgress(progress) {
        if (!progress) {
            return;
        }
        progress.classList.remove('is-running');
        progress.style.transitionDuration = '0ms';
        progress.style.width = '0%';
        void progress.offsetWidth;
    }

    function startProgress(progress) {
        if (!progress) {
            return;
        }
        resetProgress(progress);
        progress.style.transitionDuration = TAB_MS + 'ms';
        progress.classList.add('is-running');
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                progress.style.width = '100%';
            });
        });
    }

    function getTabIndex(tab) {
        var n = parseInt(tab.getAttribute('data-portal-tab'), 10);
        return isFinite(n) ? n : 0;
    }

    /**
     * Ensure every tab has its own img in the frame.
     * Legacy: one shared preview + data-portal-src on tabs → expand to per-tab imgs.
     * Also repairs imgs that lost data-portal-shot (common after media dialog).
     */
    function ensurePerTabShots(root, tabs) {
        var frame = root.querySelector('.icpd-portal-frame');
        if (!frame || !tabs.length) {
            return [];
        }

        var DUMMY = '/website_ext/static/src/images/case-study/dashboard.png';
        function isPlaceholder(value) {
            var src = (value || '').trim();
            var path = src.split('?')[0];
            return (
                !src ||
                src.indexOf('s_picture_default_image') !== -1 ||
                src.indexOf('portal-dummy') !== -1 ||
                path.indexOf('/case-study/dashboard.png') !== -1 ||
                path.indexOf('/case-image/dashboard') !== -1
            );
        }

        // Same real URL on two or more tabs → keep it on tab 0 only.
        // One upload on button 02 must stay on button 02.
        var owned = [];
        tabs.forEach(function (tab) {
            var key = String(getTabIndex(tab));
            var img = frame.querySelector('img[data-portal-shot="' + key + '"]');
            var src = (
                (img && img.getAttribute('src')) ||
                tab.getAttribute('data-portal-src') ||
                ''
            ).trim();
            if (!isPlaceholder(src)) {
                owned.push(src);
            }
        });
        var shared =
            owned.length >= 2 &&
            owned.every(function (src) {
                return src === owned[0];
            });
        if (shared) {
            var only = owned[0];
            var keeper = frame.querySelector('img[data-portal-shot="0"]') || frame.querySelector('img');
            Array.prototype.forEach.call(frame.querySelectorAll('img'), function (img) {
                if (img !== keeper && img.parentNode) {
                    img.parentNode.removeChild(img);
                }
            });
            if (keeper) {
                keeper.setAttribute('data-portal-shot', '0');
                keeper.setAttribute('src', only);
            }
            tabs.forEach(function (tab) {
                if (getTabIndex(tab) === 0) {
                    tab.setAttribute('data-portal-src', only);
                } else {
                    tab.removeAttribute('data-portal-src');
                }
            });
        }

        var claimed = [];
        var shots = [];
        tabs.forEach(function (tab, i) {
            var idx = getTabIndex(tab);
            var shot = frame.querySelector('[data-portal-shot="' + idx + '"]');
            if (!shot) {
                // Prefer orphan imgs (uploaded but missing data-portal-shot)
                var orphans = Array.prototype.slice
                    .call(frame.querySelectorAll('img'))
                    .filter(function (img) {
                        return (
                            !img.hasAttribute('data-portal-shot') &&
                            claimed.indexOf(img) === -1
                        );
                    });
                shot = orphans[0] || null;
            }
            if (!shot) {
                var byOrder = frame.querySelectorAll('img')[i];
                if (
                    byOrder &&
                    claimed.indexOf(byOrder) === -1 &&
                    (!byOrder.hasAttribute('data-portal-shot') ||
                        byOrder.getAttribute('data-portal-shot') === String(idx))
                ) {
                    shot = byOrder;
                }
            }
            if (!shot) {
                shot = document.createElement('img');
                frame.appendChild(shot);
            }

            claimed.push(shot);
            shot.classList.add('icpd-portal-shot', 'img', 'img-fluid');
            shot.setAttribute('data-portal-shot', String(idx));
            shot.removeAttribute('data-portal-preview');
            shot.removeAttribute('hidden');

            var fromImg = shot.getAttribute('src') || '';
            var fromTab = tab.getAttribute('data-portal-src') || '';
            var src = !isPlaceholder(fromImg) ? fromImg : (!isPlaceholder(fromTab) ? fromTab : '');
            // Do not clone another tab's image onto a blank slot
            if (
                src &&
                claimed.some(function (other) {
                    return other !== shot && (other.getAttribute('src') || '') === src;
                })
            ) {
                src = '';
            }
            if (src) {
                shot.setAttribute('src', src);
                tab.setAttribute('data-portal-src', src);
            } else {
                shot.setAttribute('src', DUMMY);
                tab.removeAttribute('data-portal-src');
            }

            var label = (tab.textContent || '').replace(/\s+/g, ' ').trim();
            if (label) {
                shot.setAttribute('alt', label);
            }
            shots.push(shot);
        });

        // Remove unmapped leftover imgs (old single preview duplicates)
        Array.prototype.slice.call(frame.querySelectorAll('img')).forEach(function (img) {
            if (claimed.indexOf(img) === -1) {
                img.parentNode.removeChild(img);
            }
        });

        return shots;
    }

    function showImage(state, tab) {
        var idx = getTabIndex(tab);
        var active = null;
        var prev = state.shots.filter(function (img) {
            return img.classList.contains('is-active');
        })[0] || null;

        // Always include every img in the frame (repairs stale state.shots)
        var frame = state.root && state.root.querySelector('.icpd-portal-frame');
        var allImgs = frame
            ? Array.prototype.slice.call(frame.querySelectorAll('img'))
            : state.shots.slice();
        if (allImgs.length) {
            state.shots = allImgs;
        }

        state.shots.forEach(function (img, i) {
            var raw = img.getAttribute('data-portal-shot');
            var shotIdx = raw != null && raw !== '' ? parseInt(raw, 10) : i;
            if (!isFinite(shotIdx)) {
                shotIdx = i;
            }
            // Keep attr in sync so later clicks stay reliable
            img.setAttribute('data-portal-shot', String(shotIdx));

            var on = shotIdx === idx;
            img.classList.toggle('is-switching', false);
            img.style.display = 'block';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.minHeight = '0';
            img.style.margin = '0';
            img.style.setProperty('opacity', on ? '1' : '0', 'important');
            img.style.setProperty('visibility', on ? 'visible' : 'hidden', 'important');
            img.style.setProperty('z-index', on ? '2' : '0', 'important');
            img.removeAttribute('height');
            img.removeAttribute('width');
            img.removeAttribute('hidden');

            if (on) {
                img.classList.add('is-active');
                img.setAttribute('aria-hidden', 'false');
                active = img;
            } else {
                img.classList.remove('is-active');
                img.setAttribute('aria-hidden', 'true');
            }
        });

        // Brief fade cue when switching between shots
        if (prev && active && prev !== active) {
            prev.classList.add('is-switching');
            window.setTimeout(function () {
                prev.classList.remove('is-switching');
            }, 450);
        }

        // Fallback: legacy single preview — swap src from data-portal-src
        if (!active && state.preview) {
            var src = tab.getAttribute('data-portal-src');
            if (src && state.preview.getAttribute('src') !== src) {
                state.preview.classList.add('is-switching');
                window.setTimeout(function () {
                    state.preview.setAttribute('src', src);
                    state.preview.setAttribute(
                        'alt',
                        (tab.textContent || '').replace(/\s+/g, ' ').trim()
                    );
                    state.preview.classList.remove('is-switching');
                }, 140);
            }
            active = state.preview;
        }

        return active;
    }

    function showTab(state, index, withProgress) {
        var tabs = state.tabs;
        if (!tabs.length) {
            return;
        }
        var i = ((index % tabs.length) + tabs.length) % tabs.length;
        var tab = tabs[i];
        state.index = i;

        tabs.forEach(function (t) {
            t.classList.remove('is-active');
            t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');

        if (state.root) {
            state.root.setAttribute('data-active-shot', String(getTabIndex(tab)));
        }
        showImage(state, tab);
        moveIndicator(state.indicator, tab, state.tabsRoot);

        if (withProgress) {
            startProgress(state.progress);
        } else {
            resetProgress(state.progress);
            if (state.progress) {
                state.progress.style.width = '100%';
            }
        }
    }

    function stopTimer(state) {
        if (state.timer) {
            window.clearTimeout(state.timer);
            state.timer = null;
        }
    }

    function scheduleNext(state) {
        stopTimer(state);
        state.timer = window.setTimeout(function () {
            if (!state.playing) {
                return;
            }
            showTab(state, state.index + 1, true);
            scheduleNext(state);
        }, TAB_MS);
    }

    function startAutoplay(state) {
        if (state.playing) {
            return;
        }
        state.playing = true;
        showTab(state, state.index, true);
        scheduleNext(state);
    }

    function pauseAutoplay(state) {
        state.playing = false;
        stopTimer(state);
        moveIndicator(state.indicator, state.tabs[state.index], state.tabsRoot);
        if (state.progress) {
            state.progress.classList.remove('is-running');
            state.progress.style.transitionDuration = '0ms';
            state.progress.style.width = '100%';
        }
    }

    function ensureIndicator(tabsRoot) {
        var indicator = tabsRoot.querySelector('.icpd-portal-tab-indicator');
        if (!indicator) {
            indicator = document.createElement('span');
            indicator.className = 'icpd-portal-tab-indicator';
            indicator.setAttribute('aria-hidden', 'true');
            indicator.innerHTML = '<span class="icpd-portal-tab-progress"></span>';
            tabsRoot.insertBefore(indicator, tabsRoot.firstChild);
        }
        var progress = indicator.querySelector('.icpd-portal-tab-progress');
        if (!progress) {
            progress = document.createElement('span');
            progress.className = 'icpd-portal-tab-progress';
            indicator.appendChild(progress);
        }
        return {indicator: indicator, progress: progress};
    }

    function initPortalTabs(root) {
        if (root.getAttribute('data-portal-ready') === '1') {
            return;
        }
        var tabsRoot = root.querySelector('.icpd-portal-tabs');
        var tabs = Array.prototype.slice.call(
            root.querySelectorAll('[data-portal-tab]')
        );
        if (!tabsRoot || !tabs.length) {
            return;
        }

        var shots = ensurePerTabShots(root, tabs);
        if (!shots.length) {
            return;
        }

        root.setAttribute('data-portal-ready', '1');

        var parts = ensureIndicator(tabsRoot);
        var startIndex = 0;
        tabs.forEach(function (tab, idx) {
            if (tab.classList.contains('is-active')) {
                startIndex = idx;
            }
            if (tab.tagName === 'A') {
                tab.setAttribute('href', '#');
                tab.setAttribute('role', 'tab');
            }
        });

        var state = {
            root: root,
            tabsRoot: tabsRoot,
            tabs: tabs,
            shots: shots,
            preview: shots[0] || null,
            indicator: parts.indicator,
            progress: parts.progress,
            index: startIndex,
            playing: false,
            timer: null,
        };

        showTab(state, startIndex, false);

        function onTabActivate(ev) {
            var tab = ev.target.closest && ev.target.closest('[data-portal-tab]');
            if (!tab || !tabsRoot.contains(tab)) {
                return;
            }
            // Website Edit mode: tab text is editable, so let the caret land in it
            if (!tab.isContentEditable) {
                ev.preventDefault();
                ev.stopPropagation();
                if (typeof ev.stopImmediatePropagation === 'function') {
                    ev.stopImmediatePropagation();
                }
            }
            // Re-read tabs/shots in case editor/DOM mutated
            state.tabs = Array.prototype.slice.call(
                root.querySelectorAll('[data-portal-tab]')
            );
            state.shots = ensurePerTabShots(root, state.tabs);
            var idx = state.tabs.indexOf(tab);
            if (idx < 0) {
                idx = parseInt(tab.getAttribute('data-portal-tab'), 10) || 0;
            }
            stopTimer(state);
            state.index = idx;
            if (isInView(root) && !document.body.classList.contains('editor_enable')) {
                state.playing = true;
                showTab(state, idx, true);
                scheduleNext(state);
            } else {
                state.playing = false;
                showTab(state, idx, false);
            }
        }
        // Capture so Website Edit mode cannot steal the click
        tabsRoot.addEventListener('pointerdown', onTabActivate, true);
        tabsRoot.addEventListener('keydown', function (ev) {
            if (ev.key !== 'Enter' && ev.key !== ' ') {
                return;
            }
            onTabActivate(ev);
        });

        window.addEventListener('resize', function () {
            moveIndicator(state.indicator, state.tabs[state.index], state.tabsRoot);
        });

        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(
                function (entries) {
                    entries.forEach(function (entry) {
                        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
                            startAutoplay(state);
                        } else {
                            pauseAutoplay(state);
                        }
                    });
                },
                {threshold: [0, 0.35, 0.6]}
            );
            observer.observe(root);
        } else {
            startAutoplay(state);
        }
    }

    function isInView(el) {
        var rect = el.getBoundingClientRect();
        var vh = window.innerHeight || document.documentElement.clientHeight;
        return rect.top < vh * 0.65 && rect.bottom > vh * 0.2;
    }

    /**
     * Ensure hero is centered copy stacked above the laptop mockup
     * (upgrades older left/right or split-top DB HTML).
     */
    function normalizeHeroLayout(hero) {
        if (!hero || hero.getAttribute('data-hero-ready') === '1') {
            return;
        }
        var container = hero.querySelector('.container') || hero;
        var h1 = hero.querySelector('.icpd-h1');
        var shot = hero.querySelector('.icpd-hero-shot');
        if (!h1 || !shot) {
            return;
        }

        // Remove legacy hero "PRODUCT CASE STUDY" pills
        Array.prototype.slice.call(hero.querySelectorAll('.icpd-pill')).forEach(function (pill) {
            if (pill.parentNode) {
                pill.parentNode.removeChild(pill);
            }
        });

        var kickerType = hero.querySelector('.icpd-kicker-type');
        var lead = hero.querySelector('.icpd-lead');
        var btn = hero.querySelector('.icpd-btn-solid');
        var meta = hero.querySelector('.icpd-meta');
        var intro = container.querySelector('.icpd-hero-intro');
        var media = container.querySelector('.icpd-hero-media');

        // Already correct: centered intro + media under it
        if (
            intro &&
            media &&
            intro.contains(h1) &&
            media.contains(shot) &&
            (!lead || intro.contains(lead)) &&
            (!btn || intro.contains(btn)) &&
            !container.querySelector('.icpd-hero-row, .icpd-hero-copy, .icpd-hero-top')
        ) {
            hero.setAttribute('data-hero-ready', '1');
            return;
        }

        if (!intro) {
            intro = document.createElement('div');
            intro.className = 'icpd-hero-intro';
        }
        if (!media) {
            media = document.createElement('div');
            media.className = 'icpd-hero-media';
        }

        var kicker = intro.querySelector('.icpd-hero-kicker');
        if (!kicker && kickerType) {
            kicker = document.createElement('div');
            kicker.className = 'icpd-hero-kicker';
            intro.insertBefore(kicker, intro.firstChild);
        }
        if (kicker && kickerType) {
            kicker.appendChild(kickerType);
        }

        intro.appendChild(h1);
        if (lead) {
            intro.appendChild(lead);
        }
        if (btn) {
            intro.appendChild(btn);
        }
        media.appendChild(shot);

        // Drop leftover split / top layouts
        Array.prototype.slice
            .call(
                container.querySelectorAll(
                    '.icpd-hero-intro, .icpd-hero-top, .icpd-hero-row, .icpd-hero-copy, .icpd-hero-media, .row'
                )
            )
            .forEach(function (el) {
                if (el.parentNode === container && el !== intro && el !== media) {
                    el.parentNode.removeChild(el);
                }
            });

        var anchor = meta && meta.parentNode === container ? meta : null;
        if (intro.parentNode) {
            intro.parentNode.removeChild(intro);
        }
        if (media.parentNode) {
            media.parentNode.removeChild(media);
        }
        container.insertBefore(intro, anchor);
        container.insertBefore(media, anchor);

        hero.setAttribute('data-hero-ready', '1');
    }

    /**
     * Hero "Explore" CTA:
     * - If product.explore_url is set on the page → go to that link
     * - Else scroll to portals (also fixes older #icpd-product links)
     */
    function wireExploreCta() {
        var page = document.querySelector('.ic_product_detail_page');
        var exploreUrl = (page && page.getAttribute('data-explore-url') || '').trim();
        var portals = document.querySelector('.icpd-portals');
        if (portals && !portals.id) {
            portals.id = 'icpd-portals';
        }

        document.querySelectorAll('.icpd-case-hero .icpd-btn-solid').forEach(function (btn) {
            if (exploreUrl) {
                btn.setAttribute('href', exploreUrl);
                if (/^https?:\/\//i.test(exploreUrl)) {
                    btn.setAttribute('target', '_blank');
                    btn.setAttribute('rel', 'noopener noreferrer');
                } else {
                    btn.removeAttribute('target');
                    btn.removeAttribute('rel');
                }
                return;
            }
            var href = btn.getAttribute('href') || '';
            if (portals && (!href || href === '#' || href === '#icpd-product')) {
                btn.setAttribute('href', '#' + portals.id);
            }
        });
    }

    /**
     * Tech strip must be separate <span>s spread across the row.
     * Editors often paste one line ("Next.js React … Tailwind CSS") — split it.
     */
    function splitTechLabels(text) {
        var multi = [
            'Tailwind CSS',
            'React Native',
            'Node.js',
            'Next.js',
            'Vue.js',
            'Nuxt.js',
            'NestJS',
            'Amazon Web Services',
            'Visual Studio',
        ];
        var t = (text || '').replace(/\s+/g, ' ').trim();
        if (!t) {
            return [];
        }
        var map = {};
        multi
            .slice()
            .sort(function (a, b) {
                return b.length - a.length;
            })
            .forEach(function (name, i) {
                var key = '__TECH' + i + '__';
                if (t.indexOf(name) !== -1) {
                    map[key] = name;
                    t = t.split(name).join(' ' + key + ' ');
                }
            });
        return t
            .split(/[\s·•|,\/]+/)
            .map(function (part) {
                return map[part] || part;
            })
            .filter(function (part) {
                return part && part !== '[Tech' && !/^\[Tech\s*\d*\]$/.test(part);
            });
    }

    function normalizeTechRow(row) {
        if (!row || row.getAttribute('data-tech-ready') === '1') {
            return;
        }
        var spans = Array.prototype.slice.call(row.querySelectorAll(':scope > span'));
        var labels = [];

        if (spans.length >= 2) {
            labels = spans
                .map(function (el) {
                    return (el.textContent || '').replace(/\s+/g, ' ').trim();
                })
                .filter(Boolean);
            // One span holding the whole list → still needs splitting
            if (labels.length === 1 && /\s/.test(labels[0])) {
                labels = splitTechLabels(labels[0]);
            } else if (
                labels.length >= 2 &&
                labels.every(function (l) {
                    return l.indexOf(' ') === -1 || /^(Tailwind CSS|React Native)$/.test(l);
                })
            ) {
                // Already separate tech items
                row.setAttribute('data-tech-ready', '1');
                return;
            }
        } else {
            labels = splitTechLabels(row.textContent || '');
        }

        if (labels.length < 2) {
            row.setAttribute('data-tech-ready', '1');
            return;
        }

        row.innerHTML = '';
        labels.forEach(function (label) {
            var span = document.createElement('span');
            span.textContent = label;
            row.appendChild(span);
        });
        row.setAttribute('data-tech-ready', '1');
    }

    function boot() {
        document.querySelectorAll(
            ".icpd-portal-editor-hint, .icpd-portal-upload-btn, .icpd-portal-slot-badge, .icpd-portal-empty-label, .icpd-portal-upload-bait, .icpd-portal-toolbar"
        ).forEach(function (el) {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });
        document.querySelectorAll('.icpd-case-hero').forEach(normalizeHeroLayout);
        wireExploreCta();
        document.querySelectorAll('.icpd-tech-row').forEach(normalizeTechRow);
        document.querySelectorAll('.icpd-portals').forEach(initPortalTabs);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
    window.addEventListener('load', boot);
})();
