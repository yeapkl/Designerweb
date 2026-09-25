// Imili Design Studio — small progressive enhancements. The page works
// without this file; everything here is optional polish.
(function () {
  "use strict";

  var WHATSAPP_NUMBER = "60143223601";
  var MAX_NAME = 60;
  var MAX_MESSAGE = 500;

  var root = document.documentElement;
  root.classList.add("js");

  // --- Sticky header shadow ------------------------------------------------
  var header = document.querySelector("[data-header]");
  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // --- Mobile nav ----------------------------------------------------------
  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.querySelector("[data-nav]");
  function setNav(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
  }
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setNav(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setNav(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setNav(false);
        toggle.focus();
      }
    });
  }

  // --- Reveal on scroll ----------------------------------------------------
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  // --- Project filter ------------------------------------------------------
  var filters = document.querySelector("[data-filters]");
  var projects = document.querySelectorAll("[data-projects] .project");
  if (filters) {
    filters.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-filter]");
      if (!btn) return;
      var value = btn.getAttribute("data-filter");
      filters.querySelectorAll("[data-filter]").forEach(function (b) {
        var active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      projects.forEach(function (p) {
        var show = value === "all" || p.getAttribute("data-category") === value;
        p.hidden = !show;
        if (show) p.classList.add("is-visible");
      });
    });
  }

  // --- Before / after comparison -------------------------------------------
  // The range input sits invisibly over the images, so mouse, touch and
  // keyboard (arrow keys) all work natively. CSSOM custom properties are
  // allowed under our CSP (only inline style attributes are blocked).
  document.querySelectorAll("[data-compare]").forEach(function (el) {
    var range = el.querySelector("[data-compare-range]");
    if (!range) return;
    function update() {
      var v = Math.min(100, Math.max(0, Number(range.value) || 0));
      el.style.setProperty("--pos", v + "%");
    }
    range.addEventListener("input", update);
    update();
  });

  // --- WhatsApp enquiry ----------------------------------------------------
  // Builds a pre-filled wa.me link on the visitor's own device. No data is
  // sent to or stored by this website.
  var form = document.querySelector("[data-enquiry]");
  if (form) {
    var errorEl = form.querySelector("[data-form-error]");
    // Localised strings come from data attributes rendered per language.
    var msg = {
      errName: form.getAttribute("data-err-name") || "Please tell us your name.",
      errMessage: form.getAttribute("data-err-message") || "Please add a few words about your project.",
      greeting: form.getAttribute("data-wa-greeting") || "Hi Imili Design Studio! I'm",
      space: form.getAttribute("data-wa-space") || "Space"
    };

    function clean(value, max) {
      // Strip control characters (keep newlines), collapse whitespace runs,
      // and enforce the same limits as the inputs' maxlength.
      return String(value || "")
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
        .replace(/[ \t]+/g, " ")
        .trim()
        .slice(0, max);
    }

    function showError(field, message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      field.setAttribute("aria-invalid", "true");
      field.focus();
    }

    form.addEventListener("input", function (e) {
      if (e.target.hasAttribute("aria-invalid")) e.target.removeAttribute("aria-invalid");
      if (!errorEl.hidden) errorEl.hidden = true;
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var nameField = form.elements.name;
      var typeField = form.elements.type;
      var msgField = form.elements.message;

      var name = clean(nameField.value, MAX_NAME);
      var type = clean(typeField.value, 40);
      var message = clean(msgField.value, MAX_MESSAGE);

      if (!name) return showError(nameField, msg.errName);
      if (message.length < 3) return showError(msgField, msg.errMessage);

      var text = msg.greeting + " " + name + "\n" +
        msg.space + ": " + type + "\n\n" + message;
      var url = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text);

      // window.open(..., "noopener") always returns null, so it can't tell us
      // whether a popup blocker fired. A real link click is never blocked.
      var link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  }

  // --- Footer year ---------------------------------------------------------
  var year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
})();
