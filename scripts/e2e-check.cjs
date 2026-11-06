// End-to-end check of the GroundGame static export through Chrome DevTools Protocol.
// Opens the built site, clicks the map five times, and reports what the game
// actually did: question progression, score feedback, final summary.
//
// Usage: node scripts/e2e-check.cjs <url> [cdpPort]
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const URL = process.argv[2] || "http://127.0.0.1:3989/";
const PORT = Number(process.argv[3] || 9222);
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PROFILE = path.join(require("os").tmpdir(), "groundgame-e2e-" + Date.now());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--window-size=1280,900",
    "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + PROFILE,
    "about:blank",
  ], { stdio: "ignore" });

  let targets = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      targets = await r.json();
      if (targets.some((t) => t.type === "page")) break;
    } catch {}
  }
  if (!targets) throw new Error("chrome devtools never came up");
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const myId = ++id;
      pending.set(myId, resolve);
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result?.result?.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: URL });
  await sleep(3500);

  const report = { steps: [] };

  report.steps.push(await evaluate(`(() => ({
    phase: 'loaded',
    h1: (document.querySelector('h1')||{}).textContent,
    questionLabel: (document.body.innerText.match(/Question \\d+\\/\\d+/)||[''])[0],
    prompt: (document.querySelector('[class*=prompt],[class*=clue]')||{}).innerText||'',
    score: (document.body.innerText.match(/(\\d+)\\s*streak/)||[''])[0]
  }))()`));

  // Click the map five times, advancing between questions.
  for (let q = 0; q < 5; q++) {
    const box = await evaluate(`(() => {
      const el = document.querySelector('svg[class*=map], .gg-map, [class*=worldmap]') || document.querySelector('svg');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width*0.5, y: r.top + r.height*0.45, w: r.width, h: r.height };
    })()`);
    if (!box) { report.steps.push({ error: "no map svg found" }); break; }

    for (const type of ["mousePressed", "mouseReleased"]) {
      await send("Input.dispatchMouseEvent", {
        type, x: Math.round(box.x), y: Math.round(box.y), button: "left", clickCount: 1,
      });
    }
    await sleep(900);

    const after = await evaluate(`(() => ({
      questionLabel: (document.body.innerText.match(/Question \\d+\\/\\d+/)||[''])[0],
      hasResult: /km|Nailed|Close|Way off|得分|公里/i.test(document.body.innerText),
      resultText: (document.body.innerText.match(/(Nailed it|Close-ish|Way off|Close)[^\\n]{0,60}/i)||[''])[0],
      scoreText: (document.body.innerText.match(/\\b\\d{1,5}\\b(?=[^\\n]{0,12}streak)/)||[''])[0]
    }))()`);
    report.steps.push({ click: q + 1, ...after });

    // advance to next question if a next button exists
    const advanced = await evaluate(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const next = btns.find(b => /next|下一|continue|继续|again|再来/i.test(b.textContent||''));
      if (next) { next.click(); return next.textContent.trim().slice(0,30); }
      return null;
    })()`);
    if (advanced) await sleep(700);
  }

  report.final = await evaluate(`(() => ({
    bodyText: document.body.innerText.slice(0, 1400),
    hasSummary: /total|总|final|summary|streak|连胜/i.test(document.body.innerText),
    buttons: Array.from(document.querySelectorAll('button')).map(b=>b.textContent.trim().slice(0,30)),
    links: Array.from(document.querySelectorAll('a')).map(a=>a.getAttribute('href')).slice(0,20)
  }))()`);

  console.log(JSON.stringify(report, null, 1));
  ws.close();
  chrome.kill();
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch {}
  process.exit(0);
})().catch((e) => {
  console.error("E2E FAILED:", e.message);
  process.exit(1);
});
