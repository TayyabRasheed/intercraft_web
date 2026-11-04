/** @odoo-module **/
/**
 * Case Study HTML editor:
 * - Click a section / paragraph / button / div → blue outline + Delete (remove whole block).
 * - Each portal tab 01/02/03/04 owns a SEPARATE <img data-portal-shot="N"> — never shared.
 * - ONE click on a tab → show THAT tab’s image only; upload writes only to that img.
 *
 * Selection chrome lives OUTSIDE contenteditable so Odoo cannot strip it.
 */
import { HtmlField, htmlField } from "@web_editor/js/backend/html_field";
import { registry } from "@web/core/registry";
import { onMounted, onPatched, onWillUnmount, useRef } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

const BLANK_PORTAL_SRC = "/website_ext/static/src/images/case-study/portal-dummy.png";

/** Tags that can show click → rectangle → Delete. */
const BLOCK_TAGS = new Set([
    "SECTION",
    "DIV",
    "P",
    "BUTTON",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "LI",
    "A",
    "IMG",
    "FIGURE",
    "UL",
    "OL",
    "SPAN",
]);

/** Structural wrappers — never treat as the selected "content" block. */
const LAYOUT_SKIP = new Set([
    "icpd-page",
    "icpd-html-dual-wrap",
    "icpd-html-dual-frame",
    "container",
    "container-fluid",
    "row",
    "odoo-editor-editable",
    "note-editable",
    "o_editable",
]);

function isLayoutSkip(el) {
    if (!(el instanceof HTMLElement)) {
        return true;
    }
    if (
        el.classList.contains("icpd-block-toolbar") ||
        el.classList.contains("icpd-block-delete") ||
        el.classList.contains("icpd-block-overlay") ||
        el.classList.contains("icpd-block-outline") ||
        el.classList.contains("icpd-portal-tab-indicator") ||
        el.classList.contains("icpd-portal-tab-progress")
    ) {
        return true;
    }
    for (const cls of el.classList) {
        if (LAYOUT_SKIP.has(cls) || cls.startsWith("col-") || cls.startsWith("o_")) {
            return true;
        }
    }
    return false;
}

function blockLabel(el) {
    if (!el) {
        return "block";
    }
    const tag = (el.tagName || "").toLowerCase();
    if (el.classList) {
        for (const cls of el.classList) {
            if (
                cls.startsWith("icpd-") &&
                !cls.includes("editable") &&
                !cls.includes("selected")
            ) {
                return cls.replace(/^icpd-/, "").replace(/-/g, " ");
            }
        }
    }
    return tag || "block";
}

function findSelectableBlock(target, editable) {
    if (!target || !editable) {
        return null;
    }
    let el = target.nodeType === 3 ? target.parentElement : target;
    if (!(el instanceof HTMLElement)) {
        return null;
    }
    if (el.closest && el.closest(".icpd-block-toolbar, .icpd-block-delete, .icpd-block-overlay")) {
        return null;
    }
    // Portal tabs keep their own click behavior
    if (el.closest && el.closest("[data-portal-tab], .icpd-portal-tabs")) {
        return null;
    }

    while (el && el !== editable) {
        if (!(el instanceof HTMLElement)) {
            break;
        }
        const tag = el.tagName;
        if (BLOCK_TAGS.has(tag) && !isLayoutSkip(el)) {
            if (tag === "SPAN") {
                const inlineOnly =
                    !el.classList ||
                    el.classList.contains("icpd-accent") ||
                    el.classList.contains("icpd-tab-num") ||
                    el.classList.contains("icpd-pill") ||
                    el.classList.contains("icpd-cap-icon") ||
                    el.classList.contains("icpd-callout-icon") ||
                    el.classList.contains("icpd-check") ||
                    el.classList.contains("icpd-meta-label") ||
                    el.classList.contains("icpd-meta-value") ||
                    el.classList.contains("icpd-revenue-mark") ||
                    ![...el.classList].some((c) => c.startsWith("icpd-"));
                if (inlineOnly) {
                    el = el.parentElement;
                    continue;
                }
            }
            return el;
        }
        el = el.parentElement;
    }
    return null;
}

function getTabIndex(tab) {
    const raw = tab && tab.getAttribute("data-portal-tab");
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
}

function isBlankSrc(src) {
    if (!src) {
        return true;
    }
    const s = String(src).trim();
    return (
        !s ||
        s === BLANK_PORTAL_SRC ||
        s.includes("portal-dummy") ||
        s.includes("s_picture_default_image") ||
        s === "about:blank"
    );
}

function dummySrc(idx) {
    return `${BLANK_PORTAL_SRC}?slot=${idx}`;
}

/** Same attachment = same image, even if the URL string differs slightly. */
function srcIdentity(src) {
    const s = String(src || "").trim();
    if (!s || isBlankSrc(s)) {
        return "";
    }
    const attachment = s.match(/\/web\/image\/(\d+)/);
    if (attachment) {
        return `att:${attachment[1]}`;
    }
    return s.split("?")[0];
}

function markShotEmpty(shot, empty) {
    if (!shot) {
        return;
    }
    if (empty) {
        shot.setAttribute("data-portal-empty", "1");
        shot.classList.add("is-empty");
    } else {
        shot.removeAttribute("data-portal-empty");
        shot.classList.remove("is-empty");
    }
}

function eventElement(ev) {
    const node = ev && ev.target;
    if (!node) {
        return null;
    }
    return node.nodeType === 3 ? node.parentElement : node;
}

function tabUnderPointer(section, ev) {
    if (!section || ev.clientX == null || ev.clientY == null) {
        return null;
    }
    const tabs = [...section.querySelectorAll("[data-portal-tab]")];
    return (
        tabs.find((tab) => {
            const rect = tab.getBoundingClientRect();
            return (
                ev.clientX >= rect.left &&
                ev.clientX <= rect.right &&
                ev.clientY >= rect.top &&
                ev.clientY <= rect.bottom
            );
        }) || null
    );
}

function closestFromEvent(ev, selector) {
    const el = eventElement(ev);
    if (!el || !el.closest) {
        return null;
    }
    return el.closest(selector);
}

function tabDisplayName(tab) {
    return (tab && tab.textContent ? tab.textContent : "")
        .replace(/\s+/g, " ")
        .replace(/Upload/gi, "")
        .trim();
}

function getShotForTab(section, tab) {
    if (!section || !tab) {
        return null;
    }
    const idx = getTabIndex(tab);
    const frame = section.querySelector(".icpd-portal-frame");
    if (!frame) {
        return null;
    }
    // Strict: only the img owned by this tab index — never fall back to "first img"
    return frame.querySelector(`img[data-portal-shot="${idx}"]`);
}

