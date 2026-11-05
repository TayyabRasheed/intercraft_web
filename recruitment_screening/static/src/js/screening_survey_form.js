/** @odoo-module **/
/*
 * Recruitment Screening - candidate form enhancements
 *
 *  1. Single-choice questions shown as a SLIDER (1-10 ratings) or a DROPDOWN.
 *     Odoo's own radio inputs stay in the page (hidden) and remain the source of truth,
 *     so scoring, mandatory checks and conditional questions keep working unchanged.
 *  2. With "Foldable sections on one page", every section can be folded / unfolded.
 */
import { _t } from "@web/core/l10n/translation";
import publicWidget from "@web/legacy/js/public/public_widget";
import "@survey/js/survey_form";

const ENHANCED = "screeningEnhanced";

/**
 * Translated text that never breaks the page: when the candidate re-opens a started
 * questionnaire, this script runs before Odoo has loaded its translations, and the
 * lazy _t() string would throw. Fall back to the English text in that case.
 */
function tr(term, ...values) {
    try {
        return _t(term, ...values).valueOf();
    } catch {
        return values.reduce((text, value) => text.replace("%s", value), term);
    }
}

/* ------------------------------------------------------------------ helpers */

function choiceInputs(wrapper) {
    // real answer options only (the "Other" comment option has value -1)
    return [...wrapper.querySelectorAll("input.o_survey_form_choice_item[type='radio']")];
}

function selectRadio(radio) {
    if (!radio || radio.checked) {
        return;
    }
    radio.checked = true;
    // bubble a native change event so Odoo's survey widget (jQuery delegated handler)
    // updates its selection bookkeeping and shows/hides conditional questions
    radio.dispatchEvent(new Event("change", { bubbles: true }));
}

function labelText(radio) {
    const span = radio.closest("label")?.querySelector("span.text-break, span.ms-2");
    return (span ? span.textContent : radio.value).trim();
}

/* ------------------------------------------------------------------ dropdown */

function buildDropdown(wrapper) {
    const group = wrapper.querySelector(".o_survey_form_choice");
    const radios = choiceInputs(wrapper);
    if (!group || !radios.length) {
        return;
    }
    const select = document.createElement("select");
    select.className = "form-select o_screening_dropdown";
    select.setAttribute("aria-label", wrapper.querySelector("h3")?.textContent.trim() || "");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = tr("Select…");
    placeholder.disabled = true;
    select.appendChild(placeholder);
    for (const radio of radios) {
        const opt = document.createElement("option");
        opt.value = radio.value;
        opt.textContent = labelText(radio);
        select.appendChild(opt);
    }
    const checked = radios.find((r) => r.checked);
    select.value = checked ? checked.value : "";
    if (!checked) {
        placeholder.selected = true;
    }
    select.addEventListener("change", () => {
        selectRadio(radios.find((r) => r.value === select.value));
    });
    group.classList.add("o_screening_hidden");
    group.insertAdjacentElement("beforebegin", select);
}

/* ------------------------------------------------------------------ slider */

