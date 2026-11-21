import type { Metadata } from 'next'
import raw from '@/data/questions.json'
import type { Question } from '@/lib/game'
import { questionsSchema } from '@/lib/schema'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Verified sports geography facts',
  description:
    'Fact-checked answers from the GroundGame question bank: sports venues, birthplaces and historic moments, each with a source link.',
  alternates: {
    canonical: 'https://groundquiz.com/questions',
    languages: {
      'en-US': 'https://groundquiz.com/questions',
      'x-default': 'https://groundquiz.com/questions',
    },
  },
}

const ALL = raw.questions as Question[]

/** 只展示已人工核验的题，未核验的事实不对外声称 */
const VERIFIED = ALL.filter(q => q.sources?.some(s => s.status === 'verified'))

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(questionsSchema(VERIFIED)) }}
      />
      <div className="gg-shell">
        <header className="gg-header">
          <a className="gg-brand" href="/">
            Ground<span>Game</span>
          </a>
          <nav className="gg-nav" aria-label="Main">
            <a href="/#how">How it works</a>
            <a href="/how-it-works">Scoring</a>
            <a href="/questions" aria-current="page">Facts</a>
          </nav>
        </header>

        <main id="main">
          <section className="gg-hero">
            <span className="gg-tagline">Fact-checked · with sources</span>
            <h1>Verified sports geography facts</h1>
            <p>
              These are the answers and background facts from our daily quiz that we have checked against public sources.
              Each one links to the source we used. Only {VERIFIED.length} of our {ALL.length} questions have been verified so far —
              the rest will appear here once checked.
            </p>
          </section>

          <section className="gg-section">
            <h2>The facts ({VERIFIED.length})</h2>
            <div className="gg-grid-cards">
              {VERIFIED.map(q => {
                const source = q.sources!.find(s => s.status === 'verified')!
                return (
                  <article className="gg-card" key={q.id}>
                    <h3>{q.answer}</h3>
                    <p style={{ marginBottom: 8 }}>{q.prompt}</p>
                    {q.story && <p>{q.story}</p>}
                    <p style={{ marginTop: 10 }}>
                      <a href={source.url} rel="nofollow noopener" target="_blank">
                        Source: {source.title}
                      </a>
                    </p>
                  </article>
                )
              })}
            </div>
          </section>
        </main>

        <footer className="gg-footer">
          <div>GroundGame — daily geography guessing game.</div>
          <nav aria-label="Footer">
            <a href="/">Play</a>
            <a href="/questions">Facts</a>
            <a href="/sitemap.xml">Sitemap</a>
          </nav>
        </footer>
      </div>
    </>
  )
}
