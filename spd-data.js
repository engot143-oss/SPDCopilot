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
    var byCompany = {};
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
    var originalBy = {};
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

  function buildBackup(stores, exportedAt) {
    if (typeof exportedAt !== "string" || !exportedAt.trim()) throw new Error("A backup needs a timestamp.");
    var bag = stores && typeof stores === "object" && !Array.isArray(stores) ? stores : {};
    var data = {};
    for (var i = 0; i < BACKUP_KEYS.length; i++) {
      var key = BACKUP_KEYS[i];
      var value = Object.prototype.hasOwnProperty.call(bag, key) && bag[key] !== undefined ? bag[key] : null;
      assertList(key, value);
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
      assertList(key, root.data[key]);
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
    parseBackup: parseBackup
  };
});
