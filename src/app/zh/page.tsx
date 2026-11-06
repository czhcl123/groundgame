import GamePage from '@/components/GamePage'
import { dateKeyUTC } from '@/lib/game'
import { websiteSchema } from '@/lib/schema'

export const dynamic = 'force-static'

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema()) }}
      />
      <GamePage dateKey={dateKeyUTC()} lang="zh" />
    </>
  )
}