/**
 * Tabs must be <div>s (text inside a <button> cannot be edited).
 * Converts older <button> tabs and keeps the data-portal-tab index.
 */
function ensurePortalTabButton(tab, index) {
    if (!tab) {
        return null;
    }
    const idx = tab.hasAttribute("data-portal-tab")
        ? getTabIndex(tab)
        : index;
    if (tab.tagName !== "BUTTON") {
        tab.setAttribute("data-portal-tab", String(idx));
        return tab;
    }
    const div = document.createElement("div");
    div.className = tab.className || "icpd-portal-tab";
    div.innerHTML = tab.innerHTML;
    [...tab.attributes].forEach((attr) => {
        if (attr.name !== "type") {
            div.setAttribute(attr.name, attr.value);
        }
    });
    div.setAttribute("data-portal-tab", String(idx));
    div.setAttribute("role", "tab");
    if (tab.parentNode) {
        tab.parentNode.replaceChild(div, tab);
    }
    return div;
}

/** Wrap the tab text (after the 01/02… number) in an editable label span. */
function ensureTabLabel(tab) {
    let label = tab.querySelector(".icpd-tab-label");
    if (!label) {
        const numEl = tab.querySelector(".icpd-tab-num");
        label = document.createElement("span");
        label.className = "icpd-tab-label";
        [...tab.childNodes].forEach((node) => {
            if (node !== numEl) {
                label.appendChild(node);
            }
        });
        if (!label.textContent.trim()) {
            label.textContent = " ";
        }
        tab.appendChild(label);
    }
    // The 01 / 02 / 03 / 04 number is editable too
    const numEl = tab.querySelector(".icpd-tab-num");
    [label, numEl].forEach((el) => {
        if (!el) {
            return;
        }
        el.setAttribute("contenteditable", "true");
        el.removeAttribute("data-oe-protected");
        el.classList.remove("o_not_editable");
        el.style.setProperty("user-select", "text", "important");
        el.style.setProperty("-webkit-user-select", "text", "important");
        el.style.setProperty("pointer-events", "auto", "important");
        el.style.setProperty("cursor", "text", "important");
        el.style.setProperty("outline", "none");
    });
    return label;
}

/** A tab whose number AND label were both cleared. */
function isTabEmpty(tab) {
    return !!tab && !(tab.textContent || "").replace(/[\s\u200b\u00a0]/g, "");
}

/** True when the pointer is on the ACTIVE tab's label → let the user type there. */
function isEditingTabLabel(ev, tab) {
    return !!(
        tab &&
        tab.classList.contains("is-active") &&
        closestFromEvent(ev, ".icpd-tab-label, .icpd-tab-num")
    );
}

/**
 * Tab buttons switch images. They are not text, so the editor toolbar must not open.
 */
function hardenPortalTabs(section) {
    const tabsRoot = section.querySelector(".icpd-portal-tabs");
    if (!tabsRoot) {
        return;
    }
    tabsRoot.setAttribute("contenteditable", "false");
    tabsRoot.setAttribute("data-oe-protected", "true");
    tabsRoot.classList.add("o_not_editable");
    tabsRoot.style.setProperty("pointer-events", "auto", "important");
    tabsRoot.style.setProperty("user-select", "none", "important");

    section.querySelectorAll(
        ".icpd-portal-editor-hint, .icpd-portal-upload-btn, .icpd-portal-upload-bait"
    ).forEach((el) => el.remove());

    [...section.querySelectorAll("[data-portal-tab], .icpd-portal-tab")].forEach((tab, i) => {
        const btn = ensurePortalTabButton(tab, i);
        if (!btn) {
            return;
        }
        btn.setAttribute("contenteditable", "false");
        btn.setAttribute("data-oe-protected", "true");
        btn.classList.add("o_not_editable", "icpd-portal-tab");
        btn.style.setProperty("pointer-events", "auto", "important");
        btn.style.setProperty("cursor", "pointer", "important");
        btn.style.setProperty("user-select", "none", "important");
        btn.style.setProperty("-webkit-user-select", "none", "important");
        ensureTabLabel(btn);
    });
}

/** Snapshot src per tab index (+ data-portal-src on tabs) so uploads cannot leak. */
function snapshotPortalShots(section) {
    const out = {};
    if (!section) {
        return out;
    }
    const frame = section.querySelector(".icpd-portal-frame");
    section.querySelectorAll("[data-portal-tab]").forEach((tab) => {
        const key = String(getTabIndex(tab));
        const img = frame && frame.querySelector(`img[data-portal-shot="${key}"]`);
        const src =
            (img && img.getAttribute("src")) ||
            tab.getAttribute("data-portal-src") ||
            "";
        out[key] = {
            src,
            alt: (img && img.getAttribute("alt")) || tabDisplayName(tab) || "",
            empty: !src || isBlankSrc(src),
        };
    });
    return out;
}

/** Write newSrc ONLY to this tab’s img + data-portal-src; restore every other tab. */
function applyPortalSrcToTab(section, tab, newSrc, snapshot) {
    if (!section || !tab || !newSrc || isBlankSrc(newSrc)) {
        return null;
    }
    const idx = String(getTabIndex(tab));
    const frame = section.querySelector(".icpd-portal-frame");
    if (!frame) {
        return null;
    }

    // Rebuild strict 1-img-per-tab, seeding others from snapshot
    const seed = { ...(snapshot || {}) };
    seed[idx] = { src: newSrc, alt: tabDisplayName(tab), empty: false };
    Object.keys(seed).forEach((key) => {
        const t = section.querySelector(`[data-portal-tab="${key}"]`);
        if (t) {
            if (seed[key].src && !isBlankSrc(seed[key].src)) {
                t.setAttribute("data-portal-src", seed[key].src);
            } else {
                t.removeAttribute("data-portal-src");
            }
        }
    });

    ensurePerTabShots(section, { force: true });

    const shot = frame.querySelector(`img[data-portal-shot="${idx}"]`);
    if (shot) {
        shot.setAttribute("src", newSrc);
        markShotEmpty(shot, false);
        tab.setAttribute("data-portal-src", newSrc);
        const label = tabDisplayName(tab);
        if (label) {
            shot.setAttribute("alt", label);
        }
    }

    // Drop any stray imgs the media dialog may have inserted
    [...frame.querySelectorAll("img")].forEach((img) => {
        const raw = img.getAttribute("data-portal-shot");
        if (raw == null || raw === "") {
            img.remove();
            return;
        }
        const owner = section.querySelector(`[data-portal-tab="${raw}"]`);
        if (!owner) {
            img.remove();
        }
    });

    activatePortalTab(section, tab, { force: true });
    return shot;
}

/**
 * Legacy HTML stored ONE screenshot and copied it onto every tab.
 * If every tab resolves to that same URL, keep it on tab 01 only and
 * leave 02/03/04 as empty upload slots.
 */
