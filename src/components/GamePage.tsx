import GameBoard from '@/components/GameBoard'
import { dailyRound } from '@/lib/game'
import type { Question } from '@/lib/game'
import raw from '@/data/questions.json'

const ALL = raw.questions as Question[]
export const GAME_ID = 'groundgame'

interface Props {
  dateKey: string
  lang: 'en' | 'zh'
  /** 是否显示英雄区（归档页更简洁） */
  hero?: boolean
}

export default function GamePage({ dateKey, lang, hero = true }: Props) {
  const questions = dailyRound(ALL, dateKey, GAME_ID)
  const isToday = dateKey === new Date().toISOString().slice(0, 10)
  // 归档页要保留日期：/d/2026-01-01 <-> /zh/d/2026-01-01
  const enHref = hero ? '/' : `/d/${dateKey}`
  const zhHref = hero ? '/zh' : `/zh/d/${dateKey}`

  return (
    <div className="gg-shell">
      <a className="gg-skip" href="#main">
        {lang === 'zh' ? '跳到正文' : 'Skip to content'}
      </a>

      <header className="gg-header">
        <a className="gg-brand" href={lang === 'zh' ? '/zh' : '/'}>
          Ground<span>Game</span>
        </a>
        <nav className="gg-nav" aria-label={lang === 'zh' ? '主导航' : 'Main'}>
          <a href={lang === 'zh' ? '/zh#how' : '/#how'}>
            {lang === 'zh' ? '玩法说明' : 'How it works'}
          </a>
          <a href={lang === 'zh' ? '/zh#stats' : '/#stats'}>
            {lang === 'zh' ? '题库' : 'Stats'}
          </a>
          <div className="gg-lang" role="group" aria-label={lang === 'zh' ? '语言' : 'Language'}>
            <a href={enHref} aria-current={lang === 'en' ? 'true' : undefined} lang="en">
              EN
            </a>
            <a href={zhHref} aria-current={lang === 'zh' ? 'true' : undefined} lang="zh-CN">
              中文
            </a>
          </div>
        </nav>
      </header>

      <main id="main">
        {hero && (
          <section className="gg-hero">
            <span className="gg-tagline">
              {lang === 'zh'
                ? '每天 5 题 · 60-90 秒'
                : '5 questions · 60–90 seconds'}
            </span>
            <h1>
              {lang === 'zh' ? '在地图上点出它发生的地方' : 'Tap where it happened'}
            </h1>
            <p>
              {lang === 'zh'
                ? '每天 5 道地理题,题材涵盖体育历史、场馆、名人出生地。越接近真分越高,连对还有倍率。'
                : 'Every day, five questions about places — stadiums, hometown cities, famous moments. The closer you click, the more you score.'}
            </p>
          </section>
        )}

        {!hero && (
          <section className="gg-hero">
            <span className="gg-tagline">{dateKey}</span>
            <h1>
              {lang === 'zh' ? `${dateKey} 的挑战` : `Round of ${dateKey}`}
            </h1>
            <p>
              {lang === 'zh'
                ? '五道题,点出它发生的地方。'
                : 'Five questions. Tap where it happened.'}
            </p>
          </section>
        )}

        <GameBoard
          questions={questions}
          dateKey={dateKey}
          gameId={GAME_ID}
          lang={lang}
          isToday={isToday}
        />

        <section className="gg-section" id="how">
          <h2>{lang === 'zh' ? '玩法说明' : 'How scoring works'}</h2>
          <div className="gg-grid-cards">
            <div className="gg-card">
              <h3>{lang === 'zh' ? '🎯 命中(60 km 内)' : '🎯 Nailed it'}</h3>
              <p>
                {lang === 'zh'
                  ? '1000 分,最准的档位。'
                  : '1000 base points. Under 60 km from the answer.'}
              </p>
            </div>
            <div className="gg-card">
              <h3>{lang === 'zh' ? '👍 接近(400 km 内)' : '👍 Close'}</h3>
              <p>
                {lang === 'zh'
                  ? '600 分,猜到了大致区域。'
                  : '600 base points. You found the right part of the map.'}
              </p>
            </div>
            <div className="gg-card">
              <h3>{lang === 'zh' ? '🤔 有点偏(1500 km 内)' : '🤔 Close-ish'}</h3>
              <p>
                {lang === 'zh'
                  ? '300 分,大方向对了。'
                  : '300 base points. Right continent, wrong side.'}
              </p>
            </div>
            <div className="gg-card">
              <h3>{lang === 'zh' ? '🫠 偏很远' : '🫠 Way off'}</h3>
              <p>
                {lang === 'zh'
                  ? '100 分,但至少参与了就得分。'
                  : '100 base points. Everyone scores.'}
              </p>
            </div>
            <div className="gg-card">
              <h3>{lang === 'zh' ? '× 倍率' : '× Streak multiplier'}</h3>
              <p>
                {lang === 'zh'
                  ? '连续命中会提升倍率,最高 2.5 倍。'
                  : 'Consecutive hits raise your multiplier, up to ×2.5.'}
              </p>
            </div>
            <div className="gg-card">
              <h3>{lang === 'zh' ? '⌨️ 键盘可用' : '⌨️ Keyboard ready'}</h3>
              <p>
                {lang === 'zh'
                  ? '方向键移动准星,回车落子。'
                  : 'Arrow keys move the crosshair, Enter places your guess.'}
              </p>
            </div>
          </div>
        </section>

        <section className="gg-section" id="stats">
          <h2>{lang === 'zh' ? '题目库' : 'Question bank'}</h2>
          <div className="gg-grid-cards">
            <div className="gg-card">
              <h3>{ALL.length}+</h3>
              <p>
                {lang === 'zh'
                  ? '道题,覆盖 NFL / MLB / NBA / NHL / 足球 / 高尔夫 / 奥运。'
                  : 'questions across the NFL, MLB, NBA, NHL, football, golf and the Olympics.'}
              </p>
            </div>
            <div className="gg-card">
              <h3>{lang === 'zh' ? '同一天同题' : 'Same round, worldwide'}</h3>
              <p>
                {lang === 'zh'
                  ? '题目按 UTC 日期确定性生成,全球玩家同一时间玩同一套题。'
                  : 'The round is seeded by the UTC date, so everyone plays the same five questions.'}
              </p>
            </div>
            <div className="gg-card">
              <h3>{lang === 'zh' ? '零地图依赖' : 'No map API, no key'}</h3>
              <p>
                {lang === 'zh'
                  ? '自研 SVG 投影,无瓦片请求,手机上也秒开。'
                  : 'A self-contained SVG projection. No tiles, no API key, instant on mobile.'}
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="gg-footer">
        <div>GroundGame — daily geography guessing game.</div>
        <nav aria-label="Footer">
          <a href={lang === 'zh' ? '/zh#how' : '/#how'}>How it works</a>
          <a href={lang === 'zh' ? '/zh#stats' : '/#stats'}>Question bank</a>
          <a href="/sitemap.xml">Sitemap</a>
        </nav>
      </footer>
    </div>
  )
}
