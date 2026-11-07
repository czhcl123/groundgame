// Fix the Chinese copy of the newly added questions.
//
// The defects, confirmed by reading every flagged case:
//   1. 这座城市X队…          -> 这座城市的X队…      (missing 的 after 城市)
//      但 "这座城市是布朗斯队主场" is already fine — 是 makes the
//      possession obvious, so only fix the cases without 是/有/两支/的主场.
//   2. 第XLIV届超级碗        -> 第44届超级碗          (Roman numeral)
//   3. 多恩Birn高尔夫俱乐部   -> 多恩比恩高尔夫俱乐部   (latin inside a
//      Chinese proper name)
//   4. Rip City / Kingdome / LoanDepot Park are real venue or nickname
//      names — those stay in English.
//
// Usage: node scripts/fix-zh-copy.cjs [--dry-run]

const fs = require("fs");
const path = require("path");
const DATA = path.resolve(__dirname, "..", "src", "data", "questions.json");
const DRY = process.argv.includes("--dry-run");

const ROMAN = {
  XLI: 41, XLIV: 44, LVI: 56, XLII: 42, XLIII: 43, XLVII: 47, XLV: 45,
  XLVI: 46, XLIX: 49, L: 50, LI: 51, LII: 52, LIII: 53, LIV: 54, LV: 55,
  LVII: 57, LVIII: 58, XXXVIII: 38, XXXVII: 37, XXXVI: 36, XXXV: 35,
  XXXIV: 34, XXXIII: 33, XXXII: 32, XXXI: 31, XXX: 30, XXIX: 29,
  XXVIII: 28, XXVII: 27, XXVI: 26, XXV: 25, XXIV: 24, XXIII: 23,
  XXII: 22, XXI: 21, XX: 20, XIX: 19, XVIII: 18, XVII: 17, XVI: 16,
  XV: 15, XIV: 14, XIII: 13, XII: 12, XI: 11, X: 10, IX: 9, VIII: 8,
  VII: 7, VI: 6, V: 5, IV: 4, III: 3, II: 2, I: 1,
};

// A Chinese proper name that the generator left half-translated.
const PROPER_NOUN_FIX = [
  [/多恩Birn/g, "多恩比恩"],
];

// Leftover English words in the original hand-written bank.
// Each pattern is written so that applying it twice is a no-op.
const ENGLISH_FIX = [
  [/“-mean乔”格林/g, "“Mean Joe”格林"],
  [/“Fail Mary”(?!（失败迈里）)/g, "“Fail Mary”（失败迈里）"],
  [/著名的 Fail Mary 发生/g, "著名的“Fail Mary”（失败迈里）发生"],
  [/的 enduring 称号/g, "的持久称号"],
  [/由 businessman Fred Zollner 创立/g, "由商人弗雷德·佐尔纳创立"],
  [/、 undisputed超中量级拳王/g, "、 undisputed（无可争议）超中量级拳王"],
  [/成为 undisputed重量级拳王/g, "成为 undisputed（无可争议）重量级拳王"],
  [/这座城市击败法国队夺得金牌/g, "这座城市击败法国队夺得金牌"],
  [/这座城市也见证了红人队的新时代/g, "这座城市也见证了红人队的新时代"],
];

// Team names as they appear in the Chinese copy, WITHOUT the trailing 队.
// "这座城市X队" needs 的; "这座城市击败法国队" does not. A pattern cannot
// tell a team name from a verb, so the names are listed explicitly.
const TEAM_NAMES = [
  "布朗斯", "海盗", "黑豹", "猛虎", "海鹰", "野马", "猎鹰", "圣徒", "钢人",
  "包装工", "德州人", "牛仔", "雄鹰", "俄勒冈鸭", "蒙大拿灰熊", "燕子",
  "巨人", "湖人", "公牛", "凯尔特人", "热火", "开拓者", "流浪者", "油人",
  "蓝石", "红星", "游击队", "红人", "马林鱼", "太阳", "76人", "凯尔特人",
  "爱国者", "公羊", "喷气机", "突袭者", "巨人与", "红雀", "小熊", "洋基",
  "道奇", "太空人", "费城人", "红袜", "白袜", "红翼", "枫叶", "黑鹰",
  "棕熊", "飞人", "企鹅", "灰熊", "参议员", "掠夺者", "小鸭", "蓝衣军",
  "海妖", "皇马", "巴萨", "曼联", "曼城", "利物浦", "切尔西", "阿森纳",
  "尤文图斯", "拜仁", "多特蒙德", "本菲卡", "波尔图", "阿赫利", "老虎",
  "公羊", "北极星", "掘金", "尼克斯", "活塞", "步行者", "老鹰", "黄蜂",
  "魔术", "国王", "独行侠", "猛龙", "雷霆", "森林狼", "雄鹿", "爵士",
  "马刺", "火箭", "勇士", "凯尔特人", "湖人",
];

const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));

let changed = 0;
const log = [];

for (const [i, x] of raw.questions.entries()) {
  const isNew = i >= 219;
  for (const f of ["promptZh", "storyZh"]) {
    if (typeof x[f] !== "string") continue;
    const before = x[f];
    let t = before;

    // --- 1. Roman numerals -------------------------------------------------
    t = t.replace(/第([IVXLC]{2,})届/g, (m, r) => {
      const n = ROMAN[r.toUpperCase()];
      return n ? `第${n}届` : m;
    });

    // --- 2. missing 的 after 这座城市 --------------------------------------
    // Explicit team names: "这座城市X队" -> "这座城市的X队".
    // "这座城市是X队" / "这座城市有X队" are already correct.
    for (const name of TEAM_NAMES) {
      t = t.replace(
        new RegExp(`这座城市(?![是有两支支一的])(${name}队)(?!球)`, "g"),
        "这座城市的$1"
      );
    }    // "这座城市红星与游击队" -> "这座城的红星与游击队"
    t = t.replace(/这座城市(?!的)([一-龥]{2,4}与[一-龥]{2,4}队)/g, "这座城市的$1");
    // "这座城市球队" -> "这座城市的球队" (must run AFTER the team rules so
    // it does not see an already-fixed "这座城市的...队")
    t = t.replace(/这座城市球队/g, "这座城市的球队");

    // --- 3. half-translated proper nouns -----------------------------------
    for (const [re, to] of PROPER_NOUN_FIX) t = t.replace(re, to);
    for (const [re, to] of ENGLISH_FIX) t = t.replace(re, to);

    // --- 4. spacing after Chinese punctuation ------------------------------
    t = t.replace(/([，。、；：？！])\s+(?=[一-龥A-Za-z])/g, "$1");

    if (t !== before) {
      x[f] = t;
      changed++;
      log.push(`${x.id} [${f}]${isNew ? "" : " (pre-existing)"}`);
      log.push(`  - ${before}`);
      log.push(`  + ${t}`);
      log.push("");
    }
  }
}

fs.writeFileSync(
  path.resolve(__dirname, "..", "zh-fix-log.txt"),
  log.join("\n"),
  "utf8"
);

console.log(`fields changed: ${changed}`);
if (!DRY) {
  fs.writeFileSync(DATA, JSON.stringify(raw, null, 2) + "\n", "utf8");
  console.log("written to", DATA);
} else {
  console.log("(dry run — nothing written)");
}
