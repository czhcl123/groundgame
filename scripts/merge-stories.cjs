// Merge the generated stories into questions.json.
//
// Kept separate from the generator so the generator can be re-run without
// touching the question bank, and so the merge is easy to redo after the
// generator adds more stories.
//
// Usage: node scripts/merge-stories.cjs
// It reports what is still missing and exits non-zero if any question has no
// story, so CI can catch an incomplete bank.

const fs = require("fs");
const path = require("path");

const DATA = path.resolve(__dirname, "..", "src", "data", "questions.json");
const STORIES = path.resolve(__dirname, "..", "src", "data", "stories.json");

const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
const questions = raw.questions;

if (!fs.existsSync(STORIES)) {
  console.log("no stories.json yet - run scripts/generate-stories.cjs first");
  process.exit(1);
}
const stories = JSON.parse(fs.readFileSync(STORIES, "utf8")).items;

const map = new Map();
for (const s of stories) {
  if (!s || !s.id || !s.story || !s.storyZh) continue;
  map.set(s.id, { story: String(s.story).trim(), storyZh: String(s.storyZh).trim() });
}

let merged = 0;
for (const q of questions) {
  const s = map.get(q.id);
  if (!s) continue;
  q.story = s.story;
  q.storyZh = s.storyZh;
  merged++;
}

fs.writeFileSync(DATA, JSON.stringify(raw, null, 2));
console.log("merged stories into questions.json:", merged, "/", questions.length);

const missing = questions.filter((q) => !q.story || !q.storyZh);
if (missing.length) {
  console.log("still missing stories:", missing.length);
  console.log("  " + missing.map((q) => q.id).join(", "));
  process.exit(1);
}
console.log("every question has a story in both languages");