function splitSharedPortalImage(section) {
    const frame = section.querySelector(".icpd-portal-frame");
    const tabs = [...section.querySelectorAll("[data-portal-tab]")];
    if (!frame || tabs.length < 2) {
        return;
    }
    // Only collapse when TWO OR MORE tabs share the exact same real URL.
    // One uploaded image on button 02 must stay on button 02.
    const owned = [];
    tabs.forEach((tab) => {
        const key = String(getTabIndex(tab));
        const img = frame.querySelector(`img[data-portal-shot="${key}"]`);
        const src = (
            (img && img.getAttribute("src")) ||
            tab.getAttribute("data-portal-src") ||
            ""
        ).trim();
        if (!isBlankSrc(src)) {
            owned.push(src);
        }
    });
    if (owned.length < 2) {
        return;
    }
    const unique = new Set(owned);
    if (unique.size !== 1) {
        return;
    }
    const only = [...unique][0];
    const keeper =
        frame.querySelector('img[data-portal-shot="0"]') || frame.querySelector("img");
    frame.querySelectorAll("img").forEach((img) => {
        if (img !== keeper) {
            img.remove();
        }
    });
    if (keeper) {
        keeper.setAttribute("data-portal-shot", "0");
        keeper.setAttribute("src", only);
        markShotEmpty(keeper, false);
    }
    tabs.forEach((tab) => {
        if (getTabIndex(tab) === 0) {
            tab.setAttribute("data-portal-src", only);
        } else {
            tab.removeAttribute("data-portal-src");
        }
    });
}

/**
 * Guarantee ONE unique <img data-portal-shot="N"> per tab.
 * Never assign the same DOM node to two tabs (that was the "one image for all" bug).
 * force=true always creates missing slots (editor mode).
 */
function ensurePerTabShots(section, { createMissing = false, force = false } = {}) {
    const frame = section.querySelector(".icpd-portal-frame");
    const tabs = [...section.querySelectorAll("[data-portal-tab]")];
    if (!frame || !tabs.length) {
        return;
    }

    hardenPortalTabs(section);
    const mustCreate = force || createMissing;
    const claimed = new Set();
    // First button that saved a file owns it. Other buttons do not inherit that URL.
    const ownerBySrc = new Map();
    tabs.forEach((tab) => {
        const id = srcIdentity(tab.getAttribute("data-portal-src"));
        if (id && !ownerBySrc.has(id)) {
            ownerBySrc.set(id, tab);
        }
    });

    tabs.forEach((tab) => {
        const idx = getTabIndex(tab);
        const key = String(idx);

        // Prefer exact owner match that is not already claimed by another tab
        let shot = null;
        const matches = [...frame.querySelectorAll(`img[data-portal-shot="${key}"]`)];
        for (const img of matches) {
            if (!claimed.has(img)) {
                shot = img;
                break;
            }
        }

        // One-time claim of a true orphan (no data-portal-shot) — never steal another tab’s img
        if (!shot) {
            const orphan = [...frame.querySelectorAll("img")].find(
                (img) => !img.hasAttribute("data-portal-shot") && !claimed.has(img)
            );
            if (orphan) {
                shot = orphan;
            }
        }

        if (!shot && mustCreate) {
            shot = document.createElement("img");
            frame.appendChild(shot);
        }

        if (!shot) {
            return;
        }

        claimed.add(shot);
        shot.classList.add("icpd-portal-shot", "img", "img-fluid");
        shot.setAttribute("data-portal-shot", key);
        shot.removeAttribute("data-portal-preview");
        shot.removeAttribute("hidden");

        // Each button keeps its own file. A copied URL becomes a black dummy
        // so the next button still has a slot to upload into.
        const fromTab = (tab.getAttribute("data-portal-src") || "").trim();
        const fromImg = (shot.getAttribute("src") || "").trim();
        const tabId = srcIdentity(fromTab);
        const imgId = srcIdentity(fromImg);
        let src = "";
        if (tabId && ownerBySrc.get(tabId) === tab) {
            src = fromTab;
        } else if (imgId && !ownerBySrc.has(imgId)) {
            src = fromImg;
            ownerBySrc.set(imgId, tab);
        }

        if (!src) {
            shot.setAttribute("src", dummySrc(idx));
            markShotEmpty(shot, true);
            tab.removeAttribute("data-portal-src");
        } else {
            shot.setAttribute("src", src);
            tab.setAttribute("data-portal-src", src);
            markShotEmpty(shot, false);
            ownerBySrc.set(srcIdentity(src), tab);
        }

        const label = tabDisplayName(tab);
        if (label) {
            shot.setAttribute("alt", label);
        }
    });

    // Exactly one img per tab index; drop duplicates and unclaimed leftovers
    tabs.forEach((tab) => {
        const key = String(getTabIndex(tab));
        const shots = [...frame.querySelectorAll(`img[data-portal-shot="${key}"]`)];
        const primary = shots.find((img) => claimed.has(img)) || shots[0];
        shots.forEach((img) => {
            if (primary && img !== primary) {
                img.remove();
            }
        });
    });
    [...frame.querySelectorAll("img")].forEach((img) => {
        if (!claimed.has(img)) {
            img.remove();
        }
    });
}

function updatePortalSlotBadge(section, tab) {
    if (!section) {
        return;
    }
    const frame = section.querySelector(".icpd-portal-frame");
    if (!frame) {
        return;
    }
    let badge = section.querySelector(".icpd-portal-slot-badge");
    if (!badge) {
        badge = document.createElement("div");
        badge.className = "icpd-portal-slot-badge";
        badge.setAttribute("contenteditable", "false");
        badge.setAttribute("data-oe-protected", "true");
        if (frame.parentNode) {
            frame.parentNode.insertBefore(badge, frame);
        }
    }
    if (!tab) {
        badge.textContent = "";
        return;
    }
    const num = String(getTabIndex(tab) + 1).padStart(2, "0");
    const name = tabDisplayName(tab) || `Tab ${num}`;
    badge.innerHTML = `<strong>Image slot ${num}</strong> — ${name} <span>(this tab only)</span>`;
}

