import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Method } from '../api/client'
import DateCalendar from './DateCalendar'

/** Prev / date (opens calendar popover) / Next, limited to dates that have records. */
export default function DatePicker({
  available,
  flags,
  value,
  onChange,
}: {
  available: string[]
  flags: Record<string, Method[]>
  value: string
  onChange: (d: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const idx = available.indexOf(value)

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const weekday = value ? new Date(`${value}T00:00:00Z`).toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' }) : ''
  const btn = 'flex size-10 items-center justify-center rounded-xl border border-grey-100 bg-white text-grey-500 hover:text-ink disabled:opacity-40'

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      <button className={btn} disabled={idx <= 0} onClick={() => onChange(available[idx - 1])} title="Previous day">
        <ChevronLeft className="size-4" />
      </button>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-xl border border-grey-100 bg-primary-0 px-4 text-sm font-medium text-ink"
      >
        <CalendarDays className="size-4 text-primary-300" />
        {value} <span className="font-normal text-grey-500">{weekday}</span>
        <ChevronDown className="size-4 text-grey-500" />
      </button>
      <button className={btn} disabled={idx < 0 || idx >= available.length - 1} onClick={() => onChange(available[idx + 1])} title="Next day">
        <ChevronRight className="size-4" />
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-40 w-[560px] max-w-[90vw] rounded-2xl border border-grey-50 bg-white p-4 shadow-xl">
          <DateCalendar
            available={available}
            flags={flags}
            selected={value}
            onSelect={(d) => {
              onChange(d)
              setOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}
