// /website_ext/static/src/js/main.js - FINAL SIMPLIFIED VERSION

document.addEventListener("DOMContentLoaded", () => {
    initNavbar();
    // initServiceCards();
    initMobileAccordion();
    initFeatureCards();
    initPartnerLogos();
    initTeamFunctionality();
    initGenericScrollAnimations();
});
function initMobileAccordion() {
    const accordionToggle = document.getElementById('servicesAccordionToggle');
    const accordionCollapse = document.getElementById('servicesAccordion');

    if (accordionToggle && accordionCollapse) {
        accordionToggle.addEventListener('click', function(event) {
            event.preventDefault();

            accordionCollapse.classList.toggle('show');

            const isExpanded = accordionCollapse.classList.contains('show');
            accordionToggle.setAttribute('aria-expanded', isExpanded);
        });
    }
}

function initNavbar() {
    const navbar = document.querySelector(".navbar");
    const navbarToggler = document.querySelector(".navbar-toggler");
    const navbarCollapse = document.querySelector(".navbar-collapse");

    if (!navbar || !navbarToggler || !navbarCollapse) {
        return;
    }

    const scrollContainer = document.querySelector("#wrapwrap") || window;
    const scrollElement = document.querySelector("#wrapwrap") || document.documentElement;
    const handleScroll = () => {
        if ((scrollElement.scrollTop || window.scrollY) > 50) {
            navbar.classList.add("navbar-scrolled");
        } else {
            navbar.classList.remove("navbar-scrolled");
        }
    };
    handleScroll();
    scrollContainer.addEventListener("scroll", handleScroll);

    navbarToggler.addEventListener("click", function (e) {
        e.stopPropagation();
        const collapseInstance = bootstrap.Collapse.getOrCreateInstance(navbarCollapse);
        collapseInstance.toggle();
    });

    document.addEventListener("click", function (e) {
        if (navbarCollapse.classList.contains("show") && !navbar.contains(e.target)) {
            const collapseInstance = bootstrap.Collapse.getInstance(navbarCollapse);
            if (collapseInstance) {
                collapseInstance.hide();
            }
        }
    });

}


function initFeatureCards() {
    const featureCards = document.querySelectorAll(".feature-card");
    featureCards.forEach((card) => {
        card.addEventListener("mouseenter", () => card.classList.add("hovered"));
        card.addEventListener("mouseleave", () => card.classList.remove("hovered"));
    });
}

function initPartnerLogos() {
    const partnerContainers = document.querySelectorAll(".partner-logo-container");
    partnerContainers.forEach((container) => {
        container.addEventListener("mouseenter", () => container.classList.add("hovered"));
        container.addEventListener("mouseleave", () => container.classList.remove("hovered"));
    });
}

function initTeamFunctionality() {
    const teamCarouselEl = document.getElementById("teamCarousel");
    if (!teamCarouselEl) return;
    initTeamCarousel(teamCarouselEl);
    initTeamCardAnimations();
    initResponsiveTeamSlider(teamCarouselEl);
    initTeamSectionObserver();
    initTeamKeyboardControls(teamCarouselEl);
    initAccessibility(teamCarouselEl);
}

function initTeamCarousel(teamCarouselEl) {
    const carousel = new bootstrap.Carousel(teamCarouselEl, {
        interval: 4000,
        wrap: true,
        touch: true,
        pause: "hover",
    });
    teamCarouselEl.addEventListener("slide.bs.carousel", (event) => {
        const activeSlide = event.target.querySelector(".carousel-item.active");
        if (activeSlide) activeSlide.style.opacity = "0.7";
    });
    teamCarouselEl.addEventListener("slid.bs.carousel", (event) => {
        event.target.querySelectorAll(".carousel-item").forEach(slide => slide.style.opacity = "1");
        animateTeamCards(event.relatedTarget);
    });
}

function initTeamCardAnimations() {
    const teamCards = document.querySelectorAll(".team-card");
    teamCards.forEach((card) => {
        card.addEventListener("mouseenter", function () {
            this.style.transform = "translateY(-15px) scale(1.02)";
            this.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.2)";
        });
        card.addEventListener("mouseleave", function () {
            this.style.transform = "translateY(0) scale(1)";
            this.style.boxShadow = "0 5px 15px rgba(0, 0, 0, 0.08)";
        });
    });
}

