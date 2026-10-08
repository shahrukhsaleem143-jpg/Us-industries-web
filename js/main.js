(function () {
  "use strict";

  // Footer year
  document.getElementById("year").textContent = new Date().getFullYear();

  // Header shadow on scroll
  var header = document.querySelector(".site-header");
  function onScroll() {
    header.classList.toggle("scrolled", window.scrollY > 10);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile navigation
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  function setNav(open) {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  toggle.addEventListener("click", function () {
    setNav(!nav.classList.contains("open"));
  });
  nav.addEventListener("click", function (e) {
    if (e.target.tagName === "A") setNav(false);
  });

  // Animated counters
  function animateCount(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    var duration = 1400;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Reveal on scroll
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revealEls = document.querySelectorAll(".reveal");
  var counters = document.querySelectorAll("[data-count]");

  if (!("IntersectionObserver" in window) || reduceMotion) {
    revealEls.forEach(function (el) { el.classList.add("visible"); });
    counters.forEach(function (el) {
      el.textContent = parseInt(el.getAttribute("data-count"), 10).toLocaleString();
    });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        entry.target.querySelectorAll("[data-count]").forEach(animateCount);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  // Contact form (client-side validation; connect to a backend or form service to deliver)
  var form = document.getElementById("contact-form");
  var status = form.querySelector(".form-status");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var valid = true;
    form.querySelectorAll("[required]").forEach(function (field) {
      var ok = field.value.trim() !== "" && (field.type !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value));
      field.classList.toggle("invalid", !ok);
      if (!ok) valid = false;
    });

    if (!valid) {
      status.textContent = "Please fill in the required fields.";
      status.className = "form-status err";
      return;
    }

    status.textContent = "Thank you! Your message has been received. We'll be in touch soon.";
    status.className = "form-status ok";
    form.reset();
  });
})();
