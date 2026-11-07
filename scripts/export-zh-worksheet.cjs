// Export the machine-generated Chinese copy as a rewrite worksheet.
//
// The English prompts/stories are the source of truth. This file gives the
// current machine Chinese side by side so the copy can be rewritten properly
// and pasted back.
//
// Usage:
//   node scripts/export-zh-worksheet.cjs            # write the worksheet
//   node scripts/export-zh-worksheet.cjs --apply    # write back from a fixed file
//
// The apply side reads zh-rewrite.json, which must be an object keyed by
// question id: { "<id>": { "promptZh": "...", "storyZh": "..." } }.
// Fields you leave out keep the current machine text.

const fs = require("fs");
const path = require("path");
const DATA = path.resolve(__dirname, "..", "src", "data", "questions.json");
const OUT = path.resolve(__dirname, "..", "zh-rewrite.json");
const APPLY = process.argv.includes("--apply");

const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));

if (APPLY) {
  if (!fs.existsSync(OUT)) {
    console.error("zh-rewrite.json not found — nothing applied");
    process.exit(1);
  }
  const fixes = JSON.parse(fs.readFileSync(OUT, "utf8"));
  const byId = new Map(raw.questions.map((q) => [q.id, q]));
  let applied = 0;
  const unknown = [];
  for (const [id, patch] of Object.entries(fixes)) {
    const q = byId.get(id);
    if (!q) {
      unknown.push(id);
      continue;
    }
    if (patch.promptZh) q.promptZh = patch.promptZh.trim();
    if (patch.storyZh) q.storyZh = patch.storyZh.trim();
    applied++;
  }
  if (unknown.length) {
    console.error(`warning: ${unknown.length} ids not found:`, unknown.slice(0, 10));
  }
  fs.writeFileSync(DATA, JSON.stringify(raw, null, 2) + "\n", "utf8");
  console.log(`applied ${applied} Chinese rewrites`);
  process.exit(0);
}

// Worksheet mode: only the questions whose Chinese came from the machine.
const rows = raw.questions.map((q, i) => ({
  n: i,
  id: q.id,
  answer: q.answer,
  scope: q.scope,
  sport: q.sport,
  prompt: q.prompt,
  promptZh: q.promptZh,
  story: q.story,
  storyZh: q.storyZh,
}));

fs.writeFileSync(
  path.resolve(__dirname, "..", "zh-worksheet.json"),
  JSON.stringify(rows, null, 2) + "\n",
  "utf8"
);
console.log(`wrote zh-worksheet.json (${rows.length} questions)`);
console.log("edit zh-rewrite.json, then run with --apply");