function showShot(section, tab) {
    const frame = section.querySelector(".icpd-portal-frame");
    if (!frame) {
        return null;
    }
    frame.style.position = "relative";
    frame.style.overflow = "hidden";
    frame.style.width = "100%";
    frame.style.zIndex = "1";
    if (!frame.style.aspectRatio) {
        frame.style.aspectRatio = "16 / 10";
    }
    frame.style.minHeight = "280px";

    const idx = getTabIndex(tab);
    section.setAttribute("data-active-shot", String(idx));
    let active = null;
    const imgs = [...frame.querySelectorAll("img")];
    imgs.forEach((img) => {
        const raw = img.getAttribute("data-portal-shot");
        const shotIdx = raw != null && raw !== "" ? parseInt(raw, 10) : NaN;
        // Do not rewrite missing attrs by array index — that remaps images across tabs
        if (!Number.isFinite(shotIdx)) {
            img.style.opacity = "0";
            img.style.pointerEvents = "none";
            img.classList.remove("is-active");
            img.setAttribute("aria-hidden", "true");
            return;
        }
        const on = shotIdx === idx;
        const empty = isBlankSrc(img.getAttribute("src"));
        img.classList.toggle("is-active", on);
        img.classList.toggle("is-empty", on && empty);
        if (on) {
            img.removeAttribute("hidden");
            img.setAttribute("aria-hidden", "false");
            img.style.setProperty("display", "block", "important");
            img.style.setProperty("visibility", "visible", "important");
            img.style.setProperty("opacity", "1", "important");
            img.style.setProperty("position", "absolute", "important");
            img.style.setProperty("inset", "0", "important");
            img.style.setProperty("width", "100%", "important");
            img.style.setProperty("height", "100%", "important");
            img.style.setProperty("object-fit", "contain", "important");
            img.style.setProperty("z-index", "2", "important");
            img.style.setProperty("pointer-events", "auto", "important");
            if (empty) {
                img.setAttribute("src", dummySrc(shotIdx));
                markShotEmpty(img, true);
            } else {
                markShotEmpty(img, false);
            }
            active = img;
        } else {
            img.setAttribute("hidden", "hidden");
            img.setAttribute("aria-hidden", "true");
            img.style.setProperty("display", "none", "important");
            img.style.setProperty("visibility", "hidden", "important");
            img.style.setProperty("opacity", "0", "important");
            img.style.setProperty("pointer-events", "none", "important");
        }
    });
    updatePortalSlotBadge(section, tab);
    updateEmptyOverlay(frame, tab, active);
    return active;
}

function updateEmptyOverlay(frame) {
    if (!frame) {
        return;
    }
    // The black dummy image is the placeholder. Do not cover it.
    frame.querySelectorAll(":scope > .icpd-portal-empty-label").forEach((el) => el.remove());
}

function ensureIndicator(tabsRoot) {
    if (!tabsRoot) {
        return null;
    }
    let indicator = tabsRoot.querySelector(".icpd-portal-tab-indicator");
    if (!indicator) {
        indicator = document.createElement("span");
        indicator.className = "icpd-portal-tab-indicator";
        indicator.setAttribute("aria-hidden", "true");
        indicator.setAttribute("contenteditable", "false");
        indicator.innerHTML = '<span class="icpd-portal-tab-progress"></span>';
        tabsRoot.insertBefore(indicator, tabsRoot.firstChild);
    }
    let progress = indicator.querySelector(".icpd-portal-tab-progress");
    if (!progress) {
        progress = document.createElement("span");
        progress.className = "icpd-portal-tab-progress";
        indicator.appendChild(progress);
    }
    return indicator;
}

function moveIndicator(tabsRoot, tab) {
    if (!tabsRoot || !tab) {
        return;
    }
    const indicator = ensureIndicator(tabsRoot);
    if (!indicator) {
        return;
    }
    const progress = indicator.querySelector(".icpd-portal-tab-progress");
    const rootRect = tabsRoot.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const x = tabRect.left - rootRect.left + tabsRoot.scrollLeft;

    indicator.style.opacity = "1";
    indicator.style.width = `${Math.max(tabRect.width, 40)}px`;
    requestAnimationFrame(() => {
        indicator.style.transform = `translateX(${x}px)`;
        if (progress) {
            progress.style.transitionDuration = "0ms";
            progress.style.width = "0%";
            void progress.offsetWidth;
            progress.style.transitionDuration = "320ms";
            progress.style.width = "100%";
        }
    });
}

/** Switch visible image + active tab UI (always, even without wysiwyg). */
function activatePortalTab(
    section,
    tab,
    { createMissing = false, force = false, editor = null } = {}
) {
    if (!section || !tab) {
        return null;
    }
    const run = () => {
        // Editor always force-creates one img per tab so buttons never share a slot
        ensurePerTabShots(section, { createMissing: createMissing || force, force });
        const tabs = [...section.querySelectorAll("[data-portal-tab]")];

        tabs.forEach((t) => {
            t.classList.toggle("is-active", t === tab);
            t.setAttribute("aria-selected", t === tab ? "true" : "false");
        });

        const shot = showShot(section, tab);

        if (shot && shot.getAttribute("src") && !isBlankSrc(shot.getAttribute("src"))) {
            tab.setAttribute("data-portal-src", shot.getAttribute("src"));
        }

        const tabsRoot = section.querySelector(".icpd-portal-tabs");
        moveIndicator(tabsRoot, tab);
        return shot;
    };

    // Odoo’s mutation observer often reverts the first click’s class/src changes;
    // pause it while we switch so ONE click sticks (no need to double-click).
    if (editor && editor.observerUnactive && editor.observerActive) {
        try {
            editor.observerUnactive("icpd-portal-tab");
            return run();
        } finally {
            try {
                editor.observerActive("icpd-portal-tab");
            } catch (_e) {
                // ignore
            }
        }
    }
    return run();
}

function extractAttachmentId(src) {
    if (!src) {
        return null;
    }
    const m = String(src).match(/\/web\/image\/(\d+)\b/);
    return m ? parseInt(m[1], 10) : null;
}

function stripEditorChrome(root, { clearSelected = true } = {}) {
    if (!root) {
        return;
    }
    // Only remove leftover IN-content chrome (overlay host is outside editable)
    root.querySelectorAll(
        [
            ".icpd-section-toolbar",
            ".icpd-section-delete",
            ".icpd-part-toolbar",
            ".icpd-part-delete",
            ".icpd-block-toolbar",
            ".icpd-block-delete",
            ".icpd-meta-add",
            ".icpd-revenue-add-total",
            ".icpd-revenue-add-stat",
            ".icpd-portal-upload-bar",
            ".icpd-portal-upload-btn",
            ".icpd-portal-editor-hint",
            ".icpd-portal-slot-badge",
            ".icpd-portal-empty-label",
            ".icpd-portal-upload-bait",
        ].join(", ")
    ).forEach((el) => el.remove());
    if (clearSelected) {
        // Label editing is editor-only; visitors must not get editable tab text
        root.querySelectorAll(".icpd-tab-label, .icpd-tab-num").forEach((el) => {
            el.removeAttribute("contenteditable");
        });
        root.querySelectorAll(".icpd-portals").forEach((section) => {
            section.removeAttribute("data-active-shot");
        });
        root.querySelectorAll(".icpd-block-selected, .icpd-block-editable").forEach((el) => {
            el.classList.remove("icpd-block-selected", "icpd-block-editable");
        });
    }
}

