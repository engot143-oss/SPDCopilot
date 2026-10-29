# SPDCopilot

Two browser apps for sterile-processing supply work. Each one is a single HTML file. Contacts and inventory stay in the browser (`localStorage`). There is no build step.

## Enrique Surgical Instrument Inventory Tracker

`index.html` (repo root) is the inventory tracker: quantities, par levels, quote and order status, and a small rep address book. `sw.js` is an optional service worker that caches the page for offline use. It registers only when the page is opened over `http` or `https`.

Open `index.html` directly in a browser, or serve this folder and visit `/`.

## Supply Rep Database

`public/Rep_Database.html` is a searchable directory of supplier representatives. You can type a contact, or photograph a business card or an email screenshot and fill the form from the text. `docs/REP_DATABASE_CHANGES.md` describes the email-screenshot parser. `public/Rep_Database.original.html` is the untouched original, kept for provenance.

Open `public/Rep_Database.html` in a browser. Search and manual entry work on their own. Real OCR needs Tesseract files in `public/ocr/` (that folder was not included). The page loads them from `/ocr/tesseract.min.js`, `/ocr/worker.min.js`, `/ocr/core`, and `/ocr/lang`, so a local server or Pages site has to serve those files at `/ocr/`.

From the repo root, compare the original and updated parsers:

```bash
node tests/parse-test.mjs
```

## GitHub Pages

In the repo on GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**. Choose branch **main** and folder **/ (root)**, then save.

The inventory tracker is the site root. The rep database is at `public/Rep_Database.html` on that same site.
