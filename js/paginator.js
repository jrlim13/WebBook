/* ============================================================
   paginator.js — measure-and-cut text into page-sized HTML blocks
   ============================================================ */

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/**
 * Build the set of "blocks" for a chapter — atomic units the paginator
 * tries to keep together when possible.
 * Each block: { kind, html, text?, paraIndex?, charStart?, charEnd? }
 */
function buildChapterBlocks(chapter) {
  const blocks = [];

  blocks.push({
    kind: "chapterEyebrow",
    html: `<h2>${escapeHTML(chapter.shortTitle || "")}</h2>`,
  });

  blocks.push({
    kind: "chapterTitle",
    html: `<h1>${escapeHTML(chapter.title || "")}</h1>`,
  });

  let cursor = 0;
  chapter.paragraphs.forEach((text, i) => {
    const html = renderParagraph(text, {
      dropcap: chapter.dropcap && i === 0,
      noIndent: false,
    });
    blocks.push({
      kind: "para",
      paraIndex: i,
      charStart: cursor,
      charEnd: cursor + text.length,
      text,
      html,
      dropcap: chapter.dropcap && i === 0,
    });
    cursor += text.length + 1; // +1 to keep offsets monotonic across paragraphs
  });

  return blocks;
}

function renderParagraph(text, { dropcap, noIndent, continuation } = {}) {
  const cls = [];
  if (dropcap) cls.push("dropcap");
  if (noIndent || continuation) cls.push("no-indent");
  const attr = cls.length ? ` class="${cls.join(" ")}"` : "";
  return `<p${attr}>${escapeHTML(text)}</p>`;
}

/** Test whether the proposed inner HTML fits within the measurer's max height. */
function fits(measurer, html, maxH) {
  measurer.innerHTML = html;
  return measurer.scrollHeight <= maxH + 1;
}

/**
 * Binary-search the largest prefix (by word boundary) of `text` whose
 * rendering fits in the measurer.
 * Returns { takenChars, takenWords } — char count consumed (including
 * trailing space) and the actual word count.
 */
