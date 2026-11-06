# GroundGame — 每日地理定位游戏

对标 geosports.app，但做得更好。

## 差异化（相对 GeoSports）

| 维度 | GeoSports | GroundGame |
|---|---|---|
| 难度 | 全部 `medium` | **easy / medium / hard / brutal 四档**，按距离阈值分档 |
| 地图 | 全部 `world` | **world / country / city 三种范围**，题目按范围出 |
| 语言 | 仅英语 | **英语 + 中文**（题目本地化） |
| 题库 | 服务端下发全部 | **本地题库 + 确定性种子生成**，每天自动出题，可离线 |
| 每日题数 | 固定 5 | **5 题（默认）**，另有 Quick Play 3 题速玩 |
| 反馈 | 仅得分 + emoji | **得分 + 距离（km）+ 精确度 + 逐题复盘 + 答案城市** |
| 连胜 | streak_current / best | 同样，并加**周赛联赛积分** |
| SEO | 无 sitemap | **sitemap + 结构化数据 + 每题独立分享页** |
| 无障碍 | 未见 | 键盘操作 / 屏幕阅读器 / 减少动画 / 高对比 |

## 技术选型

- **Next.js 16 App Router + TypeScript + Tailwind 4**（与用户其他站一致）
- **零外部依赖的地图**：自研 SVG 世界投影 + Canvas 打点，不引 Leaflet/Mapbox
  - 理由：GeoSports 的地图是重资产（瓦片请求 / API key / 移动端卡顿），自研 SVG 投影更轻、更快、可离线、可 SEO
- **确定性出题**：`date + gameId` → SHA-256 → 种子 → 从题库确定性抽取当日 5 题
- **本地题库**：`src/data/questions/*.json`，每题带 `lat/lng` + 难度 + 范围
- 纯静态导出（`output: 'export'`），部署零成本
