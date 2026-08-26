(function () {
    function hidePopup(popup) {
        if (!popup) {
            return;
        }
        popup.classList.add("is-hidden");
        popup.style.display = "none";
        document.body.classList.remove("ic-event-popup-open");
    }

    function bindPopup() {
        const popup = document.querySelector(".ic-event-popup");
        if (!popup || popup.dataset.icEventBound === "1") {
            return;
        }
        popup.dataset.icEventBound = "1";
        document.body.classList.add("ic-event-popup-open");

        popup.addEventListener("click", (event) => {
            if (event.target.closest("[data-ic-event-close]")) {
                event.preventDefault();
                event.stopPropagation();
                hidePopup(popup);
            }
        });
    }

    document.addEventListener("click", (event) => {
        const closeEl = event.target.closest("[data-ic-event-close]");
        if (!closeEl) {
            return;
        }
        const popup = closeEl.closest(".ic-event-popup");
        if (popup) {
            event.preventDefault();
            hidePopup(popup);
        }
    }, true);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            document.querySelectorAll(".ic-event-popup").forEach(hidePopup);
        }
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindPopup);
    } else {
        bindPopup();
    }
})();
