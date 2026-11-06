// Generate a short factual "story" for every question in the bank.
//
// A story is the one thing that turns a right answer into a reward: it says
// why that place matters, in one or two sentences. GeoSports attaches a story
// to every question and it is the clearest reason to copy.
//
// Each story is written twice (English + Chinese) because the Chinese site
// shows the same story.
//
// Rules the model has to follow:
//   - Ground the story in the answer place, not in the prompt.
//   - One or two sentences. No preamble, no "Here is the story".
//   - State a real fact: a date, a record, a name, a consequence.
//   - Do not repeat the question, do not explain the scoring.
//   - No emoji, no markdown.
//
// Usage:
//   node scripts/generate-stories.cjs [--dry-run] [--batch 10]
//
// Resumable: every finished batch is written to src/data/stories.json, so a
// re-run only asks for what is still missing.

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DB = process.env.USERPROFILE + "\\.openclaw\\agents\\main\\agent\\openclaw-agent.sqlite";
const store = JSON.parse(
  new DatabaseSync(DB, { readOnly: true })
    .prepare("select store_json from auth_profile_store where store_key='primary'")
    .get().store_json
);
const KEY = store.profiles["minimax:cn"].key;
const MODEL = "MiniMax-M2.5";
const DATA = path.resolve(__dirname, "..", "src", "data", "questions.json");
const OUT = path.resolve(__dirname, "..", "src", "data", "stories.json");

const BATCH = Number((process.argv.find((a) => a.startsWith("--batch=")) || "").split("=")[1] || 8);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chat(messages) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch("https://api.minimaxi.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + KEY },
        body: JSON.stringify({ model: MODEL, messages, max_tokens: 8000, temperature: 0.3 }),
      });
      if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 200));
      const j = await r.json();
      const text = j.choices?.[0]?.message?.content || "";
      const clean = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      if (!clean) throw new Error("empty reply");
      return clean;
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(1500 * attempt);
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

const SYSTEM = `你为一款地理猜测游戏写「地点背景故事」。给你一组题目，你为每道题写一句英文和一句中文背景，说明这个地方为什么值得记住。

规则：
1. 故事围绕【答案地点】展开，不要复述题干的问法。
2. 一到两句话，必须包含一个具体事实：日期、数字、纪录、人名或结果。
3. 英文和中文表达同一件事。
4. 不要 emoji、不要 markdown、不要引号包裹。
5. 不要提分数、难度、地图、点击这些游戏机制。
6. 严格输出 JSON：{"items":[{"id":"原id","story":"English story","storyZh":"中文故事"}]}，不要输出任何其他文字。
7. 如果这道题的事实你确实不确定，就写该地点最广为人知、最稳妥的一条事实，不要编造具体数字。`;

(async () => {
  const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const questions = raw.questions;

  const done = new Map();
  if (fs.existsSync(OUT)) {
    for (const it of JSON.parse(fs.readFileSync(OUT, "utf8")).items) {
      if (it && it.id && it.story && it.storyZh) done.set(it.id, it);
    }
  }
  console.log("total questions:", questions.length, "| already have stories:", done.size);

  const pending = questions.filter((x) => !done.has(x.id));
  if (process.argv.includes("--dry-run")) {
    console.log("would generate:", pending.length);
    return;
  }

  const save = () => {
    fs.writeFileSync(
      OUT,
      JSON.stringify({ items: [...done.values()] }, null, 1)
    );
  };

  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH);
    const payload = slice.map((x) => ({
      id: x.id,
      prompt: x.prompt,
      answer: x.answer,
      sport: x.sport,
      tags: x.tags,
    }));
    const reply = await chat([
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify(payload) },
    ]);
    const parsed = parseJsonLoose(reply);
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    let ok = 0;
    for (const it of items) {
      if (!it || !it.id || !it.story || !it.storyZh) continue;
      const story = String(it.story).trim().replace(/^["']|["']$/g, "");
      const storyZh = String(it.storyZh).trim().replace(/^["']|["']$/g, "");
      if (!story || !storyZh) continue;
      done.set(it.id, { id: it.id, story, storyZh });
      ok++;
    }
    console.log(
      `batch ${Math.floor(i / BATCH) + 1}: ${ok}/${slice.length} stories (total ${done.size}/${questions.length})`
    );
    save();
    await sleep(700);
  }

  console.log("DONE:", done.size, "/", questions.length);
  const missing = questions.filter((x) => !done.has(x.id)).map((x) => x.id);
  if (missing.length) console.log("MISSING:", missing.join(", "));
})();
