// Third-pass polish: defects found by reading every Chinese prompt.
//
// The golf batch is the worst offender: the model produced "Point here" /
// "点击这里" (a UI instruction, not a clue) and Chinese numerals for years.
// The English prompts are fine, so each fix restores the English meaning in
// idiomatic Chinese.
//
// Usage: node scripts/polish-zh3.cjs [--dry-run]

const fs = require("fs");
const path = require("path");
const DATA = path.resolve(__dirname, "..", "src", "data", "questions.json");
const DRY = process.argv.includes("--dry-run");

const POLISH = {
  // "马队" is wrong; the Colts are 小马. Also 第41届 needs the 第.
  "nfl-indianapolis-indiana": {
    promptZh: "这座城市的球队赢得第41届超级碗，也以每年举行的500英里车赛闻名。",
  },
  "nfl-indianapolis-indiana-2": {
    promptZh: "这座城市的小马队赢得第41届超级碗，并承办五月500英里赛。",
  },
  // "决赛决赛" doubled.
  "soccer-netherlands": {
    promptZh: "这个国家曾三次打进世界杯决赛，并赢得了1974年的世界杯。",
  },
  // Pohang Steelers is 浦光制铁, not 坡光钢铁.
  "soccer-seoul-south-korea": {
    promptZh: "这座首都所在国家的浦光制铁曾夺得2002年亚冠冠军。",
  },
  // Pebble Beach is on the Monterey Peninsula, but the course is Pebble
  // Beach Golf Links.
  "golf-pebble-beach-california": {
    promptZh: "这座小镇的海岸球场举办AT&T职业业余赛。",
  },
  "golf-pinehurst-north-carolina": {
    promptZh: "美国公开赛曾五次在这座小镇的球场举办。",
  },
  // "点击这里" is a UI instruction, not a clue.
  "golf-kiawah-island-south-carolina": {
    promptZh: "1991年及2023年的PGA锦标赛都在这里举办。",
  },
  "golf-valhalla-kentucky": {
    promptZh: "PGA锦标赛曾六次在这里举办。",
  },
  "golf-troon-arizona": {
    promptZh: "这座小镇的度假球场举办凤凰城公开赛。",
  },
  "golf-carnoustie-scotland": {
    promptZh: "1999年及2018年的英国公开赛都在这里举办。",
  },
  "golf-muirfield-scotland": {
    promptZh: "1860年首届英国公开赛就在这里举办。",
  },
  "golf-royal-troon-scotland": {
    promptZh: "这座小镇的林克斯球场曾举办八届英国公开赛。",
  },
  // Chinese numerals -> digits.
  "golf-portrush-northern-ireland": {
    promptZh: "这座小镇曾举办2019年及1951年的英国公开赛。",
  },
  "golf-ballybunion-ireland": {
    promptZh: "这座小镇曾举办1966年及1971年的英国公开赛。",
  },
  "golf-westerly-rhode-island": {
    promptZh: "这个小镇的球场曾五次承办美国公开赛，末次是1964年。",
  },
  "golf-bethpage-new-york": {
    promptZh: "这座小镇的球场曾五次承办美国公开赛，末次在2019年。",
  },
  "golf-olympia-fields-illinois": {
    promptZh: "这座小镇的球场承办了2003年美国公开赛。",
  },
  // "明尼苏达这里的主球场" / "纽约这里" — awkward adverbial.
  "golf-hazeltine-minnesota": {
    promptZh: "明尼苏达州这座城市的球场举办过三届美国公开赛。",
  },
  "golf-shinnecock-hills-new-york": {
    promptZh: "纽约州这座小镇在1896年举办了首届美国公开赛。",
  },
  "golf-martha-s-vineyard-massachusetts": {
    promptZh: "马萨诸塞州这座海岛的球场曾举办1998年美国公开赛。",
  },
  "golf-coral-gables-florida": {
    promptZh: "佛罗里达州这座城市的主球场曾举办1991年美国公开赛。",
  },
  "golf-sarasota-florida": {
    promptZh: "佛罗里达州这座城市有奥谢斯，亦举办2006年PGA元老赛。",
  },
  // US -> 美国.
  "golf-congressional-country-club-maryland": {
    promptZh: "这家俱乐部曾举办五届美国公开赛。",
  },
  "golf-whistling-straits-wisconsin": {
    promptZh: "这里在2003年和2015年两度举办PGA锦标赛。",
  },
  "golf-oak-hill-texas": {
    promptZh: "这座球场在三个年份举办过PGA锦标赛。",
  },
  // "这里" alone loses the place reference.
  "soccer-saint-denis-france": {
    promptZh: "这座城市曾举办1998年世界杯决赛，法国3比0击败巴西。",
  },
  "soccer-rio-de-janeiro-brazil": {
    promptZh: "这座城市有红黑军团主场，也是1950年世界杯决赛举办地。",
  },
  // "绿野仙踪" film premiere phrasing.
  "nfl-philadelphia-pennsylvania-2": {
    promptZh: "1939年电影《绿野仙踪》的世界首映就在这座城市举办。",
  },
};

const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
const byId = new Map(raw.questions.map((q) => [q.id, q]));
let changed = 0;
const log = [];
const missing = [];

for (const [id, patch] of Object.entries(POLISH)) {
  const q = byId.get(id);
  if (!q) {
    missing.push(id);
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
  path.resolve(__dirname, "..", "zh-polish3-log.txt"),
  log.join("\n"),
  "utf8"
);
console.log(`polished fields: ${changed}`);
if (missing.length) console.log("missing ids:", missing.join(", "));
if (!DRY) {
  fs.writeFileSync(DATA, JSON.stringify(raw, null, 2) + "\n", "utf8");
  console.log("written");
} else {
  console.log("(dry run)");
}
