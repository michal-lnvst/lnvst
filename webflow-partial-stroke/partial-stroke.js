(function () {
  const SELECTOR = ".blog_image_wrapper";
  const VARIANTS = [
    { route: "trb", start: 0.78, end: 0.48 },
    { route: "ltr", start: 0.30, end: 0.68 },
    { route: "blt", start: 0.72, end: 0.26 },
    { route: "rbl", start: 0.22, end: 0.58 }
  ];

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function readNumber(cs, prop, fallback) {
    const n = parseFloat(cs.getPropertyValue(prop));
    return Number.isFinite(n) ? n : fallback;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function getOrCreateSvg(el) {
    let svg = el.querySelector(":scope > svg.wf-partial-stroke");
    if (svg) return svg;

    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("wf-partial-stroke");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("preserveAspectRatio", "none");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.appendChild(path);
    el.appendChild(svg);

    return svg;
  }

  function resolveVariantIndex(el) {
    const attr = (el.getAttribute("data-stroke-variant") || "").trim().toLowerCase();

    // Accept data-stroke-variant="1..N" to force a specific variant.
    if (/^\d+$/.test(attr)) {
      const requested = parseInt(attr, 10) - 1;
      if (requested >= 0 && requested < VARIANTS.length) {
        return requested;
      }
    }

    // Persist random pick so wrappers do not change variant after resize/re-render.
    const existing = el.getAttribute("data-stroke-variant-index");
    if (existing && /^\d+$/.test(existing)) {
      const index = parseInt(existing, 10);
      if (index >= 0 && index < VARIANTS.length) {
        return index;
      }
    }

    const randomIndex = Math.floor(Math.random() * VARIANTS.length);
    el.setAttribute("data-stroke-variant-index", String(randomIndex));
    return randomIndex;
  }

  function applyVariant(el) {
    const index = resolveVariantIndex(el);
    const variant = VARIANTS[index];

    el.setAttribute("data-stroke-route", variant.route);
    el.style.setProperty("--stroke-start", String(variant.start));
    el.style.setProperty("--stroke-end", String(variant.end));
  }

  function drawStroke(el) {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;

    const cs = getComputedStyle(el);

    const strokeW = readNumber(cs, "--stroke-size", 3);
    const radiusFromVar = readNumber(cs, "--stroke-radius", NaN);
    const radiusFromCss = parseFloat(cs.borderTopRightRadius) || 0;
    const rBase = Number.isFinite(radiusFromVar) ? radiusFromVar : radiusFromCss || 24;

    const startRatio = clamp(readNumber(cs, "--stroke-start", 0.78), 0, 1);
    const endRatio = clamp(readNumber(cs, "--stroke-end", 0.48), 0, 1);

    // Keep the path centered on the stroke thickness, similar to Figma center stroke.
    const inset = strokeW / 2;
    const x0 = inset;
    const y0 = inset;
    const x1 = w - inset;
    const y1 = h - inset;

    const r = clamp(rBase, 0, Math.min((x1 - x0) / 2, (y1 - y0) / 2));

    const route = (el.getAttribute("data-stroke-route") || "trb").toLowerCase();
    const minX = x0 + r;
    const maxX = x1 - r;
    const minY = y0 + r;
    const maxY = y1 - r;
    let d;

    if (route === "ltr") {
      // left -> top -> right
      const sy = clamp(lerp(minY, maxY, startRatio), minY, maxY);
      const ey = clamp(lerp(minY, maxY, endRatio), minY, maxY);

      d = [
        `M ${x0} ${sy}`,
        `L ${x0} ${y0 + r}`,
        `Q ${x0} ${y0} ${x0 + r} ${y0}`,
        `L ${x1 - r} ${y0}`,
        `Q ${x1} ${y0} ${x1} ${y0 + r}`,
        `L ${x1} ${ey}`
      ].join(" ");
    } else if (route === "blt") {
      // bottom -> left -> top
      const sx = clamp(lerp(minX, maxX, startRatio), minX, maxX);
      const ex = clamp(lerp(minX, maxX, endRatio), minX, maxX);

      d = [
        `M ${sx} ${y1}`,
        `L ${x0 + r} ${y1}`,
        `Q ${x0} ${y1} ${x0} ${y1 - r}`,
        `L ${x0} ${y0 + r}`,
        `Q ${x0} ${y0} ${x0 + r} ${y0}`,
        `L ${ex} ${y0}`
      ].join(" ");
    } else if (route === "rbl") {
      // right -> bottom -> left
      const sy = clamp(lerp(minY, maxY, startRatio), minY, maxY);
      const ey = clamp(lerp(minY, maxY, endRatio), minY, maxY);

      d = [
        `M ${x1} ${sy}`,
        `L ${x1} ${y1 - r}`,
        `Q ${x1} ${y1} ${x1 - r} ${y1}`,
        `L ${x0 + r} ${y1}`,
        `Q ${x0} ${y1} ${x0} ${y1 - r}`,
        `L ${x0} ${ey}`
      ].join(" ");
    } else {
      // top -> right -> bottom (default)
      const sx = clamp(lerp(minX, maxX, startRatio), minX, maxX);
      const ex = clamp(lerp(minX, maxX, endRatio), minX, maxX);

      d = [
        `M ${sx} ${y0}`,
        `L ${x1 - r} ${y0}`,
        `Q ${x1} ${y0} ${x1} ${y0 + r}`,
        `L ${x1} ${y1 - r}`,
        `Q ${x1} ${y1} ${x1 - r} ${y1}`,
        `L ${ex} ${y1}`
      ].join(" ");
    }

    const svg = getOrCreateSvg(el);
    const path = svg.querySelector("path");

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    path.setAttribute("d", d);
  }

  function init() {
    const wrappers = document.querySelectorAll(SELECTOR);
    if (!wrappers.length) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) drawStroke(entry.target);
    });

    wrappers.forEach((el) => {
      applyVariant(el);
      drawStroke(el);
      ro.observe(el);
    });

    // Covers dynamic content changes in CMS lists/tabs/etc.
    const mo = new MutationObserver(() => {
      document.querySelectorAll(SELECTOR).forEach((el) => {
        if (!el.querySelector(":scope > svg.wf-partial-stroke")) {
          applyVariant(el);
          drawStroke(el);
          ro.observe(el);
        }
      });
    });

    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
