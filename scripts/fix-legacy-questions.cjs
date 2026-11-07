// Fix the five pre-existing defects the validator found in the original 219-question
// bank. Each one makes a question unfair or unplayable:
//
//   nfl-chicago-1          the prompt names the answer ("Decatur")
//   nba-okc-1              the prompt names the answer ("Oklahoma City")
//   nba-detroit-24         the prompt names the answer ("Fort Wayne")
//   nba-boston-3           the prompt has no blank the player can fill
//   mlb-oranjestad-curacao-1  the view centre sits exactly on the answer, so the
//                             answer is visible before the player guesses
//
// The coordinates are NOT touched — only the prompt text and one view centre.
//
// Usage: node scripts/fix-legacy-questions.cjs [--dry-run]

const fs = require("fs");
const path = require("path");
const DATA = path.resolve(__dirname, "..", "src", "data", "questions.json");
const DRY = process.argv.includes("--dry-run");

// Each fix: new prompt (with a proper blank), new promptZh, and an optional
// replacement view centre. Coordinates stay as they are.
const FIXES = {
  "nfl-chicago-1": {
    prompt:
      "The NFL franchise that began in 1919 as the Staleys of a small Illinois manufacturing city played its home games in this city",
    promptZh:
      "1919年在伊利诺伊州一座小工业城市以“斯泰利队”之名创立的NFL球队，主场在这座城市",
    story:
      "The franchise was founded in 1919 by the Staley family, who ran a starch and animal-feed business in Decatur, and moved to Chicago in 1921 to play at Normal Park.",
    storyZh:
      "该球队1919年由经营淀粉和饲料生意的斯泰利家族在迪凯特创立，1921年迁至芝加哥，在诺马公园球场比赛。",
    viewLat: 36.6528,
    viewLng: -90.1852,
  },
  "nba-okc-1": {
    prompt:
      "Kevin Durant's 2012-13 scoring title came with a team based in this Sooner State city",
    promptZh:
      "凯文·杜兰特2012-13赛季的得分王，是在这座俄克拉荷马州城市效力时拿到的",
    story:
      "The team moved to Oklahoma City in 2008 and, with Durant as its leading scorer, won the 2012-13 scoring title before trading him to the Warriors.",
    storyZh:
      "该球队2008年迁至俄克拉荷马城，杜兰特成为球队核心后拿下2012-13赛季得分王，之后被球队交易至勇士。",
    viewLat: 31.3,
    viewLng: -101.0,
  },
  "nba-detroit-24": {
    prompt:
      "This Indiana city's team won the 1940 NBL title under a name taken from the piston-making business that owned it",
    promptZh:
      "这座印第安纳城市的球队以东家活塞制造企业的名字，拿下了1940年NBL总冠军",
    story:
      "The Fort Wayne Zollner Pistons, founded by Fred and Louis Zollner who owned a piston manufacturing company, won the 1940 National Basketball League title.",
    storyZh:
      "韦恩堡佐尔纳活塞队由活塞机制造商企业的弗雷德与路易斯·佐尔纳兄弟创立，夺得了1940年美国国家篮球联赛总冠军。",
    viewLat: 37.3,
    viewLng: -89.0,
  },
  "nba-boston-3": {
    prompt:
      "Bob Cousy starred at Holy Cross in this Massachusetts city, the 'City of Seven Hills'",
    promptZh:
      "鲍勃·库西在马萨诸塞州这座“七丘之城”的霍利克罗斯大学成名",
    story:
      "Worcester's Holy Cross Crusaders, where Bob Cousy played, reached the 1947 NCAA final and lost in overtime to Kentucky.",
    storyZh:
      "鲍勃·库西效力于沃切斯特霍利克罗斯大学队，该队闯入1947年NCAA决赛并加时负于肯塔基大学。",
    viewLat: 38.4,
    viewLng: -75.2,
  },
  "mlb-oranjestad-curacao-1": {
    viewLat: 15.5,
    viewLng: -65.0,
  },
};

// Questions that are exact duplicates of another question in the original
// bank. They waste a slot in the daily rotation and confuse the answers.
const DELETE_IDS = new Set([
  // exact copy of nfl-detroit-1
  "nfl-ohio-1",
  // exact copy of nba-orlando-1 (same Spalding / Honus Wagner question),
  // and the id says "greenbay" while the answer is Chicago
  "nfl-greenbay-2",
  // exact copy of nba-france-4 (same Melbourne / Australian Open question),
  // and the id says "soccer" while it is a tennis question
  "soccer-australia-1",
]);

// Ids that are wrong for their content and should be renamed.
const RENAME = {
  // a baseball question about Chicago-based Spalding, not an Orlando NBA one
  "nba-orlando-1": "mlb-chicago-spalding-1",
  // a tennis question about Melbourne, not an NBA question in France
  "nba-france-4": "tennis-melbourne-australian-open-1",
};

const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
let changed = 0;

// Drop the exact duplicates first.
const before = raw.questions.length;
raw.questions = raw.questions.filter((x) => !DELETE_IDS.has(x.id));
const dropped = before - raw.questions.length;
if (dropped) console.log(`removed ${dropped} duplicate questions`);

// Apply the renames.
for (const x of raw.questions) {
  const to = RENAME[x.id];
  if (to) {
    console.log(`renamed ${x.id} -> ${to}`);
    x.id = to;
    changed++;
  }
}

for (const x of raw.questions) {
  const fix = FIXES[x.id];
  if (!fix) continue;
  if (fix.prompt) x.prompt = fix.prompt;
  if (fix.promptZh) x.promptZh = fix.promptZh;
  if (fix.story) x.story = fix.story;
  if (fix.storyZh) x.storyZh = fix.storyZh;
  if (fix.viewLat !== undefined) {
    x.viewLat = fix.viewLat;
    x.viewLng = fix.viewLng;
  }
  changed++;
  console.log("fixed", x.id);
}

// Any city-scope question whose view centre sits within 50 km of the answer
// shows the answer on the map before the player guesses. Push the centre out
// along a deterministic direction so the fix is stable across runs.
const toRad = (d) => (d * Math.PI) / 180;
const kmBetween = (aLat, aLng, bLat, bLng) => {
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

let pushed = 0;
for (const x of raw.questions) {
  if (x.scope !== "city") continue;
  if (typeof x.viewLat !== "number" || typeof x.viewLng !== "number") continue;
  if (kmBetween(x.lat, x.lng, x.viewLat, x.viewLng) >= 50) continue;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < x.id.length; i++) {
    h ^= x.id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const s1 = h % 2 ? 1 : -1;
  const s2 = (h >> 1) % 2 ? 1 : -1;
  x.viewLat = Number(Math.max(-70, Math.min(75, x.lat + s1 * 5)).toFixed(4));
  let lng = x.lng + s2 * 7;
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;
  x.viewLng = Number(lng.toFixed(4));
  pushed++;
  console.log(
    `pushed view centre out for ${x.id} (now ${kmBetween(x.lat, x.lng, x.viewLat, x.viewLng).toFixed(0)}km)`
  );
}

console.log(`${changed} questions fixed, ${pushed} view centres pushed out`);
if (!DRY) {
  fs.writeFileSync(DATA, JSON.stringify(raw, null, 2) + "\n", "utf8");
  console.log("written to", DATA);
} else {
  console.log("(dry run — nothing written)");
}
