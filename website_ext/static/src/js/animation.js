function initDynamicSlider() {
    const track = document.getElementById('sliderTrack');
    const container = document.querySelector('.animation-stage');
    if (!track || !container) return;

    const originalSlides = Array.from(track.children);
    if (originalSlides.length === 0) return;
    originalSlides.forEach(slide => track.appendChild(slide.cloneNode(true)));

    let centerX = container.offsetWidth / 2;
    window.addEventListener('resize', () => { centerX = container.offsetWidth / 2; });

    function updateSlides() {
        const allSlides = track.children;
        const containerRect = container.getBoundingClientRect();

        for (let i = 0; i < allSlides.length; i++) {
            const slide = allSlides[i];
            const slideRect = slide.getBoundingClientRect();

            if (slideRect.right < 0 || slideRect.left > window.innerWidth) continue;

            const slideCenter = slideRect.left - containerRect.left + (slideRect.width / 2);
            const distanceFromCenter = Math.abs(centerX - slideCenter);
            const maxDistance = container.offsetWidth * 0.6;

            const proximity = Math.max(0, 1 - (distanceFromCenter / maxDistance));

            const isMobile = window.innerWidth <= 768;
            const baseScale = isMobile ? 0.85 : 0.75;
            const scaleFactor = isMobile ? 0.15 : 0.35;

            const scale = baseScale + (proximity * scaleFactor);
            const opacity = 0.8 + (proximity * 0.2);
            const zIndex = Math.floor(proximity * 100);

            slide.style.transform = `scale(${scale}) translate3d(0,0,0)`;
            slide.style.opacity = opacity;
            slide.style.zIndex = zIndex;
        }
        requestAnimationFrame(updateSlides);
    }

    requestAnimationFrame(updateSlides);
}

document.addEventListener('DOMContentLoaded', initDynamicSlider);