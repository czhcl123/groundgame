import GamePage from '@/components/GamePage'
import { dateKeyUTC } from '@/lib/game'
import { websiteSchema } from '@/lib/schema'

export const dynamic = 'force-static'

/**
 * JSON-LD is rendered as a script tag from the component. Next puts it in the
 * document body, which is valid - crawlers read structured data from <body>
 * as well as <head>.
 */
export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema()) }}
      />
      <GamePage dateKey={dateKeyUTC()} lang="en" />
    </>
  )
}
