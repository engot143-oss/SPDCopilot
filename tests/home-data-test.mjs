import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPD = require(path.join(root, "spd-data.js"));

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log("ok", name);
}

function ids() {
  let n = 0;
  return function () { n += 1; return "new-" + n; };
}

check("adds a company and fills only empty address-book fields", () => {
  const existing = [{ id: "k1", company: "Aesculap", repName: "Hayley Dent", repPhone: "", repEmail: "hayley.dent@aesculapusa.com", notes: "Do not replace" }];
  const before = JSON.stringify(existing);
  const incoming = [{
    id: "r2", company: "AESCULAP", name: "Hayley Dent", title: "Specialist", specialty: "Healthcare Solutions",
    phone: "206-573-3332", email: "hayley.dent@aesculapusa.com", notes: "from card"
  }];
  const result = SPD.mergeRepContacts(existing, incoming, ids());
  assert.equal(JSON.stringify(existing), before);
  assert.equal(result.reps.length, 1);
  assert.equal(result.reps[0].company, "Aesculap");
  assert.equal(result.reps[0].repName, "Hayley Dent");
  assert.equal(result.reps[0].repPhone, "206-573-3332");
  assert.equal(result.reps[0].repEmail, "hayley.dent@aesculapusa.com");
  assert.equal(result.reps[0].notes, "Do not replace");
  assert.equal(result.summary.added.length, 0);
  assert.deepEqual(result.summary.filled, [{ company: "Aesculap", fields: [{ field: "repPhone", value: "206-573-3332" }] }]);
  const keptFields = result.summary.kept.map((row) => row.field).sort();
  assert.deepEqual(keptFields, ["notes"]);
});

check("creates one address-book row per company and does not overwrite a filled name", () => {
  const incoming = [
    { company: "KARL STORZ", name: "Oscar Villa", phone: "", email: "oscar.villa@karlstorz.com", notes: "" },
    { company: "Karl Storz", name: "Geoff Cooper", phone: "253-549-8466", email: "geoff.cooper@karlstorz.com", notes: "second" }
  ];
  const result = SPD.mergeRepContacts([], incoming, ids());
  assert.equal(result.reps.length, 1);
  assert.equal(result.reps[0].id, "new-1");
  assert.equal(result.reps[0].company, "KARL STORZ");
  assert.equal(result.reps[0].repName, "Oscar Villa");
  assert.equal(result.reps[0].repPhone, "");
  assert.equal(result.reps[0].repEmail, "oscar.villa@karlstorz.com");
  assert.equal(result.reps[0].notes, "");
  assert.equal(result.summary.added.length, 1);
  assert.equal(result.summary.filled.length, 0);
  assert.ok(result.summary.kept.some((row) => row.field === "contact" && row.incoming === "Geoff Cooper"));
  assert.equal(result.summary.skipped, 1);
});

check("skips contacts with no company and matches companies that differ only by spacing", () => {
  const existing = [{ id: "1", company: "Key Surgical / STERIS", repName: "", repPhone: "", repEmail: "", notes: "" }];
  const result = SPD.mergeRepContacts(existing, [
    { company: "  ", name: "Nobody" },
    { company: "Key   Surgical / STERIS", name: "Jason Karrmann", phone: "952-767-7372", email: "" }
  ], ids());
  assert.equal(result.summary.skipped, 1);
  assert.equal(result.reps.length, 1);
  assert.equal(result.reps[0].repName, "Jason Karrmann");
  assert.equal(result.reps[0].repPhone, "952-767-7372");
  assert.equal(result.summary.added.length, 0);
});

