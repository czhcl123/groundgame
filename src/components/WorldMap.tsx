'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { project, unproject, isValidGuess, type Guess } from '@/lib/game'

/**
 * 轻量世界地图。
 *
 * 不引 Leaflet / Mapbox：瓦片请求 + API key 是移动端卡顿和加载慢的主因，
 * 而这个玩法只需要「世界轮廓 + 一个可点位置」。SVG 投影零请求、零依赖、
 * 首屏即用，手机上也能瞬间交互。
 *
 * 轮廓用的是极简的低多边形大陆轮廓（不是精确海岸线）——
 * 玩法靠经纬度判断，轮廓只提供空间参照。
 */

interface Props {
  guess: Guess | null
  answer?: Guess | null
  /** 公开视野中心（城市题用；避免用答案坐标泄露位置） */
  view?: Guess | null
  onGuess: (g: Guess) => void
  disabled?: boolean
  scope?: 'world' | 'country' | 'city'
}

// 极简世界轮廓（经纬度多边形，够用于空间参照）
const LANDMASSES: [number, number][][] = [
  // 北美
  [[-168, 66], [-158, 71], [-140, 70], [-125, 70], [-100, 70], [-82, 73], [-62, 66], [-55, 52], [-66, 45], [-70, 42], [-75, 36], [-81, 26], [-84, 30], [-90, 29], [-97, 26], [-107, 23], [-114, 28], [-121, 35], [-124, 42], [-124, 48], [-131, 54], [-140, 60], [-152, 58], [-165, 60], [-168, 66]],
  // 中美 + 南美
  [[-92, 18], [-88, 21], [-83, 22], [-79, 9], [-77, 8], [-72, 12], [-62, 10], [-52, 5], [-44, -2], [-35, -6], [-39, -14], [-48, -25], [-53, -34], [-58, -39], [-62, -41], [-65, -45], [-68, -52], [-72, -54], [-75, -48], [-73, -40], [-71, -30], [-70, -18], [-77, -12], [-81, -6], [-80, 2], [-78, 8], [-84, 15], [-92, 18]],
  // 欧洲
  [[-10, 36], [-9, 43], [-2, 43], [-4, 48], [0, 50], [4, 52], [8, 54], [10, 57], [13, 55], [19, 54], [21, 56], [24, 60], [30, 60], [30, 66], [24, 71], [31, 70], [40, 68], [50, 69], [60, 70], [68, 73], [60, 76], [40, 78], [30, 76], [20, 70], [10, 64], [5, 58], [8, 54], [4, 52], [0, 50], [-5, 48], [-2, 43], [-9, 43], [-10, 36]],
  // 非洲
  [[-17, 15], [-16, 21], [-10, 27], [0, 30], [10, 33], [20, 32], [32, 31], [35, 24], [38, 15], [43, 11], [51, 12], [42, 3], [40, -8], [35, -20], [32, -26], [27, -34], [18, -34], [12, -18], [9, -1], [3, 5], [-8, 5], [-13, 9], [-17, 15]],
  // 亚洲
  [[50, 70], [60, 72], [75, 76], [95, 78], [110, 74], [130, 72], [145, 70], [160, 69], [170, 66], [178, 65], [170, 60], [162, 58], [156, 52], [145, 44], [140, 36], [128, 38], [122, 30], [110, 20], [105, 10], [100, 6], [95, 16], [88, 22], [80, 15], [72, 20], [68, 24], [62, 25], [57, 25], [52, 28], [48, 30], [44, 38], [40, 42], [35, 40], [30, 36], [26, 38], [22, 37], [18, 40], [14, 42], [10, 44], [5, 43], [-2, 36], [4, 37], [12, 38], [20, 40], [28, 36], [35, 36], [40, 40], [45, 40], [50, 45], [50, 55], [50, 70]],
  // 澳洲
  [[113, -22], [122, -18], [132, -12], [142, -11], [150, -20], [153, -28], [146, -39], [140, -38], [130, -32], [118, -35], [113, -22]],
  // 格陵兰
  [[-45, 60], [-20, 70], [-25, 78], [-45, 83], [-65, 80], [-55, 68], [-45, 60]],
  // 日本
  [[130, 31], [135, 34], [140, 36], [142, 40], [145, 44], [141, 45], [138, 37], [132, 33], [130, 31]],
  // 英国
  [[-6, 50], [0, 51], [1, 53], [-1, 55], [-3, 58], [-6, 58], [-8, 55], [-5, 52], [-6, 50]],
  // 新西兰
  [[166, -46], [174, -41], [178, -37], [174, -34], [172, -40], [166, -46]],
]

const VIEW = { w: 1000, h: 500 }

