import assert from 'node:assert/strict';
import fs from 'fs';
const ex=f=>{const h=fs.readFileSync(f,'utf8');const js=h.split('<script>')[1].split('</script>')[0];const a=js.indexOf('function normalize'),b=js.indexOf('function withTimeout');
 const n=js.slice(a,js.indexOf('function save'));const p=js.slice(js.indexOf('function labeled'),b);return new Function(n+p+';return parseInfo')()};
const O=ex('public/Rep_Database.original.html'),N=ex('public/Rep_Database.html');
const cards=[`JOHN SMITH\nTerritory Sales Manager\nSTERIS CORPORATION\nPhone: (555) 123-4567\njohn.smith@steris.com\nwww.steris.com`,
`Maria Lopez\nRegional Account Executive\nKey Surgical\nmaria.lopez@keysurgical.com\nCell 612-555-0199`,
`ACME MEDICAL\nDavid Chen\nClinical Specialist\nProducts: Scopes, Brushes\nTel: 800.555.1212\nd.chen@acmemed.com`];
for(const c of cards){const a=JSON.stringify(O(c)),b=JSON.stringify(N(c));assert.equal(a,b,'Business-card parser changed');console.log('CARD SAME',b)}
const em=[`Inbox\nRe: Tray quote\nFrom: Sarah Johnson <sarah.johnson@medline.com>\nTo: Eric <eric@hospital.org>\nDate: Oct 27, 2026, 9:14 AM\nHi Eric,\nThanks for meeting with Our team today. Please let Me Know about the trays.\nBest regards,\nSarah Johnson\nTerritory Manager\nMedline Industries\nMobile: 312-555-0147\nsarah.johnson@medline.com\nReply  Forward`,
`Mike Brown <mbrown@healthmark.com>\nto me\nHello,\nAttached is the Instrument Care price list.\nThanks,\nMike Brown\nAccount Executive | Healthmark Industries\n(586) 555-0123`,
`From: Ken Ito <ken.ito@gmail.com>\nSubject: Follow Up\nGood morning,\nSee you Friday.\nRegards,\nKen Ito\nC: 415 555 0101`];
const expected=[['Sarah Johnson','Medline Industries','sarah.johnson@medline.com','312-555-0147'],['Mike Brown','Healthmark','mbrown@healthmark.com','586-555-0123'],['Ken Ito','','ken.ito@gmail.com','415-555-0101']];
for(const [i,e] of em.entries()){const r=N(e);assert.deepEqual([r.name,r.company,r.email,r.phone],expected[i]);console.log('EMAIL PASS',r.name)}
console.log('6 parser checks passed');
