# SPDCopilot

Two browser apps for sterile-processing supply work. Each one is a single HTML file. Contacts and inventory stay in the browser (`localStorage`). There is no build step.

## Enrique Surgical Instrument Inventory Tracker

`index.html` (repo root) is the inventory tracker: quantities, par levels, quote and order status, and a small rep address book. The header links to `identify.html`, which identifies one instrument from the rear camera or an uploaded photo. `sw.js` is an optional service worker that caches `index.html` and `identify.html` for offline use. It registers only when the page is opened over `http` or `https`.

Open `index.html` directly in a browser, or serve this folder and visit `/`.

### Instrument identification

Open `identify.html` (or tap Identify on the inventory page). The live camera uses the rear camera and needs HTTPS, which GitHub Pages provides. On an iPhone, tap Start camera and allow the prompt. Upload a photo if the camera is unavailable. The hint on the camera is: place one instrument on a plain, light background.

Identification sends that photo to an OpenAI-compatible chat-completions endpoint. In Settings, paste your own API key and set the base URL and model. Presets fill the URL and model for OpenAI, xAI, and OpenRouter. The key stays in `localStorage` on that device (`surgicalCopilot.idSettings.v1`). It is not part of this repository, it is not logged, and it is sent only to the endpoint you set. Without a key, Use demo shows a canned result so the screens can be tried.

The model is asked for strict JSON (`name`, `category`, `likely_patterns`, `estimated_length_cm`, `key_features_seen`, `confidence`, `top_3_alternatives`) and is told not to guess a catalog number. Mark the result Correct or Wrong (pick an alternative or type the right name), or Retake. A close fuzzy match on `instrumentName` or `instrumentType` in `surgicalInventory.v1` offers Open in inventory. Otherwise Add to inventory prefills the name and type and leaves the catalog number blank.

Feedback is stored in `surgicalCopilot.idLog.v1`: the model answer, your correction, a timestamp, and a small thumbnail only when that thumbnail is under 50KB. The log screen shows an accuracy summary and exports CSV. Do not photograph patient labels. The page does not store patient information. The banner on the page is a reminder to verify against the count sheet and the IFU.

```bash
node tests/identify-test.mjs
```

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