export default function WorldMap({ guess, answer, view, onGuess, disabled, scope = 'world' }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<{ x: number; y: number; lat: number; lng: number } | null>(null)

  // 城市 scope 时把视野缩到公开中心附近（不能用 answer——那会泄露答案）
  const viewBox = useMemoViewBox(view ?? undefined, scope)

  const toSvg = useCallback(
    (lat: number, lng: number) => {
      const p = project(lat, lng)
      return { x: p.x * VIEW.w, y: p.y * VIEW.h }
    },
    []
  )

  /**
   * 屏幕坐标 → 经纬度。
   * 用 SVG 的 getScreenCTM() 做精确换算：这样无论 viewBox 怎么缩放
   * （全球视野 vs 城市视野），点击位置都能准确落在对应的经纬度上。
   *
   * getScreenCTM().inverse() 给的是 viewBox 用户坐标（不是 0-1 比例），
   * 所以要先减掉 viewBox 原点再除以 viewBox 尺寸。
   */
  const clientToGeo = useCallback((clientX: number, clientY: number): Guess | null => {
    const svg = svgRef.current
    if (!svg) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const local = pt.matrixTransform(ctm.inverse())
    const g = unproject(
      (local.x - viewBox.x) / viewBox.w,
      (local.y - viewBox.y) / viewBox.h
    )
    if (!isValidGuess(g)) return null
    return g
  }, [viewBox.x, viewBox.y, viewBox.w, viewBox.h])

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (disabled) return
      const g = clientToGeo(e.clientX, e.clientY)
      if (g) onGuess(g)
    },
    [disabled, onGuess, clientToGeo]
  )

  const handleMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const g = clientToGeo(e.clientX, e.clientY)
      if (!g) { setHover(null); return }
      const rect = svgRef.current!.getBoundingClientRect()
      setHover({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        lat: g.lat,
        lng: g.lng,
      })
    },
    [clientToGeo]
  )

  // 键盘可达：方向键移动准星，Enter 落子
  const [cursor, setCursor] = useState<Guess | null>(null)
  useEffect(() => {
    if (guess) setCursor(guess)
  }, [guess])

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return
      const step = e.shiftKey ? 5 : 1
      let c = cursor ?? { lat: 20, lng: 0 }
      let handled = true
      switch (e.key) {
        case 'ArrowUp': c = { ...c, lat: Math.min(90, c.lat + step) }; break
        case 'ArrowDown': c = { ...c, lat: Math.max(-90, c.lat - step) }; break
        case 'ArrowLeft': c = { ...c, lng: Math.max(-180, c.lng - step) }; break
        case 'ArrowRight': c = { ...c, lng: Math.min(180, c.lng + step) }; break
        case 'Enter':
        case ' ':
          if (cursor) onGuess(cursor)
          handled = true
          // 阻止冒泡：GameBoard 也有一个全局 Enter/Space 监听器（下一题），
          // 不拦住的话落子和翻页会在同一次按键里连续触发，feedback 一闪而过
          e.stopPropagation()
          break
        default: handled = false
      }
      if (handled) {
        e.preventDefault()
        setCursor(c)
      }
    },
    [cursor, disabled, onGuess]
  )

  const landPaths = LANDMASSES.map((poly, i) => {
    // 轮廓数据是 [lng, lat] 顺序（地理学惯例：经度在前）
    const pts = poly.map(([lng, lat]) => {
      const { x, y } = toSvg(lat, lng)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    return <polygon key={i} points={pts.join(' ')} className="gg-land" />
  })

  const guessPt = guess ? toSvg(guess.lat, guess.lng) : null
  const answerPt = answer ? toSvg(answer.lat, answer.lng) : null
  const cursorPt = cursor && !guess ? toSvg(cursor.lat, cursor.lng) : null

  return (
    <div className="gg-map-wrap">
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="gg-map"
        role="application"
        aria-label="World map. Use arrow keys to move the crosshair and Enter to place your guess."
        tabIndex={0}
        onClick={handleClick}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onKeyDown={handleKey}
      >
        <rect x="0" y="0" width={VIEW.w} height={VIEW.h} className="gg-ocean" />
        {landPaths}

        {/* 经纬网格 */}
        <g className="gg-grid">
          {[-60, -30, 0, 30, 60].map(lat => {
            const { y } = toSvg(lat, 0)
            return <line key={`lat${lat}`} x1="0" y1={y} x2={VIEW.w} y2={y} />
          })}
          {[-120, -60, 0, 60, 120].map(lng => {
            const { x } = toSvg(0, lng)
            return <line key={`lng${lng}`} x1={x} y1="0" x2={x} y2={VIEW.h} />
          })}
        </g>

        {/* 正确答案 */}
        {answerPt && (
          <g className="gg-answer">
            <circle cx={answerPt.x} cy={answerPt.y} r="14" className="gg-answer-ring" />
            <circle cx={answerPt.x} cy={answerPt.y} r="5" className="gg-answer-dot" />
          </g>
        )}

        {/* 猜测点 */}
        {guessPt && (
          <g className="gg-guess">
            <circle cx={guessPt.x} cy={guessPt.y} r="9" className="gg-guess-ring" />
            <circle cx={guessPt.x} cy={guessPt.y} r="3.5" className="gg-guess-dot" />
          </g>
        )}

        {/* 键盘准星 */}
        {cursorPt && !guess && (
          <g className="gg-cursor">
            <line x1={cursorPt.x - 8} y1={cursorPt.y} x2={cursorPt.x + 8} y2={cursorPt.y} />
            <line x1={cursorPt.x} y1={cursorPt.y - 8} x2={cursorPt.x} y2={cursorPt.y + 8} />
          </g>
        )}
      </svg>

      {hover && !disabled && (
        <div className="gg-map-readout" aria-live="off">
          {hover.lat.toFixed(1)}°, {hover.lng.toFixed(1)}°
        </div>
      )}
    </div>
  )
}

/** 根据 scope 和答案位置计算 viewBox */
function useMemoViewBox(answer: Guess | undefined, scope: string) {
  if (scope !== 'city' || !answer) {
    return { x: 0, y: 0, w: VIEW.w, h: VIEW.h }
  }
  const p = project(answer.lat, answer.lng)
  const span = 0.12 // 约 ±21°
  const x = Math.max(0, Math.min(VIEW.w - VIEW.w * span, p.x * VIEW.w - (VIEW.w * span) / 2))
  const y = Math.max(0, Math.min(VIEW.h - VIEW.h * span * 2, p.y * VIEW.h - (VIEW.h * span)))
  return { x, y, w: VIEW.w * span, h: VIEW.h * span * 2 }
}