function buildSlider(wrapper) {
    const group = wrapper.querySelector(".o_survey_form_choice");
    const radios = choiceInputs(wrapper).filter((r) => r.value !== "-1");
    if (!group || radios.length < 2) {
        return;
    }
    const box = document.createElement("div");
    box.className = "o_screening_slider";

    const range = document.createElement("input");
    range.type = "range";
    range.min = "1";
    range.max = String(radios.length);
    range.step = "1";
    range.className = "form-range";
    range.setAttribute("aria-label", wrapper.querySelector("h3")?.textContent.trim() || "");

    const ticks = document.createElement("div");
    ticks.className = "o_screening_slider_ticks";
    radios.forEach((radio, index) => {
        const tick = document.createElement("span");
        tick.textContent = String(index + 1);
        tick.title = labelText(radio);
        tick.addEventListener("click", () => {
            range.value = String(index + 1);
            apply();
        });
        ticks.appendChild(tick);
    });

    const caption = document.createElement("div");
    caption.className = "o_screening_slider_value";

    const checkedIndex = radios.findIndex((r) => r.checked);
    const apply = () => {
        const radio = radios[parseInt(range.value, 10) - 1];
        box.classList.remove("o_screening_untouched");
        caption.textContent = tr("Your rating: %s", labelText(radio));
        [...ticks.children].forEach((t, i) => t.classList.toggle("active", i === parseInt(range.value, 10) - 1));
        selectRadio(radio);
    };
    if (checkedIndex >= 0) {
        range.value = String(checkedIndex + 1);
        caption.textContent = tr("Your rating: %s", labelText(radios[checkedIndex]));
        ticks.children[checkedIndex].classList.add("active");
    } else {
        // nothing chosen yet: the candidate must move or click the slider
        range.value = String(Math.ceil(radios.length / 2));
        box.classList.add("o_screening_untouched");
        caption.textContent = tr("Move the slider or click a number");
    }
    range.addEventListener("input", apply);
    range.addEventListener("change", apply);
    // a click on the thumb without moving still counts as a choice
    range.addEventListener("pointerup", apply);
    range.addEventListener("keyup", apply);

    box.append(range, ticks, caption);
    group.classList.add("o_screening_hidden");
    group.insertAdjacentElement("beforebegin", box);
}

function enhanceQuestion(wrapper) {
    if (wrapper.dataset[ENHANCED]) {
        return;
    }
    const mode = wrapper.dataset.screeningDisplay;
    if (!mode || choiceInputs(wrapper).some((r) => r.disabled)) {
        return;
    }
    wrapper.dataset[ENHANCED] = "1";
    if (mode === "slider") {
        buildSlider(wrapper);
    } else if (mode === "dropdown") {
        buildDropdown(wrapper);
    }
}

/* ------------------------------------------------------------------ foldable sections */

function isAnswered(questionWrapper) {
    if (questionWrapper.querySelector("input[type='radio']:checked, input[type='checkbox']:checked")) {
        return true;
    }
    return [...questionWrapper.querySelectorAll("textarea, input[type='text'], input[type='email'], input[type='number'], input.datetimepicker-input")]
        .some((el) => el.value && el.value.trim());
}

function refreshSectionStatus(section) {
    const status = section.querySelector(":scope > .o_screening_section_header .o_screening_section_status");
    if (!status) {
        return;
    }
    const questions = [...section.querySelectorAll(".js_question-wrapper")].filter((q) => !q.classList.contains("d-none"));
    const done = questions.filter(isAnswered).length;
    status.textContent = `${done} / ${questions.length}`;
    section.classList.toggle("o_screening_section_done", questions.length > 0 && done === questions.length);
}

function refreshWithParents(section) {
    for (let s = section; s; s = s.parentElement?.closest(".o_screening_section")) {
        refreshSectionStatus(s);
    }
}

function setOpen(section, open) {
    section.classList.toggle("o_screening_section_open", open);
    const header = section.querySelector(":scope > .o_screening_section_header");
    header?.setAttribute("aria-expanded", open ? "true" : "false");
}

function openWithParents(section) {
    for (let s = section; s; s = s.parentElement?.closest(".o_screening_section")) {
        setOpen(s, true);
    }
}

function isShown(section) {
    return !section.classList.contains("d-none");
}

function hasOwnQuestions(section) {
    return Boolean(section.querySelector(".js_question-wrapper"));
}

/**
 * A section WITHOUT questions (e.g. "Technical", "Scenario Based Questions") is a main
 * section: the sections that follow it (e.g. "Linux", "Docker") are shown inside it,
 * until the next section without questions.
 */
function groupSections(allSections) {
    const groups = []; // [{section, children: []}]
    let current = null;
    for (const section of allSections) {
        if (!hasOwnQuestions(section)) {
            current = { section, children: [] };
            groups.push(current);
        } else if (current) {
            current.children.push(section);
        } else {
            groups.push({ section, children: [] });
        }
    }
    return groups.filter((g) => hasOwnQuestions(g.section) || g.children.length);
}

