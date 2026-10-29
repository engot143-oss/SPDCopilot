import fs from "fs";
import path from "path";
import assert from "node:assert/strict";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "identify.html"), "utf8");
const block = html.match(/\/\* @id-core \*\/([\s\S]*?)\/\* @id-core-end \*\//);
assert.ok(block, "identify core block not found");
const api = new Function(block[1] + "\nreturn { normalizeLabel, parseIdentificationJson, extractMessageText, fuzzyMatchInstruments, completionsUrl, demoIdentification, feedbackCsv, accuracyFromLog };")();

const { parseIdentificationJson, extractMessageText, fuzzyMatchInstruments, completionsUrl, demoIdentification, feedbackCsv, accuracyFromLog } = api;

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log("ok", name);
}

check("parses a raw JSON object and drops catalog and patient fields", () => {
  const parsed = parseIdentificationJson('{"name":"Adson Forceps","category":"Forceps","likely_patterns":["toothed tip"],"estimated_length_cm":"12 cm","key_features_seen":"fine teeth","confidence":"80%","top_3_alternatives":["Brown-Adson","Cushing","Adson","Extra"],"catalog_number":"AF-1","patient_name":"Jane Doe","mrn":"99"}');
  assert.deepEqual(Object.keys(parsed).sort(), ["category", "confidence", "estimated_length_cm", "key_features_seen", "likely_patterns", "name", "top_3_alternatives"]);
  assert.equal(parsed.name, "Adson Forceps");
  assert.equal(parsed.confidence, 0.8);
  assert.equal(parsed.estimated_length_cm, 12);
  assert.deepEqual(parsed.key_features_seen, ["fine teeth"]);
  assert.equal(parsed.top_3_alternatives.length, 3);
  assert.equal(parsed.top_3_alternatives[0].name, "Brown-Adson");
  assert.equal(JSON.stringify(parsed).includes("Jane"), false);
  assert.equal(JSON.stringify(parsed).includes("AF-1"), false);
});

check("parses fenced JSON with a brace inside a string and trailing prose", () => {
  const text = "Here you go:\n```json\n{\"name\":\"Forceps {curved}\",\"category\":\"Forceps\",\"confidence\":1.4,\"estimated_length_cm\":null,\"key_features_seen\":[{\"feature\":\"rings\"}],\"top_3_alternatives\":[{\"name\":\"Kelly Clamp\",\"category\":\"Clamp\",\"confidence\":0.2}]}\n```\nThanks }";
  const parsed = parseIdentificationJson(text);
  assert.equal(parsed.name, "Forceps {curved}");
  assert.equal(parsed.confidence, 1);
  assert.equal(parsed.estimated_length_cm, null);
  assert.deepEqual(parsed.key_features_seen, ["rings"]);
  assert.equal(parsed.top_3_alternatives[0].category, "Clamp");
});

check("clamps confidence and rejects a missing name", () => {
  assert.equal(parseIdentificationJson({ name: "X", confidence: -3 }).confidence, 0);
  assert.equal(parseIdentificationJson({ name: "X", confidence: 150 }).confidence, 1);
  assert.equal(parseIdentificationJson({ name: "X", confidence: "0.25" }).confidence, 0.25);
  assert.throws(() => parseIdentificationJson("not json"), /JSON/);
  assert.throws(() => parseIdentificationJson({ category: "Forceps" }), /name/);
});

check("reads chat-completions message text", () => {
  const fenced = "```json\n{\"name\":\"Yankauer\",\"category\":\"Suction\",\"confidence\":0.4}\n```";
  const fromArray = extractMessageText({ choices: [{ message: { content: [{ type: "text", text: fenced }] } }] });
  assert.equal(parseIdentificationJson(fromArray).name, "Yankauer");
  assert.throws(() => extractMessageText({ error: { message: "bad key" } }), /bad key/);
  assert.throws(() => extractMessageText({ choices: [] }), /no choices/);
});

check("demo result is the canned example without hidden fields", () => {
  const demo = demoIdentification();
  assert.equal(demo.name, "Mayo Scissors");
  assert.equal(demo.category, "Scissors");
  assert.equal(demo.confidence, 0.62);
  assert.equal(demo.top_3_alternatives.length, 3);
  assert.equal(JSON.stringify(demo).includes("DO-NOT-KEEP"), false);
});

const inventory = [
  { id: "1", instrumentName: "Adson Forceps", instrumentType: "Forceps", catalogNumber: "AF-1" },
  { id: "2", instrumentName: "Adson Tissue Forceps", instrumentType: "Forceps" },
  { id: "3", instrumentName: "Metzenbaum Scissors", instrumentType: "Scissors" },
  { id: "4", instrumentName: "Mayo-Hegar Needle Holder", instrumentType: "Needle Holder" },
  { id: "5", instrumentName: "Richardson Retractor", instrumentType: "Retractor" },
  { id: "6", instrumentName: "Knife Handle", instrumentType: "Knife Handle", catalogNumber: "KH-003" }
];

check("fuzzy match prefers the instrument name and keeps close variants", () => {
  const hits = fuzzyMatchInstruments({ name: "Adson Forceps", category: "Forceps" }, inventory);
  assert.equal(hits[0].instrument.id, "1");
  assert.equal(hits[0].score, 1);
  assert.equal(hits[0].matchedOn, "instrumentName");
  assert.ok(hits.some((h) => h.instrument.id === "2"));
  assert.equal(hits.some((h) => h.instrument.id === "3"), false);
});

