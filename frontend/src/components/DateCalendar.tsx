import clsx from 'clsx'
import type { Method } from '../api/client'

type Flags = Record<string, Method[]>

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function monthsBetween(dates: string[]): string[] {
  return [...new Set(dates.map((d) => d.slice(0, 7)))].sort()
}

/** Month grids covering the dataset. Only dates with a record are selectable; flagged dates are coloured. */
export default function DateCalendar({
  available,
  flags,
  selected,
  onSelect,
}: {
  available: string[]
  flags: Flags
  selected: string
  onSelect: (d: string) => void
}) {
  const has = new Set(available)
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {monthsBetween(available).map((ym) => {
          const [y, m] = ym.split('-').map(Number)
          const first = new Date(Date.UTC(y, m - 1, 1))
          const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
          const offset = (first.getUTCDay() + 6) % 7
          return (
            <div key={ym}>
              <div className="mb-2 text-sm font-medium">
                {first.toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-1 text-grey-500">{w}</div>
                ))}
                {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: days }).map((_, i) => {
                  const d = `${ym}-${String(i + 1).padStart(2, '0')}`
                  const f = flags[d] ?? []
                  const both = f.length === 2
                  const isSel = d === selected
                  return (
                    <button
                      key={d}
                      disabled={!has.has(d)}
                      onClick={() => onSelect(d)}
                      title={f.length ? `Flagged: ${f.join(' + ')}` : undefined}
                      className={clsx(
                        'relative aspect-square rounded-lg transition',
                        !has.has(d) && 'cursor-not-allowed text-grey-100',
                        has.has(d) && !isSel && !f.length && 'text-ink hover:bg-grey-25',
                        has.has(d) && !isSel && both && 'bg-error-0 font-medium text-error-100 hover:brightness-95',
                        has.has(d) && !isSel && f.length === 1 && f[0] === 'iqr' && 'bg-warning-0 text-warning-200 hover:brightness-95',
                        has.has(d) && !isSel && f.length === 1 && f[0] === 'iforest' && 'bg-primary-0 text-primary-300 hover:brightness-95',
                        isSel && 'bg-primary-300 font-medium text-white shadow-sm',
                      )}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-grey-500">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-error-0 ring-1 ring-error-100/40" /> Both methods</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-warning-0 ring-1 ring-warning-100/60" /> IQR only</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-primary-0 ring-1 ring-primary-100/60" /> Isolation Forest only</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded bg-primary-300" /> Selected</span>
      </div>
    </div>
  )
}