function animateTeamCards(activeSlide) {
    if (!activeSlide) return;
    const teamCards = activeSlide.querySelectorAll(".team-card");
    teamCards.forEach((card, index) => {
        card.style.opacity = "0";
        card.style.transform = "translateY(30px)";
        setTimeout(() => {
            card.style.transition = "all 0.6s ease-out";
            card.style.opacity = "1";
            card.style.transform = "translateY(0)";
        }, index * 150);
    });
}

function initResponsiveTeamSlider(teamCarouselEl) {
    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const carouselInstance = bootstrap.Carousel.getInstance(teamCarouselEl);
            if (carouselInstance) {
                carouselInstance.dispose();
            }
            initTeamCarousel(teamCarouselEl);
        }, 250);
    });
}

function initTeamSectionObserver() {
    const teamSection = document.querySelector(".our-team");
    if (!teamSection) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            const carouselEl = entry.target.querySelector("#teamCarousel");
            const carouselInstance = bootstrap.Carousel.getInstance(carouselEl);
            if (entry.isIntersecting) {
                animateTeamCards(carouselEl.querySelector(".carousel-item.active"));
                if (carouselInstance) carouselInstance.cycle();
            } else {
                if (carouselInstance) carouselInstance.pause();
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
    observer.observe(teamSection);
}

function initTeamKeyboardControls(teamCarouselEl) {
    document.addEventListener("keydown", (e) => {
        const rect = teamCarouselEl.getBoundingClientRect();
        if (rect.top > window.innerHeight || rect.bottom < 0) return;
        const carouselInstance = bootstrap.Carousel.getInstance(teamCarouselEl);
        if (!carouselInstance) return;
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            carouselInstance.prev();
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            carouselInstance.next();
        }
    });
}

function initAccessibility(teamCarouselEl) {
    const indicators = teamCarouselEl.querySelectorAll(".carousel-indicators button");
    indicators.forEach((indicator, index) => {
        indicator.setAttribute("aria-label", `Go to team slide ${index + 1}`);
    });
    teamCarouselEl.addEventListener("slid.bs.carousel", (e) => {
        const activeSlide = e.relatedTarget;
        if (activeSlide && document.activeElement === teamCarouselEl) {
            const firstFocusable = activeSlide.querySelector('a, button, .team-card');
            if (firstFocusable) firstFocusable.focus();
        }
    });
}

