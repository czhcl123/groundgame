// Interactive smoke test for the GroundGame build over CDP.
//
// Runs a real headless Chrome against the site and checks that the game
// actually works: the map renders, a click scores, the round advances, the
// keyboard path works, progress persists, and the SEO-critical markup is
// present on every page type.
//
// Usage:
//   node scripts/smoke-test.cjs                       # local static server
//   BASE_URL=https://host node scripts/smoke-test.cjs # against a deployed URL
//
// Notes:
//  - A unique profile dir per run matters: the game remembers a finished
//    round in localStorage and jumps straight to the summary page, which
//    would make the "playing" assertions fail.
//  - The debug port is randomised for the same reason - a stale Chrome from
//    an earlier run would otherwise be picked up instead of this one.

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const http = require("http");
const path = require("path");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ROOT = path.resolve(__dirname, "..", "out");
const PORT = Number(process.env.SERVE_PORT || 3991);
const CDP_PORT = 9400 + Math.floor(Math.random() * 400);
const BASE = (process.env.BASE_URL || `http://127.0.0.1:${PORT}`).replace(/\/$/, "");
const USE_LOCAL_SERVER = !process.env.BASE_URL;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- static server

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) return void res.writeHead(403).end("forbidden");
    // Next static export emits /foo -> foo.html and /foo/ -> foo/index.html.
    const isFile = (q) => fs.existsSync(q) && fs.statSync(q).isFile();
    const candidates = [];
    if (!url.endsWith("/")) candidates.push(file + ".html");
    candidates.push(path.join(file, "index.html"));
    candidates.push(file);
    file = candidates.find(isFile);
    if (!file) return void res.writeHead(404, { "content-type": "text/plain" }).end("404 " + url);
    const body = fs.readFileSync(file);
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] || "application/octet-stream",
      "content-length": body.length,
    });
    res.end(body);
  });
  return new Promise((resolve) => server.listen(PORT, "127.0.0.1", () => resolve(server)));
}

// ---------------------------------------------------------------- CDP client

async function connect() {
  const profile = path.join(os.tmpdir(), "gg-smoke-" + process.pid + "-" + Date.now());
  const proc = spawn(
    CHROME,
    [
      "--headless=new", "--disable-gpu", "--no-sandbox", "--no-proxy-server",
      "--proxy-bypass-list=*", "--remote-debugging-port=" + CDP_PORT,
      "--user-data-dir=" + profile,
      "--window-size=1280,1000", BASE + "/",
    ],
    { stdio: "ignore" }
  );
  let wsUrl = null;
  const needle = BASE.replace(/^https?:\/\//, "").split("/")[0];
  for (let i = 0; i < 75; i++) {
    await sleep(400);
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      const p = list.find((t) => t.type === "page" && t.url.includes(needle));
      if (p && p.webSocketDebuggerUrl) { wsUrl = p.webSocketDebuggerUrl; break; }
    } catch {}
  }
  if (!wsUrl) { proc.kill(); throw new Error("no CDP target"); }
  const sock = new WebSocket(wsUrl);
  await new Promise((res, rej) => { sock.onopen = res; sock.onerror = rej; });
  let id = 0; const pend = new Map();
  sock.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  };
  const send = (method, params = {}) =>
    new Promise((r) => { const i = ++id; pend.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expression) => {
    const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (res.result && res.result.exceptionDetails) {
      return "EXCEPTION: " + JSON.stringify(res.result.exceptionDetails).slice(0, 300);
    }
    return res.result && res.result.result ? res.result.result.value : undefined;
  };
  const shot = async (name) => {
    const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    if (s.result && s.result.data) {
      const p = path.join(ROOT, "..", "tmp-" + name + ".png");
      fs.writeFileSync(p, Buffer.from(s.result.data, "base64"));
      return p;
    }
    return null;
  };
  return {
    send, evalJs, shot,
    on: (ev, cb) => sock.addEventListener("message", cb),
    off: (ev, cb) => sock.removeEventListener("message", cb),
    close: () => {
      try { sock.close(); } catch {}
      try { proc.kill(); } catch {}
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
    },
  };
}

// ---------------------------------------------------------------- assertions


// Navigate and wait until the new document is really there.
// Page.navigate returns before the new document has parsed, so a fixed sleep
// is not enough - poll readyState and the expected body instead.
async function goto(b, url, expect) {
  await b.send("Page.navigate", { url });
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    const ready = await b.evalJs(
      "(()=>{const t=document.body?document.body.innerText:'';return JSON.stringify({" +
      "state:document.readyState,len:t.length," +
      "hit:" + (expect ? "t.includes(" + JSON.stringify(expect) + ")" : "true") + "});})()"
    );
    if (!ready || String(ready).startsWith("EXCEPTION")) continue;
    const st = JSON.parse(ready);
    if (st.state === "complete" && st.len > 200 && st.hit) return true;
  }
  return false;
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? "  :: " + detail : ""));
}

// ---------------------------------------------------------------- run

