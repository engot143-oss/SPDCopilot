# CHANGES — email-screenshot OCR fix
File: public/Rep_Database.html (only the parsing section; ~35 lines added before `parseInfo`).

Added:
- `looksLikeEmail(text)`: needs 2+ email signals (From:/To:/Subject:/Date: headers, `<addr@domain>`, Reply/Forward/Inbox/"wrote:", greeting line, closing line like "Best regards,").
- `parseEmailInfo(text)`: name/email from the From header (or a `Name <email>` line); otherwise from the signature block after the last closing line. Phone and company come from the signature. If there's no company, it uses the email domain (skipped for gmail/yahoo/outlook/icloud and similar). It ignores greetings, message text, headers, and app buttons. Uncertain fields stay blank. The Key Surgical rule is kept.
- `parseInfo` now starts with `if(looksLikeEmail(text))return parseEmailInfo(text);`. The rest of the function is unchanged, so business-card results stay the same.

Unchanged: storage key `supplyRepDatabase_v1`, seeded contacts, dedupe/merge, form fields, CSS/iPhone layout, photo never saved.
Tests: `node tests/parse-test.mjs` (compares original vs fixed).

Publication fixes: bundled pinned Tesseract assets, page-relative OCR paths, safe contact-action event listeners, and offline caching. See README.md and public/ocr/ASSETS.json.