export class HtmlDualField extends HtmlField {
    static template = "website_ext.HtmlDualField";

    /** Owl 2 has no this.el — resolve the field root from a t-ref. */
    get el() {
        return (this.dualRootRef && this.dualRootRef.el) || null;
    }

    setup() {
        super.setup();
        this.dualRootRef = useRef("dualRoot");
        this.containsComplexHTML = false;
        this.sandboxedPreview = false;
        this.orm = useService("orm");
        this.blockOverlayRef = useRef("blockOverlay");
        this._portalDelegated = false;
        this._portalBoundEls = [];
        this._activePortalSection = null;
        this._activePortalTab = null;
        /** Remembered tab index so Owl/editor re-renders cannot reset to tab 0. */
        this._activePortalTabIndex = 0;
        this._portalSwitchToken = 0;
        this._selectedBlock = null;
        this._overlayHost = null;
        this._onPortalPointer = this._onPortalPointer.bind(this);
        this._onOverlayReposition = this._onOverlayReposition.bind(this);
        this._onPortalSwitch = (ev) => {
            const section = ev.detail && ev.detail.section;
            const tab = ev.detail && ev.detail.tab;
            if (section && tab) {
                this._activePortalTabIndex = getTabIndex(tab);
                this._setActivePortal(section, tab);
            }
        };

        const refresh = () => {
            this._refreshPortalSections();
            this._ensureDelegatedBinding();
        };

        onMounted(() => {
            document.addEventListener("pointerdown", this._onPortalPointer, true);
            document.addEventListener("mousedown", this._onPortalPointer, true);
            document.addEventListener("click", this._onPortalPointer, true);
            document.addEventListener("dblclick", this._onPortalPointer, true);
            document.addEventListener("selectstart", this._onPortalPointer, true);
            if (this.el) {
                this.el.addEventListener("icpd-portal-switch", this._onPortalSwitch);
            }
            refresh();
        });
        onPatched(refresh);
        onWillUnmount(() => {
            document.removeEventListener("pointerdown", this._onPortalPointer, true);
            document.removeEventListener("mousedown", this._onPortalPointer, true);
            document.removeEventListener("click", this._onPortalPointer, true);
            document.removeEventListener("dblclick", this._onPortalPointer, true);
            document.removeEventListener("selectstart", this._onPortalPointer, true);
            if (this._mediaDialogWatch) {
                clearInterval(this._mediaDialogWatch);
                this._mediaDialogWatch = null;
            }
            if (this.el) {
                this.el.removeEventListener("icpd-portal-switch", this._onPortalSwitch);
            }
            this._clearBlockSelection();
            this._unbindPortalListeners();
        });
    }

    _unbindPortalListeners() {
        const types = ["pointerdown", "mousedown", "click", "dblclick", "selectstart"];
        (this._portalBoundEls || []).forEach((el) => {
            if (!el) {
                return;
            }
            types.forEach((type) => {
                el.removeEventListener(type, this._onPortalPointer, true);
            });
        });
        this._portalBoundEls = [];
        this._portalDelegated = false;
    }

    _getEditableRoot() {
        const wrap = this.el;
        if (!wrap) {
            return null;
        }
        return (
            wrap.querySelector(".odoo-editor-editable") ||
            wrap.querySelector(".note-editable") ||
            wrap.querySelector("[contenteditable='true']") ||
            wrap
        );
    }

    _getEditor() {
        return this.wysiwyg && this.wysiwyg.odooEditor ? this.wysiwyg.odooEditor : null;
    }

    _findPortalTab(section, index) {
        if (!section) {
            return null;
        }
        const idx = Number.isFinite(index) ? index : 0;
        return (
            section.querySelector(`[data-portal-tab="${idx}"]`) ||
            section.querySelectorAll("[data-portal-tab]")[idx] ||
            section.querySelector(".icpd-portal-tab.is-active") ||
            section.querySelector("[data-portal-tab]")
        );
    }

    _refreshPortalSections() {
        const editable = this._getEditableRoot();
        if (!editable) {
            return;
        }
        // Keep current selection class during live refresh; strip only on save.
        stripEditorChrome(editable, { clearSelected: false });
        editable.querySelectorAll(".icpd-portal-editor-hint").forEach((el) => el.remove());
        const sections = editable.querySelectorAll(".icpd-portals");
        const editor = this._getEditor();
        sections.forEach((section) => {
            // Always materialize 4 separate image slots in the editor
            ensurePerTabShots(section, { force: true });
            this._bindBottomPortalTabs(section);
            const active = this._findPortalTab(section, this._activePortalTabIndex);
            if (active) {
                activatePortalTab(section, active, { force: true, editor });
                this._setActivePortal(section, active);
            }
        });
        if (this._selectedBlock && document.contains(this._selectedBlock)) {
            this._positionOverlay();
        } else if (this._selectedBlock) {
            this._clearBlockSelection();
        }
    }

    /** Bottom 01–04: click switches to that button’s own image (never shared). */
    _bindBottomPortalTabs(section) {
        if (!section) {
            return;
        }
        section.querySelectorAll("[data-portal-tab]").forEach((tab) => {
            if (tab.dataset.icpdTabBound === "1") {
                return;
            }
            tab.dataset.icpdTabBound = "1";
            const onActivate = (ev) => {
                if (isTabEmpty(tab) || isEditingTabLabel(ev, tab)) {
                    return;
                }
                ev.preventDefault();
                ev.stopPropagation();
                if (typeof ev.stopImmediatePropagation === "function") {
                    ev.stopImmediatePropagation();
                }
                this._clearBlockSelection();
                // Only switch on pointerdown; upload is by clicking the picture
                if (ev.type === "pointerdown" || ev.type === "click") {
                    this._switchPortalTab(section, tab, { sticky: true });
                }
            };
            tab.addEventListener("pointerdown", onActivate, true);
            tab.addEventListener("click", onActivate, true);
        });
    }

