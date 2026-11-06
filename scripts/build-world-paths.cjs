/**
 * 把 Natural Earth 110m 陆地数据转成预计算的 SVG path。
 *
 * 为什么要预计算：
 *  - 运行时零依赖、零请求（JSON 53KB → path 字符串约 40KB，直接内嵌）
 *  - 客户端不需要 topojson 解码器
 *  - 坐标已经投影好，渲染时只做一次字符串拼接
 *
 * 投影：equirectangular（等距圆柱），和 game.ts 的 project() 完全一致。
 */
const fs = require('fs')
const topojson = require('topojson-client')

const SRC = 'D:/SEO/groundgame/node_modules/world-atlas/land-110m.json'
const OUT = 'D:/SEO/groundgame/src/components/worldPaths.ts'

const W = 1000
const H = 500

const topo = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const geo = topojson.feature(topo, topo.objects.land)

function project(lng, lat) {
  return {
    x: ((lng + 180) / 360) * W,
    y: ((90 - lat) / 360) * H,
  }
}

function ringToPath(ring) {
  let d = ''
  for (let i = 0; i < ring.length; i++) {
    const [lng, lat] = ring[i]
    const p = project(lng, lat)
    // 只保留 2 位小数，压缩体积
    d += (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)
  }
  return d + 'Z'
}

const paths = []
for (const geom of geo.geometry.geometries ?? [geo.geometry]) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  for (const poly of polys) {
    // poly[0] = 外环，poly[1..] = 洞（湖泊）
    const outer = ringToPath(poly[0])
    const holes = poly.slice(1).map(ringToPath)
    paths.push(outer + holes.join(''))
  }
}

const body = paths.map(p => `'${p}'`).join(',\n  ')

const out = `/**
 * 世界陆地轮廓（Natural Earth 110m，公有领域）。
 *
 * 由 scripts/build-world-paths.cjs 从 world-atlas/land-110m.json 生成，
 * 已投影到 equirectangular（1000 × 500），与 lib/game.ts 的 project() 一致。
 *
 * 不要手改 —— 改数据源后重新跑生成脚本。
 */
export const WORLD_LAND_PATHS: string[] = [
  ${body},
]
`

fs.writeFileSync(OUT, out, 'utf8')
console.log('rings:', paths.length)
console.log('output:', (out.length / 1024).toFixed(1), 'KB ->', OUT)
