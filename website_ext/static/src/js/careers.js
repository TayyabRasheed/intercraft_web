document.addEventListener('DOMContentLoaded', function() {
    const galleryContainer = document.querySelector('#bootstrap-image-gallery');
    
    if (galleryContainer) {
        const gallery = window.lightGallery(galleryContainer, {
            selector: '.lg-item',
            plugins: [lgZoom, lgThumbnail],
            speed: 500,
            download: false,
            counter: true,
            getCaptionFromTitleOrAlt: true,
            thumbnail: true,
            animateThumb: true,
            showThumbByDefault: false,
            thumbWidth: 100,
            thumbHeight: 80,
            thumbMargin: 5,
            appendThumbnailsTo: '.lg-components',
            toggleThumb: true,
            enableThumbDrag: true,
            enableThumbSwipe: true,
            thumbSwipeThreshold: 50,
            loadYouTubeThumbnail: false,
            youTubeThumbSize: 1,
            loadVimeoThumbnail: false,
            vimeoThumbSize: 'thumbnail_small',
            zoom: true,
            scale: 1,
            enableZoomAfter: 300,
            backdropDuration: 300,
            hideBarsDelay: 2000,
            useLeftForZoom: true,
            closable: true,
            loop: true,
            escKey: true,
            keyPress: true,
            controls: true,
            slideEndAnimation: true,
            hideControlOnEnd: false,
            mousewheel: true,
            swipeThreshold: 50,
            enableSwipe: true,
            enableDrag: true
        });

        galleryContainer.addEventListener('lgBeforeOpen', function() {
            console.log('Gallery is about to open');
            document.body.style.overflow = 'hidden';
        });

        galleryContainer.addEventListener('lgAfterClose', function() {
            console.log('Gallery closed');
            document.body.style.overflow = 'auto';
        });

        galleryContainer.addEventListener('lgBeforeSlide', function(event) {
            console.log('Slide changing to:', event.detail.index);
        });
    }

    const galleryImages = document.querySelectorAll('.gallery-img');
    
    galleryImages.forEach(function(img) {
        img.classList.add('loading');
        
        img.addEventListener('load', function() {
            this.classList.remove('loading');
            this.classList.add('loaded');
        });
        
        img.addEventListener('error', function() {
            this.classList.remove('loading');
            this.classList.add('error');
            this.src = '/placeholder.svg?height=200&width=300&text=Image+Not+Found';
            this.alt = 'Image not available';
        });
    });

    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    const galleryItems = document.querySelectorAll('.lg-item');
    galleryItems.forEach(function(item) {
        observer.observe(item);
    });

    const style = document.createElement('style');
    style.textContent = `
        .lg-item {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.6s ease, transform 0.6s ease;
        }
        
        .lg-item.animate-in {
            opacity: 1;
            transform: translateY(0);
        }
        
        .gallery-img.loading {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
        }
        
        @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        
        .gallery-img.loaded {
            background: none;
            animation: none;
        }
        
        .gallery-img.error {
            background: #f8f9fa;
            border: 2px dashed #dee2e6;
        }
    `;
    document.head.appendChild(style);

    let currentImageIndex = 0;
    const preloadNextImages = function() {
        const images = document.querySelectorAll('.lg-item img');
        const nextIndex = (currentImageIndex + 1) % images.length;
        const nextImage = new Image();
        nextImage.src = images[nextIndex].src;
    };

    preloadNextImages();

    if (galleryContainer) {
        galleryContainer.addEventListener('lgAfterSlide', function(event) {
            currentImageIndex = event.detail.index;
            preloadNextImages();
        });
    }

    console.log('Gallery initialized successfully');
});

function handleResponsiveGallery() {
    const gallery = document.querySelector('#bootstrap-image-gallery');
    if (!gallery) return;

    const updateGalleryLayout = function() {
        const images = gallery.querySelectorAll('.gallery-img');
        const screenWidth = window.innerWidth;
        
        images.forEach(function(img) {
            if (screenWidth < 768) {
                img.style.height = '150px';
            } else if (screenWidth < 992) {
                img.style.height = '180px';
            } else {
                img.style.height = '200px';
            }
        });
    };

    updateGalleryLayout();

    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(updateGalleryLayout, 250);
    });
}

handleResponsiveGallery();

window.CareersGallery = {
    init: function() {
        console.log('Gallery module loaded');
    },
    refreshGallery: function() {
        handleResponsiveGallery();
    }
};