check("backup includes the four data keys and leaves out the API settings", () => {
  const secret = "sk-secret-value-should-not-export";
  const instruments = [{ instrumentName: "Adson Forceps" }];
  const backup = SPD.buildBackup({
    "surgicalInventory.v1": instruments,
    "surgicalInventory.reps.v1": [],
    "supplyRepDatabase_v1": [{ company: "Acme", name: "Ann" }],
    "surgicalCopilot.idLog.v1": [{ ai: { name: "Mayo Scissors" } }],
    "surgicalCopilot.idSettings.v1": { apiKey: secret, baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" }
  }, "2026-10-29T03:04:05.000Z");
  const encoded = JSON.stringify(backup);
  assert.equal(encoded.includes(secret), false);
  assert.equal(encoded.includes("idSettings"), false);
  assert.equal(encoded.includes("apiKey"), false);
  assert.deepEqual(backup.keys, SPD.BACKUP_KEYS);
  assert.equal(SPD.BACKUP_KEYS.includes(SPD.SETTINGS_KEY), false);
  assert.equal(backup.exportedAt, "2026-10-29T03:04:05.000Z");
  assert.equal(backup.data["surgicalInventory.v1"][0].instrumentName, "Adson Forceps");
  assert.equal(backup.data["supplyRepDatabase_v1"][0].company, "Acme");
  backup.data["surgicalInventory.v1"].push({ instrumentName: "changed after export" });
  assert.equal(instruments.length, 1);
});

check("backup round trip drops a smuggled settings key and rejects bad JSON", () => {
  const backup = SPD.buildBackup({
    "surgicalInventory.v1": [],
    "surgicalInventory.reps.v1": [{ company: "Acme", repName: "Ann" }],
    "supplyRepDatabase_v1": null,
    "surgicalCopilot.idLog.v1": []
  }, "2026-10-29T00:00:00.000Z");
  const smuggled = JSON.parse(JSON.stringify(backup));
  smuggled.data["surgicalCopilot.idSettings.v1"] = { apiKey: "sk-smuggled" };
  smuggled.data.extra = [{ apiKey: "nope" }];
  const parsed = SPD.parseBackup(JSON.stringify(smuggled));
  assert.equal(JSON.stringify(parsed).includes("sk-smuggled"), false);
  assert.equal(JSON.stringify(parsed).includes("idSettings"), false);
  assert.equal(parsed.data["surgicalInventory.reps.v1"][0].repName, "Ann");
  assert.equal(parsed.data["supplyRepDatabase_v1"], null);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed.data, "extra"), false);
  assert.throws(() => SPD.parseBackup("{"), /valid JSON/);
  assert.throws(() => SPD.parseBackup({ data: { "surgicalInventory.v1": { not: "a list" } } }), /must be a list/);
  assert.throws(() => SPD.parseBackup([]), /JSON object/);
  assert.throws(() => SPD.buildBackup({ "surgicalInventory.v1": {} }, "2026-10-29T00:00:00.000Z"), /must be a list/);
});

check("home, manifest, and service worker are wired without icon files", () => {
  const home = fs.readFileSync(path.join(root, "home.html"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const identify = fs.readFileSync(path.join(root, "identify.html"), "utf8");
  const reps = fs.readFileSync(path.join(root, "public/Rep_Database.html"), "utf8");
  assert.equal(manifest.start_url, "home.html");
  assert.equal(manifest.display, "standalone");
  assert.equal(Object.prototype.hasOwnProperty.call(manifest, "icons"), false);
  assert.ok(home.includes('href="index.html"'));
  assert.ok(home.includes('href="identify.html"'));
  assert.ok(home.includes('href="public/Rep_Database.html"'));
  assert.ok(home.includes("manifest.webmanifest"));
  assert.ok(sw.includes("./home.html"));
  assert.ok(sw.includes("./identify.html"));
  assert.ok(index.includes('href="home.html"'));
  assert.ok(index.includes("Import from Rep Database"));
  assert.ok(index.includes("supplyRepDatabase_v1"));
  assert.ok(identify.includes('href="home.html"'));
  assert.ok(reps.includes('href="../home.html"'));
  assert.equal(reps.includes("function parseEmailInfo"), true);
});

check("rejects malformed rows and injected IDs before restore", () => {
  for (const row of [null, [], {id:"x\" onclick=\"alert(1)"}, {company:{bad:true}}]) {
    assert.throws(() => SPD.parseBackup({data:{"supplyRepDatabase_v1":[row]}}), /invalid/);
  }
});
check("restore rolls back a partial write and leaves settings untouched", () => {
  const before={"surgicalInventory.v1":'[1]',"surgicalInventory.reps.v1":'[2]',"surgicalCopilot.idSettings.v1":'keep-key'};
  const bag={...before};let fail=true;
  const storage={getItem:k=>bag[k]??null,removeItem:k=>{delete bag[k]},setItem(k,v){if(k==="surgicalInventory.reps.v1"&&v==="[]"&&fail){fail=false;throw Error("quota")}bag[k]=v}};
  const backup=SPD.buildBackup({"surgicalInventory.v1":[],"surgicalInventory.reps.v1":[]},"now");
  assert.throws(()=>SPD.restoreBackup(storage,backup),/previous data was restored/);
  assert.deepEqual(bag,before);
  SPD.restoreBackup(storage,backup);
  assert.equal(bag["surgicalInventory.v1"],"[]");assert.equal(bag[SPD.SETTINGS_KEY],"keep-key");
});
check("storage failure before recovery copy leaves all stores unchanged",()=>{
  let writes=0;
  const storage={getItem:k=>k==="surgicalCopilot.restoreRecovery.v1"?null:"old",setItem(){writes++;throw Error("quota")}};
  assert.throws(()=>SPD.restoreBackup(storage,SPD.buildBackup({"surgicalInventory.v1":[]},"now")),/quota/);
  assert.equal(writes,1);
});
console.log(passed + " passed");
