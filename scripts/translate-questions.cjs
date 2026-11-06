// Translate the question bank into Chinese using the MiniMax chat API.
//
// Each prompt ends with a blank ("this city", "this stadium", ...) that the
// player fills in by tapping the map. The Chinese translation must keep the
// same blanking style, keep proper nouns (team/player/place names) in their
// recognisable form, and must NOT reveal the answer city.
//
// Usage: node scripts/translate-questions.cjs [--dry-run]

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DB =
  process.env.USERPROFILE + "\\.openclaw\\agents\\main\\agent\\openclaw-agent.sqlite";
const store = JSON.parse(
  new DatabaseSync(DB, { readOnly: true })
    .prepare("select store_json from auth_profile_store where store_key='primary'")
    .get().store_json
);
const KEY = store.profiles["minimax:cn"].key;
const MODEL = "MiniMax-M2.5";
const DATA = path.resolve(__dirname, "..", "src", "data", "questions.json");
const BATCH = 12;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chat(messages) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch("https://api.minimaxi.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + KEY },
        body: JSON.stringify({ model: MODEL, messages, max_tokens: 8000, temperature: 0.2 }),
      });
      if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 200));
      const j = await r.json();
      const text = j.choices?.[0]?.message?.content || "";
      const clean = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      if (!clean) throw new Error("empty reply");
      return clean;
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(1200 * attempt);
    }
  }
}

function parseJsonLoose(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no JSON object in reply: " + raw.slice(0, 200));
  return JSON.parse(raw.slice(start, end + 1));
}

const SYSTEM = `你是地理问答游戏的中文本地化译者。给你一组英文题目 JSON,请你为每道题写出中文题干。

规则:
1. 只翻译题干(prompt),不要翻译答案城市名。答案城市在中文题干里必须保持"留白" —— 用"这座城市""这座球场""这座球场所在的这座城市"这类说法指代,不要写出答案。
2. 人名、球队名、机构名保留英文/常见译名,例如 "Chicago Bears" 保留为 "Chicago Bears(熊队)" 或直接英文; "Notre Dame" 保留 "Notre Dame"。地名若不是答案,可以音译。
3. 语气简洁,像英文原句一样短促有力,不要加解释、不要加前缀。
4. 严格输出 JSON: {"items":[{"id":"原id","promptZh":"中文题干"}]},不要输出任何其他文字。
5. 每道题的中文题干必须能被地图点击填入,不能出现具体答案地名。`;

(async () => {
  const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const q = raw.questions;
  const done = new Map();
  if (fs.existsSync(DATA + ".zh")) {
    for (const it of JSON.parse(fs.readFileSync(DATA + ".zh", "utf8")).items) done.set(it.id, it.promptZh);
  }
  console.log("total questions:", q.length, "| already translated:", done.size);

  const pending = q.filter((x) => !done.has(x.id));
  if (process.argv.includes("--dry-run")) {
    console.log("would translate:", pending.length);
    return;
  }

  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH);
    const payload = slice.map((x) => ({ id: x.id, prompt: x.prompt }));
    const reply = await chat([
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify(payload) },
    ]);
    const parsed = parseJsonLoose(reply);
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    let ok = 0;
    for (const it of items) {
      if (!it || !it.id || !it.promptZh) continue;
      done.set(it.id, String(it.promptZh).trim());
      ok++;
    }
    console.log(`batch ${Math.floor(i / BATCH) + 1}: ${ok}/${slice.length} translated (total ${done.size}/${q.length})`);
    fs.writeFileSync(DATA + ".zh", JSON.stringify({ items: [...done].map(([id, promptZh]) => ({ id, promptZh })) }, null, 2));
    await sleep(600);
  }

  console.log("DONE:", done.size, "/", q.length);
  const missing = q.filter((x) => !done.has(x.id)).map((x) => x.id);
  if (missing.length) console.log("MISSING:", missing.join(", "));
})();
