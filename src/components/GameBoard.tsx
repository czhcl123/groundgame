'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import WorldMap from '@/components/WorldMap'
import {
  QUESTIONS_PER_ROUND,
  countsForStreak,
  dailyRound,
  dateKeyUTC,
  loadResults,
  saveResult,
  scoreGuess,
  shiftDateKey,
  streakFrom,
  type Guess,
  type Question,
  type RoundResult,
} from '@/lib/game'

interface Props {
  questions: Question[]
  dateKey: string
  gameId: string
  lang: 'en' | 'zh'
  /** 是否是今天的轮次（归档页为 false） */
  isToday?: boolean
}

type Phase = 'intro' | 'playing' | 'done'

export default function GameBoard({ questions, dateKey, gameId, lang, isToday = true }: Props) {
  const [phase, setPhase] = useState<Phase>('playing')
  const [index, setIndex] = useState(0)
  const [guess, setGuess] = useState<Guess | null>(null)
  const [locked, setLocked] = useState(false)
  const [results, setResults] = useState<RoundResult[]>([])
  // ref 始终持有最新 results，避免 React 批处理下 next() 读到旧值
  const resultsRef = useRef<RoundResult[]>([])
  useEffect(() => { resultsRef.current = results }, [results])
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [prevDay, setPrevDay] = useState<{ date: string; score: number } | null>(null)

  const T = copy(lang)
  const q = questions[index]
  const last = results[results.length - 1]

  // 载入历史（连胜、昨天成绩、今天是否已玩过）
  useEffect(() => {
    const all = loadResults()
    setStreak(streakFrom(all, dateKey))
    const best = Object.values(all).reduce((m, r) => Math.max(m, r.streakBest || 0), 0)
    setBestStreak(best)
    const y = shiftDateKey(dateKey, -1)
    if (all[y]) setPrevDay({ date: y, score: all[y].totalScore })
    // 今天已经玩过 → 直接进结果页
    if (isToday && all[dateKey]) {
      setResults(all[dateKey].rounds)
      setPhase('done')
    }
  }, [dateKey, isToday])

  const submitGuess = useCallback(
    (g: Guess) => {
      if (locked || !q) return
      setGuess(g)
      setLocked(true)
      const r = scoreGuess(q, g, streak)
      setResults(prev => [...prev, r])
      if (countsForStreak(r.difficulty)) setStreak(s => s + 1)
    },
    [locked, q, streak]
  )

  const next = useCallback(() => {
    if (!locked) return
    const prev = resultsRef.current
    const isLast = index >= questions.length - 1
    if (isLast) {
      const total = prev.reduce((s, r) => s + r.score, 0)
      const all = loadResults()
      const finalStreak = streakFrom(all, dateKey) || streak
      const rec = {
        date: dateKey,
        totalScore: total,
        rounds: prev,
        streakCurrent: finalStreak,
        streakBest: Math.max(bestStreak, finalStreak),
        completedAt: new Date().toISOString(),
      }
      saveResult(rec)
      setBestStreak(rec.streakBest)
      setPhase('done')
    } else {
      setIndex(i => i + 1)
      setGuess(null)
      setLocked(false)
      // 切题后滚回顶部——否则新题目的地图会停在视口外，看不见
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [locked, index, questions.length, streak, dateKey, bestStreak])

  // 键盘：空格/回车 = 下一题
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && locked) {
        const el = e.target as HTMLElement | null
        // 地图自己处理 Enter/Space（落子），别在这里重复翻页
        if (el?.tagName === 'BUTTON' || el?.tagName === 'A') return
        if (el?.closest?.('svg.gg-map')) return
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [locked, next])

  const total = useMemo(() => results.reduce((s, r) => s + r.score, 0), [results])

  if (phase === 'done') {
    return (
      <div className="gg-done">
        <div className="gg-done-head">
          <span className="gg-done-emoji">
            {results.map(r => r.emoji).join('')}
          </span>
          <div>
            <div className="gg-done-score">{total}</div>
            <div className="gg-done-label">{T.totalScore}</div>
          </div>
        </div>

        <div className="gg-done-stats">
          <div>
            <strong>{streak}</strong>
            <span>{T.streak}</span>
          </div>
          <div>
            <strong>{bestStreak}</strong>
            <span>{T.bestStreak}</span>
          </div>
          <div>
            <strong>{results.length}</strong>
            <span>{T.questions}</span>
          </div>
        </div>

        <ol className="gg-review">
          {results.map((r, i) => {
            const qq = questions.find(x => x.id === r.questionId)
            return (
              <li key={r.questionId}>
                <div className="gg-review-head">
                  <span className="gg-review-q">Q{i + 1}</span>
                  <span className="gg-review-emoji">{r.emoji}</span>
                  <span className="gg-review-dist">{r.distanceKm.toLocaleString()} km</span>
                  <span className="gg-review-score">+{r.score}</span>
                </div>
                {qq && <div className="gg-review-answer">{qq.answer}</div>}
                <div className="gg-review-prompt">{qq ? promptFor(qq, lang) : ''}</div>
              </li>
            )
          })}
        </ol>

        <button className="gg-btn gg-btn-secondary" onClick={() => location.reload()}>
          {T.backHome}
        </button>
      </div>
    )
  }

  if (!q) return null

  return (
    <div className="gg-board">
      <div className="gg-hud">
        <span className="gg-hud-q">
          {T.question} {index + 1}/{questions.length}
        </span>
        <span className="gg-hud-score">{total}</span>
        <span className="gg-hud-streak">
          {T.streak} {streak}
        </span>
      </div>

      <p className="gg-prompt">{promptFor(q, lang)}</p>

      {/* 引导条：不遮挡地图，打开就能直接玩 */}
      <div className="gg-tip">
        <span className="gg-tip-text">{T.tip}</span>
        {prevDay && (
          <span className="gg-tip-prev">
            {T.yesterday} <strong>{prevDay.score}</strong>
          </span>
        )}
      </div>

      <WorldMap
        guess={guess}
        answer={locked ? { lat: q.lat, lng: q.lng } : undefined}
        view={q.viewLat !== undefined ? { lat: q.viewLat, lng: q.viewLng! } : null}
        onGuess={submitGuess}
        disabled={locked}
        scope={q.scope}
      />

      {locked && last ? (
        <div className="gg-feedback">
          <div className="gg-feedback-main">
            <span className="gg-feedback-emoji">{last.emoji}</span>
            <div>
              <div className="gg-feedback-dist">
                {last.distanceKm.toLocaleString()} km
              </div>
              <div className="gg-feedback-label">{labelText(last.difficulty, lang)}</div>
            </div>
            <div className="gg-feedback-score">
              +{last.score}
              {last.multiplier > 1 && <span className="gg-mult">×{last.multiplier}</span>}
            </div>
          </div>
          <div className="gg-feedback-answer">
            <span className="gg-feedback-answer-label">{T.answer}</span>
            {q.answer}
          </div>
          <button className="gg-btn gg-btn-primary" onClick={next} autoFocus>
            {index >= questions.length - 1 ? T.finish : T.next}
          </button>
        </div>
      ) : (
        <p className="gg-hint">{T.hint}</p>
      )}
    </div>
  )
}

/** 取题干：中文站优先用中文题干，缺失时回退英文（不出现空白） */
function promptFor(q: Question, lang: 'en' | 'zh'): string {
  if (lang === 'zh' && q.promptZh) return q.promptZh
  return q.prompt
}

function labelText(d: string, lang: 'en' | 'zh'): string {
  const en: Record<string, string> = {
    easy: 'Nailed it',
    medium: 'Close',
    hard: 'Close-ish',
    brutal: 'Way off',
  }
  const zh: Record<string, string> = {
    easy: '非常准',
    medium: '接近',
    hard: '有点偏',
    brutal: '偏很远',
  }
  return (lang === 'zh' ? zh : en)[d] ?? ''
}

function copy(lang: 'en' | 'zh') {
  const en = {
    introTitle: "Today's Round",
    introLead: 'Five questions. Tap where it happened.',
    introLi1: 'Every question points to a place — a stadium, a city, a town.',
    introLi2: 'Tap the map to place your guess. Closer is better.',
    introLi3: 'You get more points for harder hits, and a streak multiplier.',
    start: 'Play',
    tip: 'Tap the map to guess · closer is better',
    yesterday: 'Yesterday:',
    totalScore: 'points',
    streak: 'streak',
    bestStreak: 'best streak',
    questions: 'questions',
    question: 'Question',
    answer: 'Answer:',
    hint: 'Click the map to guess · arrow keys + Enter also work',
    next: 'Next question',
    finish: 'See results',
    backHome: 'Back to home',
  }
  const zh = {
    introTitle: '今日挑战',
    introLead: '五道题,点出它发生的地方。',
    introLi1: '每道题都指向一个地点——球场、城市、小镇。',
    introLi2: '在地图上点一下你的猜测,越近分越高。',
    introLi3: '越难的命中分越高,连对还有倍率加成。',
    start: '开始',
    tip: '点击地图作答 · 越近分越高',
    yesterday: '昨天:',
    totalScore: '总分',
    streak: '当前连胜',
    bestStreak: '最高连胜',
    questions: '题数',
    question: '第',
    answer: '答案:',
    hint: '点击地图作答 · 也可用方向键 + 回车',
    next: '下一题',
    finish: '看结果',
    backHome: '回到首页',
  }
  return lang === 'zh' ? zh : en
}
