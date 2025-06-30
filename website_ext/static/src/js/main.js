// ===== MAIN JAVASCRIPT FILE =====
document.addEventListener("DOMContentLoaded", () => {
  initNavbar();
  initServiceCards();
  initMegaMenu();
  initTeamSlider();
  initSmoothScrolling();
  initScrollAnimations();
  initPartnerLogos();
  initTeamCarousel();
  initTeamCardAnimations();
  initResponsiveTeamSlider();
});

// ===== NAVBAR FUNCTIONALITY =====
function initNavbar() {
    const navbar = document.querySelector(".navbar-custom");
    const navbarToggler = document.querySelector(".navbar-toggler");
    const navbarCollapse = document.querySelector(".navbar-collapse");

    // Scroll behavior
    if (navbar) {
        window.addEventListener("scroll", () => {
            if (window.scrollY > 50) {
                navbar.classList.add("navbar-scrolled");
            } else {
                navbar.classList.remove("navbar-scrolled");
            }
        });
    }

    // Mobile menu toggle functionality
    if (navbarToggler && navbarCollapse) {
        // Set initial state based on screen size
        function handleResponsive() {
            if (window.innerWidth > 991) {
                navbarCollapse.classList.add("show");
                navbarToggler.setAttribute('aria-expanded', 'true');
            } else {
                navbarCollapse.classList.remove("show");
                navbarToggler.setAttribute('aria-expanded', 'false');
            }
        }

        // Initialize
        handleResponsive();

        // Toggle menu on button click
        navbarToggler.addEventListener("click", function(e) {
            e.stopPropagation(); // Prevent this click from bubbling to document
            navbarCollapse.classList.toggle("show");
            const isExpanded = navbarCollapse.classList.contains("show");
            navbarToggler.setAttribute('aria-expanded', isExpanded);
        });

        // Close menu when clicking outside
        document.addEventListener("click", function(e) {
            if (window.innerWidth <= 991 &&
                !navbar.contains(e.target) &&
                !e.target.classList.contains("navbar-toggler")) {
                navbarCollapse.classList.remove("show");
                navbarToggler.setAttribute('aria-expanded', 'false');
            }
        });

        // Handle window resize
        // window.addEventListener("resize", function() {
        //     handleResponsive();
        // });
    }
}

// ===== SERVICE CARDS FUNCTIONALITY =====
function initServiceCards() {
  const serviceCards = document.querySelectorAll(".service-card");

  serviceCards.forEach((card) => {
    card.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        return;
      }

      serviceCards.forEach((c) => c.classList.remove("active"));

      this.classList.add("active");
      const serviceType = this.getAttribute("data-service");
      if (serviceType) {
        setTimeout(() => {
          window.location.href = `services/${serviceType}.html`;
        }, 300);
      }
    });

    card.addEventListener("mouseenter", function () {
      this.classList.add("hovered");
    });

    card.addEventListener("mouseleave", function () {
      this.classList.remove("hovered");
    });
  });
}

// ===== MEGA MENU FUNCTIONALITY =====
function initMegaMenu() {
  const megaDropdown = document.querySelector(".mega-dropdown");
  const megaMenu = document.querySelector(".mega-menu");

  if (megaDropdown && megaMenu) {
    let hoverTimeout;

    megaDropdown.addEventListener("mouseenter", () => {
      clearTimeout(hoverTimeout);
      megaMenu.style.opacity = "1";
      megaMenu.style.visibility = "visible";
    });

    megaDropdown.addEventListener("mouseleave", () => {
      hoverTimeout = setTimeout(() => {
        megaMenu.style.opacity = "0";
        megaMenu.style.visibility = "hidden";
      }, 100);
    });
  }
}
document.addEventListener("DOMContentLoaded", () => {
  initFeatureCards();
});

function initFeatureCards() {
  const featureCards = document.querySelectorAll(".feature-card");

  featureCards.forEach((card) => {
    card.addEventListener("mouseenter", function () {
      this.classList.add("hovered");
    });

    card.addEventListener("mouseleave", function () {
      this.classList.remove("hovered");
    });
  });
}
// ===== TEAM CAROUSEL INITIALIZATION =====
function initTeamCarousel() {
  const teamCarousel = document.getElementById("teamCarousel");

  if (teamCarousel) {
    const carousel = new bootstrap.Carousel(teamCarousel, {
      interval: 4000,
      wrap: true,
      touch: true,
      pause: "hover",
    });

    teamCarousel.addEventListener("slide.bs.carousel", (event) => {
      const activeSlide = event.target.querySelector(".carousel-item.active");
      const nextSlide = event.relatedTarget;

      if (activeSlide) {
        activeSlide.style.opacity = "0.7";
      }
    });

    teamCarousel.addEventListener("slid.bs.carousel", (event) => {
      const allSlides = event.target.querySelectorAll(".carousel-item");
      allSlides.forEach((slide) => {
        slide.style.opacity = "1";
      });

      animateTeamCards(event.target.querySelector(".carousel-item.active"));
    });

    const indicators = teamCarousel.querySelectorAll(
      ".carousel-indicators button"
    );
    indicators.forEach((indicator, index) => {
      indicator.addEventListener("click", () => {
        carousel.to(index);
      });
    });

    const teamCards = teamCarousel.querySelectorAll(".team-card");
    teamCards.forEach((card) => {
      card.addEventListener("mouseenter", () => {
        carousel.pause();
      });

      card.addEventListener("mouseleave", () => {
        carousel.cycle();
      });
    });
  }
}

