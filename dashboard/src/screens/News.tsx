import { Card, PageHeader } from '../components/ui'
import { shortDate } from '../lib/format'
import { WHATS_NEW } from '../whats-new'

export default function News() {
  const dates = [...new Set(WHATS_NEW.map((e) => e.date))]
  return (
    <>
      <PageHeader title="What's new" subtitle="Changes to the dashboard, newest first." />
      <div className="flex flex-col gap-4">
        {dates.map((date) => (
          <Card key={date}>
            <p className="text-[11px] tracking-[0.14em] text-muted uppercase">{shortDate(date)}</p>
            <ul className="mt-3 flex flex-col gap-4">
              {WHATS_NEW.filter((e) => e.date === date).map((e) => (
                <li key={e.title}>
                  <p className="font-medium">{e.title}</p>
                  <p className="mt-1 text-sm text-body">{e.body}</p>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  )
}
