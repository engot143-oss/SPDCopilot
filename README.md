# SPDCopilot

Browser tools for sterile-processing supply work. Each page is plain HTML. Contacts and inventory stay in the browser (`localStorage`). There is no build step and no server.

## Home

`home.html` links to the inventory tracker, instrument identification, and the rep database. Each of those pages has a Home link. `manifest.webmanifest` lets iPhone Safari add the hub to the Home Screen (Share, then Add to Home Screen). There is no separate icon image; the installed icon opens `home.html`.

The same page exports one JSON backup of `surgicalInventory.v1`, `surgicalInventory.reps.v1`, `supplyRepDatabase_v1`, and `surgicalCopilot.idLog.v1`, then shows the last backup time. Import backup checks the JSON and replaces those lists only after confirmation. The identification API key (`surgicalCopilot.idSettings.v1`) is not exported or restored.

`sw.js` caches `home.html`, `identify.html`, the inventory page, the Rep Database, the small `spd-data.js` helper, and bundled OCR assets after the initial download finishes. It registers only over `http` or `https`.

## Enrique Surgical Instrument Inventory Tracker

`index.html` (repo root) is the inventory tracker: quantities, par levels, quote and order status, and a small rep address book. The header also links to Identify and Home.

On the Reps tab, Import from Rep Database reads `supplyRepDatabase_v1` and merges contacts into `surgicalInventory.reps.v1`. Each representative becomes their own address-book row (matched by company plus name or email). A preview lists new representatives and empty fields that would be filled. Names, phones, emails, and notes that already have text are left as they are. On GitHub Pages the pages share one origin, so both apps see the same `localStorage`.

Open `index.html` directly in a browser, or serve this folder and visit `/`. The site root stays the inventory tracker. Use `home.html` for the hub.

### Instrument identification

Open `identify.html` (or tap Identify on the inventory page). The live camera uses the rear camera and needs HTTPS, which GitHub Pages provides. On an iPhone, tap Start camera and allow the prompt. Upload a photo if the camera is unavailable. The hint on the camera is: place one instrument on a plain, light background.

Identification sends that photo to an OpenAI-compatible chat-completions endpoint. In Settings, paste your own API key and set the base URL and model. Presets fill the URL and model for OpenAI, xAI, and OpenRouter. The key stays in `localStorage` on that device (`surgicalCopilot.idSettings.v1`). It is not part of this repository, it is not logged, and it is sent only to the endpoint you set. Without a key, Use demo shows a canned result so the screens can be tried.

The model is asked for strict JSON (`name`, `category`, `likely_patterns`, `estimated_length_cm`, `key_features_seen`, `confidence`, `top_3_alternatives`) and is told not to guess a catalog number. Mark the result Correct or Wrong (pick an alternative or type the right name), or Retake. A close fuzzy match on `instrumentName` or `instrumentType` in `surgicalInventory.v1` offers Open in inventory. Otherwise Add to inventory prefills the name and type and leaves the catalog number blank.

Feedback is stored in `surgicalCopilot.idLog.v1`: the model answer, your correction, a timestamp. New entries do not store photo thumbnails; older thumbnails may remain in existing logs and backups. The log screen shows an accuracy summary and exports CSV. Do not photograph patient labels. Photos are sent to the selected provider for live identification and are not automatically redacted. Changing the endpoint clears the old key unless a replacement is entered. The banner on the page is a reminder to verify against the count sheet and the IFU.

```bash
node tests/identify-test.mjs
node tests/home-data-test.mjs
```

## Supply Rep Database

`public/Rep_Database.html` is a searchable directory of supplier representatives. You can type a contact, or photograph a business card or an email screenshot and fill the form from the text. `docs/REP_DATABASE_CHANGES.md` describes the email-screenshot parser. `public/Rep_Database.original.html` is the untouched original, kept for provenance.

Open `public/Rep_Database.html` in a browser. Search and manual entry work on their own. Real OCR uses the bundled, free Tesseract.js 5.1.1 / core 5.1.1 engine and English language data in `public/ocr/`. Paths are relative to the Rep Database page, including on GitHub Pages. The service worker caches these files for offline use. Sources, integrity hashes, and licenses are included in that folder.

From the repo root, compare the original and updated parsers:

```bash
node tests/parse-test.mjs
```

## GitHub Pages

In the repo on GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**. Choose branch **main** and folder **/ (root)**, then save.

The inventory tracker is the site root. Open `home.html` on that site for the hub. The rep database is at `public/Rep_Database.html`. Add to Home Screen uses `home.html`.


## Import safety

Imports validate records before writing. Hub restores and inventory imports keep a recovery copy and roll back on storage failure. If recovery cannot finish, stop editing and use the Home page’s Export recovery copy button; do not clear browser storage. API settings are never restored. Import only backups you trust.
