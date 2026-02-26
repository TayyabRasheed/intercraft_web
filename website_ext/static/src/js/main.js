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
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    const animatedElements = document.querySelectorAll(".service-card, .feature-card");
    animatedElements.forEach((el) => {
        el.classList.add('animate-on-scroll');
        observer.observe(el);
    });
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