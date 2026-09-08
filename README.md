# PDF Stamp — local & private PDF annotation

Add text anywhere on any PDF, draw or type a signature, and export the edited
file — **entirely in your browser**. The app is a static site: PDFs are opened,
rendered, modified, and downloaded locally and are **never uploaded** anywhere.

## Features

- **Open any PDF** (file picker or drag & drop)
- **Place text anywhere** on any page: 8 bundled fonts (sans / serif / mono /
  handwriting), any size, any color; placed text becomes **real, selectable
  text** in the exported PDF
- **Signature stamps**: draw with mouse/touch/stylus or type your name and
  pick a font + color, then save as a named stamp (kept in browser
  localStorage; available across sessions)
- Multi-page, zoom, move/resize elements, undo/redo, keyboard nudge
- **Download the edited PDF** at any time — pages left untouched stay exactly
  as they were
- Handles pages with any `/Rotate` (0/90/180/270°) — placed content appears
  upright

## Cross-platform

Works wherever a modern browser runs — Linux, Windows, macOS, tablets. The
"desktop" story is simply opening the published web app.

## Privacy

- No backend, no analytics, no file uploads: everything is processed in the
  browser via JavaScript ([pdf.js] for rendering, [pdf-lib] for writing).
- Even a published instance (static hosting on GitHub Pages / Netlify /
  your own server) cannot receive your documents — the code never sends them.
- Stamps/signatures you save stay in your browser's localStorage.

## Development

```sh
npm install
npm run dev      # dev server at http://localhost:5173
npm run test     # vitest: coordinate math, pdf.js cross-check, e2e export tests
npm run build    # production build in dist/
npm run preview  # serve the production build
```

## How placement works (for maintainers)

- Elements are authored in *display space*: origin at the displayed page's
  top-left corner (i.e. after `/Rotate` is applied), y downward, in PDF
  points — the same coordinates a pdf.js viewport at `scale = 1` reports.
- At export time `src/lib/coordinates.ts` maps display points to PDF user
  space per page rotation; content is drawn with `rotate: degrees(R)` so it
  appears upright. This mapping is unit-tested against pdf.js's own
  `convertToPdfPoint` on all four rotations (`src/lib/pdfjs.test.ts`),
  and text/stamp placement is verified end-to-end in Node
  (`src/lib/export.test.ts`).

## Deployment

`npm run build` produces a fully static site in `dist/`. Deploy it anywhere:

- **GitHub Pages**: the included workflow (`.github/workflows/deploy.yml`)
  deploys on every push to `main` (enable Pages → "GitHub Actions" in repo
  settings once).
- **Netlify / Vercel / Cloudflare Pages**: build command `npm run build`,
  publish directory `dist`.

## Font licenses

Bundled fonts (see `src/assets/fonts/`):

- Noto Sans / Serif / Mono — SIL OFL (`OFL-Noto.txt`)
- Great Vibes, Shadows Into Light, Indie Flower — SIL OFL (`OFL-*.txt`)

[pdf.js]: https://github.com/mozilla/pdf.js
[pdf-lib]: https://github.com/Hopding/pdf-lib
