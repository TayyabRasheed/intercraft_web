function initDynamicSlider() {
    const track = document.getElementById('sliderTrack');
    const container = document.querySelector('.animation-stage');
    if (!track || !container) return;

    // Clone items for infinite loop
    const originalSlides = Array.from(track.children);
    if (originalSlides.length === 0) return;
    originalSlides.forEach(slide => track.appendChild(slide.cloneNode(true)));

    let centerX = container.offsetWidth / 2;
    window.addEventListener('resize', () => { centerX = container.offsetWidth / 2; });

    function updateSlides() {
        const allSlides = track.children;
        const containerRect = container.getBoundingClientRect();

        // Loop through all slides (Standard 'for' is faster for 60fps)
        for (let i = 0; i < allSlides.length; i++) {
            const slide = allSlides[i];
            const slideRect = slide.getBoundingClientRect();

            // Skip slides that are completely off-screen to save CPU
            if (slideRect.right < 0 || slideRect.left > window.innerWidth) continue;

            const slideCenter = slideRect.left - containerRect.left + (slideRect.width / 2);
            const distanceFromCenter = Math.abs(centerX - slideCenter);
            const maxDistance = container.offsetWidth * 0.6;

            // High-precision proximity (No rounding here)
            const proximity = Math.max(0, 1 - (distanceFromCenter / maxDistance));

            const isMobile = window.innerWidth <= 768;
            const baseScale = isMobile ? 0.85 : 0.75;
            const scaleFactor = isMobile ? 0.15 : 0.35;

            const scale = baseScale + (proximity * scaleFactor);
            const opacity = 0.8 + (proximity * 0.2);
            const zIndex = Math.floor(proximity * 100);

            // Applying styles with translate3d(0,0,0) ensures GPU composition
            slide.style.transform = `scale(${scale}) translate3d(0,0,0)`;
            slide.style.opacity = opacity;
            slide.style.zIndex = zIndex;
        }
        requestAnimationFrame(updateSlides);
    }

    requestAnimationFrame(updateSlides);
}

document.addEventListener('DOMContentLoaded', initDynamicSlider);
// function initDynamicSlider() {
//     const track = document.getElementById('sliderTrack');
//     const container = document.querySelector('.animation-stage');
//     if (!track || !container) return;
//
//     // Clone items once
//     const originalSlides = Array.from(track.children);
//     if (originalSlides.length === 0) return;
//     originalSlides.forEach(slide => track.appendChild(slide.cloneNode(true)));
//
//     // Cache static values
//     let centerX = container.offsetWidth / 2;
//
//     window.addEventListener('resize', () => {
//         centerX = container.offsetWidth / 2;
//     });
//
//     function updateSlides() {
//         const allSlides = track.children;
//         const containerRect = container.getBoundingClientRect();
//
//         // We use a simple loop for speed
//         for (let i = 0; i < allSlides.length; i++) {
//             const slide = allSlides[i];
//             const slideRect = slide.getBoundingClientRect();
//
//             // Calculate center of the slide relative to the container center
//             const slideRelativeCenter = slideRect.left - containerRect.left + (slideRect.width / 2);
//             const distanceFromCenter = Math.abs(centerX - slideRelativeCenter);
//
//             // Proximity calculation (Higher = closer to center)
//             const maxDistance = container.offsetWidth * 0.7;
//             const proximity = Math.max(0, 1 - (distanceFromCenter / maxDistance));
//
//             // USE RAW FLOATS (No Math.round) for buttery smoothness
//             const isMobile = window.innerWidth <= 768;
//             const baseScale = isMobile ? 0.85 : 0.75;
//             const scaleFactor = isMobile ? 0.15 : 0.35;
//
//             const scale = baseScale + (proximity * scaleFactor);
//             const opacity = 0.8 + (proximity * 0.2);
//             const zIndex = Math.floor(proximity * 100);
//
//             // Apply directly. The browser handles the float values smoothly.
//             slide.style.transform = `scale(${scale}) translate3d(0,0,0)`;
//             slide.style.opacity = opacity;
//             slide.style.zIndex = zIndex;
//         }
//         requestAnimationFrame(updateSlides);
//     }
//
//     requestAnimationFrame(updateSlides);
// }
//
// document.addEventListener('DOMContentLoaded', initDynamicSlider);

