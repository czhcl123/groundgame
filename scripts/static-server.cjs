// Minimal static file server for verifying the exported Next.js site locally.
// Usage: node scripts/static-server.cjs <rootDir> [port]
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(process.argv[2] || ".");
// PORT: prefer the environment variable the platform injects (Railway sets it
// to whatever port its proxy expects), then the argv value, then a default.
const PORT = Number(process.env.PORT || process.argv[3] || 3989);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    const exists = (p) => fs.existsSync(p) && fs.statSync(p).isFile();
    // Next static export emits /foo -> foo.html and /foo/ -> foo/index.html
    const candidates = [];
    if (!url.endsWith("/")) candidates.push(file + ".html");
    candidates.push(path.join(file, "index.html"));
    candidates.push(file);
    if (exists(file) && fs.statSync(file).isDirectory()) candidates.push(path.join(file, "index.html"));
    file = candidates.find(exists);
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain" }).end("404 " + url);
      return;
    }
    const body = fs.readFileSync(file);
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] || "application/octet-stream",
      "content-length": body.length,
    });
    res.end(body);
  })
  // Bind 0.0.0.0, not 127.0.0.1: Railway (and most container hosts) reach the
  // service through a proxy on the container's external interface, so a
  // loopback-only listener answers with 502.
  .listen(PORT, "0.0.0.0", () => {
    console.log(`serving ${ROOT} on http://0.0.0.0:${PORT}`);
  });
