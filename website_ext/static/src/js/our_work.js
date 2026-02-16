/** Our Work page: project dots + testimonial slider */
(function () {
    'use strict';

    function initTestimonialSlider() {
        var slider = document.querySelector('.ic-testimonial-slider');
        if (!slider || slider.dataset.icTestimonialInit) return;
        slider.dataset.icTestimonialInit = '1';

        var dataEl = slider.querySelector('.ic-testimonial-data') || document.getElementById('ic-testimonial-data');
        if (!dataEl) return;

        var itemEls = dataEl.querySelectorAll('.ic-testimonial-item');
        var items = [];
        itemEls.forEach(function (el) {
            var get = function (cls) {
                var s = el.querySelector('.data-' + cls);
                return s ? s.textContent.trim() : '';
            };
            items.push({
                title: get('title'),
                quote: get('quote'),
                author: get('author'),
                role: get('role'),
                company: get('company')
            });
        });

        if (items.length === 0) return;

        var n = items.length;
        var currentIndex = 0;
        var leftSlot = slider.querySelector('.ic-testi-slot-left');
        var centerSlot = slider.querySelector('.ic-testi-slot-center');
        var rightSlot = slider.querySelector('.ic-testi-slot-right');
        if (!leftSlot || !centerSlot || !rightSlot) return;

        var sliderTrack = slider.querySelector('.row') || slider;

        /* 3 bars: cycle 1st → 2nd → 3rd → 1st as card changes */
        var barsWrap = slider.querySelector('.ic-testimonial-bars');
        function updateBars() {
            if (!barsWrap) return;
            var bars = barsWrap.querySelectorAll('.ic-testi-bar');
            if (bars.length < 3) return;
            var barIndex = currentIndex % 3;
            for (var i = 0; i < bars.length; i++) {
                bars[i].classList.toggle('active', i === barIndex);
            }
        }

        function shortQuote(text, maxLen) {
            maxLen = maxLen || 80;
            if (!text || text.length <= maxLen) return text;
            return text.slice(0, maxLen).trim() + '…';
        }

        function fillSlot(el, item, isCenter) {
            if (!el || !item) return;
            var titleEl = el.querySelector('.ic-testi-slot-title');
            var quoteEl = el.querySelector('.ic-testi-slot-quote');
            if (titleEl) titleEl.textContent = item.title;
            if (quoteEl) quoteEl.textContent = isCenter ? item.quote : shortQuote(item.quote);
            if (isCenter) {
                var authorEl = el.querySelector('.ic-testi-slot-author');
                var companyEl = el.querySelector('.ic-testi-slot-company');
                if (authorEl) authorEl.textContent = item.role ? item.author + ' — ' + item.role : item.author;
                if (companyEl) companyEl.textContent = item.company;
            }
        }

        function render() {
            var prev = items[(currentIndex - 1 + n) % n];
            var curr = items[currentIndex];
            var next = items[(currentIndex + 1) % n];
            fillSlot(leftSlot, prev, false);
            fillSlot(centerSlot, curr, true);
            fillSlot(rightSlot, next, false);
            updateBars();
        }

        function goNext() {
            currentIndex = (currentIndex + 1) % n;
            render();
        }

        function goPrev() {
            currentIndex = (currentIndex - 1 + n) % n;
            render();
        }

        /* Click on center card: go to next */
        centerSlot.addEventListener('click', function (e) {
            if (e.target.tagName !== 'A' && !e.target.closest('a')) goNext();
        });

        /* Touch swipe – bind to whole slider */
        var touchStartX = 0;
        function onTouchStart(e) {
            touchStartX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].screenX : e.screenX;
        }
        function onTouchEnd(e) {
            var touch = e.changedTouches && e.changedTouches[0];
            var touchEndX = touch ? touch.screenX : e.screenX;
            var diff = touchStartX - touchEndX;
            if (diff > 50) goNext();
            else if (diff < -50) goPrev();
        }
        slider.addEventListener('touchstart', onTouchStart, { passive: true });
        slider.addEventListener('touchend', onTouchEnd, { passive: true });

        /* Mouse drag (desktop) */
        var mouseStartX = 0;
        slider.addEventListener('mousedown', function (e) {
            mouseStartX = e.screenX;
        });
        slider.addEventListener('mouseup', function (e) {
            var diff = mouseStartX - e.screenX;
            if (diff > 50) goNext();
            else if (diff < -50) goPrev();
        });

        /* Auto-rotation every 5 seconds */
        setInterval(goNext, 5000);

        /* Initial render – all content from dynamic testimonials (left/center/right) */
        render();
    }

    function initProjectDots() {
        var section = document.querySelector('.ic-projects-section');
        if (!section || section.dataset.icProjectsInit) return;
        section.dataset.icProjectsInit = '1';

        var track = section.querySelector('.ic-projects-track');
        var dots = section.querySelectorAll('.ic-projects-dots .ic-dot');
        var cols = section.querySelectorAll('.ic-projects-row .ic-project-col-idx');
        var totalCols = cols.length;
        var n = totalCols / 2; /* logical number of projects (track has 2 copies) */
        if (totalCols === 0 || !track || n < 1) return;

        var currentIndex = 0;
        var transitionDuration = '0.45s';

        function setActive(index) {
            if (index < 0 || index > n) return;
            currentIndex = index;
            /* Slide track: offset as % of track width */
            var offset = (currentIndex / totalCols) * 100;
            track.style.transform = 'translateX(-' + offset + '%)';
            /* Dots: logical position (0..n-1) cycles 1st → 2nd → 3rd */
            var logicalIndex = currentIndex === n ? 0 : currentIndex;
            var activeDotIndex = logicalIndex % 3;
            for (var d = 0; d < dots.length; d++) {
                dots[d].classList.toggle('active', d === activeDotIndex);
            }
        }

        function resetToStart() {
            track.style.transition = 'none';
            currentIndex = 0;
            track.style.transform = 'translateX(0%)';
            track.offsetHeight; /* force reflow */
            track.style.transition = 'transform ' + transitionDuration + ' ease-out';
        }

        function goNext() {
            currentIndex = currentIndex + 1;
            if (currentIndex > n) currentIndex = 0;
            setActive(currentIndex);
        }

        track.addEventListener('transitionend', function (e) {
            if (e.target !== track || e.propertyName !== 'transform') return;
            /* After animating to duplicate (position n), jump back to 0 without animation */
            if (currentIndex === n) resetToStart();
        });

        dots.forEach(function (dot) {
            dot.addEventListener('click', function () {
                var index = parseInt(this.getAttribute('data-index'), 10);
                if (!isNaN(index)) setActive(Math.min(index, n - 1));
            });
            dot.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    var index = parseInt(this.getAttribute('data-index'), 10);
                    if (!isNaN(index)) setActive(Math.min(index, n - 1));
                }
            });
        });

        /* Auto-rotate: slide every 5 seconds */
        setInterval(goNext, 5000);

        setActive(0);
    }

    function init() {
        initProjectDots();
        initTestimonialSlider();
    }

    function runInit() {
        init();
        setTimeout(init, 400);
        setTimeout(init, 1200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runInit);
    } else {
        runInit();
    }

    /* Re-init when content appears later (e.g. client-side navigation to Our Work) */
    var observer = new MutationObserver(function (mutations) {
        if (document.querySelector('.ic-testimonial-slider:not([data-ic-testimonial-init])') ||
            document.querySelector('.ic-projects-section:not([data-ic-projects-init])')) {
            init();
        }
    });
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }
})();