// ===== TEAM CARD ANIMATIONS =====
function initTeamCardAnimations() {
  const teamCards = document.querySelectorAll(".team-card");

  teamCards.forEach((card, index) => {
    card.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-15px) scale(1.02)";
      this.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.2)";
    });

    card.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0) scale(1)";
      this.style.boxShadow = "0 5px 15px rgba(0, 0, 0, 0.08)";
    });
    const socialLink = card.querySelector(".team-social");
    if (socialLink) {
      socialLink.addEventListener("click", function (e) {
        e.preventDefault();
        this.style.transform = "scale(0.95)";
        setTimeout(() => {
          this.style.transform = "scale(1.1)";
          setTimeout(() => {
            this.style.transform = "scale(1)";
          }, 150);
        }, 100);
        console.log(
          `Opening social profile for ${
            card.querySelector(".team-name").textContent
          }`
        );
      });
    }
  });
}

// ===== ANIMATE TEAM CARDS IN ACTIVE SLIDE =====
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

// ===== RESPONSIVE TEAM SLIDER =====
function initResponsiveTeamSlider() {
  let resizeTimer;

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const teamCarousel = document.getElementById("teamCarousel");
      if (teamCarousel) {
        const carousel = bootstrap.Carousel.getInstance(teamCarousel);
        if (carousel) {
          carousel.dispose();
          initTeamCarousel();
        }
      }
    }, 250);
  });
}

function initScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const teamSection = entry.target;
        const activeSlide = teamSection.querySelector(".carousel-item.active");
        if (activeSlide) {
          animateTeamCards(activeSlide);
        }
        const carousel = bootstrap.Carousel.getInstance(
          teamSection.querySelector("#teamCarousel")
        );
        if (carousel) {
          carousel.cycle();
        }
      }
    });
  }, observerOptions);

  const teamSection = document.querySelector(".our-team");
  if (teamSection) {
    observer.observe(teamSection);
  }
}

document.addEventListener("keydown", (e) => {
  const teamCarousel = document.getElementById("teamCarousel");
  if (!teamCarousel) return;

  const carousel = bootstrap.Carousel.getInstance(teamCarousel);
  if (!carousel) return;

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    carousel.prev();
  }

  if (e.key === "ArrowRight") {
    e.preventDefault();
    carousel.next();
  }
});

function initTouchGestures() {
  const teamCarousel = document.getElementById("teamCarousel");
  if (!teamCarousel) return;

  let startX = 0;
  let endX = 0;

  teamCarousel.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  });

  teamCarousel.addEventListener("touchend", (e) => {
    endX = e.changedTouches[0].clientX;
    handleSwipe();
  });

  function handleSwipe() {
    const carousel = bootstrap.Carousel.getInstance(teamCarousel);
    if (!carousel) return;

    const swipeThreshold = 50;
    const diff = startX - endX;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        carousel.next();
      } else {
        carousel.prev();
      }
    }
  }
}

// Initialize touch gestures
document.addEventListener("DOMContentLoaded", initTouchGestures);

function initAccessibility() {
  const teamCarousel = document.getElementById("teamCarousel");
  if (!teamCarousel) return;

  const indicators = teamCarousel.querySelectorAll(
    ".carousel-indicators button"
  );
  indicators.forEach((indicator, index) => {
    indicator.setAttribute("aria-label", `Go to team slide ${index + 1}`);
  });

  teamCarousel.addEventListener("slid.bs.carousel", (e) => {
    const activeSlide = e.target.querySelector(".carousel-item.active");
    const firstTeamCard = activeSlide.querySelector(".team-card");
    if (document.activeElement === teamCarousel) {
      firstTeamCard.focus();
    }
  });
}

// Initialize accessibility features
document.addEventListener("DOMContentLoaded", initAccessibility);

// ===== SMOOTH SCROLLING =====
function initSmoothScrolling() {
  const anchorLinks = document.querySelectorAll('a[href^="#"]');

  anchorLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();

      const targetId = this.getAttribute("href");
      const targetSection = document.querySelector(targetId);

      if (targetSection) {
        targetSection.scrollIntoView({
          behavior: "smooth",
        });
      }
    });
  });
}

// ===== SCROLL ANIMATIONS =====
function initScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  }, observerOptions);

  const serviceCards = document.querySelectorAll(".service-card");
  serviceCards.forEach((card) => {
    card.style.opacity = "0";
    card.style.transform = "translateY(30px)";
    card.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    observer.observe(card);
  });

  const featureCards = document.querySelectorAll(".feature-card");
  featureCards.forEach((card) => {
    card.style.opacity = "0";
    card.style.transform = "translateY(30px)";
    card.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    observer.observe(card);
  });

  const teamCards = document.querySelectorAll(".team-card");
  teamCards.forEach((card) => {
    card.style.opacity = "0";
    card.style.transform = "translateY(30px)";
    card.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    observer.observe(card);
  });
}

function initPartnerLogos() {
  const partnerContainers = document.querySelectorAll(
    ".partner-logo-container"
  );

  partnerContainers.forEach((container) => {
    container.addEventListener("mouseenter", function () {
      this.classList.add("hovered");
    });

    container.addEventListener("mouseleave", function () {
      this.classList.remove("hovered");
    });
  });
}

