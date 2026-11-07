// Hand-written polish for the Chinese copy that no regex can fix.
//
// The mechanical rules in fix-zh-copy.cjs handle the systematic defects
// (missing 的, Roman numerals, leftover English). This file handles only
// the sentences that are factually wrong or grammatically broken.
//
// NOT fixed here (and deliberately so):
//   "这座城市是黑豹队主场"  — already correct Chinese. Adding 的 turns it
//   into a dangling noun phrase, so it is left alone.
//   "这座城市的球队"        — the 的 is required.
//
// Usage: node scripts/polish-zh.cjs [--dry-run]

const fs = require("fs");
const path = require("path");
const DATA = path.resolve(__dirname, "..", "src", "data", "questions.json");
const DRY = process.argv.includes("--dry-run");

// id -> { promptZh?, storyZh? }
const POLISH = {
  // "以六场击败" is not idiomatic — the Finals was six games, the score 4-2.
  "nba-dallas-texas": {
    promptZh: "这座城市的球队2011年以六比四击败迈阿密，赢得NBA总冠军。",
  },
  // "美式橄榄球队的所在地" reads as a dangling modifier; the subject is
  // the team, so it belongs directly after 这座城市.
  "nfl-eugene-oregon": {
    promptZh: "俄勒冈鸭队美式橄榄球队所在地就是这座城市。",
  },
  "nfl-missoula-montana": {
    promptZh: "蒙大拿灰熊队美式橄榄球队所在地就是这座城市。",
  },
};

const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
const byId = new Map(raw.questions.map((q) => [q.id, q]));
let changed = 0;
const log = [];

for (const [id, patch] of Object.entries(POLISH)) {
  const q = byId.get(id);
  if (!q) {
    log.push(`MISSING id: ${id}`);
    continue;
  }
  for (const f of ["promptZh", "storyZh"]) {
    if (!patch[f]) continue;
    if (q[f] === patch[f]) continue;
    log.push(`${id} [${f}]`);
    log.push(`  - ${q[f]}`);
    log.push(`  + ${patch[f]}`);
    q[f] = patch[f];
    changed++;
  }
}

fs.writeFileSync(
  path.resolve(__dirname, "..", "zh-polish-log.txt"),
  log.join("\n"),
  "utf8"
);
console.log(`polished fields: ${changed}`);
if (!DRY) {
  fs.writeFileSync(DATA, JSON.stringify(raw, null, 2) + "\n", "utf8");
  console.log("written");
} else {
  console.log("(dry run)");
}