// // const images = [
// //     "images/1.jpg", "images/2.jpg", "images/3.jpg", "images/5.jpg",
// //     "images/7.jpg", "images/9.jpg", "images/16.jpg", "images/17.jpg",
// //     "images/18.jpg", "images/19.jpg", "images/20.jpg", "images/21.jpg",
// //     "images/22.jpg", "images/23.jpg", "images/24.jpg", "images/25.jpg",
// //     "images/26.jpg", "images/27.jpg", "images/28.jpg", "images/29.jpg",
// //     "images/30.jpg", "images/31.jpg", "images/32.jpg", "images/33.jpg",
// //     "images/34.jpg", "images/35.jpg", "images/36.jpg", "images/37.jpg",
// //     "images/38.jpg", "images/39.jpg", "images/40.jpg", "images/41.jpg",
// //     "images/42.jpg", "images/43.jpg"
// // ];
// //
// // function populateSlider() {
// //     const track = document.getElementById('sliderTrack');
// //     const doubledImages = [...images, ...images];
// //
// //     doubledImages.forEach((src, index) => {
// //         const slideDiv = document.createElement('div');
// //         slideDiv.className = 'slide-item';
// //
// //         const cardDiv = document.createElement('div');
// //         cardDiv.className = 'img-card';
// //
// //         const img = document.createElement('img');
// //         img.src = src;
// //         img.alt = `Gallery image ${(index % images.length) + 1}`;
// //         img.loading = 'lazy';
// //
// //         cardDiv.appendChild(img);
// //         slideDiv.appendChild(cardDiv);
// //         track.appendChild(slideDiv);
// //     });
// //
// //     animateSlides();
// // }
// //
// // function animateSlides() {
// //     const track = document.getElementById('sliderTrack');
// //     const slides = track.querySelectorAll('.slide-item');
// //     const container = document.querySelector('.animation-stage');
// //
// //     function updateSlides() {
// //         const containerRect = container.getBoundingClientRect();
// //         const centerX = containerRect.left + containerRect.width / 2;
// //
// //         slides.forEach(slide => {
// //             const slideRect = slide.getBoundingClientRect();
// //             const slideCenterX = slideRect.left + slideRect.width / 2;
// //
// //             const distanceFromCenter = Math.abs(centerX - slideCenterX);
// //             const maxDistance = containerRect.width / 2;
// //
// //             const proximity = Math.max(0, 1 - (distanceFromCenter / maxDistance));
// //             const scale = 0.75 + (proximity * 0.35);
// //             const opacity = 0.4 + (proximity * 0.6);
// //
// //             slide.style.transform = `scale(${scale})`;
// //             slide.style.opacity = opacity;
// //         });
// //
// //         requestAnimationFrame(updateSlides);
// //     }
// //
// //     updateSlides();
// // }
// //
// // document.addEventListener('DOMContentLoaded', populateSlider);
// //
// // document.addEventListener('error', (e) => {
// //     if (e.target.tagName === 'IMG') {
// //         console.warn(`Image failed to load: ${e.target.src}`);
// //         e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="380" height="280"%3E%3Crect fill="%23ddd" width="380" height="280"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="20"%3EImage Not Found%3C/text%3E%3C/svg%3E';
// //     }
// // }, true);
//
// function initDynamicSlider() {
//     const track = document.getElementById('sliderTrack');
//     if (!track) return;
//
//     // 1. Get the items already rendered by Odoo
//     const slides = Array.from(track.children);
//     if (slides.length === 0) return;
//
//     // 2. Clone them once to ensure the infinite scroll has enough content
//     slides.forEach((slide) => {
//         const clone = slide.cloneNode(true);
//         track.appendChild(clone);
//     });
//
//     // 3. Start the visual animation logic (scaling/opacity based on center)
//     animateSlides();
// }
//
// // function animateSlides() {
// //     const track = document.getElementById('sliderTrack');
// //     const container = document.querySelector('.animation-stage');
// //     if (!track || !container) return;
// //
// //     function updateSlides() {
// //         const allSlides = track.querySelectorAll('.slide-item');
// //         const containerRect = container.getBoundingClientRect();
// //         const centerX = containerRect.left + containerRect.width / 2;
// //
// //         allSlides.forEach(slide => {
// //             const slideRect = slide.getBoundingClientRect();
// //             const slideCenterX = slideRect.left + slideRect.width / 2;
// //
// //             const distanceFromCenter = Math.abs(centerX - slideCenterX);
// //             const maxDistance = containerRect.width / 2;
// //
// //             const proximity = Math.max(0, 1 - (distanceFromCenter / maxDistance));
// //             const scale = 0.75 + (proximity * 0.35);
// //             const opacity = 0.4 + (proximity * 0.6);
// //
// //             slide.style.transform = `scale(${scale})`;
// //             slide.style.opacity = opacity;
// //         });
// //
// //         requestAnimationFrame(updateSlides);
// //     }
// //     updateSlides();
// // }
//
// function updateSlides() {
//     const allSlides = track.querySelectorAll('.slide-item');
//     const containerRect = container.getBoundingClientRect();
//     const centerX = containerRect.left + containerRect.width / 2;
//
//     const isMobile = window.innerWidth <= 768;
//     const baseScale = isMobile ? 0.85 : 0.8;
//     const scaleFactor = isMobile ? 0.15 : 0.35;
//
//     allSlides.forEach(slide => {
//         const slideRect = slide.getBoundingClientRect();
//         const slideCenterX = slideRect.left + slideRect.width / 2;
//         const distanceFromCenter = Math.abs(centerX - slideCenterX);
//         const maxDistance = containerRect.width / 2;
//         const proximity = Math.max(0, 1 - (distanceFromCenter / maxDistance));
//
//         // 1. Calculate scale and round it to 2 decimal places to prevent sub-pixel blur
//         let scale = baseScale + (proximity * scaleFactor);
//         scale = Math.round(scale * 100) / 100;
//
//         // 2. Keep opacity high (minimum 0.8) to keep the image crisp
//         const opacity = 0.8 + (proximity * 0.2);
//
//         // 3. Dynamic Z-Index
//         const zIndex = Math.round(proximity * 100);
//
//         // 4. Use translate3d to trigger Hardware Acceleration
//         slide.style.transform = `scale(${scale}) translate3d(0,0,0)`;
//         slide.style.opacity = opacity;
//         slide.style.zIndex = zIndex;
//     });
//
//     requestAnimationFrame(updateSlides);
// }
//
// document.addEventListener('DOMContentLoaded', initDynamicSlider);