    /**
     * Remove an emptied tab and its image slot, then re-index the rest so
     * every remaining tab keeps ITS OWN image and the bar re-fills the width.
     */
    _deletePortalTab(section, tab) {
        const tabs = [...section.querySelectorAll("[data-portal-tab]")];
        if (tabs.length <= 1) {
            return; // keep at least one tab
        }
        const frame = section.querySelector(".icpd-portal-frame");
        const pos = tabs.indexOf(tab);
        const removedKey = String(getTabIndex(tab));

        const imgByKey = new Map();
        if (frame) {
            frame.querySelectorAll("img[data-portal-shot]").forEach((img) => {
                imgByKey.set(img.getAttribute("data-portal-shot"), img);
            });
        }
        const removedImg = imgByKey.get(removedKey);
        if (removedImg) {
            removedImg.remove();
            imgByKey.delete(removedKey);
        }
        tab.remove();

        const remaining = tabs.filter((t) => t !== tab);
        const moves = remaining.map((t) => ({
            tab: t,
            img: imgByKey.get(String(getTabIndex(t))) || null,
        }));
        moves.forEach(({ tab: t, img }, i) => {
            t.setAttribute("data-portal-tab", String(i));
            if (img) {
                img.setAttribute("data-portal-shot", String(i));
            }
            // Renumber plain "01 / 02 …" numbers; custom numbers are left alone
            const numEl = t.querySelector(".icpd-tab-num");
            if (numEl && /^\s*\d{1,2}\s*$/.test(numEl.textContent)) {
                numEl.textContent = String(i + 1).padStart(2, "0");
            }
        });

        this._tabDeletedAt = Date.now();
        this._clearBlockSelection();
        const next = remaining[Math.min(pos, remaining.length - 1)];
        this._activePortalTabIndex = getTabIndex(next);
        ensurePerTabShots(section, { force: true });
        this._switchPortalTab(section, next, { sticky: true });
        try {
            const editor = this._getEditor();
            if (editor && editor.historyStep) {
                editor.historyStep();
            }
        } catch (_e) {
            // ignore
        }
    }

    _setActivePortal(section, tab) {
        this._activePortalSection = section;
        this._activePortalTab = tab;
        if (tab) {
            this._activePortalTabIndex = getTabIndex(tab);
        }
    }

    /**
     * One click: show this tab’s image (its own file, not shared).
     * sticky=true re-applies after editor observer ticks.
     */
    _switchPortalTab(section, tab, { sticky = true } = {}) {
        if (!section || !tab) {
            return null;
        }
        const editor = this._getEditor();
        const shot = activatePortalTab(section, tab, {
            force: true,
            editor,
        });
        this._setActivePortal(section, tab);
        const token = ++this._portalSwitchToken;
        if (!sticky) {
            return shot;
        }
        const idx = getTabIndex(tab);
        const reapply = () => {
            if (token !== this._portalSwitchToken) {
                return;
            }
            const liveSection =
                (this._activePortalSection && document.contains(this._activePortalSection)
                    ? this._activePortalSection
                    : null) ||
                (this._getEditableRoot() &&
                    this._getEditableRoot().querySelector(".icpd-portals"));
            const liveTab = this._findPortalTab(liveSection, idx);
            if (liveSection && liveTab) {
                activatePortalTab(liveSection, liveTab, {
                    force: true,
                    editor: this._getEditor(),
                });
                this._setActivePortal(liveSection, liveTab);
            }
        };
        window.setTimeout(reapply, 0);
        window.setTimeout(reapply, 50);
        window.setTimeout(reapply, 150);
        return shot;
    }

    /**
     * Capture listeners on field root + editable (+ iframe doc if any).
     * Rebinds when the editable is remounted so tab clicks never fall through
     * to the text toolbar.
     */
    _ensureDelegatedBinding() {
        if (!this.el) {
            return;
        }
        const targets = [this.el];
        const editable = this._getEditableRoot();
        if (editable && editable !== this.el) {
            targets.push(editable);
        }
        try {
            const edDoc = this.wysiwyg && this.wysiwyg.odooEditor && this.wysiwyg.odooEditor.document;
            if (edDoc && edDoc !== document && edDoc.addEventListener) {
                targets.push(edDoc);
            }
            const edRoot = this.wysiwyg && this.wysiwyg.odooEditor && this.wysiwyg.odooEditor.editable;
            if (edRoot && !targets.includes(edRoot)) {
                targets.push(edRoot);
            }
        } catch (_e) {
            // ignore
        }

        const same =
            this._portalDelegated &&
            this._portalBoundEls.length === targets.length &&
            targets.every((t, i) => t === this._portalBoundEls[i]);
        if (same) {
            return;
        }

        this._unbindPortalListeners();
        const types = ["pointerdown", "mousedown", "click", "dblclick", "selectstart"];
        targets.forEach((el) => {
            types.forEach((type) => {
                el.addEventListener(type, this._onPortalPointer, true);
            });
        });
        this._portalBoundEls = targets;
        this._portalDelegated = true;
    }

    _onPortalPointer(ev) {
        if (!this.el) {
            return;
        }
        const hit = eventElement(ev);
        if (!hit || !this.el.contains(hit)) {
            return;
        }
        if (ev.type === "pointerdown" && ev.button !== 0) {
            return;
        }

        // Click the visible black dummy (or double-click any slot image) → replace THAT button only.
        const shotHit = closestFromEvent(ev, ".icpd-portal-frame img");
        if (
            shotHit &&
            this.el.contains(shotHit) &&
            (ev.type === "pointerdown" || ev.type === "dblclick")
        ) {
            const section = shotHit.closest(".icpd-portals");
            const raw = shotHit.getAttribute("data-portal-shot");
            const tab =
                section &&
                raw != null &&
                raw !== "" &&
                section.querySelector(`[data-portal-tab="${raw}"]`);
            const blank = isBlankSrc(shotHit.getAttribute("src"));
            const replace = tab && (ev.type === "dblclick" || (ev.type === "pointerdown" && blank));
            if (replace) {
                const now = Date.now();
                if (this._uploadJustOpened && now - this._uploadJustOpened < 700) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    return;
                }
                ev.preventDefault();
                ev.stopPropagation();
                if (typeof ev.stopImmediatePropagation === "function") {
                    ev.stopImmediatePropagation();
                }
                this._clearBlockSelection();
                this._switchPortalTab(section, tab, { sticky: true });
                this._uploadPictureForTab(section, tab);
                return;
            }
        }

        // Bottom 01 / 02 / 03 / 04 tabs: only switch to that button’s own image
        let tab = closestFromEvent(ev, "[data-portal-tab]");
        const tabsRootHit = closestFromEvent(ev, ".icpd-portal-tabs");
        if (!tab && tabsRootHit && this.el.contains(tabsRootHit)) {
            tab = tabUnderPointer(tabsRootHit.closest(".icpd-portals"), ev);
        }
        if (tab && this.el.contains(tab)) {
            const section = tab.closest(".icpd-portals");
            if (!section) {
                return;
            }
            // Swallow the tail of the click that just deleted a tab
            if (this._tabDeletedAt && Date.now() - this._tabDeletedAt < 500) {
                ev.preventDefault();
                ev.stopPropagation();
                return;
            }
            // Text was removed from this tab → one more click deletes the whole tab
            if (isTabEmpty(tab) && ev.type === "pointerdown") {
                ev.preventDefault();
                ev.stopPropagation();
                if (typeof ev.stopImmediatePropagation === "function") {
                    ev.stopImmediatePropagation();
                }
                this._deletePortalTab(section, tab);
                return;
            }
            // Active tab's label: let the click through so the text can be edited in place
            if (isEditingTabLabel(ev, tab)) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            if (typeof ev.stopImmediatePropagation === "function") {
                ev.stopImmediatePropagation();
            }
            try {
                const sel = window.getSelection && window.getSelection();
                if (sel && sel.removeAllRanges) {
                    sel.removeAllRanges();
                }
                const editor = this._getEditor();
                if (editor && editor._updateToolbar) {
                    editor._updateToolbar(false);
                }
            } catch (_e) {
                // ignore
            }
            if (ev.type === "pointerdown" || ev.type === "mousedown") {
                this._clearBlockSelection();
                this._switchPortalTab(section, tab, { sticky: true });
            }
            return;
        }

