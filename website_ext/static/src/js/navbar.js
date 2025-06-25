document.addEventListener("DOMContentLoaded", () => {
    const navbar = document.querySelector(".navbar");
    const scrollContainer = document.querySelector("#wrapwrap");
    if (!navbar || !scrollContainer) {
        return;
    }
    scrollContainer.addEventListener("scroll", () => {
        if (scrollContainer.scrollTop > 50) {
            navbar.classList.add("navbar-scrolled");
        } else {
            navbar.classList.remove("navbar-scrolled");
        }
    });
});