function findBreakpoint(measurer, prefixHtml, text, opts, maxH) {
  const tokens = text.split(/(\s+)/); // alternating word, space, word, space…
  const wordIndexes = [];
  for (let i = 0; i < tokens.length; i++) {
    if (i % 2 === 0 && tokens[i].length > 0) wordIndexes.push(i);
  }

  if (wordIndexes.length === 0) return { takenChars: 0, takenWords: 0 };

  let lo = 0;
  let hi = wordIndexes.length;
  let best = 0;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (mid === 0) {
      lo = 1;
      continue;
    }
    const sliceEnd = wordIndexes[mid - 1] + 1;
    const partial = tokens.slice(0, sliceEnd).join("");
    const html = prefixHtml + renderParagraph(partial, opts);
    if (fits(measurer, html, maxH)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (best === 0) return { takenChars: 0, takenWords: 0 };

  const sliceEnd = wordIndexes[best - 1] + 1;
  const consumed = tokens.slice(0, sliceEnd).join("");
  return { takenChars: consumed.length, takenWords: best };
}

/**
 * Paginate a book into an array of page descriptors.
 *
 * @param {Object} args
 * @param {Object} args.book          { title, author, chapters: [...] }
 * @param {HTMLElement} args.measurer An off-screen element styled like .page
 * @param {Object} args.contentBox    { width, height } of the inner content area in CSS px
 * @param {Object} args.options       { fontSize, lineHeight }
 * @returns {Array<{chapterIdx, chapterShort, chapterTitle, charStart, charEnd, firstOfChapter, html}>}
 */
export function paginate({ book, measurer, contentBox, options }) {
  if (!contentBox || contentBox.width < 10 || contentBox.height < 10) {
    return [];
  }

  measurer.style.width = contentBox.width + "px";
  measurer.style.maxHeight = "none";
  measurer.style.height = "auto";
  measurer.style.fontSize = options.fontSize + "px";
  measurer.style.lineHeight = String(options.lineHeight);

  const maxH = contentBox.height;
  const pages = [];

  for (let ci = 0; ci < book.chapters.length; ci++) {
    const chapter = book.chapters[ci];
    const blocks = buildChapterBlocks(chapter);

    let pageHtml = "";
    let pageCharStart = 0;
    let pageCharEnd = 0;
    let firstOfChapter = true;
    let firstParaCommitted = false;

    const commit = () => {
      if (!pageHtml) return;
      pages.push({
        chapterIdx: ci,
        chapterShort: chapter.shortTitle || chapter.title,
        chapterTitle: chapter.title,
        firstOfChapter,
        charStart: pageCharStart,
        charEnd: pageCharEnd,
        html: pageHtml,
      });
      firstOfChapter = false;
      pageHtml = "";
      pageCharStart = pageCharEnd;
    };

    for (const block of blocks) {
      const tentative = pageHtml + block.html;
      if (fits(measurer, tentative, maxH)) {
        pageHtml = tentative;
        if (block.kind === "para") {
          pageCharEnd = block.charEnd;
          firstParaCommitted = true;
        }
        continue;
      }

      // Tentative overflows. First, flush whatever fits.
      if (pageHtml) {
        commit();
      }

      // Try block alone on a fresh page.
      if (fits(measurer, block.html, maxH)) {
        pageHtml = block.html;
        if (block.kind === "para") {
          pageCharStart = block.charStart;
          pageCharEnd = block.charEnd;
          firstParaCommitted = true;
        }
        continue;
      }

      // Block alone doesn't fit. Only paragraphs are splittable.
      if (block.kind !== "para") {
        // Heading too tall — push anyway, content is short enough that this
        // should never happen in practice; safer to emit than to drop.
        pageHtml = block.html;
        commit();
        continue;
      }

      // Split the paragraph into multiple pages.
      let remainingText = block.text;
      let remainingCharStart = block.charStart;
      let isFirstSlice = true;

      while (remainingText.length > 0) {
        const opts = {
          dropcap: block.dropcap && isFirstSlice,
          continuation: !isFirstSlice,
        };

        const { takenChars, takenWords } = findBreakpoint(
          measurer,
          "",
          remainingText,
          opts,
          maxH
        );

        if (takenWords === 0) {
          // Pathological — single word longer than a page. Emit anyway.
          pageHtml = renderParagraph(remainingText, opts);
          pageCharStart = remainingCharStart;
          pageCharEnd = remainingCharStart + remainingText.length;
          commit();
          break;
        }

        const sliceText = remainingText.slice(0, takenChars).replace(/\s+$/, "");
        pageHtml = renderParagraph(sliceText, opts);
        pageCharStart = remainingCharStart;
        pageCharEnd = remainingCharStart + sliceText.length;
        commit();

        remainingText = remainingText.slice(takenChars).replace(/^\s+/, "");
        remainingCharStart += takenChars;
        isFirstSlice = false;
      }
    }

    if (pageHtml) commit();
  }

  return pages;
}

/**
 * Compute the inner content box for a single page given the book container.
 * Accounts for the .page CSS padding (3% all sides) plus footer reserve.
 * CSS percentage padding is always relative to the containing block's WIDTH,
 * even for top/bottom — so all four sides use pageW * 0.03.
 */
export function computeContentBox(bookEl) {
  if (!bookEl) return { width: 0, height: 0, portrait: false };
  const rect = bookEl.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) {
    return { width: 0, height: 0, portrait: false };
  }
  const portrait = rect.height > rect.width;
  const pageW = portrait ? rect.width : rect.width / 2;
  const pageH = rect.height;
  // Matches .page CSS padding: 3% (all sides). CSS % padding always uses pageW as the base.
  const pad = pageW * 0.03;
  // footerReserve = gap above footer (= pad, so it matches top breathing room) + footer height.
  const FOOTER_HEIGHT = 26; // approx height of .page__footer (10px font + 12px padding-top)
  const footerReserve = pad + FOOTER_HEIGHT;
  const result = {
    width: Math.max(120, pageW - pad * 2),
    height: Math.max(160, pageH - pad * 2 - footerReserve),
    portrait,
  };
  return result;
}

/**
 * Given a stored position { chapterIdx, charOffset }, find the page index
 * that contains it (or the nearest page after).
 */
export function findPageForPosition(pages, position) {
  if (!position || typeof position.chapterIdx !== "number") return 0;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (p.chapterIdx > position.chapterIdx) return Math.max(0, i - 1);
    if (p.chapterIdx === position.chapterIdx) {
      if (p.charEnd >= position.charOffset) return i;
    }
  }
  return Math.max(0, pages.length - 1);
}
