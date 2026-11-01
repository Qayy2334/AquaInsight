import clsx from 'clsx'
import { ChevronDown, Info, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('rounded-2xl border border-grey-50 bg-white p-4', className)}>{children}</div>
}

export function CardHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {icon && <div className="mt-0.5 rounded-lg bg-primary-0 p-1.5 text-primary-300">{icon}</div>}
        <div>
          <h3 className="text-lg font-medium leading-snug">{title}</h3>
          {subtitle && <p className="text-xs text-grey-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

type Tone = 'primary' | 'success' | 'warning' | 'error' | 'grey'
const toneClass: Record<Tone, string> = {
  primary: 'bg-primary-0 text-primary-300 border-primary-100/40',
  success: 'bg-success-0 text-success-200 border-success-100/40',
  warning: 'bg-warning-0 text-warning-200 border-warning-100/50',
  error: 'bg-error-0 text-error-100 border-error-100/30',
  grey: 'bg-grey-25 text-grey-500 border-grey-100',
}

export function Badge({ tone = 'primary', children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium', toneClass[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-xl border border-grey-50 bg-grey-25 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded-lg px-3 py-1.5 text-sm transition',
            value === o.value ? 'bg-primary-300 text-white shadow-sm' : 'text-grey-500 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  className?: string
}) {
  return (
    <div className={clsx('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full appearance-none rounded-xl border border-grey-100 bg-white py-2 pl-3 pr-9 text-sm outline-none focus:border-primary-200"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-grey-500" />
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  icon,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'outline'
  disabled?: boolean
  icon?: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50',
        variant === 'primary'
          ? 'bg-gradient-to-b from-primary-200 to-primary-300 text-white shadow-sm hover:brightness-105'
          : 'border border-grey-100 bg-white text-ink hover:bg-grey-25',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function StatCard({
  icon,
  title,
  subtitle,
  value,
  unit,
  footer,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  value: string
  unit?: string
  footer?: ReactNode
}) {
  return (
    <Card>
      <div className="flex items-start gap-2.5">
        <div className="text-primary-300">{icon}</div>
        <div>
          <div className="text-[15px] font-medium leading-tight">{title}</div>
          {subtitle && <div className="text-xs text-grey-500">{subtitle}</div>}
        </div>
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-2xl font-medium">{value}</span>
        {unit && <span className="text-sm text-grey-500">{unit}</span>}
      </div>
      {footer && <div className="mt-2 text-xs text-grey-500">{footer}</div>}
    </Card>
  )
}

export function Notice({ children, tone = 'primary' }: { children: ReactNode; tone?: 'primary' | 'warning' }) {
  return (
    <div
      className={clsx(
        'flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm',
        tone === 'primary' ? 'bg-primary-0 text-primary-300' : 'bg-warning-0 text-warning-200',
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0" />
      <div className="text-paragraph [&_strong]:text-ink">{children}</div>
    </div>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex h-40 items-center justify-center gap-2 text-sm text-grey-500">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  )
}

export function ErrorState({ error }: { error: unknown }) {
  const msg =
    (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
    (error as Error)?.message ??
    'Something went wrong'
  return <div className="rounded-xl bg-error-0 px-4 py-3 text-sm text-error-100">{msg}</div>
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="bg-grey-25 text-grey-500">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2.5 font-medium first:rounded-l-lg last:rounded-r-lg">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-grey-50 [&_td]:px-3 [&_td]:py-2.5 [&_td]:text-paragraph">
          {children}
        </tbody>
      </table>
    </div>
  )
}