function initGenericScrollAnimations() {
    // Codeerts-style: each card gets its own reveal + stagger delay (never dump a whole grid at once)
    if (window.__icRevealInit) {
        return;
    }
    window.__icRevealInit = true;

    document.documentElement.classList.add("ic-js");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root =
        document.querySelector("#wrap") ||
        document.querySelector("main") ||
        document.querySelector("#wrapwrap");

    if (!root) {
        return;
    }

    const SKIP = [
        "header", "nav", "script", "style", "link", "noscript", "iframe",
        ".navbar", ".modal", ".dropdown-menu",
        "#portal_side_contact_us", "#contactFormModal", ".btn-top",
        ".carousel-indicators", ".carousel-control-prev", ".carousel-control-next",
        ".services-bg", ".service-hero-bg", ".hero-video-container",
    ].join(",");

    // Prefer real cards/tiles — avoid marking huge parents (that made whole grids pop together)
    const CARD_SEL = [
        ".service-card", ".feature-card", ".team-card",
        ".icp-product-card", ".icp-build-card", ".ic-build-card", ".ic-project-card",
        ".ic-hero-img-wrapper", ".ic-testimonial-card", ".icp-testimonial-card",
        ".partner-logo-container", ".job-card", ".open-job-card", ".event-card",
        ".service-feature-card", ".flip-card", ".card",
        /* Product case study */
        ".icpd-cap-card", ".icpd-audience-item", ".icpd-callout",
        ".icpd-revenue-card", ".icpd-meta-item", ".icpd-cta-banner",
    ].join(",");

    const COPY_SEL = [
        ".service-hero-content", ".hero-content",
        ".service-content", ".service-image",
        ".icpd-portal", ".icpd-section",
        /* Product case study */
        ".icpd-hero-intro", ".icpd-hero-media", ".icpd-portals-head",
        ".icpd-portal-frame", ".icpd-split-head", ".icpd-tech-row",
        ".icpd-h1", ".icpd-h2", ".icpd-h2-light", ".icpd-lead", ".icpd-body",
        ".ic-hero-title", ".ic-hero-subtitle", ".icp-hero-title", ".icp-hero-subtitle",
        ".ic-section-main-title", ".icp-section-main-title",
        ".section-title", ".section-label", ".section-subtitle",
        ".text-center.mb-5",
    ].join(",");

    const marked = new Set();
    const inSkipTree = (el) => {
        if (!el || el.nodeType !== 1) {
            return true;
        }
        try {
            return !!el.closest(SKIP);
        } catch (e) {
            return false;
        }
    };

    const mark = (el) => {
        if (!el || el.nodeType !== 1 || marked.has(el) || inSkipTree(el)) {
            return false;
        }
        if (el.querySelector && el.querySelector(".ic-reveal")) {
            return false;
        }
        if (el.closest && el.closest(".ic-reveal")) {
            return false;
        }
        marked.add(el);
        el.classList.add("ic-reveal");
        return true;
    };

    const sections = Array.from(root.querySelectorAll("section")).filter((section) => {
        return !inSkipTree(section) && section.getClientRects().length > 0;
    });

    sections.forEach((section) => {
        section.querySelectorAll(COPY_SEL).forEach((el) => mark(el));

        const cards = Array.from(section.querySelectorAll(CARD_SEL));
        if (cards.length) {
            cards.forEach((card) => mark(card));
            return;
        }

        // No cards: stagger columns instead of the whole section
        section.querySelectorAll(".row > [class*='col']").forEach((col) => {
            mark(col.firstElementChild || col);
        });
    });

    root.querySelectorAll(CARD_SEL).forEach((el) => mark(el));

    // Final stagger per section so siblings never share the same delay
    sections.forEach((section) => {
        const items = Array.from(section.querySelectorAll(".ic-reveal"));
        items.forEach((el, i) => {
            el.style.setProperty("--rd", `${Math.min(i * 90, 720)}ms`);
        });
    });

    const rev = Array.from(marked);
    if (!rev.length) {
        return;
    }

    const showNow = (el) => {
        if (!el || el.classList.contains("in")) {
            return;
        }
        el.classList.add("in");
    };

    if (reduce || !("IntersectionObserver" in window)) {
        rev.forEach(showNow);
        return;
    }

    const scrollRoot = document.querySelector("#wrapwrap");
    const ioRoot =
        scrollRoot && scrollRoot.scrollHeight > scrollRoot.clientHeight + 40
            ? scrollRoot
            : null;

    // Batch intersecting cards, then reveal in DOM order with fresh stagger
    // (fixes “whole grid at once” when IO fires them together)
    let batch = [];
    let batchTimer = null;

    const flushBatch = () => {
        batchTimer = null;
        const items = batch.splice(0);
        if (!items.length) {
            return;
        }
        items.sort((a, b) => {
            if (a === b) {
                return 0;
            }
            const pos = a.compareDocumentPosition(b);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
                return -1;
            }
            if (pos & Node.DOCUMENT_POSITION_PRECEDING) {
                return 1;
            }
            return 0;
        });
        items.forEach((el, i) => {
            el.style.setProperty("--rd", `${i * 90}ms`);
            // reflow so the new --rd applies before .in
            void el.offsetWidth;
            showNow(el);
        });
    };

    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }
            io.unobserve(entry.target);
            batch.push(entry.target);
        });
        if (batch.length && !batchTimer) {
            batchTimer = setTimeout(flushBatch, 40);
        }
    }, {
        root: ioRoot,
        threshold: 0.15,
        rootMargin: "0px 0px -10% 0px",
    });

    rev.forEach((el) => io.observe(el));

    // Failsafe only for stuck items (not a hard dump of the whole page at 3.5s)
    setTimeout(() => {
        rev.forEach((el) => {
            if (!el.classList.contains("in")) {
                el.style.setProperty("--rd", "0ms");
                showNow(el);
            }
        });
    }, 12000);
}


document.addEventListener("DOMContentLoaded", function () {
    const toggleBtn = document.getElementById("mobile_services_toggle");
    const dropdownMenu = document.getElementById("mobile_services_menu");

    if (toggleBtn && dropdownMenu) {
        toggleBtn.addEventListener("click", function (e) {
            e.preventDefault();
            dropdownMenu.classList.toggle("show");
        });
    }
});