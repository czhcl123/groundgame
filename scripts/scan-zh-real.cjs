// Narrow the scan to the ACTUAL defects, then dump exact sentences so the
// fixes can be written precisely.
//
// Verified against the original hand-written bank:
//   - "匹兹堡钢人队" / "绿湾包装工队" are CORRECT Chinese (X队 is standard)
//   - so "team name needs 的" as a blanket rule is a false positive
// The real defects are:
//   1. 这座城市X队主场      -> 这座城市的X队主场  (missing 的)
//   2. 第XLVII届超级碗      -> 第47届超级碗       (Roman numeral)
//   3. Chinese, Latin       -> Chinese, Latin is fine; Chinese+Latin+Chinese
//                                with a space after punctuation is not
//   4. leftover English words in an otherwise Chinese sentence
//   5. mojibake left over in the ORIGINAL bank
const fs = require("fs");
const path = require("path");
const DATA = path.resolve(__dirname, "..", "src", "data", "questions.json");
const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));

const ROMAN = {
  XXXVIII: 38, XXXVII: 37, XXXVI: 36, XXXV: 35, XXXIV: 34, XXXIII: 33,
  XXXII: 32, XXXI: 31, XXX: 30, XXIX: 29, XXVIII: 28, XXVII: 27, XXVI: 26,
  XXV: 25, XXIV: 24, XXIII: 23, XXII: 22, XXI: 21, XX: 20, XIX: 19,
  XVIII: 18, XVII: 17, XVI: 16, XV: 15, XIV: 14, XIII: 13, XII: 12, XI: 11,
  X: 10, IX: 9, VIII: 8, VII: 7, VI: 6, V: 5, IV: 4, III: 3, II: 2, I: 1,
  L: 50, LI: 51, LII: 52, LIII: 53, LIV: 54, LV: 55, LVI: 56, LVII: 57,
  LVIII: 58, LIX: 59, LX: 60, LXI: 61,
};

// English words that should not survive in Chinese prose.
const EN_WORDS = [
  "enduring", "undisputed", "businessman", "candidates", "Qatar", "Formula",
  "IndyCar", "Motorsport", "SoFi", "Fail Mary", "Hockeytown",
];

const cases = [];
const isNew = (i) => i >= 219;

for (const [i, x] of raw.questions.entries()) {
  for (const f of ["promptZh", "storyZh"]) {
    const t = x[f] || "";
    const hits = [];
    // 1. missing 的 — only the genuinely broken shape:
    //    "这座城市X队..." with no 是/有/的 between 城市 and the team name.
    //    "这座城市是布朗斯队主场" and "这座城市有燕子队" are correct Chinese.
    if (/这座城市(?![是有两支支一的])[一-龥]{2,6}队/.test(t))
      hits.push("MISSING_DE_CITY_TEAM");
    // 2. Roman numerals
    if (/第[IVXLC]{2,}届/.test(t)) hits.push("ROMAN");
    // 3. space after punctuation
    if (/[，。、；：？！]\s+[一-龥A-Za-z]/.test(t)) hits.push("SPACE_PUNCT");
    // 4. leftover English
    for (const w of EN_WORDS) if (t.includes(w)) hits.push("EN:" + w);
    // 5. mojibake
    if (/鈥|锟|涓|璇|鏂|绔|鐨|鍙|銆|锛|�|-mean/.test(t)) hits.push("MOJIBAKE");
    // 6. mixed latin inside Chinese with no space (e.g. "New York Giants击败")
    if (/[一-龥][A-Z][a-z]/.test(t)) hits.push("LATIN_IN_CJK");
    if (hits.length) {
      cases.push({
        i,
        id: x.id,
        field: f,
        new: isNew(i),
        hits: [...new Set(hits)],
        text: t,
      });
    }
  }
}

fs.writeFileSync(
  path.resolve(__dirname, "..", "zh-real-cases.json"),
  JSON.stringify(cases, null, 2),
  "utf8"
);

const byHit = {};
cases.forEach((c) => c.hits.forEach((h) => (byHit[h] = (byHit[h] || 0) + 1)));
const lines = Object.entries(byHit)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `${String(v).padStart(4)}  ${k}`);
fs.writeFileSync(
  path.resolve(__dirname, "..", "zh-real-summary.txt"),
  lines.join("\n"),
  "utf8"
);
console.log("cases:", cases.length);
