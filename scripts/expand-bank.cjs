// Expand the GroundGame question bank.
//
// Every new question is anchored to a real place from seed-locations.cjs. The
// coordinates are copied verbatim from the seed file — the model never
// produces lat/lng, because a wrong coordinate means an unplayable question.
//
// For each seed the model writes:
//   prompt    - English prompt with a blank the player fills on the map
//   promptZh  - Chinese prompt, same blanking style
//   story     - one or two sentences about the answer place (English)
//   storyZh   - the same story in Chinese
//
// Rules the model must follow:
//   - The prompt must NOT name the answer place, the country, or a synonym.
//   - The prompt must contain a blank phrase ("this city", "this stadium", ...)
//     so the player knows what to fill in.
//   - The story must be about the ANSWER place and state a real fact.
//   - No emoji, no markdown, no "Here is the story" preamble.
//
// Usage:
//   node scripts/expand-bank.cjs [--dry-run] [--batch 8] [--limit N]
//
// Resumable: finished batches are appended to src/data/questions.json.

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const seeds = require("./seed-locations.cjs");

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

const argOf = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : dflt;
};
const DRY = process.argv.includes("--dry-run");
const BATCH = Number(argOf("batch", 6));
const LIMIT = Number(argOf("limit", 0));
const TARGET = Number(argOf("target", 500));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chat(messages) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch("https://api.minimaxi.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + KEY },
        body: JSON.stringify({
          model: MODEL,
          messages,
          max_tokens: 16000,
          temperature: 0.4,
        }),
      });
      if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 300));
      const j = await r.json();
      const text = (j.choices?.[0]?.message?.content || "")
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .trim();
      if (!text) throw new Error("empty reply");
      return text;
    } catch (e) {
      if (attempt === 4) throw e;
      console.error("  retry", attempt, e.message);
      await sleep(1500 * attempt);
    }
  }
}

function parseJsonLoose(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end < 0) throw new Error("no JSON array in reply: " + raw.slice(0, 300));
  return JSON.parse(raw.slice(start, end + 1));
}

/**
 * The model sometimes thinks in mangled Chinese and copies that broken form
 * into the answer. GBK bytes decoded as UTF-8 show up as characters like
 * 涓 鈥 锛 — if any Chinese field contains them the item is unusable, so we
 * detect it and make the caller retry.
 */
const MOJIBAKE = /鈥|锟|鐨|鍙|鏂|璇|娴|绔|闂|璧|鏍|杩|銆|锛|浜|浠|鏄|鍦|绱|鈥|濞|鏈|鍔|浜|鐗|鐭|浜|杩|鎴|璁|绗|鑱/;

function hasMojibake(item) {
  if (!item || typeof item !== "object") return false;
  for (const k of ["prompt", "promptZh", "story", "storyZh"]) {
    if (typeof item[k] === "string" && (MOJIBAKE.test(item[k]) || item[k].includes("�"))) {
      return true;
    }
  }
  return false;
}

const SYSTEM = `你是地理问答游戏 GroundGame 的出题人。你一次拿到一批"地点 + 事实线索",请为每个地点写出一道题目。

严格规则:

1. prompt(英文题干):必须包含一个"留白"位置,玩家要在地图上点出那个地方。留白有两种写法,任选其一:
   - 用 "this city" / "this town" / "this stadium" / "this university" / "this small town" / "this capital" / "this country" / "this college" / "this school" / "this club" 等说法;
   - 或直接用单词 "here"(例如 "...happened here in 1987" / "...played here")。
   - 题干里绝对不能出现答案地名、答案国家名、或它们的同义词/别称。也不能出现能一眼定位到答案的著名地标名。
   - 题干要包含事实线索(给出的 hint),让玩家有依据去猜。
   - 题干是英文,长度 12-24 词。必须是一个完整的句子,句末加句号。
   - 四个字段都必须写完整,不许留空、不许写省略号、不许只写半句。

2. promptZh(中文题干):中文翻译,保留同样的留白风格,留白用"这座城市""这个小镇""这座球场""这所大学""这个国家"等。绝对不能透露答案。长度 12-26 字,完整句子。

3. story(英文背景故事):1-2 句,关于答案地点本身,必须陈述一个真实可查的事实(年份、数字、人名、事件、纪录)。不要重复题干,不要解释计分规则,不要 emoji,不要 markdown。必须以句号结尾。

4. storyZh(中文背景故事):story 的中文翻译,同样的事实,完整句子,以句号结尾。

5. 每道题必须能靠给出的 hint 成立。如果 hint 不足以支撑一道好题,就换一个更具体的表述方式,而不是编造事实。

只输出 JSON 数组,每个元素形如:
{"prompt":"...","promptZh":"...","story":"...","storyZh":"..."}

不要输出任何解释文字。

重要:请用英文思考,不要在推理过程中写中文。你要输出的中文字段必须是正常的中文,不得出现乱码(例如"涓" "鈥" "锛"这类字符)。`;

