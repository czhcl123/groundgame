import type { Metadata } from 'next'
import { howItWorksSchema } from '@/lib/schema'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'How scoring works',
  description:
    'How GroundGame scores your guesses: distance bands, base points, the streak multiplier, and the keyboard controls.',
  alternates: {
    canonical: 'https://groundgame.app/how-it-works',
    languages: {
      'en-US': 'https://groundgame.app/how-it-works',
      'x-default': 'https://groundgame.app/how-it-works',
    },
  },
}

const BANDS = [
  { emoji: '🎯', name: 'Nailed it', range: 'Under 60 km', points: 1000 },
  { emoji: '👍', name: 'Close', range: '60–400 km', points: 600 },
  { emoji: '🤔', name: 'Close-ish', range: '400–1,500 km', points: 300 },
  { emoji: '🫠', name: 'Way off', range: 'Over 1,500 km', points: 100 },
]

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howItWorksSchema()) }}
      />
      <div className="gg-shell">
        <header className="gg-header">
          <a className="gg-brand" href="/">
            Ground<span>Game</span>
          </a>
          <nav className="gg-nav" aria-label="Main">
            <a href="/#how">How it works</a>
            <a href="/how-it-works" aria-current="page">
              Scoring
            </a>
          </nav>
        </header>

        <main id="main">
          <section className="gg-hero">
            <h1>How scoring works</h1>
            <p>
              Every question has one correct place. We measure the straight-line
              distance between your click and that place, then convert it into
              points. Nothing else is measured — no time bonus, no guessing streak
              penalty for being wrong.
            </p>
          </section>

          <section className="gg-section">
            <h2>Distance bands</h2>
            <div className="gg-grid-cards">
              {BANDS.map(b => (
                <div className="gg-card" key={b.name}>
                  <h3>
                    {b.emoji} {b.name}
                  </h3>
                  <p>
                    {b.range} — <strong>{b.points}</strong> base points
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="gg-section">
            <h2>Streak multiplier</h2>
            <p style={{ color: 'var(--gg-muted)', maxWidth: '60ch', lineHeight: 1.7 }}>
              Hitting within 400 km counts as a hit and builds your streak. The
              multiplier applies to every question you answer after that: ×1 for
              the first two, ×1.2, ×1.5, ×2, and ×2.5 from the fifth consecutive
              hit onward. Missing resets the multiplier to ×1 for the next
              question.
            </p>
          </section>

          <section className="gg-section">
            <h2>Keyboard and accessibility</h2>
            <p style={{ color: 'var(--gg-muted)', maxWidth: '60ch', lineHeight: 1.7 }}>
              The map is fully keyboard operable. Tab to it, then use the arrow
              keys to move the crosshair (hold Shift for larger steps) and press
              Enter to place your guess. The game respects{' '}
              <code style={{ color: 'var(--gg-accent-2)' }}>prefers-reduced-motion</code>{' '}
              and <code style={{ color: 'var(--gg-accent-2)' }}>prefers-contrast</code>{' '}
              settings.
            </p>
          </section>

          <section className="gg-section">
            <h2>One round per day</h2>
            <p style={{ color: 'var(--gg-muted)', maxWidth: '60ch', lineHeight: 1.7 }}>
              The round is seeded by the UTC date, so everyone playing on the same
              day gets the same five questions — that is what makes the score
              meaningful to compare. Your results stay in your own browser.
            </p>
          </section>

          <p>
            <a className="gg-btn gg-btn-primary" href="/">
              Play today&apos;s round
            </a>
          </p>
        </main>

        <footer className="gg-footer">
          <div>GroundGame — daily geography guessing game.</div>
          <nav aria-label="Footer">
            <a href="/">Play</a>
            <a href="/how-it-works">Scoring</a>
            <a href="/sitemap.xml">Sitemap</a>
          </nav>
        </footer>
      </div>
    </>
  )
}
