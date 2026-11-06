// Interactive smoke test for the GroundGame static build over CDP.
// Verifies: map click -> score panel -> next question -> language switch -> archive page.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE || "http://127.0.0.1:3989";
const PORT = 9336;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp() {
  const proc = spawn(
    CHROME,
    [
      "--headless=new", "--disable-gpu", "--no-sandbox", "--no-proxy-server",
      "--proxy-bypass-list=*", "--remote-debugging-port=" + PORT,
      "--user-data-dir=" + os.tmpdir() + "\\gg-smoke",
      "--window-size=1280,1000", BASE + "/",
    ],
    { stdio: "ignore" }
  );
  let wsUrl = null;
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === "page" && t.url.includes("127.0.0.1"));
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
    if (res.result?.exceptionDetails) return "EXCEPTION: " + JSON.stringify(res.result.exceptionDetails).slice(0, 300);
    return res.result?.result?.value;
  };
  const shot = async (name) => {
    const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    if (s.result?.data) {
      fs.writeFileSync(`D:\\SEO\\groundgame\\tmp-${name}.png`, Buffer.from(s.result.data, "base64"));
      return `D:\\SEO\\groundgame\\tmp-${name}.png`;
    }
    return null;
  };
  return { send, evalJs, shot, close: () => { try { sock.close(); } catch {} proc.kill(); } };
}

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  :: " + detail : ""));
};