        // Overlay delete lives outside contenteditable — handle first
        const deleteBtn = closestFromEvent(ev, ".icpd-block-delete");
        if (deleteBtn && this.el.contains(deleteBtn)) {
            ev.preventDefault();
            ev.stopPropagation();
            if (typeof ev.stopImmediatePropagation === "function") {
                ev.stopImmediatePropagation();
            }
            if (ev.type === "pointerdown") {
                this._deleteSelectedBlock(this._selectedBlock);
            }
            return;
        }
        if (closestFromEvent(ev, ".icpd-block-overlay")) {
            return;
        }

        // pointerdown: select block before Odoo editor swallows the gesture
        if (ev.type === "pointerdown") {
            const editable = this._getEditableRoot();
            if (!editable || !editable.contains(ev.target)) {
                return;
            }
            const block = findSelectableBlock(ev.target, editable);
            if (block) {
                this._selectBlock(block);
            } else {
                this._clearBlockSelection();
            }
        }
    }

    _getOverlayHost() {
        const host =
            (this.blockOverlayRef && this.blockOverlayRef.el) ||
            (this.el && this.el.querySelector(":scope > .icpd-block-overlay"));
        this._overlayHost = host || null;
        return this._overlayHost;
    }

    _onOverlayReposition() {
        this._positionOverlay();
    }

    _clearBlockSelection() {
        if (this._overlayHost) {
            this._overlayHost.innerHTML = "";
            this._overlayHost.classList.remove("is-active");
        }
        const editable = this._getEditableRoot();
        if (editable) {
            editable.querySelectorAll(".icpd-block-selected").forEach((el) => {
                el.classList.remove("icpd-block-selected");
            });
            editable
                .querySelectorAll(".icpd-block-toolbar, .icpd-block-delete")
                .forEach((el) => el.remove());
            editable.removeEventListener("scroll", this._onOverlayReposition);
        }
        this._selectedBlock = null;
        window.removeEventListener("resize", this._onOverlayReposition);
    }

    _selectBlock(block) {
        if (!(block instanceof HTMLElement)) {
            return;
        }
        if (
            this._selectedBlock === block &&
            this._overlayHost &&
            this._overlayHost.classList.contains("is-active")
        ) {
            this._positionOverlay();
            return;
        }
        this._clearBlockSelection();
        this._selectedBlock = block;
        block.classList.add("icpd-block-selected");

        const host = this._getOverlayHost();
        if (!host) {
            return;
        }
        host.classList.add("is-active");
        host.innerHTML = "";

        const outline = document.createElement("div");
        outline.className = "icpd-block-outline";
        host.appendChild(outline);

        const toolbar = document.createElement("div");
        toolbar.className = "icpd-block-toolbar";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "icpd-block-delete";
        btn.setAttribute("title", `Delete this ${blockLabel(block)}`);
        btn.innerHTML = '<i class="fa fa-trash"></i><span>Delete</span>';
        toolbar.appendChild(btn);
        host.appendChild(toolbar);

        this._positionOverlay();

        const editable = this._getEditableRoot();
        if (editable) {
            editable.addEventListener("scroll", this._onOverlayReposition, {
                passive: true,
            });
        }
        window.addEventListener("resize", this._onOverlayReposition);
    }

    _positionOverlay() {
        const block = this._selectedBlock;
        const host = this._overlayHost;
        if (!block || !host || !this.el || !document.contains(block)) {
            return;
        }
        const wrapRect = this.el.getBoundingClientRect();
        const rect = block.getBoundingClientRect();
        const top = rect.top - wrapRect.top + this.el.scrollTop;
        const left = rect.left - wrapRect.left + this.el.scrollLeft;

        const outline = host.querySelector(".icpd-block-outline");
        if (outline) {
            outline.style.top = `${top}px`;
            outline.style.left = `${left}px`;
            outline.style.width = `${rect.width}px`;
            outline.style.height = `${rect.height}px`;
        }
        const toolbar = host.querySelector(".icpd-block-toolbar");
        if (toolbar) {
            toolbar.style.top = `${Math.max(0, top - 36)}px`;
            toolbar.style.left = `${left + rect.width / 2}px`;
        }
    }

    _deleteSelectedBlock(block) {
        const target = block || this._selectedBlock;
        if (!target || !target.parentNode) {
            return;
        }
        const label = blockLabel(target);
        if (!window.confirm(`Delete this ${label}?`)) {
            return;
        }
        this._clearBlockSelection();
        const editor = this.wysiwyg && this.wysiwyg.odooEditor;
        try {
            if (editor && editor.observerUnactive) {
                editor.observerUnactive("icpd-block-delete");
            }
            target.remove();
            if (editor && editor.historyStep) {
                editor.historyStep();
            }
        } catch (_e) {
            try {
                target.remove();
            } catch (_e2) {
                // ignore
            }
        } finally {
            try {
                if (editor && editor.observerActive) {
                    editor.observerActive("icpd-block-delete");
                }
            } catch (_e3) {
                // ignore
            }
        }
    }

    /** Never persist leftover selection classes into saved Case Study HTML */
    _patchWysiwygValueCleaner() {
        if (!this.wysiwyg || this.wysiwyg.__icpdValuePatched) {
            return;
        }
        this.wysiwyg.__icpdValuePatched = true;
        const originalGetValue = this.wysiwyg.getValue.bind(this.wysiwyg);
        this.wysiwyg.getValue = (...args) => {
            this._clearBlockSelection();
            const editable = this._getEditableRoot();
            stripEditorChrome(editable);
            return originalGetValue(...args);
        };
    }

    async _onAttachmentChange(attachment) {
        if (attachment && attachment.id) {
            try {
                await this.orm.write("ir.attachment", [attachment.id], {
                    public: true,
                });
            } catch (_e) {
                // ignore
            }
        }
    }

    _selectNode(el) {
        try {
            const editor = this.wysiwyg && this.wysiwyg.odooEditor;
            if (!el || !editor || !el.parentNode) {
                return false;
            }
            if (editor.editable && editor.editable.focus) {
                editor.editable.focus();
            }
            const doc = el.ownerDocument || editor.document;
            const parent = el.parentNode;
            const offset = Array.prototype.indexOf.call(parent.childNodes, el);
            if (offset < 0) {
                return false;
            }
            const sel = doc.getSelection();
            if (!sel) {
                return false;
            }
            const range = doc.createRange();
            range.setStart(parent, offset);
            range.setEnd(parent, offset + 1);
            sel.removeAllRanges();
            sel.addRange(range);
            return sel.rangeCount > 0;
        } catch (_e) {
            return false;
        }
    }

    /**
     * Open Odoo's image dialog and write the file onto this tab's img only.
     * The dialog refuses to open unless the editor has a selection, so the
     * real per-tab <img> is selected first. The chosen file is copied onto
     * that img; the dialog is not allowed to replace the node (that made
     * every button share one screenshot).
     */
    _uploadPictureForTab(section, tab) {
        if (!section || !tab || !this.wysiwyg || !this.wysiwyg.odooEditor) {
            return;
        }
        this._uploadJustOpened = Date.now();

        this._switchPortalTab(section, tab, { sticky: false });
        ensurePerTabShots(section, { force: true });

        const snapshot = snapshotPortalShots(section);
        const targetIdx = String(getTabIndex(tab));
        const shot = getShotForTab(section, tab);
        if (!shot) {
            return;
        }
        shot.removeAttribute("data-oe-protected");
        shot.removeAttribute("contenteditable");

        const wysiwyg = this.wysiwyg;
        const originalSave = wysiwyg._onMediaDialogSave.bind(wysiwyg);
        let restored = false;
        const restoreSave = () => {
            if (restored) {
                return;
            }
            restored = true;
            wysiwyg._onMediaDialogSave = originalSave;
            if (this._mediaDialogWatch) {
                clearInterval(this._mediaDialogWatch);
                this._mediaDialogWatch = null;
            }
        };

        const finishWithSrc = (src) => {
            restoreSave();
            if (!src || isBlankSrc(src)) {
                ensurePerTabShots(section, { force: true });
                this._switchPortalTab(section, tab, { sticky: true });
                return;
            }
            applyPortalSrcToTab(section, tab, src, snapshot);
            Object.keys(snapshot || {}).forEach((key) => {
                if (key === targetIdx) {
                    return;
                }
                const otherTab = section.querySelector(`[data-portal-tab="${key}"]`);
                const snap = snapshot[key];
                if (!otherTab || !snap) {
                    return;
                }
                if (snap.src && !isBlankSrc(snap.src)) {
                    otherTab.setAttribute("data-portal-src", snap.src);
                } else {
                    otherTab.removeAttribute("data-portal-src");
                }
            });
            ensurePerTabShots(section, { force: true });
            this._switchPortalTab(section, tab, { sticky: true });
            const attId = extractAttachmentId(src);
            if (attId) {
                this.orm.write("ir.attachment", [attId], { public: true }).catch(() => {});
            }
            try {
                const editor = this._getEditor();
                if (editor && editor.historyStep) {
                    editor.historyStep();
                }
            } catch (_e) {
                // ignore
            }
            // Keep other buttons clickable with their own dummy slots
            this._refreshPortalSections();
        };

        wysiwyg._onMediaDialogSave = (params, element) => {
            const nested = element && element.querySelector && element.querySelector("img");
            const src =
                (element && element.getAttribute && element.getAttribute("src")) ||
                (nested && nested.getAttribute("src")) ||
                "";
            finishWithSrc(src);
        };

        if (!this._selectNode(shot)) {
            restoreSave();
            this._uploadJustOpened = 0;
            return;
        }
        try {
            wysiwyg.openMediaDialog({
                node: shot,
                noVideos: true,
                noIcons: true,
                noDocuments: true,
            });
            // Cancel closes dialog without save — restore hook so later tab clicks still work
            if (this._mediaDialogWatch) {
                clearInterval(this._mediaDialogWatch);
            }
            let sawDialog = false;
            this._mediaDialogWatch = setInterval(() => {
                const open = document.querySelector(
                    ".o_select_media_dialog, .o_media_dialog, .o_technical_modal, .modal.show"
                );
                if (open) {
                    sawDialog = true;
                    return;
                }
                if (!sawDialog) {
                    return;
                }
                restoreSave();
                this._uploadJustOpened = 0;
                ensurePerTabShots(section, { force: true });
                this._switchPortalTab(section, tab, { sticky: true });
            }, 400);
        } catch (_e) {
            restoreSave();
            this._uploadJustOpened = 0;
        }
    }

    _onDblClickEditableMedia(ev) {
        const el = ev.currentTarget;
        if (!el || el.nodeName !== "IMG" || !this.wysiwyg) {
            return;
        }
        const section = el.closest(".icpd-portals");
        if (!section) {
            return;
        }
        ev.preventDefault();
        ev.stopPropagation();

        const shotIdx = el.getAttribute("data-portal-shot");
        const tab =
            (shotIdx !== null &&
                section.querySelector(`[data-portal-tab="${shotIdx}"]`)) ||
            this._findPortalTab(section, this._activePortalTabIndex);
        if (tab) {
            this._switchPortalTab(section, tab, { sticky: false });
            this._uploadPictureForTab(section, tab);
        }
    }

    async startWysiwyg(...args) {
        const result = await super.startWysiwyg(...args);
        try {
            this._patchWysiwygValueCleaner();
            const editor = this._getEditor();
            if (editor && !this._portalHistoryBound) {
                this._portalHistoryBound = true;
                this._onEditorHistory = () => {
                    if (this._portalRefreshing) {
                        return;
                    }
                    this._portalRefreshing = true;
                    try {
                        this._refreshPortalSections();
                    } finally {
                        this._portalRefreshing = false;
                    }
                };
                editor.addEventListener("historyStep", this._onEditorHistory);
            }
            this._refreshPortalSections();
            this._ensureDelegatedBinding();
        } catch (_e) {
            // ignore
        }
        return result;
    }

    async commitChanges(...args) {
        this._clearBlockSelection();
        stripEditorChrome(this._getEditableRoot());
        return super.commitChanges(...args);
    }
}

export const htmlDualField = {
    ...htmlField,
    component: HtmlDualField,
    extractProps(params, dynamicInfo) {
        const props = htmlField.extractProps(params, dynamicInfo);
        props.codeview = true;
        props.sandboxedPreview = false;
        if (props.wysiwygOptions) {
            props.wysiwygOptions = {
                ...props.wysiwygOptions,
                allowCommandImage: true,
            };
        }
        return props;
    },
};

registry.category("fields").add("html_dual", htmlDualField);
