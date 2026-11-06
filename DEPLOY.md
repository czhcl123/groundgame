# GroundGame deployment

Static export (`output: 'export'`), so the deploy target is any static host.

## Build

```bash
npm ci
npm run build      # emits ./out
```

## Serve

Serve `out/` as the document root. `next.config.ts` sets `trailingSlash: false`,
so `/zh` is served by `out/zh.html` and `/d/2026-11-05` by `out/d/2026-11-05.html`.

Most static hosts resolve `/foo` → `foo.html` automatically. If yours does not,
use `scripts/static-server.cjs` as a reference resolver or configure a
"clean URLs / try .html" rule.

## Domain

`https://groundgame.app` is referenced in:

- `src/lib/site.ts` — `SITE_URL`, `metadataBase`, canonical, hreflang
- `src/lib/schema.ts` — JSON-LD URLs
- `src/app/sitemap.ts` — sitemap entries
- `src/app/robots.ts` — sitemap + host

Change `SITE_URL` in `src/lib/site.ts` before deploying to a different domain.

## After deploy

1. Verify `https://groundgame.app/sitemap.xml` returns 200 and lists 183 URLs.
2. Verify `https://groundgame.app/zh` returns `<html lang="zh-CN">`.
3. Submit the sitemap to Google Search Console and Bing Webmaster Tools.