function buildCard(section, level) {
    section.dataset[ENHANCED] = "1";
    const sub = level === 2;
    section.classList.add("o_screening_section", sub ? "o_screening_subsection" : "o_screening_mainsection");
    const title = section.querySelector(":scope > h2");
    const body = document.createElement("div");
    body.className = "o_screening_section_body";
    [...section.children].filter((el) => el !== title).forEach((el) => body.appendChild(el));

    // main sections: clickable header that folds / unfolds;
    // sub-sections (Linux, Docker...): a plain heading, always open inside their main section
    const header = document.createElement(sub ? "div" : "button");
    header.className = "o_screening_section_header";
    const name = document.createElement(sub ? "h3" : "span");
    name.className = "o_screening_section_title";
    name.textContent = title ? title.textContent.trim() : "";
    const status = document.createElement("span");
    status.className = "o_screening_section_status";
    const check = document.createElement("i");
    check.className = "fa fa-check-circle o_screening_section_check";
    if (sub) {
        header.append(name, check, status);
    } else {
        header.type = "button";
        header.setAttribute("aria-expanded", "false");
        const icon = document.createElement("i");
        icon.className = "fa fa-chevron-right o_screening_chevron";
        header.append(icon, name, check, status);
        header.addEventListener("click", () => setOpen(section, !section.classList.contains("o_screening_section_open")));
    }
    if (title) {
        title.remove();
    }
    section.append(header, body);
    return body;
}

function enhanceSections(root) {
    const data = root.querySelector(".o_survey_form_content_data");
    if (!data || !data.dataset.screeningCollapsible) {
        return;
    }
    const allSections = [...root.querySelectorAll(".js_section_wrapper")];
    if (!allSections.length || allSections.some((s) => s.dataset[ENHANCED])) {
        return;
    }
    const groups = groupSections(allSections);

    // build the cards and nest the sub-sections in their main section
    for (const group of groups) {
        const body = buildCard(group.section, 1);
        for (const child of group.children) {
            buildCard(child, 2);
            body.appendChild(child);
        }
        if (group.children.length) {
            group.section.classList.remove("d-none");
        }
    }

    // "Next section" at the end of every main section
    const mains = groups.map((g) => g.section);
    mains.forEach((main, index) => {
        if (index === mains.length - 1) {
            return;
        }
        const next = document.createElement("button");
        next.type = "button";
        next.className = "btn btn-primary o_screening_next_section";
        next.textContent = tr("Next section");
        next.addEventListener("click", () => {
            const target = mains.slice(index + 1).find(isShown);
            if (!target) {
                return;
            }
            setOpen(main, false);
            setOpen(target, true);
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        main.querySelector(":scope > .o_screening_section_body").appendChild(next);
    });

    // first section open (and, if it is a main section, its first sub-section)
    const first = groups[0];
    if (first) {
        setOpen(first.section, true);
    }
    root.querySelectorAll(".o_screening_section").forEach(refreshSectionStatus);

    if (!root.dataset.screeningStatusListener) {
        root.dataset.screeningStatusListener = "1";
        const update = (ev) => {
            const section = ev.target.closest?.(".o_screening_section");
            if (section) {
                refreshWithParents(section);
            }
        };
        root.addEventListener("input", update);
        root.addEventListener("change", update);
    }
}

/* ------------------------------------------------------------------ wiring */

/**
 * Sections whose questions are all hidden (e.g. after "Willing to work on site?" = No) are hidden
 * too, and "Next section" disappears when no further section is left.
 */
function syncSectionVisibility(root) {
    const hideIfEmpty = (section) => {
        const wrappers = section.querySelectorAll(".js_question-wrapper");
        if (!wrappers.length) {
            return;
        }
        const allHidden = [...wrappers].every((w) => w.classList.contains("d-none"));
        if (section.classList.contains("d-none") !== allHidden) {
            section.classList.toggle("d-none", allHidden);
        }
    };
    root.querySelectorAll(".js_section_wrapper").forEach(hideIfEmpty);
    root.querySelectorAll(".o_screening_subsection").forEach(hideIfEmpty);
    const mains = [...root.querySelectorAll(".o_screening_mainsection")];
    mains.forEach(hideIfEmpty);
    mains.forEach((main, index) => {
        const button = main.querySelector(":scope > .o_screening_section_body > .o_screening_next_section");
        if (button) {
            const hasNext = mains.slice(index + 1).some(isShown);
            if (button.classList.contains("d-none") === hasNext) {
                button.classList.toggle("d-none", !hasNext);
            }
        }
    });
}

function enhance(root) {
    root.querySelectorAll(".js_question-wrapper[data-screening-display]").forEach(enhanceQuestion);
    enhanceSections(root);
    syncSectionVisibility(root);
}

function start() {
    const form = document.querySelector(".o_survey_form");
    if (!form) {
        return;
    }
    enhance(form);
    // the survey content is (re)loaded by Odoo through AJAX: enhance whatever arrives
    new MutationObserver(() => enhance(form)).observe(form, { childList: true, subtree: true });
    // Odoo shows / hides conditional questions by toggling a CSS class: follow it
    let scheduled = false;
    new MutationObserver(() => {
        if (!scheduled) {
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                syncSectionVisibility(form);
                form.querySelectorAll(".o_screening_section").forEach(refreshSectionStatus);
            });
        }
    }).observe(form, { attributes: true, attributeFilter: ["class"], subtree: true });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
} else {
    start();
}

