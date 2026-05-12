/* ============================================================
   ui.js — toolbars, settings sheet, progress, chrome auto-hide
   ============================================================ */

const CHROME_HIDE_DELAY = 4500;

export function createUI({ onPrev, onNext, onSettingsChange, onBookmarkToggle }) {
  const app = document.getElementById("app");
  const titleEl = document.getElementById("book-title");
  const authorEl = document.getElementById("book-author");
  const chapterEl = document.getElementById("progress-chapter");
  const pagesEl = document.getElementById("progress-pages");
  const fillEl = document.getElementById("progress-fill");

  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnAa = document.getElementById("btn-aa");
  const btnBookmark = document.getElementById("btn-bookmark");
  const btnBack = document.getElementById("btn-back");

  const sheet = document.getElementById("settings-sheet");
  const sheetScrim = document.getElementById("sheet-scrim");
  const btnCloseSettings = document.getElementById("btn-close-settings");

  let chromeTimer = null;
  const showChrome = () => {
    app.classList.remove("chrome-hidden");
    if (chromeTimer) clearTimeout(chromeTimer);
    chromeTimer = setTimeout(() => {
      if (sheet.dataset.open !== "true") {
        app.classList.add("chrome-hidden");
      }
    }, CHROME_HIDE_DELAY);
  };

  const toggleChrome = () => {
    if (app.classList.contains("chrome-hidden")) {
      showChrome();
    } else {
      app.classList.add("chrome-hidden");
      if (chromeTimer) clearTimeout(chromeTimer);
    }
  };

  // --- Sheet ----------------------------------------------------------------

  const openSheet = () => {
    sheet.hidden = false;
    sheetScrim.hidden = false;
    requestAnimationFrame(() => {
      sheet.dataset.open = "true";
      sheetScrim.dataset.open = "true";
      btnAa.setAttribute("aria-expanded", "true");
    });
    showChrome();
  };

  const closeSheet = () => {
    sheet.dataset.open = "false";
    sheetScrim.dataset.open = "false";
    btnAa.setAttribute("aria-expanded", "false");
    setTimeout(() => {
      sheet.hidden = true;
      sheetScrim.hidden = true;
    }, 360);
    showChrome();
  };

  const toggleSheet = () => {
    if (sheet.hidden || sheet.dataset.open !== "true") openSheet();
    else closeSheet();
  };

  btnAa.addEventListener("click", toggleSheet);
  btnCloseSettings.addEventListener("click", closeSheet);
  sheetScrim.addEventListener("click", closeSheet);

  // --- Nav buttons ----------------------------------------------------------

  btnPrev.addEventListener("click", () => {
    showChrome();
    onPrev?.();
  });
  btnNext.addEventListener("click", () => {
    showChrome();
    onNext?.();
  });

  // --- Bookmark -------------------------------------------------------------

  btnBookmark.addEventListener("click", () => {
    showChrome();
    onBookmarkToggle?.();
  });

  btnBack.addEventListener("click", () => {
    // No library yet — clicking "back" just toggles chrome / returns to top.
    showChrome();
  });

  // --- Click delegation on the stage ---------------------------------------
  // The native `click` event only fires when no drag occurred, so drag-corner
  // page-curls (handled by StPageFlip) pass through cleanly.

  const stage = document.getElementById("stage");
  let downPos = null;
  stage.addEventListener("pointerdown", (e) => {
    downPos = { x: e.clientX, y: e.clientY, t: Date.now() };
  });
  stage.addEventListener("click", (e) => {
    // If the click traveled too far or took too long, treat as drag-end.
    if (downPos) {
      const dx = e.clientX - downPos.x;
      const dy = e.clientY - downPos.y;
      const dt = Date.now() - downPos.t;
      downPos = null;
      if (Math.hypot(dx, dy) > 10 || dt > 600) return;
    }

    const rect = stage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    if (ratio < 1 / 3) {
      showChrome();
      onPrev?.();
    } else if (ratio > 2 / 3) {
      showChrome();
      onNext?.();
    } else {
      toggleChrome();
    }
  });

  // --- Keyboard -------------------------------------------------------------

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
      e.preventDefault();
      showChrome();
      onNext?.();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      showChrome();
      onPrev?.();
    } else if (e.key === "Escape") {
      if (sheet.dataset.open === "true") closeSheet();
      else toggleChrome();
    } else if (e.key === "b" || e.key === "B") {
      showChrome();
      onBookmarkToggle?.();
    }
  });

  // --- Settings controls inside sheet --------------------------------------

  const segGroups = sheet.querySelectorAll(".seg[role='radiogroup']");
  segGroups.forEach((group) => {
    group.querySelectorAll(".seg__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        group.querySelectorAll(".seg__btn").forEach((b) => {
          b.setAttribute("aria-checked", "false");
        });
        btn.setAttribute("aria-checked", "true");

        const lh = btn.dataset.lineHeight;
        const paper = btn.dataset.paper;
        if (lh != null) {
          onSettingsChange?.({ lineHeight: parseFloat(lh) });
        }
        if (paper != null) {
          onSettingsChange?.({ paper });
        }
      });
    });
  });

  // Font size segmented control (relative)
  sheet
    .querySelectorAll(".seg__btn[data-font-size]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const delta = parseInt(btn.dataset.fontSize, 10);
        onSettingsChange?.({ fontSizeDelta: delta });
      });
    });

  // --- Public API -----------------------------------------------------------

  return {
    setBookMeta({ title, author }) {
      titleEl.textContent = title || "";
      authorEl.textContent = author ? `by ${author}` : "";
    },

    setProgress({ chapterShort, leftPage, rightPage, pageCount }) {
      chapterEl.textContent = chapterShort || "";

      const hasLeft = typeof leftPage === "number";
      const hasRight = typeof rightPage === "number";
      let label = "";
      if (hasLeft && hasRight && leftPage !== rightPage) {
        label = `Page ${leftPage}-${rightPage} of ${pageCount}`;
      } else if (hasRight) {
        label = `Page ${rightPage} of ${pageCount}`;
      } else if (hasLeft) {
        label = `Page ${leftPage} of ${pageCount}`;
      }
      pagesEl.textContent = label;

      const rightmost = hasRight ? rightPage : hasLeft ? leftPage : 0;
      const pct = pageCount > 1 ? ((rightmost - 1) / (pageCount - 1)) * 100 : 0;
      fillEl.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    },

    setBookmarkActive(isActive) {
      btnBookmark.setAttribute("aria-pressed", isActive ? "true" : "false");
    },

    setSettings(settings) {
      sheet
        .querySelectorAll(".seg__btn[data-line-height]")
        .forEach((b) => {
          b.setAttribute(
            "aria-checked",
            Math.abs(parseFloat(b.dataset.lineHeight) - settings.lineHeight) <
              0.01
              ? "true"
              : "false"
          );
        });
      sheet.querySelectorAll(".seg__btn[data-paper]").forEach((b) => {
        b.setAttribute(
          "aria-checked",
          b.dataset.paper === settings.paper ? "true" : "false"
        );
      });
    },

    markReady() {
      document.body.classList.add("is-ready");
      showChrome();
    },

    showChrome,
    closeSheet,
  };
}
