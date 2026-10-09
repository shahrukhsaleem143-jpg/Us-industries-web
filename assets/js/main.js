/* US Industries — interactions. No dependencies. */
(function () {
  "use strict";

  var doc = document.documentElement;
  var body = document.body;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (reduced) doc.classList.add("reduced");

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }

  /* ---------- Page transitions ---------- */
  // Coming back via the back/forward cache: drop the leaving state so the veil lifts again.
  window.addEventListener("pageshow", function (e) { if (e.persisted) body.classList.remove("is-leaving"); });

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a");
    if (!a || reduced) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (a.target === "_blank" || a.hasAttribute("download")) return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
    if (url.pathname === location.pathname && url.hash) return; // same-page anchor
    e.preventDefault();
    closeMenu();
    body.classList.add("is-leaving");
    setTimeout(function () { location.href = url.href; }, 520);
  });

  /* ---------- Header ---------- */
  var header = $(".site-header");
  var lastY = 0;
  function onHeaderScroll() {
    var y = window.scrollY;
    header.classList.toggle("is-solid", y > 40);
    var hide = y > 400 && y > lastY && !body.classList.contains("menu-open");
    header.classList.toggle("is-hidden", hide);
    body.classList.toggle("header-hidden", hide);
    lastY = y;
  }
  window.addEventListener("scroll", onHeaderScroll, { passive: true });
  onHeaderScroll();

  /* ---------- Fullscreen menu ---------- */
  var toggle = $(".menu-toggle");
  var menu = $("#menu");
  function openMenu() {
    body.classList.add("menu-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    menu.setAttribute("aria-hidden", "false");
  }
  function closeMenu() {
    if (!body.classList.contains("menu-open")) return;
    body.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    menu.setAttribute("aria-hidden", "true");
  }
  toggle.addEventListener("click", function () { body.classList.contains("menu-open") ? closeMenu() : openMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  window.addEventListener("resize", function () { if (window.innerWidth >= 1080) closeMenu(); });

  /* ---------- Split headings into masked words ---------- */
  $$("[data-split]").forEach(function (el) {
    var i = 0;
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            var outer = document.createElement("span");
            outer.className = "split-word";
            outer.setAttribute("aria-hidden", "true");
            var inner = document.createElement("span");
            inner.style.setProperty("--i", i++);
            inner.textContent = part;
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    }
    walk(el);
  });

  /* ---------- Reveal on scroll ---------- */
  var revealables = $$("[data-reveal], [data-split], .global-map");
  if (!("IntersectionObserver" in window) || reduced) {
    revealables.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealables.forEach(function (el) { io.observe(el); });
    // Above-the-fold elements reveal right after the veil lifts.
    setTimeout(function () {
      revealables.forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-in");
      });
    }, 350);
  }

  /* ---------- Scroll-driven effects (single rAF loop) ---------- */
  var parallaxEls = $$("[data-parallax]");
  var fillLines = $$(".fill-line");
  var hscroll = $("[data-hscroll]");
  var hTrack = hscroll && $(".scale-track", hscroll);
  var hPinned = false;

  function setupHScroll() {
    if (!hscroll) return;
    var want = window.innerWidth >= 1024 && !reduced;
    hscroll.classList.toggle("is-pinned", want);
    hPinned = want;
    if (want) {
      // Mobile scroll-snap may have scrolled the strip before pinning took over.
      $(".scale-sticky", hscroll).scrollLeft = 0;
      var distance = hTrack.scrollWidth - window.innerWidth;
      hscroll.style.height = (window.innerHeight + distance) + "px";
    } else {
      hscroll.style.height = "";
      hTrack.style.transform = "";
    }
  }

  var ticking = false;
  function update() {
    ticking = false;
    var vh = window.innerHeight;

    if (!reduced) {
      parallaxEls.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0.1;
        var offset = (r.top + r.height / 2 - vh / 2) * -speed;
        el.style.transform = "translate3d(0," + offset.toFixed(1) + "px,0)";
      });
    }

    fillLines.forEach(function (line) {
      var r = line.getBoundingClientRect();
      var p = reduced ? 1 : clamp((vh * 0.85 - r.top) / (vh * 0.45), 0, 1);
      line.style.setProperty("--p", p.toFixed(3));
    });

    if (hPinned) {
      var rect = hscroll.getBoundingClientRect();
      var max = hTrack.scrollWidth - window.innerWidth;
      var progress = clamp(-rect.top / (rect.height - vh), 0, 1);
      hTrack.style.transform = "translate3d(" + (-max * progress).toFixed(1) + "px,0,0)";
    }
  }
  function requestUpdate() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", function () { setupHScroll(); requestUpdate(); });
  window.addEventListener("load", function () { setupHScroll(); requestUpdate(); });
  setupHScroll();
  update();

  /* ---------- Hero: background slides + look rotation ---------- */
  function rotate(items, interval, onChange) {
    if (items.length < 2 || reduced) return;
    var idx = 0;
    setInterval(function () {
      if (document.hidden) return;
      items[idx].classList.remove("is-active");
      idx = (idx + 1) % items.length;
      items[idx].classList.add("is-active");
      if (onChange) onChange(idx);
    }, interval);
  }
  rotate($$(".hero-slide"), 7000);
  var captions = ["Garment-dyed fleece, 280 GSM", "Ribbed thermal knit", "Heavyweight fleece, 280 GSM"];
  var lookCount = $(".look-count");
  var lookCaption = $(".look-caption");
  rotate($$(".look"), 4500, function (i) {
    if (lookCount) lookCount.textContent = "0" + (i + 1) + " / 03";
    if (lookCaption) lookCaption.textContent = captions[i];
  });

  /* ---------- Development story ---------- */
  var story = $("[data-story]");
  if (story && "IntersectionObserver" in window) {
    var steps = $$(".develop-step", story);
    var imgs = $$(".develop-img", story);
    var dots = $$(".develop-index li", story);
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var n = entry.target.getAttribute("data-step");
        steps.forEach(function (s) { s.classList.toggle("is-active", s === entry.target); });
        imgs.forEach(function (im) { im.classList.toggle("is-active", im.getAttribute("data-step") === n); });
        dots.forEach(function (d, i) { d.classList.toggle("is-active", String(i + 1) === n); });
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    steps.forEach(function (s) { sio.observe(s); });
  }

  /* ---------- Principles hover preview ---------- */
  var preview = $(".preview");
  if (preview && finePointer && !reduced) {
    var previewImg = $("img", preview);
    var px = 0, py = 0, tx = 0, ty = 0, raf = null;
    function follow() {
      px += (tx - px) * 0.14; py += (ty - py) * 0.14;
      preview.style.left = px + "px"; preview.style.top = py + "px";
      raf = Math.abs(tx - px) + Math.abs(ty - py) > 0.5 ? requestAnimationFrame(follow) : null;
    }
    $$(".principles li").forEach(function (li) {
      li.addEventListener("mouseenter", function () {
        previewImg.src = li.getAttribute("data-preview");
        preview.classList.add("is-on");
      });
      li.addEventListener("mouseleave", function () { preview.classList.remove("is-on"); });
      li.addEventListener("mousemove", function (e) {
        tx = e.clientX + 180; ty = e.clientY;
        if (!raf) raf = requestAnimationFrame(follow);
      });
    });
  }

  /* ---------- Custom cursor ---------- */
  var cursor = $(".cursor");
  if (cursor && finePointer && !reduced) {
    doc.classList.add("has-cursor");
    var cx = -100, cy = -100, x = -100, y = -100;
    window.addEventListener("mousemove", function (e) { x = e.clientX; y = e.clientY; }, { passive: true });
    (function loop() {
      cx += (x - cx) * 0.2; cy += (y - cy) * 0.2;
      cursor.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
      requestAnimationFrame(loop);
    })();
    document.addEventListener("mouseover", function (e) {
      var t = e.target;
      cursor.classList.toggle("is-view", !!t.closest("[data-cursor='view']"));
      cursor.classList.toggle("is-link", !t.closest("[data-cursor='view']") && !!t.closest("a, button, label, select"));
      cursor.classList.toggle("is-hidden", !!t.closest("input, textarea"));
    });
    document.addEventListener("mouseleave", function () { cursor.classList.add("is-hidden"); });
    document.addEventListener("mouseenter", function () { cursor.classList.remove("is-hidden"); });
  }

  /* ---------- Product filters ---------- */
  var filters = $$(".filter");
  if (filters.length) {
    var products = $$(".product");
    function applyFilter(cat, updateHash) {
      if (!filters.some(function (f) { return f.getAttribute("data-filter") === cat; })) cat = "all";
      filters.forEach(function (f) {
        var on = f.getAttribute("data-filter") === cat;
        f.classList.toggle("is-active", on);
        f.setAttribute("aria-pressed", String(on));
      });
      products.forEach(function (p) {
        var show = cat === "all" || p.getAttribute("data-category") === cat;
        p.hidden = !show;
        if (show) p.classList.add("is-in");
      });
      if (updateHash) history.replaceState(null, "", cat === "all" ? location.pathname : "#" + cat);
    }
    filters.forEach(function (f) {
      f.addEventListener("click", function () { applyFilter(f.getAttribute("data-filter"), true); });
    });
    applyFilter(location.hash.slice(1) || "all", false);
    window.addEventListener("hashchange", function () { applyFilter(location.hash.slice(1) || "all", false); });
  }

  /* ---------- Inquiry form ---------- */
  var form = $("#inquiry-form");
  if (form) {
    var status = $(".form-status", form);
    var fileInput = $("#techpack", form);
    var fileName = $(".file-name", form);
    var MAX_BYTES = 10 * 1024 * 1024;

    if (fileInput) {
      fileInput.addEventListener("change", function () {
        var f = fileInput.files[0];
        fileName.textContent = f ? f.name + " · " + (f.size / 1048576).toFixed(1) + " MB" : "";
      });
    }

    function setError(field, msg) {
      var wrap = field.closest(".field");
      var err = wrap && $(".field-error", wrap);
      if (wrap) wrap.classList.toggle("is-invalid", !!msg);
      if (err) err.textContent = msg || "";
      field.setAttribute("aria-invalid", msg ? "true" : "false");
    }

    function validate() {
      var ok = true;
      $$("[required]", form).forEach(function (field) {
        var v = field.value.trim();
        var msg = "";
        if (!v) msg = "Required";
        else if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = "Enter a valid email address";
        setError(field, msg);
        if (msg) ok = false;
      });
      if (fileInput && fileInput.files[0] && fileInput.files[0].size > MAX_BYTES) {
        setError(fileInput, "Files up to 10 MB, or share a link in your message");
        ok = false;
      } else if (fileInput) {
        setError(fileInput, "");
      }
      return ok;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.className = "form-status";
      if (!validate()) {
        status.textContent = "Please complete the highlighted fields.";
        status.classList.add("is-err");
        var first = $("[aria-invalid='true']", form);
        if (first) first.focus();
        return;
      }

      var endpoint = form.getAttribute("data-endpoint");
      var data = new FormData(form);

      if (endpoint) {
        var btn = $("button[type='submit']", form);
        btn.disabled = true;
        status.textContent = "Sending…";
        fetch(endpoint, { method: "POST", body: data, headers: { Accept: "application/json" } })
          .then(function (res) {
            if (!res.ok) throw new Error(res.status);
            form.reset();
            if (fileName) fileName.textContent = "";
            status.textContent = "Thank you. Your project brief has been received. Our team will reply within one business day.";
            status.classList.add("is-ok");
          })
          .catch(function () {
            status.textContent = "Something went wrong. Please email usoffice@usindustries.pk directly.";
            status.classList.add("is-err");
          })
          .then(function () { btn.disabled = false; });
        return;
      }

      // No form endpoint configured yet: hand the brief to the visitor's email client.
      var lines = [];
      data.forEach(function (value, key) {
        if (key === "techpack" || key === "website") return;
        if (String(value).trim()) lines.push(key.replace(/_/g, " ").toUpperCase() + ": " + value);
      });
      if (fileInput && fileInput.files[0]) lines.push("", "(Please attach your tech pack / reference: " + fileInput.files[0].name + ")");
      var subject = "Project inquiry — " + (data.get("company") || data.get("name"));
      location.href = "mailto:" + form.getAttribute("data-mailto") +
        "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
      status.textContent = "Your email app should open with your brief ready to send. Prefer to call? +1 (469) 673-8464.";
      status.classList.add("is-ok");
    });

    $$("input, select, textarea", form).forEach(function (field) {
      field.addEventListener("blur", function () {
        if (field.closest(".field.is-invalid")) validate();
      });
    });
  }
})();
