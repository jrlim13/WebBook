/* ============================================================
   flip.js — thin wrapper around StPageFlip
   ============================================================ */

const STF_GLOBAL_KEYS = ["St", "ST", "pageFlip"];

function resolvePageFlipCtor() {
  for (const key of STF_GLOBAL_KEYS) {
    const ns = window[key];
    if (ns?.PageFlip) return ns.PageFlip;
    if (typeof ns === "function") return ns;
  }
  // Some builds expose PageFlip directly on window
  if (typeof window.PageFlip === "function") return window.PageFlip;
  return null;
}

/**
 * Create a StPageFlip instance with config tuned for the reader.
 *
 * @param {HTMLElement} stageEl  The book stage container (#book)
 * @param {Array<HTMLElement>} pageEls  Page elements (.page / .page--hard)
 * @param {Object} opts
 * @param {number} opts.width
 * @param {number} opts.height
 * @param {boolean} opts.portrait
 * @param {Function} opts.onFlip
 * @param {Function} opts.onOrientationChange
 * @returns {Object} PageFlip instance, or null if library not available
 */
export function initPageFlip(stageEl, pageEls, opts) {
  const PageFlip = resolvePageFlipCtor();
  if (!PageFlip) {
    console.error(
      "StPageFlip not loaded. Check the CDN script tag in index.html."
    );
    return null;
  }

  // Clear any prior content and strip any inline styles StPageFlip may have
  // applied in a previous lifecycle (e.g. size:'stretch' sets width:100%).
  stageEl.innerHTML = "";
  stageEl.removeAttribute("style");

  const pf = new PageFlip(stageEl, {
    width: opts.width,
    height: opts.height,
    size: "fixed",
    maxShadowOpacity: 0.5,
    drawShadow: true,
    flippingTime: 700,
    usePortrait: true,
    startPage: 0,
    showCover: true,
    mobileScrollSupport: false,
    swipeDistance: 30,
    showPageCorners: false,
    disableFlipByClick: true,
    clickEventForward: true,
  });

  pf.loadFromHTML(pageEls);

  if (opts.onFlip) {
    pf.on("flip", (e) => opts.onFlip(e.data));
  }

  if (opts.onOrientationChange) {
    pf.on("changeOrientation", (e) => opts.onOrientationChange(e.data));
  }

  return pf;
}

export function destroyPageFlip(pf) {
  if (!pf) return;
  try {
    pf.destroy();
  } catch (err) {
    /* destroy can throw if already torn down */
  }
}
