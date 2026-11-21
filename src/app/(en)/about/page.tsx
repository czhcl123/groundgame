import type { Metadata } from 'next'
import { aboutSchema } from '@/lib/schema'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'What is GroundGame? A free daily sports geography quiz',
  description:
    'GroundGame is a free daily sports geography game: guess five locations a day on a world map. Learn how it works, who it is for, and how it compares to GeoGuessr and GeoSports.',
  alternates: {
    canonical: 'https://groundquiz.com/about',
    languages: {
      'en-US': 'https://groundquiz.com/about',
      'x-default': 'https://groundquiz.com/about',
    },
  },
}

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema()) }}
      />
      <div className="gg-shell">
        <header className="gg-header">
          <a className="gg-brand" href="/">
            Ground<span>Game</span>
          </a>
          <nav className="gg-nav" aria-label="Main">
            <a href="/">Play</a>
            <a href="/how-it-works">Scoring</a>
            <a href="/questions">Facts</a>
          </nav>
        </header>

        <main id="main">
          <section className="gg-hero">
            <span className="gg-tagline">About GroundGame</span>
            <h1>What is GroundGame?</h1>
            <p>
              GroundGame is a free daily sports geography quiz. Every day, you get five questions about
              sports places — stadiums, hometowns, and historic moments — and click where each one
              happened on a world map. The closer you click, the more points you score.
            </p>
          </section>

          <section className="gg-section">
            <h2>Who is it for?</h2>
            <p style={{ color: 'var(--gg-muted)', lineHeight: 1.7, maxWidth: '70ch' }}>
              GroundGame is for sports fans who know the stories but not always the map. A Round takes
              a few minutes, so it fits a coffee break. The questions cover the NFL, NBA, MLB, NHL,
              soccer, golf, tennis and the Olympics. You do not need to install anything: the game
              runs in the browser, works on mobile, and needs no account or API key. Results are stored
              locally in your browser.
            </p>
          </section>

          <section className="gg-section">
            <h2>What makes it different?</h2>
            <p style={{ color: 'var(--gg-muted)', lineHeight: 1.7, maxWidth: '70ch' }}>
              GroundGame is a sports-knowledge game, not a photo-based location game. Unlike GeoGuessr,
              which asks you to identify a place from street images, GroundGame gives you a sports clue
              and asks you to place it on the map. Unlike a generic trivia quiz, every answer is a real
              coordinate, so you are scored on how close your click is rather than on multiple choice.
              Every day uses the same five questions for everyone playing that day, so scores are comparable.
            </p>
            <div className="gg-grid-cards" style={{ marginTop: 20 }}>
              <div className="gg-card">
                <h3>GroundGame</h3>
                <p>Five sports-location clues a day, scored by distance on a world map. Free, no account, no map API key.</p>
              </div>
              <div className="gg-card">
                <h3>GeoGuessr</h3>
                <p>A paid photo-based game where you identify locations from street-level imagery. Different skill: visual deduction, not sports knowledge.</p>
              </div>
              <div className="gg-card">
                <h3>GeoSports</h3>
                <p>A sports geography quiz that serves questions from a server. GroundGame uses a local question bank with a deterministic daily seed, so rounds are reproducible and work offline.</p>
              </div>
            </div>
          </section>

          <section className="gg-section">
            <h2>Why is it free?</h2>
            <p style={{ color: 'var(--gg-muted)', lineHeight: 1.7, maxWidth: '70ch' }}>
              GroundGame is a static website: the map is a self-contained SVG projection with no tile
              requests and no third-party map API. There are no server costs per round, so the daily game
              is free to play. Verified facts from the question bank are published on the Facts page with
              links to their public sources.
            </p>
          </section>

          <p>
            <a className="gg-btn gg-btn-primary" href="/">Play today&apos;s round</a>
          </p>
        </main>

        <footer className="gg-footer">
          <div>GroundGame — daily geography guessing game.</div>
          <nav aria-label="Footer">
            <a href="/">Play</a>
            <a href="/about">About</a>
            <a href="/questions">Facts</a>
            <a href="/sitemap.xml">Sitemap</a>
          </nav>
        </footer>
      </div>
    </>
  )
}