function slug(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function scopeView(lat, lng, scope) {
  // City-scope questions get a public view centre that is deliberately NOT the
  // answer coordinates — it only frames the region so the player can zoom in
  // without the answer being visible. Deterministic so re-runs are stable.
  if (scope !== "city") return {};
  let h = 2166136261 >>> 0;
  const s = lat.toFixed(3) + "," + lng.toFixed(3);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const r = (n) => (h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296;
  // Offset the view centre so the answer point is never visible before the
  // player guesses. The magnitude is drawn from a fixed range and the SIGN
  // is random, so the offset can never cancel itself out to near zero.
  const magLat = 2.5 + r() * 4.5; // 2.5 - 7.0 degrees
  const magLng = 3.0 + r() * 5.5; // 3.0 - 8.5 degrees
  const dLat = (r() < 0.5 ? -1 : 1) * magLat;
  const dLng = (r() < 0.5 ? -1 : 1) * magLng;
  const vLat = Math.max(-70, Math.min(75, lat + dLat));
  let vLng = lng + dLng;
  if (vLng > 180) vLng -= 360;
  if (vLng < -180) vLng += 360;
  // Safety net: if clamping or wraparound pulled the centre onto the answer,
  // push it back out along the original offset direction.
  if (Math.abs(vLat - lat) + Math.abs(vLng - lng) < 1.0) {
    const fixLat = Math.max(-70, Math.min(75, lat + (dLat > 0 ? 3 : -3)));
    let fixLng = lng + (dLng > 0 ? 4 : -4);
    if (fixLng > 180) fixLng -= 360;
    if (fixLng < -180) fixLng += 360;
    return {
      viewLat: Number(fixLat.toFixed(4)),
      viewLng: Number(fixLng.toFixed(4)),
    };
  }
  return {
    viewLat: Number(vLat.toFixed(4)),
    viewLng: Number(vLng.toFixed(4)),
  };
}

const SPORT_ALIAS = {
    "american football": "nfl",
    baseball: "mlb",
    basketball: "nba",
    "ice hockey": "nhl",
    soccer: "soccer",
    golf: "golf",
    tennis: "tennis",
    olympics: "olympics",
    racing: "racing",
    running: "running",
    cycling: "cycling",
    boxing: "boxing",
    rugby: "rugby",
    swimming: "swimming",
    athletics: "athletics",
    gymnastics: "gymnastics",
    cricket: "cricket",
    bobsled: "bobsled",
    skiing: "skiing",
    "canadian football": "cfl",
    motorsport: "motorsport",
  };

/** The id prefix a seed row will produce. */
function sportAliasFor(sport) {
  return SPORT_ALIAS[sport] || slug(sport);
}

function buildId(seed, used) {
  const base = `${sportAliasFor(seed.sport)}-${slug(seed.place)}`;
  let id = base;
  let n = 1;
  while (used.has(id)) {
    n += 1;
    id = `${base}-${n}`;
  }
  used.add(id);
  return id;
}

function validate(item, seed) {
  const errs = [];
  if (!item || typeof item !== "object") return ["not an object"];
  for (const k of ["prompt", "promptZh", "story", "storyZh"]) {
    const v = item[k];
    if (typeof v !== "string" || v.trim().length < 4) {
      errs.push(`missing ${k}`);
      continue;
    }
    const t = v.trim();
    // Truncation guards: the model sometimes gets cut off mid-sentence.
    if (/\.\.\.$|…$|^[,，、]$/.test(t)) errs.push(`${k} truncated`);
    if (/[,，、]\s*$/.test(t)) errs.push(`${k} ends mid-clause`);
    if (/\b(XX|XXX|VIII)\b/.test(t)) errs.push(`${k} looks like a lone numeral`);
  }
  if (errs.length) return errs;

  const answer = seed.place.toLowerCase();
  const head = answer.split(",")[0].trim();
  if (head.length > 3 && item.prompt.toLowerCase().includes(head)) {
    errs.push("prompt leaks answer");
  }
  // The English prompt must end in a complete sentence.
  if (!/[.!?"')\]]$/.test(item.prompt.trim())) errs.push("prompt not a full sentence");  if (!/\bthis\s+\w/i.test(item.prompt) && !/\bhere\b/i.test(item.prompt)) {
    errs.push("prompt has no blank");
  }
  if (item.prompt.split(/\s+/).length < 10) errs.push("prompt too short");
  if (item.prompt.split(/\s+/).length > 30) errs.push("prompt too long");
  if (item.promptZh.length < 10) errs.push("promptZh too short");
  if (item.promptZh.length > 90) errs.push("promptZh too long");
  if (item.story.length < 40) errs.push("story too short");
  if (item.story.split(/\s+/).length < 8) errs.push("story too short");
  if (!/[。.!?]$/.test(item.story.trim())) errs.push("story not terminated");
  if (item.storyZh.length < 15) errs.push("storyZh too short");
  if (!/[。.!?]$/.test(item.storyZh.trim())) errs.push("storyZh not terminated");
  return errs;
}

function loadBank() {
  const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
  return raw;
}

async function main() {
  const bank = loadBank();
  const existing = bank.questions;
  console.log(`existing questions: ${existing.length} / target ${TARGET}`);

  const usedIds = new Set(existing.map((q) => q.id));

  // Build the work list. A place may appear several times in the seed file,
  // each row carrying a different fact anchor — those become genuinely
  // different questions, not paraphrases.
  const todo = [];
  const seenRows = new Set();
  for (const s of seeds) {
    const key = `${s.place}|${s.scope}|${s.hint.slice(0, 40)}`;
    if (seenRows.has(key)) continue;
    seenRows.add(key);
    todo.push(s);
  }

  // Resumability: rows are consumed in seed order, so a re-run must skip the
  // rows that already produced a question. buildId() derives the id from the
  // place plus a numeric suffix, so we rebuild the same id for every seed row
  // and skip the rows whose id is already in the bank.
  const probeIds = new Set();
  const rowId = [];
  for (const s of todo) {
    const base = `${sportAliasFor(s.sport)}-${slug(s.place)}`;
    let id = base;
    let n = 1;
    while (probeIds.has(id)) {
      n += 1;
      id = `${base}-${n}`;
    }
    probeIds.add(id);
    rowId.push(id);
  }

  const fresh = [];
  todo.forEach((s, i) => {
    if (usedIds.has(rowId[i])) return; // already generated in a previous run
    fresh.push(s);
  });
  console.log(
    `candidate slots: ${todo.length}, already generated: ${todo.length - fresh.length}, to do: ${fresh.length}`
  );

  const need = Math.max(0, TARGET - existing.length);
  const work = fresh.slice(0, need);
  const created = [];
  const rejected = [];

  const accept = (seed, item) => {
    const q = {
      id: buildId(seed, usedIds),
      prompt: item.prompt.trim(),
      answer: seed.place,
      lat: seed.lat,
      lng: seed.lng,
      scope: seed.scope,
      sport: seed.sport,
      tags: seed.tags,
      ...scopeView(seed.lat, seed.lng, seed.scope),
      promptZh: item.promptZh.trim(),
      story: item.story.trim(),
      storyZh: item.storyZh.trim(),
    };
    created.push(q);
    console.log("  ok", q.id, "|", q.prompt.slice(0, 68));
  };

  // generate one batch; returns {seed, item} pairs that still need repair
  const runBatch = async (slice) => {
    const payload = slice.map((s) => ({
      place: s.place,
      sport: s.sport,
      scope: s.scope,
      hint: s.hint,
    }));
    let items = null;
    for (let attempt = 1; attempt <= 3 && !items; attempt++) {
      try {
        const text = await chat([
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(payload, null, 1) },
        ]);
        items = parseJsonLoose(text);
      } catch (e) {
        console.error("  batch failed:", e.message);
        if (attempt === 3) break;
        await sleep(2000 * attempt);
      }
    }
    if (!items) return null;
    return items;
  };

  let cursor = 0;
  while (cursor < work.length) {
    const slice = work.slice(cursor, cursor + BATCH);
    console.log(
      `\n[${cursor + 1}-${cursor + slice.length}/${work.length}] ` +
        slice.map((s) => s.place).join(" | ")
    );
    const items = await runBatch(slice);
    if (!items) {
      console.error("  SKIPPING batch (all attempts failed)");
      cursor += slice.length;
      continue;
    }

    const needsRepair = [];
    slice.forEach((seed, idx) => {
      const item = items[idx];
      if (!item) {
        console.error("  no item for", seed.place);
        rejected.push({ seed, reason: "no item returned" });
        return;
      }
      let errs = validate(item, seed);
      if (!errs.length && hasMojibake(item)) errs.push("mojibake");
      if (errs.length) {
        console.error("  repair", seed.place, "|", errs.join(", "));
        needsRepair.push({ seed, item, errs });
      } else {
        accept(seed, item);
      }
    });

    // Repair pass: re-ask for the failed items individually, one call each.
    // Most failures are truncation, which a single-item retry fixes.
    for (const bad of needsRepair) {
      let fixed = null;
      for (let attempt = 1; attempt <= 5 && !fixed; attempt++) {
        try {
          const text = await chat([
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: JSON.stringify(
                [
                  {
                    place: bad.seed.place,
                    sport: bad.seed.sport,
                    scope: bad.seed.scope,
                    hint: bad.seed.hint,
                  },
                ],
                null,
                1
              ) +
                `\n\n上一次回复有这些问题: ${bad.errs.join(", ")}。请重新完整写一遍这四个字段,句子必须写完整。中文必须是正常中文,不要乱码。请用英文思考。`,
            },
          ]);
          const arr = parseJsonLoose(text);
          if (arr && arr[0]) {
            const errs2 = validate(arr[0], bad.seed);
            if (hasMojibake(arr[0])) errs2.push("mojibake");
            if (!errs2.length) fixed = arr[0];
            else console.error("  repair still bad:", bad.seed.place, errs2.join(", "));
          }
        } catch (e) {
          console.error("  repair failed:", bad.seed.place, e.message);
          await sleep(1500 * attempt);
        }
      }
      if (fixed) accept(bad.seed, fixed);
      else rejected.push({ seed: bad.seed, reason: bad.errs.join(", ") });
    }

    cursor += slice.length;

    if (!DRY) {
      const merged = {
        ...bank,
        meta: { ...bank.meta, version: (bank.meta.version || 1) + 1 },
        questions: [...existing, ...created],
      };
      fs.writeFileSync(DATA, JSON.stringify(merged, null, 2) + "\n", "utf8");
      console.log(`  saved. total now ${merged.questions.length}`);
    }
  }

  console.log(`\nDONE. created ${created.length}, rejected ${rejected.length}`);
  if (rejected.length) {
    console.log("rejected slots (for a retry run):");
    rejected.forEach((r) => console.log("  -", r.seed.place, "|", r.seed.hint.slice(0, 50), "|", r.reason));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
