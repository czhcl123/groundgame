// Stage-1 fact screen: rank UNVERIFIED questions by structural contradiction signals.
// This does NOT decide what is true. It decides what a human should look at first.
//
// Usage: node scripts/screen-facts.cjs
// Output: scripts/fact-screen-queue.md (highest risk first)

const fs = require("fs");
const path = require("path");

const DATA = path.resolve(__dirname, "..", "src", "data", "questions.json");
const OUT = path.resolve(__dirname, "fact-screen-queue.md");
const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));

// Place adjectives in clues -> canonical place token expected in the answer.
const PLACES = new Map();
for (const s of [
  "Massachusetts", "Virginia", "Texas", "California", "Iowa", "Alabama", "Maine",
  "Indiana", "Michigan", "Minnesota", "Pennsylvania", "Ohio", "Florida", "Georgia",
  "Maryland", "Missouri", "Illinois", "Tennessee", "Kentucky", "Wisconsin",
  "Oklahoma", "Oregon", "Nevada", "Arizona", "Colorado", "Utah", "Montana",
  "Kansas", "Nebraska", "Louisiana", "Mississippi", "Arkansas", "New Jersey",
  "Connecticut", "Vermont", "Delaware", "Alaska", "Hawaii", "Carolina", "Dakota",
]) PLACES.set(s.toLowerCase(), s);

const COUNTRIES = new Map();
for (const [adj, canon] of [
  ["greek", "Greece"], ["jamaican", "Jamaica"], ["argentine", "Argentina"],
  ["brazilian", "Brazil"], ["german", "Germany"], ["canadian", "Canada"],
  ["dutch", "Netherlands"], ["scottish", "Scotland"], ["italian", "Italy"],
  ["french", "France"], ["spanish", "Spain"], ["japanese", "Japan"],
  ["filipino", "Philippines"], ["australian", "Australia"], ["mexican", "Mexico"],
  ["korean", "Korea"], ["russian", "Russia"], ["liberian", "Liberia"],
  ["senegalese", "Senegal"], ["icelandic", "Iceland"], ["irish", "Ireland"],
  ["english", "England"], ["portuguese", "Portugal"], ["swiss", "Switzerland"],
  ["austrian", "Austria"], ["norwegian", "Norway"], ["swedish", "Sweden"],
  ["polish", "Poland"], ["indian", "India"], ["egyptian", "Egypt"],
]) COUNTRIES.set(adj, canon);

// League token -> the sport field it must agree with.
const LEAGUE_SPORT = {
  NBA: "basketball", NFL: "american football", MLB: "baseball", NHL: "ice hockey",
  CFL: "canadian football", FIFA: "soccer",
};
const ID_PREFIX_SPORT = {
  nba: "basketball", nfl: "american football", mlb: "baseball", nhl: "ice hockey",
};

const WEIGHT = {
  GEO_MISMATCH: 40,
  LEAGUE_TAG_MISMATCH: 35,
  SUPERLATIVE: 20,
  ID_PREFIX_MISMATCH: 4,
};

const SUPERLATIVE = /\b(first|last|only|largest|smallest|youngest|oldest|longest|never|record|inaugural)\b/i;

