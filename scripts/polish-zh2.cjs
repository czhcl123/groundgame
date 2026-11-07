// Second-pass polish: defects found by reading the Chinese, not by pattern.
//
// Usage: node scripts/polish-zh2.cjs [--dry-run]

const fs = require("fs");
const path = require("path");
const DATA = path.resolve(__dirname, "..", "src", "data", "questions.json");
const DRY = process.argv.includes("--dry-run");

const POLISH = {
  // The Kraken was rendered lowercase and untranslated.
  "nhl-seattle-washington": {
    promptZh: "这座城市是2021年加盟NHL的海妖队所在地。",
  },
  // ".394的打击率" reads badly — the average is .394, the wording is awkward.
  "mlb-san-diego-california": {
    promptZh: "这座城市的球队有一位名人堂击球手，1994年打出0.394的打击率。",
  },
  // "主场球队是开拓者队" is redundant with 这座城市的球迷.
  "nba-portland-oregon": {
    promptZh: "这座城市的球迷被称为Rip City，主场是开拓者队。",
  },
  // "这座城市的红星与游击队的永恒德比" — double 的.
  "soccer-belgrade-serbia": {
    promptZh: "这座城市的红星与游击队之间的永恒德比，早于国家独立。",
  },
  // "这座城市的球队是唯一..." is fine, but the antecedent is unclear.
  "mlb-miami-florida": {
    promptZh: "这座城市的马林鱼队是唯一在两座城市打过主场的MLB球队。",
  },
  // "这里" loses the city; keep the pattern consistent with the rest.
  "soccer-buenos-aires-argentina": {
    promptZh: "这座城市是蓝黄军团主场，1986年曾出现上帝之手进球。",
  },
  // "一座城市是一座城市" repetition.
  "nfl-atlanta-georgia-3": {
    promptZh: "一位猎鹰队接球手创下队史生涯接球码数纪录的地方就是这座乔治亚州城市。",
  },
  // "这座印第安纳州城市是一部..." — the modifier runs into the subject.
  "nfl-terre-haute-indiana": {
    promptZh: "一部讲述天才四分卫的名著，背景地就是这座印第安纳州城市。",
  },
  // "这座首都是赢得..." — the 的 is missing.
  "soccer-madrid-spain": {
    promptZh: "这座首都是赢得首届欧洲杯的俱乐部的主场。",
  },
  // "2010年加拿大女冰" is jargon; expand it.
  "nhl-vancouver-british-columbia": {
    promptZh: "这座城市有NHL球队，2010年加拿大国家女子冰球队在此夺得冬奥金牌。",
  },
  // "全球最大的室内篮球馆之一" — fine, but name the venue.
  "nba-quezon-city-philippines": {
    promptZh: "这座城市拥有全球最大的室内篮球馆之一。",
  },
  // "这座城市最著名的棒球瞬间，是..." reads fine; keep.
  "mlb-seattle-washington-2": {
    promptZh: "这座城市最著名的棒球瞬间，是“小子”击出再见全垒打。",
  },
  "soccer-rome-italy": {
    promptZh: "这座城市有两支同城球队，交锋称为首都德比。",
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
  path.resolve(__dirname, "..", "zh-polish2-log.txt"),
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
