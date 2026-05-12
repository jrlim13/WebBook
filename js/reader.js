/* ============================================================
   reader.js — book state, pagination orchestration, page DOM build
   ============================================================ */

import {
  paginate,
  computeContentBox,
  findPageForPosition,
} from "./paginator.js";

const FONT_SIZE_MIN = 14;
const FONT_SIZE_MAX = 24;
const FONT_SIZE_STEP = 1;

export function createReader({ book, settings, position, bookmarks }) {
  let state = {
    book,
    settings: { ...settings },
    hasStoredPosition: position != null,
    position: position || { chapterIdx: 0, charOffset: 0 },
    bookmarks: Array.isArray(bookmarks) ? [...bookmarks] : [],
    pages: [],
    currentPageIndex: 0,
  };

  function applySettingsToDom() {
    document.documentElement.style.setProperty(
      "--reader-font-size",
      `${state.settings.fontSize}px`
    );
    document.documentElement.style.setProperty(
      "--reader-line-height",
      String(state.settings.lineHeight)
    );
    document.body.dataset.paper = state.settings.paper;
  }

  function repaginate() {
    const bookEl = document.getElementById("book");
    const measurer = document.getElementById("measurer");
    if (!bookEl || !measurer) {
      state.pages = [];
      return state.pages;
    }
    const contentBox = computeContentBox(bookEl);
    state.pages = paginate({
      book: state.book,
      measurer,
      contentBox,
      options: {
        fontSize: state.settings.fontSize,
        lineHeight: state.settings.lineHeight,
      },
    });
    measurer.innerHTML = "";
    return state.pages;
  }

  function buildCoverElement() {
    const div = document.createElement("div");
    div.className = "page page--hard page--cover";
    div.innerHTML = `
      <div class="cover">
        <div class="cover__crest" aria-hidden="true">${escapeHTML(
          state.book.monogram || initials(state.book.title)
        )}</div>
        <p class="cover__author">${escapeHTML(state.book.author || "")}</p>
        <h1 class="cover__title">${escapeHTML(state.book.title || "")}</h1>
        <span class="cover__rule" aria-hidden="true"></span>
        <p class="cover__mark">${escapeHTML(
          state.book.epigraph || "A reader's edition"
        )}</p>
      </div>
    `;
    return div;
  }

  function buildBackCoverElement() {
    const div = document.createElement("div");
    div.className = "page page--hard page--back-cover";
    div.innerHTML = `
      <div class="cover">
        <span class="cover__rule" aria-hidden="true"></span>
        <p class="cover__mark">${escapeHTML(
          state.book.source || "The End"
        )}</p>
        <p class="cover__author">Fin</p>
      </div>
    `;
    return div;
  }

  function buildPageElement(page, totalPages, pageNumber) {
    const div = document.createElement("div");
    div.className = "page";
    div.dataset.chapterIdx = String(page.chapterIdx);
    div.dataset.charStart = String(page.charStart);
    div.dataset.charEnd = String(page.charEnd);

    const bookmarked = state.bookmarks.some(
      (b) =>
        b.chapterIdx === page.chapterIdx &&
        b.charOffset >= page.charStart &&
        b.charOffset <= page.charEnd
    );

    div.innerHTML = `
      ${bookmarked ? '<span class="page__bookmark" data-on="true" aria-hidden="true"></span>' : ""}
      <div class="page__content">${page.html}</div>
      <div class="page__footer">
        <span>${escapeHTML(page.chapterShort || "")}</span>
        <span>${pageNumber}</span>
      </div>
    `;
    return div;
  }

  function buildAllPageElements() {
    const elements = [];
    elements.push(buildCoverElement());
    const contentPages = state.pages;
    contentPages.forEach((page, i) => {
      elements.push(buildPageElement(page, contentPages.length, i + 1));
    });
    elements.push(buildBackCoverElement());
    return elements;
  }

  function getStartingPageIndex() {
    // Page index in StPageFlip space: cover is 0, content pages 1..N, back cover N+1.
    if (!state.hasStoredPosition) return 0; // first launch — show cover
    return getPageIndexForCurrentPosition();
  }

  function getPageIndexForCurrentPosition() {
    const i = findPageForPosition(state.pages, state.position);
    return state.pages.length === 0 ? 0 : i + 1;
  }

  function pageFlipIndexToContentIndex(pfIndex) {
    // Cover is 0, content starts at 1
    if (pfIndex <= 0) return 0;
    if (pfIndex > state.pages.length) return state.pages.length - 1;
    return pfIndex - 1;
  }

  function updatePositionFromPageIndex(pfIndex) {
    state.currentPageIndex = pfIndex;
    const contentIdx = pageFlipIndexToContentIndex(pfIndex);
    const page = state.pages[contentIdx];
    if (!page) return;
    state.position = {
      chapterIdx: page.chapterIdx,
      charOffset: page.charStart,
    };
    state.hasStoredPosition = true;
  }

  function toggleBookmarkOnCurrentPage() {
    const contentIdx = pageFlipIndexToContentIndex(state.currentPageIndex);
    const page = state.pages[contentIdx];
    if (!page) return { active: false };
    const existingIdx = state.bookmarks.findIndex(
      (b) =>
        b.chapterIdx === page.chapterIdx &&
        b.charOffset >= page.charStart &&
        b.charOffset <= page.charEnd
    );
    if (existingIdx >= 0) {
      state.bookmarks.splice(existingIdx, 1);
      return { active: false };
    } else {
      state.bookmarks.push({
        chapterIdx: page.chapterIdx,
        charOffset: page.charStart,
        at: Date.now(),
      });
      return { active: true };
    }
  }

  function isCurrentPageBookmarked() {
    const contentIdx = pageFlipIndexToContentIndex(state.currentPageIndex);
    const page = state.pages[contentIdx];
    if (!page) return false;
    return state.bookmarks.some(
      (b) =>
        b.chapterIdx === page.chapterIdx &&
        b.charOffset >= page.charStart &&
        b.charOffset <= page.charEnd
    );
  }

  function updateSettings(patch) {
    const next = { ...state.settings };
    if (typeof patch.fontSizeDelta === "number") {
      next.fontSize = clamp(
        next.fontSize + patch.fontSizeDelta * FONT_SIZE_STEP,
        FONT_SIZE_MIN,
        FONT_SIZE_MAX
      );
    }
    if (typeof patch.fontSize === "number") {
      next.fontSize = clamp(patch.fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX);
    }
    if (typeof patch.lineHeight === "number") {
      next.lineHeight = patch.lineHeight;
    }
    if (typeof patch.paper === "string") {
      next.paper = patch.paper;
    }
    state.settings = next;
    applySettingsToDom();
    return next;
  }

  function getProgress() {
    const contentIdx = pageFlipIndexToContentIndex(state.currentPageIndex);
    const page = state.pages[contentIdx];
    const total = state.pages.length;

    const bookEl = document.getElementById("book");
    const r = bookEl ? bookEl.getBoundingClientRect() : { width: 0, height: 0 };
    const isSpread = r.width >= r.height && r.width > 0;

    // In spread mode the rightmost visible content page is at currentPageIndex - 1
    // and the leftmost is at currentPageIndex - 2. In portrait mode only one page
    // is visible (the same content page).
    let rightHuman = total > 0 ? contentIdx + 1 : null;
    let leftHuman = null;
    if (isSpread) {
      const leftIdx = state.currentPageIndex - 2;
      if (leftIdx >= 0 && leftIdx < total) {
        leftHuman = leftIdx + 1;
      }
    }

    return {
      chapterShort: page?.chapterShort || state.book.title,
      leftPage: leftHuman,
      rightPage: rightHuman,
      pageCount: total,
    };
  }

  return {
    get state() {
      return state;
    },
    applySettingsToDom,
    repaginate,
    buildAllPageElements,
    getStartingPageIndex,
    pageFlipIndexToContentIndex,
    updatePositionFromPageIndex,
    getPageIndexForCurrentPosition,
    toggleBookmarkOnCurrentPage,
    isCurrentPageBookmarked,
    updateSettings,
    getProgress,
    getPages: () => state.pages,
    getPosition: () => state.position,
    getSettings: () => state.settings,
    getBookmarks: () => state.bookmarks,
    getCurrentPageFlipIndex: () => state.currentPageIndex,
    setCurrentPageFlipIndex: (i) => {
      state.currentPageIndex = i;
    },
    getPageBoxDimensions: () => {
      const bookEl = document.getElementById("book");
      const r = bookEl.getBoundingClientRect();
      const portrait = r.height > r.width;
      return {
        width: portrait ? r.width : r.width / 2,
        height: r.height,
        portrait,
      };
    },
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]
  );
}

function initials(title) {
  if (!title) return "A";
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "A";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
