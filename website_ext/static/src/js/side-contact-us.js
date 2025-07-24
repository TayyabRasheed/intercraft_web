
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("contactToggleBtn");
    const modal = document.getElementById("contactFormModal");
    const closeBtn = document.getElementById("closeContactForm");

    btn.addEventListener("click", () => modal.classList.add("show"));
    closeBtn.addEventListener("click", () => modal.classList.remove("show"));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("show");
    });

    document.getElementById("sideContactForm").addEventListener("submit", (e) => {
      e.preventDefault();
      // TODO: send via AJAX or Odoo controller
      alert("Message sent! We'll be in touch.");
      modal.classList.remove("show");
      e.target.reset();
    });
  });