const rows = [];
for (const q of raw.questions) {
  if (q.sources?.some((s) => s.status === "verified")) continue;
  const flags = [];
  const prompt = q.prompt || "";
  const blob = `${prompt} ${q.story || ""}`;
  const answer = (q.answer || "").toLowerCase();
  const answerTail = answer.split(",").slice(1).join(",").trim();

  // Only "this <place> city/town" phrasing is a geo clue about the ANSWER.
  // "Wisconsin beat Kentucky" or "relocated from Minnesota" are story details,
  // not contradictions — flagging those buries real errors in false positives.
  const geoClue = (word) => new RegExp(`(?:this|the)\\s+${word}\\s+(?:city|town|state|country|island|capital)`, "i").test(prompt)
    || new RegExp(`\\b${word}\\s+(?:city|town|island)\\b`, "i").test(prompt);
  for (const [k, canon] of PLACES) {
    if (!geoClue(k)) continue;
    if (answer.includes(k) || answer.includes(canon.toLowerCase())) continue;
    if (answerTail && answerTail !== canon.toLowerCase()) flags.push(`GEO_MISMATCH:${canon}→${answer}`);
  }
  for (const [adj, canon] of COUNTRIES) {
    if (!geoClue(adj)) continue;
    if (answer.includes(canon.toLowerCase())) continue;
    flags.push(`GEO_MISMATCH:${canon}→${answer}`);
  }

  // Tag says NBA but the story is about Cardinals / MLB, etc.
  for (const [tag, sport] of Object.entries(LEAGUE_SPORT)) {
    if ((q.tags || []).some((t) => t.toUpperCase() === tag) && q.sport !== sport)
      flags.push(`LEAGUE_TAG_MISMATCH:${tag}≠${q.sport}`);
    if (new RegExp(`\\b${tag}\\b`).test(blob) && (q.tags || []).some((t) => t.toUpperCase() in LEAGUE_SPORT && t.toUpperCase() !== tag))
      flags.push(`LEAGUE_TAG_MISMATCH:${tag} in text`);
  }

  if (SUPERLATIVE.test(blob)) flags.push("SUPERLATIVE");

  const prefix = (q.id || "").split("-")[0].toLowerCase();
  if (ID_PREFIX_SPORT[prefix] && ID_PREFIX_SPORT[prefix] !== q.sport.replace(" ", ""))
    flags.push(`ID_PREFIX_MISMATCH:${prefix}≠${q.sport}`);

  const score = flags.reduce((n, f) => n + (WEIGHT[f.split(":")[0]] || 0), 0);
  if (score) rows.push({ q, flags: [...new Set(flags)], score });
}

rows.sort((a, b) => b.score - a.score || a.q.id.localeCompare(b.q.id));

const lines = [
  "# Fact-screen queue",
  "",
  `Unverified questions with at least one structural signal: **${rows.length}**`,
  "",
  "Signals are hints, not verdicts. Open the source URL, confirm the exact claim, then set `status: verified` and replace the search link with a direct article link if the item checks out.",
  "",
];
for (const { q, flags, score } of rows) {
  lines.push(`## ${q.id} — score ${score}`);
  lines.push(`- flags: ${flags.join("; ")}`);
  lines.push(`- answer: ${q.answer}`);
  lines.push(`- prompt: ${q.prompt}`);
  lines.push(`- story: ${q.story}`);
  lines.push(`- source: ${q.sources?.[0]?.url || "(none)"}`);
  lines.push("");
}
fs.writeFileSync(OUT, lines.join("\n"));

const byFlag = {};
for (const { flags } of rows) for (const f of flags) {
  const k = f.split(":")[0];
  byFlag[k] = (byFlag[k] || 0) + 1;
}
console.log(`unverified questions: ${raw.questions.filter((q) => !q.sources?.some((s) => s.status === "verified")).length}`);
console.log(`flagged: ${rows.length}`);
console.log("by signal:", JSON.stringify(byFlag));
console.log(`top 15: ${rows.slice(0, 15).map((r) => `${r.q.id}(${r.score})`).join(", ")}`);
console.log(`wrote ${OUT}`);

// Self-check: the geo rule must catch "this Massachusetts city ... → Waterloo, Iowa"
// style contradictions and must NOT fire on team-name narrative like
// "Wisconsin ended Kentucky's season". Regression guard for the rule above.
const topIds = rows.slice(0, 80).map((r) => r.q.id);
if (!topIds.includes("nba-celtics-2") && raw.questions.some((q) => q.id === "nba-celtics-2" && !q.sources?.some((s) => s.status === "verified"))) {
  console.error("SELF-CHECK FAILED: known geo contradiction nba-celtics-2 not flagged");
  process.exit(1);
}
if (rows.some((r) => /GEO_MISMATCH:Kentucky|GEO_MISMATCH:Wisconsin/.test(r.flags.join(";")))) {
  console.error("SELF-CHECK FAILED: team names misread as geo clues");
  process.exit(1);
}
console.log("self-check OK");
