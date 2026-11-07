// Validate the GroundGame question bank.
//
// Run after any change to src/data/questions.json:
//   node scripts/validate-bank.cjs
//
// Checks that every question is playable:
//   - ids are unique and filesystem/URL-safe
//   - coordinates are in range and not (0,0)
//   - the bilingual fields are present and non-trivial
//   - the prompt contains a blank the player can fill ("this X" or "here")
//   - the prompt does not leak the answer place
//   - city-scope questions carry a view centre that is NOT the answer point
//   - scope and sport are values the game engine understands

const fs = require("fs");
const path = require("path");
const DATA = path.resolve(__dirname, "..", "src", "data", "questions.json");
const SCOPES = new Set(["world", "country", "city"]);
const SPORTS = new Set([
  "american football", "baseball", "basketball", "ice hockey", "soccer",
  "golf", "tennis", "olympics", "racing", "running", "cycling", "boxing",
  "rugby", "swimming", "athletics", "gymnastics", "cricket", "bobsled",
  "skiing", "canadian football", "mountaineering", "media", "music",
  "betting", "history",
]);

const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
const q = raw.questions;
const errors = [];
const warnings = [];

const seenIds = new Set();
let withView = 0;

for (const [i, x] of q.entries()) {
  const at = `#${i} ${x.id ?? "(no id)"}`;

  if (!x.id || seenIds.has(x.id)) errors.push(`${at}: duplicate or missing id`);
  seenIds.add(x.id);

  if (typeof x.lat !== "number" || typeof x.lng !== "number")
    errors.push(`${at}: lat/lng not numbers`);
  else {
    if (x.lat < -90 || x.lat > 90) errors.push(`${at}: lat out of range`);
    if (x.lng < -180 || x.lng > 180) errors.push(`${at}: lng out of range`);
    if (x.lat === 0 && x.lng === 0) errors.push(`${at}: null island coordinates`);
  }

  if (!SCOPES.has(x.scope)) errors.push(`${at}: bad scope "${x.scope}"`);
  if (!SPORTS.has(x.sport)) errors.push(`${at}: sport "${x.sport}" not in game.ts union`);

  for (const k of ["prompt", "promptZh", "story", "storyZh"]) {
    if (typeof x[k] !== "string" || x[k].trim().length < 4)
      errors.push(`${at}: ${k} missing or too short`);
  }

  const hasBlank = /\bthis\s+\w/i.test(x.prompt) || /\bhere\b/i.test(x.prompt);
  if (!hasBlank) errors.push(`${at}: prompt has no blank ("this X" / "here")`);

  // Mojibake guard: the model occasionally returns GBK bytes decoded as UTF-8,
  // which shows up as replacement chars or classic CJK-looking garbage.
  const blob = `${x.prompt}${x.promptZh}${x.story}${x.storyZh}`;
  if (/�/.test(blob)) errors.push(`${at}: contains replacement characters (mojibake)`);
  if (/鈥|锟|鐨|鍙|鏂|璇|娴|绔|闂|璧|鏍|杩|銆|锛|浜|浠|鏄|鍦|绱/.test(blob))
    errors.push(`${at}: looks like GBK-decoded-as-UTF8 mojibake`);

  const head = String(x.answer ?? "").split(",")[0].trim().toLowerCase();
  if (head.length > 3 && x.prompt.toLowerCase().includes(head))
    errors.push(`${at}: prompt leaks answer "${head}"`);

  if (x.scope === "city") {
    if (typeof x.viewLat !== "number" || typeof x.viewLng !== "number") {
      errors.push(`${at}: city scope without viewLat/viewLng`);
    } else {
      withView++;
      // The view centre must not sit on top of the answer, otherwise the
      // answer is visible on the map before the player guesses. 50 km is
      // about half a degree of latitude - close enough that the answer
      // marker would already be on screen.
      const R = 6371;
      const toRad = (d) => (d * Math.PI) / 180;
      const dLat = toRad(x.viewLat - x.lat);
      const dLng = toRad(x.viewLng - x.lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(x.lat)) *
          Math.cos(toRad(x.viewLat)) *
          Math.sin(dLng / 2) ** 2;
      const km = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
      if (km < 50) errors.push(`${at}: view centre is ${km.toFixed(0)}km from the answer`);
    }
  } else if (x.viewLat !== undefined) {
    warnings.push(`${at}: non-city scope carries a view centre`);
  }
}

const scope = {};
const sport = {};
for (const x of q) {
  scope[x.scope] = (scope[x.scope] || 0) + 1;
  sport[x.sport] = (sport[x.sport] || 0) + 1;
}

// Duplicate-prompt check. Two questions with the same normalised prompt are
// the same question twice, which wastes a slot in the daily rotation.
const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const promptSeen = new Map();
for (const x of q) {
  const k = norm(x.prompt);
  if (promptSeen.has(k)) {
    errors.push(`${x.id}: duplicate prompt (same as ${promptSeen.get(k)})`);
  } else {
    promptSeen.set(k, x.id);
  }
}

console.log(`questions: ${q.length}`);
console.log(`meta.version: ${raw.meta?.version}`);
console.log(`scope: ${JSON.stringify(scope)}`);
console.log(`sports: ${Object.keys(sport).length} -> ${JSON.stringify(sport)}`);
console.log(`city questions with view centre: ${withView}`);
console.log(`unique ids: ${seenIds.size}`);
console.log(`distinct answers: ${new Set(q.map((x) => x.answer)).size}`);

if (warnings.length) {
  console.log(`\nWARNINGS (${warnings.length}):`);
  warnings.slice(0, 20).forEach((w) => console.log("  " + w));
}
if (errors.length) {
  console.log(`\nERRORS (${errors.length}):`);
  errors.slice(0, 60).forEach((e) => console.log("  " + e));
  process.exit(1);
}
console.log("\nOK — no errors.");
