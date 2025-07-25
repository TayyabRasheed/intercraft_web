document.addEventListener("DOMContentLoaded", () => {
    const close_button = document.getElementById("closeContactForm");
    close_button.addEventListener("click", () => {
        const display_contactus = document.querySelector('.contact-form-overlay ');
        display_contactus.classList.remove('is-open')
    })
    const contact_us = document.getElementById("contactToggleBtn");
    contact_us.addEventListener("click", () => {
        const display_contactus = document.querySelector('.contact-form-overlay ');
        display_contactus.classList.add('is-open')

    })
});