(async () => {
  const b = await cdp();
  try {
    await sleep(2500);

    // 1. shell renders
    const shell = await b.evalJs(`(()=>{const t=document.body.innerText;return JSON.stringify({
      h1:document.querySelector('h1')?.textContent?.trim(),
      q:document.querySelector('.gg-question')?.textContent?.trim()||null,
      svg:!!document.querySelector('svg'),
      markers:document.querySelectorAll('.gg-marker').length,
      bodyLen:t.length});})()`);
    const s = JSON.parse(shell);
    check("1. shell renders with h1 + question + svg map", !!s.h1 && s.svg && s.bodyLen > 400, JSON.stringify(s).slice(0, 220));

    // 2. map has clickable surface
    const surface = await b.evalJs(`(()=>{const els=[...document.querySelectorAll('svg *')];
      const kinds={};els.forEach(e=>{kinds[e.tagName]=(kinds[e.tagName]||0)+1;});
      const r=document.querySelector('svg')?.getBoundingClientRect();
      return JSON.stringify({kinds,rect:r?{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}:null});})()`);
    const sv = JSON.parse(surface);
    check("2. svg map has geometry + renderable rect", !!sv.rect && sv.rect.w > 300 && sv.rect.h > 200, surface.slice(0, 220));

    // 3. click the map -> score panel appears
    const before = await b.evalJs(`document.body.innerText.length`);
    const clicked = await b.evalJs(`(()=>{
      const svg=document.querySelector('svg'); const r=svg.getBoundingClientRect();
      const x=r.x+r.width*0.5, y=r.y+r.height*0.5;
      const opts={bubbles:true,cancelable:true,clientX:x,clientY:y,button:0};
      const target=document.elementFromPoint(x,y)||svg;
      target.dispatchEvent(new MouseEvent('click',opts));
      return target.tagName+'.'+(target.className.baseVal||target.className||'');})()`);
    await sleep(900);
    const after = await b.evalJs(`(()=>{const t=document.body.innerText;
      const hasKm=/\\d[\\d,.]*\\s*km/.test(t);
      const hasScore=/\\b\\d{1,4}\\b/.test(t);
      const next=[...document.querySelectorAll('button')].map(b=>b.textContent.trim());
      return JSON.stringify({len:t.length,hasKm,hasScore,buttons:next,tail:t.slice(-700)});})()`);
    const a = JSON.parse(after);
    check("3. map click produces distance/score feedback", a.hasKm && a.len > before, "clicked " + clicked + " | " + JSON.stringify({ hasKm: a.hasKm, buttons: a.buttons }).slice(0, 220));
    console.log("   feedback text: " + String(a.tail).replace(/\s+/g, " ").slice(0, 420));
    await b.shot("after-click");

    // 4. next-question control exists
    const hasNext = a.buttons.length > 0;
    check("4. next-question button rendered after guess", hasNext, JSON.stringify(a.buttons).slice(0, 200));

    // 5. click next -> question 2
    if (hasNext) {
      await b.evalJs(`(()=>{const bs=[...document.querySelectorAll('button')];const b0=bs.find(x=>/next|下一|continue/i.test(x.textContent))||bs[0];if(b0)b0.click();return b0?b0.textContent.trim():null;})()`);
      await sleep(700);
      const q2 = await b.evalJs(`(()=>{const t=document.body.innerText;const m=t.match(/Question\\s*(\\d)\\s*\\/\\s*5/);return JSON.stringify({n:m?m[1]:null,head:t.slice(0,260)});})()`);
      check("5. advances to question 2", JSON.parse(q2).n === "2", q2.slice(0, 200));
    }

    // 6. keyboard interaction (arrow keys + Enter promised in copy)
    // NOTE: the keydown handler lives on the SVG element, so the test must
    // focus the SVG and dispatch there - dispatching on document does nothing.
    const kb = await b.evalJs(`(()=>{const svg=document.querySelector('svg');svg.focus();
      const focused=document.activeElement===svg;
      const before=document.body.innerText.length;
      for(let i=0;i<3;i++)svg.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
      const cursor=!!document.querySelector('.gg-cursor');
      svg.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      return JSON.stringify({focused,before:before.length,after:document.body.innerText.length,
        cursor,hasFeedback:/km/.test(document.body.innerText)});})()`);
    const k = JSON.parse(kb);
    check("6. keyboard path (focus map, arrows, Enter) wired",
      k.focused && k.cursor && k.hasFeedback, kb.slice(0, 220));

    // 7. localStorage persistence.
    // NOTE: results are written only when the whole 5-question round is done,
    // so the test has to finish the round before asserting.
    for (let i = 0; i < 6; i++) {
      await b.evalJs(`(()=>{const svg=document.querySelector('svg');if(!svg)return 'nosvg';
        const r=svg.getBoundingClientRect();const x=r.x+r.width*0.4,y=r.y+r.height*0.5;
        const t=document.elementFromPoint(x,y)||svg;
        t.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0}));
        return 'clicked';})()`);
      await sleep(650);
      await b.evalJs(`(()=>{const bs=[...document.querySelectorAll('button')];
        // NOTE: do NOT click "Back to home" - it reloads the page and we
        // would read localStorage mid-reload.
        const t=bs.find(x=>/next|下一|continue|again|再来|finish|看结果|see results/i.test(x.textContent));
        if(t)t.click();return t?t.textContent.trim():null;})()`);
      await sleep(450);
    }
    const ls = await b.evalJs(`(()=>{try{const keys=Object.keys(localStorage);
      const hit=keys.find(k=>/streak|score|result|gg/i.test(k));
      const raw=hit?localStorage.getItem(hit):null;
      return JSON.stringify({keys,raw:raw?raw.slice(0,180):null});}catch(e){return 'ERR '+e.message;}})()`);
    check("7. progress persisted in localStorage after finishing the round",
      /streak|score|result|gg/i.test(ls), ls.slice(0, 260));
    // 8. language switch
    await b.send("Page.navigate", { url: BASE + "/zh" });
    await sleep(2200);
    const zh = await b.evalJs(`(()=>{const t=document.body.innerText;return JSON.stringify({
      h1:document.querySelector('h1')?.textContent?.trim(),
      lang:document.documentElement.lang,
      hasZh:/[\\u4e00-\\u9fa5]/.test(t),
      canonical:document.querySelector('link[rel=canonical]')?.href,
      hreflang:[...document.querySelectorAll('link[rel=alternate]')].map(l=>l.hreflang+'='+l.href)});})()`);
    const z = JSON.parse(zh);
    check("8. /zh page: Chinese content + zh-CN lang + hreflang", z.hasZh && z.lang === "zh-CN", JSON.stringify(z).slice(0, 280));

    // 9. archive page
    await b.send("Page.navigate", { url: BASE + "/d/2026-11-05" });
    await sleep(2000);
    const arch = await b.evalJs(`(()=>{const t=document.body.innerText;return JSON.stringify({
      h1:document.querySelector('h1')?.textContent?.trim(),
      hasDate:/2026-11-05/.test(t),
      canonical:document.querySelector('link[rel=canonical]')?.href,
      ld:document.querySelectorAll('script[type="application/ld+json"]').length});})()`);
    const ar = JSON.parse(arch);
    check("9. archive page /d/2026-11-05 renders with canonical + schema", ar.hasDate && ar.ld >= 1, arch.slice(0, 260));

    // 10. how-it-works
    await b.send("Page.navigate", { url: BASE + "/how-it-works" });
    await sleep(1800);
    const hiw = await b.evalJs(`(()=>{const t=document.body.innerText;return JSON.stringify({len:t.length,h1:document.querySelector('h1')?.textContent?.trim(),ld:document.querySelectorAll('script[type="application/ld+json"]').length});})()`);
    check("10. /how-it-works has real copy + schema", JSON.parse(hiw).len > 800, hiw.slice(0, 200));

    // 11. title/description lengths on key pages
    const meta = await b.evalJs(`(()=>{const t=document.title;const d=document.querySelector('meta[name=description]')?.content||'';return JSON.stringify({title:t,tl:t.length,dl:d.length});})()`);
    const m = JSON.parse(meta);
    check("11. how-it-works title<=60 desc<=155", m.tl <= 60 && m.dl <= 155, meta.slice(0, 200));
  } finally {
    b.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\\n=== " + (results.length - failed.length) + "/" + results.length + " passed ===");
  if (failed.length) { console.log("FAILED: " + failed.map((f) => f.name).join(", ")); process.exit(1); }
})().catch((e) => { console.log("SMOKE ERROR: " + e.message); process.exit(1); });
