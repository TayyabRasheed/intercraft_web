/** Our Product page: testimonial slider */
(function () {
    'use strict';

    function initTestimonialSlider() {
        var slider = document.querySelector('.icp-testimonial-slider');
        if (!slider || slider.dataset.icpTestimonialInit) return;
        slider.dataset.icpTestimonialInit = '1';

        var dataEl = slider.querySelector('.icp-testimonial-data') || document.getElementById('icp-testimonial-data');
        if (!dataEl) return;

        var itemEls = dataEl.querySelectorAll('.icp-testimonial-item');
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
        var leftSlot = slider.querySelector('.icp-testi-slot-left');
        var centerSlot = slider.querySelector('.icp-testi-slot-center');
        var rightSlot = slider.querySelector('.icp-testi-slot-right');
        if (!leftSlot || !centerSlot || !rightSlot) return;

        var sliderTrack = slider.querySelector('.row') || slider;

        var barsWrap = slider.querySelector('.icp-testimonial-bars');
        function updateBars() {
            if (!barsWrap) return;
            var bars = barsWrap.querySelectorAll('.icp-testi-bar');
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
            var titleEl = el.querySelector('.icp-testi-slot-title');
            var quoteEl = el.querySelector('.icp-testi-slot-quote');
            if (titleEl) titleEl.textContent = item.title;
            if (quoteEl) quoteEl.textContent = isCenter ? item.quote : shortQuote(item.quote);
            if (isCenter) {
                var authorEl = el.querySelector('.icp-testi-slot-author');
                var companyEl = el.querySelector('.icp-testi-slot-company');
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

        centerSlot.addEventListener('click', function (e) {
            if (e.target.tagName !== 'A' && !e.target.closest('a')) goNext();
        });

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

        var mouseStartX = 0;
        slider.addEventListener('mousedown', function (e) {
            mouseStartX = e.screenX;
        });
        slider.addEventListener('mouseup', function (e) {
            var diff = mouseStartX - e.screenX;
            if (diff > 50) goNext();
            else if (diff < -50) goPrev();
        });

        setInterval(goNext, 5000);

        render();
    }

    function init() {
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

    var observer = new MutationObserver(function () {
        if (document.querySelector('.icp-testimonial-slider:not([data-icp-testimonial-init])')) {
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