(async () => {
  let server = null;
  if (USE_LOCAL_SERVER) {
    server = await startStaticServer();
    console.log("static server on " + BASE + " (root " + ROOT + ")");
  } else {
    console.log("testing against " + BASE);
  }

  const b = await connect();
  try {
    await sleep(3000);

    // 1 — shell renders
    const shell = await b.evalJs(`(()=>{const t=document.body.innerText;return JSON.stringify({
      h1:document.querySelector('h1')?.textContent?.trim(),
      svg:!!document.querySelector('svg'),
      bodyLen:t.length,
      prompt:(document.querySelector('.gg-prompt')||{}).textContent||null,
      done:/points|总分/.test(t)&&!/Question|第\\s*\\d/.test(t)});})()`);
    const s = JSON.parse(shell);
    check("1 shell renders (h1 + prompt + svg map)",
      !!s.h1 && s.svg && !!s.prompt && !s.done, JSON.stringify(s).slice(0, 200));

    // 2 — map geometry
    const geo = await b.evalJs(`(()=>{const r=document.querySelector('svg')?.getBoundingClientRect();
      const kinds={};[...document.querySelectorAll('svg *')].forEach(e=>{kinds[e.tagName]=(kinds[e.tagName]||0)+1;});
      return JSON.stringify({kinds,rect:r?{w:Math.round(r.width),h:Math.round(r.height)}:null});})()`);
    const g = JSON.parse(geo);
    check("2 svg map has land polygons + size",
      g.kinds.polygon >= 5 && g.rect.w > 300 && g.rect.h > 200, geo.slice(0, 200));

    // 3 — click the map -> score feedback
    const clicked = await b.evalJs(`(()=>{const svg=document.querySelector('svg');const r=svg.getBoundingClientRect();
      const x=r.x+r.width*0.45,y=r.y+r.height*0.5;
      const t=document.elementFromPoint(x,y)||svg;
      t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0}));
      return t.tagName+' '+(t.getAttribute('class')||'');})()`);
    await sleep(1000);
    const fb = await b.evalJs(`(()=>{const t=document.body.innerText;
      return JSON.stringify({len:t.length,km:/(km|KM)/.test(t),
        buttons:[...document.querySelectorAll('button')].map(b=>b.textContent.trim())});})()`);
    const f = JSON.parse(fb);
    check("3 map click -> feedback panel with distance",
      f.len > 300 && f.km, "clicked " + clicked + " buttons=" + JSON.stringify(f.buttons));

    // 4 — continue control
    check("4 continue button present after guess", f.buttons.length > 0, JSON.stringify(f.buttons).slice(0, 160));

    // 4b — the location story is what makes a right answer worth anything.
    const story = await b.evalJs(`(()=>{const el=document.querySelector('.gg-feedback-story');
      return JSON.stringify({present:!!el,text:el?el.textContent.trim().slice(0,120):null});})()`);
    const st = JSON.parse(story);
    check("4b location story shown after the answer",
      st.present && st.text && st.text.length > 25, story.slice(0, 200));

    // 5 — advance to Q2
    if (f.buttons.length) {
      await b.evalJs(`(()=>{const bs=[...document.querySelectorAll('button')];
        const t=bs.find(x=>/next|下一|continue|see results|看结果/i.test(x.textContent));
        if(t)t.click();return t?t.textContent.trim():null;})()`);
      await sleep(900);
      const q2 = await b.evalJs(`(()=>{const t=document.body.innerText;
        const m=t.match(/Question\\s*(\\d)\\s*\\/\\s*5/i)||t.match(/第\\s*(\\d)\\s*\\/\\s*5/);
        return JSON.stringify({n:m?m[1]:null});})()`);
      check("5 advances to question 2", JSON.parse(q2).n === "2", q2.slice(0, 160));
    }

    // 6 — keyboard path: focus the SVG, then arrows + Enter
    const kb = await b.evalJs(`(()=>{const svg=document.querySelector('svg');svg.focus();
      const focused=document.activeElement===svg;
      for(let i=0;i<3;i++)svg.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
      const cursor=!!document.querySelector('.gg-cursor');
      svg.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      return JSON.stringify({focused,cursor,hasFeedback:/km/.test(document.body.innerText)});})()`);
    await sleep(600);
    const k = JSON.parse(kb);
    check("6 keyboard path (focus map, arrows, Enter) wired",
      k.focused && k.cursor && k.hasFeedback, kb.slice(0, 200));

    // 7 — localStorage after finishing the round.
    // Results are only written once the whole 5-question round is done, so
    // play it out first. Never click "Back to home" - it reloads the page.
    for (let i = 0; i < 6; i++) {
      await b.evalJs(`(()=>{const svg=document.querySelector('svg');if(!svg)return 'nosvg';
        const r=svg.getBoundingClientRect();const x=r.x+r.width*0.4,y=r.y+r.height*0.5;
        const t=document.elementFromPoint(x,y)||svg;
        t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0}));
        return 'clicked';})()`);
      await sleep(700);
      await b.evalJs(`(()=>{const bs=[...document.querySelectorAll('button')];
        const t=bs.find(x=>/next|下一|continue|see results|看结果/i.test(x.textContent));
        if(t)t.click();return t?t.textContent.trim():null;})()`);
      await sleep(500);
    }
    const ls = await b.evalJs(`(()=>{try{const keys=Object.keys(localStorage);
      const hit=keys.find(k=>/streak|score|result|gg/i.test(k));
      const raw=hit?localStorage.getItem(hit):null;
      return JSON.stringify({keys,raw:raw?raw.slice(0,160):null});}catch(e){return 'ERR '+e.message;}})()`);
    check("7 progress persisted in localStorage after the round",
      /streak|score|result|gg/i.test(ls), ls.slice(0, 240));

    // 8 — Chinese page.
    // Clear the saved round first: a returning player is shown their results
    // instead of the question, so .gg-prompt would not exist.
    await b.evalJs("localStorage.clear()");
    await goto(b, BASE + "/zh", "\u6bcf\u5929");
    const zh = await b.evalJs(`(()=>{const t=document.body.innerText;return JSON.stringify({
      h1:document.querySelector('h1')?.textContent?.trim(),lang:document.documentElement.lang,
      hasCjk:/[\\u4e00-\\u9fa5]/.test(t),canon:document.querySelector('link[rel=canonical]')?.href,
      alt:[...document.querySelectorAll('link[rel=alternate]')].map(l=>l.hreflang),
      ld:document.querySelectorAll("script[type='application/ld+json']").length,
      promptZh:/[\\u4e00-\\u9fa5]/.test((document.querySelector('.gg-prompt')||{}).textContent||'')});})()`);
    const z = JSON.parse(zh);
    const zhStory = await b.evalJs(`(()=>{const svg=document.querySelector('svg');if(!svg)return 'nosvg';
      const r=svg.getBoundingClientRect();const x=r.x+r.width*0.4,y=r.y+r.height*0.5;
      const t=document.elementFromPoint(x,y)||svg;
      t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0}));
      return 'clicked';})()`);
    await sleep(900);
    const zhs = await b.evalJs(`(()=>{const el=document.querySelector('.gg-feedback-story');
      return JSON.stringify({present:!!el,text:el?el.textContent.trim().slice(0,90):null});})()`);
    const zs = JSON.parse(zhs);
    check("8b Chinese location story shown",
      zs.present && /[\u4e00-\u9fa5]/.test(zs.text || ""), zhs.slice(0, 180));

    check("8 /zh: CJK copy + prompt + lang=zh-CN + canonical + hreflang + schema",
      z.hasCjk && z.promptZh && z.lang === "zh-CN" && !!z.canon && z.alt.length >= 3 && z.ld >= 1,
      JSON.stringify(z).slice(0, 300));

    // 9 — archive page
    await goto(b, BASE + "/d/2026-11-05", "2026-11-05");
    const arch = await b.evalJs(`(()=>{const t=document.body.innerText;return JSON.stringify({
      hasDate:/2026-11-05/.test(t),canon:document.querySelector('link[rel=canonical]')?.href,
      alt:[...document.querySelectorAll('link[rel=alternate]')].map(l=>l.hreflang),
      ld:document.querySelectorAll("script[type='application/ld+json']").length});})()`);
    const ar = JSON.parse(arch);
    check("9 /d/2026-11-05 archive renders (date + canonical + hreflang + schema)",
      ar.hasDate && !!ar.canon && ar.alt.length >= 3 && ar.ld >= 1, JSON.stringify(ar).slice(0, 260));

    // 10 — how-it-works
    await goto(b, BASE + "/how-it-works", "scoring");
    const hiw = await b.evalJs(`(()=>{const t=document.body.innerText;return JSON.stringify({
      len:t.length,h1:document.querySelector('h1')?.textContent?.trim(),
      ld:document.querySelectorAll("script[type='application/ld+json']").length,
      tl:document.title.length,dl:(document.querySelector('meta[name=description]')?.content||'').length});})()`);
    const h = JSON.parse(hiw);
    check("10 /how-it-works: copy + schema + meta lengths within limits",
      h.len > 800 && h.ld >= 1 && h.tl <= 60 && h.dl <= 155, JSON.stringify(h).slice(0, 240));

    // 11 — sitemap coverage
    const sm = await b.evalJs(`fetch('/sitemap.xml').then(r=>r.text()).then(t=>JSON.stringify({
      n:(t.match(/<loc>/g)||[]).length,hasZh:t.includes('/zh/d/'),hasD:t.includes('/d/')}))`);
    const smj = JSON.parse(sm);
    check("11 sitemap lists EN + ZH + archive URLs",
      smj.n >= 180 && smj.hasZh && smj.hasD, sm.slice(0, 200));
  } finally {
    b.close();
    if (server) server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n=== " + (results.length - failed.length) + "/" + results.length + " checks passed ===");
  if (failed.length) {
    console.log("FAILED: " + failed.map((f) => f.name).join(" | "));
    process.exit(1);
  }
  console.log("ALL PASS");
})().catch((e) => {
  console.log("SMOKE ERROR: " + (e && e.stack ? e.stack : e));
  process.exit(1);
});
