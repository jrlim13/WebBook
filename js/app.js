/* ============================================================
   app.js — bootstrap & wire-up
   ============================================================ */

import { createReader } from "./reader.js";
import { createUI } from "./ui.js";
import { initPageFlip, destroyPageFlip } from "./flip.js";
import {
  loadSettings,
  saveSettings,
  loadPosition,
  savePosition,
  loadBookmarks,
  saveBookmarks,
  DEFAULT_SETTINGS,
} from "./storage.js";

const RESIZE_DEBOUNCE = 220;

async function loadBook() {
  const res = await fetch("content/alice.json", { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load book: ${res.status}`);
  return await res.json();
}

function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

async function main() {
  const settings = loadSettings();
  const position = loadPosition();
  const bookmarks = loadBookmarks();

  let book;
  try {
    book = await loadBook();
  } catch (err) {
    console.error(err);
    showFatal("Couldn't load the book. Please serve this site over http (e.g. `npx serve`) so the JSON can be fetched.");
    return;
  }

  const reader = createReader({ book, settings, position, bookmarks });
  reader.applySettingsToDom();

  const ui = createUI({
    onPrev: () => pf?.flipPrev(),
    onNext: () => pf?.flipNext(),
    onSettingsChange: (patch) => {
      const next = reader.updateSettings(patch);
      saveSettings(next);
      ui.setSettings(next);
      scheduleRepaginate();
    },
    onBookmarkToggle: () => {
      const r = reader.toggleBookmarkOnCurrentPage();
      ui.setBookmarkActive(r.active);
      saveBookmarks(reader.getBookmarks());
      // Re-render the current spread so the bookmark indicator appears
      rebuildBook({ keepPosition: true });
    },
  });

  ui.setBookMeta({ title: book.title, author: book.author });
  ui.setSettings(reader.getSettings());

  let pf = null;

  function rebuildBook({ keepPosition = true } = {}) {
    const bookEl = document.getElementById("book");
    if (!bookEl) return; // guard: abort if DOM element is missing

    // Capture the current position based on the OLD pagination before tearing
    // down the engine.
    if (pf && keepPosition) {
      reader.updatePositionFromPageIndex(pf.getCurrentPageIndex());
    }

    if (pf) {
      destroyPageFlip(pf);
      pf = null;
    }

    reader.repaginate();

    const pageEls = reader.buildAllPageElements();
    const dims = reader.getPageBoxDimensions();

    // Give StPageFlip a fresh inner container so pf.destroy() never touches #book itself.
    // #book stays permanently in the DOM as the CSS centering shell.
    let stageEl = bookEl.querySelector(".book-stage");
    if (!stageEl) {
      stageEl = document.createElement("div");
      stageEl.className = "book-stage";
      bookEl.appendChild(stageEl);
    }

    // Guard against StPageFlip's phantom flip event fired synchronously during
    // loadFromHTML. We only start tracking flips after the init rAF completes.
    let flipEnabled = false;

    pf = initPageFlip(stageEl, pageEls, {
      width: Math.max(280, dims.width),
      height: Math.max(420, dims.height),
      portrait: dims.portrait,
      onFlip: (newPageIndex) => {
        if (!flipEnabled) return;
        reader.updatePositionFromPageIndex(newPageIndex);
        savePosition(reader.getPosition());
        ui.setProgress(reader.getProgress());
        ui.setBookmarkActive(reader.isCurrentPageBookmarked());
      },
      onOrientationChange: () => {
        scheduleRepaginate();
      },
    });

    if (!pf) {
      showFatal("Couldn't initialise the page-flip engine.");
      return;
    }

    let startIndex;
    if (keepPosition) {
      startIndex = Math.min(
        reader.getPageIndexForCurrentPosition(),
        pf.getPageCount() - 1
      );
    } else {
      startIndex = Math.min(
        reader.getStartingPageIndex(),
        pf.getPageCount() - 1
      );
    }

    // StPageFlip can be quirky about flipping during init; defer one frame.
    requestAnimationFrame(() => {
      if (startIndex > 0) {
        try {
          pf.turnToPage(startIndex);
        } catch (err) {
          /* ignore */
        }
      }
      reader.setCurrentPageFlipIndex(pf.getCurrentPageIndex());
      ui.setProgress(reader.getProgress());
      ui.setBookmarkActive(reader.isCurrentPageBookmarked());
      // Enable flip tracking AFTER init so the phantom loadFromHTML event is ignored.
      flipEnabled = true;
      ui.markReady();
    });
  }

  const scheduleRepaginate = debounce(() => rebuildBook({ keepPosition: true }), RESIZE_DEBOUNCE);

  // Initial build — wait for layout to settle (especially the book aspect ratio).
  requestAnimationFrame(() => requestAnimationFrame(() => rebuildBook({ keepPosition: false })));

  // Resize handling — repaginate on dimension change only
  let lastSize = { w: window.innerWidth, h: window.innerHeight };
  window.addEventListener(
    "resize",
    () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (Math.abs(w - lastSize.w) < 4 && Math.abs(h - lastSize.h) < 4) return;
      lastSize = { w, h };
      scheduleRepaginate();
    },
    { passive: true }
  );

  // Orientation change (mobile)
  window.addEventListener("orientationchange", () => {
    setTimeout(scheduleRepaginate, 200);
  });
}

function showFatal(message) {
  const loader = document.getElementById("loader");
  if (loader) {
    loader.innerHTML = `<div style="
      max-width: 360px;
      text-align: center;
      color: var(--c-cream);
      font-family: var(--ui-font);
      padding: 20px;
      background: color-mix(in oklab, black 40%, transparent);
      backdrop-filter: blur(20px);
      border-radius: 16px;
      border: 1px solid color-mix(in oklab, white 25%, transparent);
    ">${message}</div>`;
  }
}

main().catch((err) => {
  console.error(err);
  showFatal("Something went wrong. Check the developer console.");
});