/**
 * "Are you sure?" dialog shown before the final Submit. Resolves true (submit) or false (go back).
 */
function confirmSubmit() {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "o_screening_confirm_overlay";
        const box = document.createElement("div");
        box.className = "o_screening_confirm_box";
        box.setAttribute("role", "dialog");
        box.setAttribute("aria-modal", "true");
        const title = document.createElement("h4");
        title.textContent = tr("Submit your answers?");
        const text = document.createElement("p");
        text.textContent = tr("Once submitted, you will not be able to change your answers. Please make sure everything is complete.");
        const actions = document.createElement("div");
        actions.className = "o_screening_confirm_actions";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "btn btn-secondary";
        cancel.textContent = tr("Review again");
        const ok = document.createElement("button");
        ok.type = "button";
        ok.className = "btn btn-primary";
        ok.textContent = tr("Yes, Submit");
        actions.append(cancel, ok);
        box.append(title, text, actions);
        overlay.append(box);

        const close = (answer) => {
            overlay.remove();
            resolve(answer);
        };
        cancel.addEventListener("click", () => close(false));
        ok.addEventListener("click", () => close(true));
        // keys pressed in the dialog must not reach Odoo's own Enter / arrow shortcuts
        overlay.addEventListener("keydown", (event) => {
            event.stopPropagation();
            if (event.key === "Escape") {
                close(false);
            }
        });
        document.body.append(overlay);
        ok.focus();
    });
}

/* Open folded sections that contain an error, before Odoo scrolls to it */
publicWidget.registry.SurveyFormWidget.include({
    async _submitForm(options) {
        // _super only exists during the synchronous part of the call: keep it before waiting
        const superSubmit = this._super.bind(this);
        if (options && options.isFinish && !this._screeningConfirmed) {
            if (this._screeningAsking) {
                return;
            }
            this._screeningAsking = true;
            let confirmed = false;
            try {
                confirmed = await confirmSubmit();
            } finally {
                this._screeningAsking = false;
            }
            if (!confirmed) {
                return;
            }
        }
        return superSubmit(...arguments);
    },

    _showErrors(errors) {
        for (const questionId of Object.keys(errors || {})) {
            const section = this.el.querySelector(`.js_question-wrapper[id="${questionId}"]`)?.closest(".o_screening_section");
            if (section) {
                openWithParents(section);
            }
        }
        return this._super(...arguments);
    },
});
