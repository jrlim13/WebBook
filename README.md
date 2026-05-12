# WebBook

A web-based book reader inspired by the iOS Books app. Vanilla HTML, CSS, and JavaScript with two page-turn modes (drag-corner 3D curl and snappy tap/arrow flip) powered by [StPageFlip](https://nodlik.github.io/StPageFlip/), wrapped in an Apple Liquid Glass interface.

## Run

The site is fully static. Pick one:

```bash
# Option A — local dev server
npx serve -p 5173 .
# then open http://localhost:5173

# Option B — anything that serves files
python3 -m http.server 5173
```

> Opening `index.html` directly via `file://` works in some browsers, but `fetch()` for `content/alice.json` may be blocked. Serving the folder over HTTP is recommended.

## Features

- **Two flip modes**
  - Drag a page corner → realistic 3D page curl with shading (built into StPageFlip).
  - Tap the right/left third, arrow keys, swipe, or the prev/next buttons → snappy flip.
- **Responsive layout**
  - Desktop / tablet landscape → two-page spread with spine.
  - Mobile / tablet portrait → single-page mode, full-bleed paper.
- **Apple Liquid Glass UI** — translucent toolbars and a settings sheet with vibrancy, specular highlights, and elevated depth.
- **Reader settings** — text size, line spacing, and paper tone (Cream / White / Sepia).
- **Persistence** — last position, settings, and bookmarks survive reloads via `localStorage`.
- **Bundled sample** — *Alice's Adventures in Wonderland* (public domain, Project Gutenberg eBook #11).

## Design

- **Palette** (chrome & background): `#6f1d1b`, `#bb9457`, `#432818`, `#99582a`, `#ffe6a7`.
- **Page paper** stays bookish-white (default `#fdfaf2`) regardless of palette accents.
- **Type**: SF Pro for UI chrome, New York / Charter / Georgia stack for body prose.

## Keyboard shortcuts

| Key                          | Action               |
|------------------------------|----------------------|
| `→` / `Space` / `PageDown`   | Next page            |
| `←` / `PageUp`               | Previous page        |
| `B`                          | Toggle bookmark      |
| `Esc`                        | Close sheet / toggle UI chrome |

## Project structure

```
index.html
package.json          (optional, just for `npx serve`)
styles/
  base.css            reset, tokens, typography
  glass.css           Liquid Glass utilities
  reader.css          layout, paper, StPageFlip overrides, sheets
js/
  app.js              bootstrap and wiring
  reader.js           book state, pagination orchestration
  paginator.js        text → page-sized HTML, with resize handling
  flip.js             thin wrapper around StPageFlip
  ui.js               toolbars, sheet, progress, chrome auto-hide
  storage.js          localStorage helpers
content/
  alice.json          sample book (Lewis Carroll, public domain)
```

## Dependencies

- [StPageFlip](https://github.com/Nodlik/StPageFlip) (`page-flip` on npm) — loaded via CDN, MIT license, no jQuery.
- No build step, no other runtime libraries.

## Built with

Built using [Cursor](https://www.cursor.com).

## License

Code: MIT. Sample text excerpt: public domain (Project Gutenberg eBook #11).