check("fuzzy match tolerates punctuation and a one-character typo", () => {
  const needle = fuzzyMatchInstruments({ name: "Mayo Hegar Needle Holder", category: "Needle Holder" }, inventory);
  assert.equal(needle[0].instrument.id, "4");
  assert.equal(needle[0].score, 1);
  const typo = fuzzyMatchInstruments({ name: "adsn forceps", category: "" }, inventory);
  assert.equal(typo[0].instrument.id, "1");
  assert.ok(typo[0].score >= 0.72);
});

check("fuzzy match can use instrument type and ignores catalog numbers", () => {
  const byType = fuzzyMatchInstruments({ name: "Retractor", category: "Retractor" }, [
    { id: "r", instrumentName: "Richardson", instrumentType: "Retractor" }
  ]);
  assert.equal(byType.length, 1);
  assert.equal(byType[0].matchedOn, "instrumentType");
  const byCatalog = fuzzyMatchInstruments({ name: "KH-003", category: "" }, inventory);
  assert.deepEqual(byCatalog, []);
  const different = fuzzyMatchInstruments({ name: "Metzenbaum Scissors", category: "Scissors" }, [
    { instrumentName: "Mayo Scissors", instrumentType: "Scissors" },
    { instrumentName: "Richardson Retractor", instrumentType: "Retractor" }
  ]);
  assert.deepEqual(different, []);
});

check("fuzzy match rejects empty input and honors a higher threshold", () => {
  assert.deepEqual(fuzzyMatchInstruments({ name: "", category: "Scissors" }, inventory), []);
  assert.deepEqual(fuzzyMatchInstruments({ name: "Adson Forceps" }, null), []);
  const strict = fuzzyMatchInstruments({ name: "Adson Forceps", category: "Forceps" }, inventory, 0.99);
  assert.deepEqual(strict.map((h) => h.instrument.id), ["1"]);
  assert.ok(fuzzyMatchInstruments({ name: "Adson Forceps", category: "Forceps" }, inventory).some((h) => h.instrument.id === "2"));
});

check("builds an endpoint URL without query secrets and allows local http", () => {
  assert.equal(completionsUrl("https://api.openai.com/v1"), "https://api.openai.com/v1/chat/completions");
  assert.equal(completionsUrl("https://api.openai.com/v1/chat/completions/"), "https://api.openai.com/v1/chat/completions");
  assert.equal(completionsUrl("https://api.x.ai/v1"), "https://api.x.ai/v1/chat/completions");
  assert.equal(completionsUrl("https://openrouter.ai/api/v1/"), "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(completionsUrl("http://127.0.0.1:11434/v1"), "http://127.0.0.1:11434/v1/chat/completions");
  const stripped = completionsUrl("https://user:secret@api.openai.com/v1?api_key=abc#frag");
  assert.equal(stripped, "https://api.openai.com/v1/chat/completions");
  assert.equal(stripped.includes("secret"), false);
  assert.equal(stripped.includes("abc"), false);
  assert.throws(() => completionsUrl("http://example.com/v1"), /https/);
  assert.throws(() => completionsUrl("not a url"), /valid URL/);
});

check("csv and accuracy use the correction and omit the thumbnail and key", () => {
  const log = [
    { timestamp: "2026-10-29T00:00:00.000Z", source: "demo", ai: demoIdentification(), correction: { verdict: "correct", name: "Mayo Scissors" }, thumbnail: "data:image/jpeg;base64,AAAA", apiKey: "should-not-export" },
    { timestamp: "2026-10-29T00:01:00.000Z", source: "model", ai: { name: "=cmd", category: "Forceps, fine", confidence: 0.5, likely_patterns: [], key_features_seen: [], estimated_length_cm: null, top_3_alternatives: [] }, correction: { verdict: "wrong", name: "Adson, plain" }, thumbnail: "nope" },
    { timestamp: "2026-10-29T00:02:00.000Z", source: "model", ai: { name: "Ignored" }, correction: null }
  ];
  const csv = feedbackCsv(log);
  assert.equal(csv.includes("thumbnail"), false);
  assert.equal(csv.includes("should-not-export"), false);
  assert.equal(csv.includes("AAAA"), false);
  assert.ok(csv.includes("'=cmd"));
  assert.ok(csv.includes('"Forceps, fine"'));
  assert.ok(csv.includes('"Adson, plain"'));
  const summary = accuracyFromLog(log);
  assert.equal(summary.reviewed, 2);
  assert.equal(summary.correct, 1);
  assert.equal(summary.wrong, 1);
  assert.equal(summary.demo, 1);
  assert.equal(summary.accuracy, 0.5);
  assert.equal(accuracyFromLog([]).accuracy, null);
});

check("page wires the banner, storage keys, and service worker", () => {
  assert.ok(html.includes("Training and reference tool only. Always verify against the count sheet and IFU."));
  assert.ok(html.includes("Place one instrument on a plain, light background."));
  assert.ok(html.includes("surgicalCopilot.idLog.v1"));
  assert.ok(html.includes("surgicalCopilot.idSettings.v1"));
  assert.ok(html.includes("surgicalInventory.v1"));
  assert.ok(html.includes("does not automatically remove patient information"));
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  assert.ok(sw.includes("./identify.html"));
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(index.includes('href="identify.html"'));
});

console.log(passed + " passed");
