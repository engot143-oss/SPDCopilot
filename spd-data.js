/* Shared backup and rep-import helpers. Classic script in the browser (window.SPDData); CommonJS in node tests. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SPDData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var BACKUP_KEYS = [
    "surgicalInventory.v1",
    "surgicalInventory.reps.v1",
    "supplyRepDatabase_v1",
    "surgicalCopilot.idLog.v1"
  ];
  var SETTINGS_KEY = "surgicalCopilot.idSettings.v1";
  var FIELD_MAP = [
    ["name", "repName"],
    ["phone", "repPhone"],
    ["email", "repEmail"],
    ["notes", "notes"]
  ];

  function companyKey(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().toLowerCase();
  }

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function cloneRow(row) {
    var out = {};
    if (row && typeof row === "object") {
      for (var key in row) {
        if (Object.prototype.hasOwnProperty.call(row, key)) out[key] = row[key];
      }
    }
    return out;
  }

  function mergeRepContacts(existingReps, databaseContacts, idFactory) {
    var existing = Array.isArray(existingReps) ? existingReps : [];
    var incoming = Array.isArray(databaseContacts) ? databaseContacts : [];
    var makeId = typeof idFactory === "function" ? idFactory : function () {
      return "rep-" + Math.random().toString(36).slice(2, 10);
    };
    var reps = existing.map(cloneRow);
    var byCompany = Object.create(null);
    var i, key, row;
    for (i = 0; i < reps.length; i++) {
      key = companyKey(reps[i] && reps[i].company);
      if (key && !byCompany[key]) byCompany[key] = reps[i];
    }
    var kept = [];
    var skipped = 0;
    for (i = 0; i < incoming.length; i++) {
      var contact = incoming[i];
      if (!contact || typeof contact !== "object") { skipped++; continue; }
      var company = text(contact.company);
      key = companyKey(company);
      if (!key) { skipped++; continue; }
      var target = byCompany[key];
      if (!target) {
        target = { id: makeId(), company: company, repName: "", repPhone: "", repEmail: "", notes: "" };
        reps.push(target);
        byCompany[key] = target;
      }
      // A company can have several people. Never mix their contact details.
      var sameName = companyKey(target.repName) === companyKey(contact.name);
      var sameEmail = text(target.repEmail) && companyKey(target.repEmail) === companyKey(contact.email);
      if ((text(target.repName) && text(contact.name) && !sameName) ||
          (text(target.repEmail) && text(contact.email) && !sameEmail) ||
          (text(target.repName) && !text(contact.name) && !sameEmail)) {
        kept.push({ company: company, field: "contact", existing: text(target.repName), incoming: text(contact.name) });
        skipped++;
        continue;
      }
      for (var f = 0; f < FIELD_MAP.length; f++) {
        var next = text(contact[FIELD_MAP[f][0]]);
        var dest = FIELD_MAP[f][1];
        if (!next) continue;
        var current = text(target[dest]);
        if (current) {
          if (companyKey(current) !== companyKey(next)) {
            kept.push({ company: text(target.company), field: dest, existing: current, incoming: next });
          }
          continue;
        }
        target[dest] = next;
      }
    }
    var originalBy = Object.create(null);
    for (i = 0; i < existing.length; i++) {
      key = companyKey(existing[i] && existing[i].company);
      if (key && !originalBy[key]) originalBy[key] = existing[i];
    }
    var added = [];
    var filled = [];
    for (i = 0; i < reps.length; i++) {
      row = reps[i];
      key = companyKey(row.company);
      var prev = originalBy[key];
      if (!prev) {
        added.push({
          company: text(row.company),
          repName: text(row.repName),
          repPhone: text(row.repPhone),
          repEmail: text(row.repEmail),
          notes: text(row.notes)
        });
        continue;
      }
      var fields = [];
      for (var p = 0; p < FIELD_MAP.length; p++) {
        dest = FIELD_MAP[p][1];
        if (!text(prev[dest]) && text(row[dest])) fields.push({ field: dest, value: text(row[dest]) });
      }
      if (fields.length) filled.push({ company: text(prev.company || row.company), fields: fields });
    }
    return {
      reps: reps,
      summary: { added: added, filled: filled, kept: kept, skipped: skipped }
    };
  }

  function assertList(key, value) {
    if (value !== null && !Array.isArray(value)) throw new Error(key + " must be a list.");
  }

  function validateList(key, value) {
    assertList(key, value);
    if (value === null) return;
    value.forEach(function (row) {
      if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(key + " has an invalid record.");
      if (row.id !== undefined && (typeof row.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(row.id))) throw new Error(key + " has an invalid record ID.");
      function inspect(obj, depth) {
        if (depth > 12) throw new Error("Backup records are too deeply nested.");
        Object.keys(obj).forEach(function (field) {
          if (["__proto__", "constructor", "prototype", "apiKey"].indexOf(field) !== -1) throw new Error("Backup contains a forbidden field.");
          var v = obj[field];
          if (v && typeof v === "object") inspect(v, depth + 1);
        });
      }
      inspect(row, 0);
      if (key !== "surgicalCopilot.idLog.v1") Object.keys(row).forEach(function (field) {
        if (row[field] !== null && typeof row[field] === "object") throw new Error(key + " has an invalid field.");
      });
      var strings = ["company", "name", "email", "phone", "specialty", "repName", "repPhone", "repEmail", "notes", "instrumentName", "instrumentType", "distributor"];
      strings.forEach(function (field) { if (row[field] !== undefined && typeof row[field] !== "string") throw new Error(key + " has an invalid " + field + "."); });
      if (key === "surgicalCopilot.idLog.v1") {
        if (row.ai !== undefined && (!row.ai || typeof row.ai !== "object" || Array.isArray(row.ai))) throw new Error("Invalid identification result.");
        if (row.correction !== undefined && row.correction !== null && (typeof row.correction !== "object" || Array.isArray(row.correction))) throw new Error("Invalid correction.");
        if (row.thumbnail && (typeof row.thumbnail !== "string" || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(row.thumbnail) || row.thumbnail.length > 70000)) throw new Error("Invalid thumbnail.");
      }
    });
  }

  function restoreBackup(storage, parsed) {
    // Keep a recovery copy until all four stores have been written successfully.
    var journalKey = "surgicalCopilot.restoreRecovery.v1";
    if (storage.getItem(journalKey)) throw new Error("A previous restore needs recovery. Open Home and export its recovery copy before continuing.");
    var previous = {}, next = {};
    BACKUP_KEYS.forEach(function (key) {
      validateList(key, parsed.data[key]);
      if (Array.isArray(parsed.data[key])) {
        previous[key] = storage.getItem(key);
        next[key] = JSON.stringify(parsed.data[key]);
      }
    });
    storage.setItem(journalKey, JSON.stringify(previous));
    try {
      Object.keys(next).forEach(function (key) { storage.setItem(key, next[key]); });
    } catch (error) {
      // Remove partial writes first to free space for the previous values.
      try {
        Object.keys(previous).forEach(function (key) { storage.removeItem(key); });
        Object.keys(previous).forEach(function (key) { if (previous[key] !== null) storage.setItem(key, previous[key]); });
        storage.removeItem(journalKey);
      } catch (rollbackError) {
        throw new Error("Restore stopped. A recovery copy remains on this device; do not edit data or clear browser storage. Export the recovery copy below.");
      }
      throw new Error("Restore failed. Your previous data was restored. Free some browser storage and try again.");
    }
    storage.removeItem(journalKey);
  }

  function buildBackup(stores, exportedAt) {
    if (typeof exportedAt !== "string" || !exportedAt.trim()) throw new Error("A backup needs a timestamp.");
    var bag = stores && typeof stores === "object" && !Array.isArray(stores) ? stores : {};
    var data = {};
    for (var i = 0; i < BACKUP_KEYS.length; i++) {
      var key = BACKUP_KEYS[i];
      var value = Object.prototype.hasOwnProperty.call(bag, key) && bag[key] !== undefined ? bag[key] : null;
      validateList(key, value);
      data[key] = value === null ? null : value.slice();
    }
    return {
      app: "spdCopilot",
      kind: "backup",
      version: 1,
      exportedAt: exportedAt,
      keys: BACKUP_KEYS.slice(),
      data: data
    };
  }

  function parseBackup(input) {
    var root = input;
    if (typeof input === "string") {
      try { root = JSON.parse(input); }
      catch (e) { throw new Error("The file is not valid JSON."); }
    }
    if (!root || typeof root !== "object" || Array.isArray(root)) throw new Error("The backup file is not a JSON object.");
    if (!root.data || typeof root.data !== "object" || Array.isArray(root.data)) throw new Error("The backup file has no data object.");
    var data = {};
    for (var i = 0; i < BACKUP_KEYS.length; i++) {
      var key = BACKUP_KEYS[i];
      if (!Object.prototype.hasOwnProperty.call(root.data, key) || root.data[key] === null) {
        data[key] = null;
        continue;
      }
      validateList(key, root.data[key]);
      data[key] = root.data[key];
    }
    return {
      app: "spdCopilot",
      kind: "backup",
      version: 1,
      exportedAt: typeof root.exportedAt === "string" ? root.exportedAt : "",
      keys: BACKUP_KEYS.slice(),
      data: data
    };
  }

  return {
    BACKUP_KEYS: BACKUP_KEYS.slice(),
    SETTINGS_KEY: SETTINGS_KEY,
    companyKey: companyKey,
    mergeRepContacts: mergeRepContacts,
    buildBackup: buildBackup,
    validateList: validateList,
    restoreBackup: restoreBackup,
    parseBackup: parseBackup
  };
});
