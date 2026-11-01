import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Database,
  Link2,
  ShieldCheck,
  TriangleAlert,
  Waves,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchers, type DayVariable, type Method, type VariableKey } from '../api/client'
import Chart from '../components/Chart'
import DateCalendar from '../components/DateCalendar'
import { Badge, Button, Card, CardHeader, ErrorState, Loading, Notice, Select, StatCard, Table } from '../components/ui'
import { fmt, isReference, METHOD_LABEL, MODEL_LABEL, varLabel, varUnit } from '../lib/format'
import { useMeta } from '../lib/hooks'

const STATUS_TONE = { low: 'warning', high: 'warning', normal: 'success' } as const
const STATUS_LABEL = { low: 'Low', high: 'High', normal: 'Normal' } as const
const CHECK_MODELS = ['linear_regression', 'random_forest', 'historical_mean'] as const

/** Horizontal bar: IQR band (lower–upper), median tick, and the day's value marker. */
function RangeBar({ v }: { v: DayVariable }) {
  const span = v.upper - v.lower || 1
  const lo = v.lower - span * 0.35
  const hi = v.upper + span * 0.35
  const pos = (x: number) => `${Math.min(100, Math.max(0, ((x - lo) / (hi - lo)) * 100))}%`
  return (
    <div className="relative mt-3 h-2 rounded-full bg-grey-50">
      <div className="absolute inset-y-0 rounded-full bg-primary-0 ring-1 ring-primary-100/50" style={{ left: pos(v.lower), right: `calc(100% - ${pos(v.upper)})` }} />
      <div className="absolute inset-y-[-3px] w-px bg-grey-500" style={{ left: pos(v.median) }} title="Median" />
      {v.value !== null && (
        <div
          className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${v.status === 'normal' ? 'bg-primary-300' : 'bg-warning-100'}`}
          style={{ left: pos(v.value) }}
        />
      )}
    </div>
  )
}

export default function Overview() {
  const meta = useMeta()
  const m = meta.data
  const summary = useQuery({ queryKey: ['summary'], queryFn: fetchers.summary })
  const records = useQuery({ queryKey: ['records'], queryFn: () => fetchers.records() })
  const anomalies = useQuery({ queryKey: ['anomalies'], queryFn: fetchers.anomalies })
  const [params, setParams] = useSearchParams()
  const [trendVar, setTrendVar] = useState<VariableKey>('outlet_free_chlorine')

  const available = useMemo(() => (records.data ?? []).map((r) => r.date), [records.data])
  // Default to the last record in the dataset (not "today": this is a historical-analysis tool).
  const selected = params.get('date') ?? available[available.length - 1] ?? ''
  const select = (d: string) => setParams(d ? { date: d } : {}, { replace: true })
  const day = useQuery({ queryKey: ['day', selected], queryFn: () => fetchers.day(selected), enabled: !!selected })

  const flags = useMemo(() => {
    const out: Record<string, Method[]> = {}
    for (const i of anomalies.data?.items ?? []) out[i.date] = i.methods
    return out
  }, [anomalies.data])

  if (summary.isLoading || !m) return <Loading />
  if (summary.error) return <ErrorState error={summary.error} />
  const s = summary.data!
  const beat = s.predictability.filter((p) => p.beats_mean).length
  const d = day.data

  return (
    <div className="space-y-4">
      {/* Dataset summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Database className="size-5" />}
          title="Dataset"
          subtitle={`${s.dataset.start_date} → ${s.dataset.end_date}`}
          value={String(s.dataset.rows)}
          unit="daily records"
          footer={s.dataset.name}
        />
        <StatCard
          icon={<ShieldCheck className="size-5" />}
          title="Data Quality"
          subtitle="Values present across six variables"
          value={`${((s.quality.completeness ?? 0) * 100).toFixed(1)}%`}
          footer={`${s.quality.missing_days} missing days · ${s.quality.corrections} auto-corrected · ${s.quality.duplicates} duplicate(s)`}
        />
        <StatCard
          icon={<BrainCircuit className="size-5" />}
          title="Predictability"
          subtitle="Targets where a model beats the historical mean (CV MAE)"
          value={`${beat} / ${s.predictability.length}`}
          footer={
            <Link to="/evaluation" className="inline-flex items-center gap-1 text-primary-300">
              {beat === 0 ? 'No next-day predictive signal found' : 'See model evaluation'} <ArrowRight className="size-3" />
            </Link>
          }
        />
        <StatCard
          icon={<TriangleAlert className="size-5" />}
          title="Records to Review"
          subtitle="Flagged by both anomaly methods"
          value={String(s.anomalies.both)}
          unit="days"
          footer={`IQR ${s.anomalies.iqr} · Isolation Forest ${s.anomalies.iforest}`}
        />
      </div>

      {/* Key findings */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Treatment Effect" subtitle="Influent vs outlet, dataset means" icon={<Waves className="size-4" />} />
          <div className="space-y-3">
            {([['turbidity', 'Turbidity', 'NTU', 3], ['ph', 'pH', '', 2]] as const).map(([k, label, unit, dp]) => {
              const t = s.treatment[k]
              return (
                <div key={k} className="rounded-xl bg-grey-25 p-3">
                  <div className="text-xs text-grey-500">{label}</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-lg font-medium">{fmt(t.influent_mean, dp)}</span>
                    <ArrowRight className="size-4 self-center text-grey-500" />
                    <span className="text-lg font-medium">{fmt(t.outlet_mean, dp)}</span>
                    <span className="text-xs text-grey-500">{unit}</span>
                    <Badge tone={k === 'turbidity' ? (t.change_pct < 0 ? 'success' : 'warning') : 'grey'}>
                      {t.change_pct > 0 ? '+' : ''}{fmt(t.change_pct, 1)}%
                    </Badge>
                  </div>
                  {k === 'turbidity' && (
                    <div className="mt-1 text-xs text-grey-500">Outlet above influent on {t.days_outlet_above_influent} of {s.dataset.rows} days</div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Strongest Relationships" subtitle="Pearson correlation between variables" icon={<Link2 className="size-4" />} />
          <div className="space-y-2">
            {s.top_correlations.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-xl bg-grey-25 px-3 py-2.5 text-sm">
                <span>{varLabel(m, c.a)} × {varLabel(m, c.b)}</span>
                <span className="shrink-0 font-medium">r = {fmt(c.r, 2)}</span>
              </div>
            ))}
          </div>
          {s.top_correlations[0] && Math.abs(s.top_correlations[0].r) > 0.95 && (
            <p className="mt-3 text-xs text-warning-200">
              Near-perfect correlation: check whether one variable is derived from the other rather than measured independently.
            </p>
          )}
          <Link to="/trends" className="mt-3 inline-flex items-center gap-1 text-xs text-primary-300">
            Explore in Historical Trends <ArrowRight className="size-3" />
          </Link>
        </Card>

        <Card>
          <CardHeader title="Within Reference Range" subtitle="Share of days, outlet indicators" icon={<ShieldCheck className="size-4" />} />
          <div className="space-y-4">
            {s.compliance.map((c) => {
              const pct = c.total ? (c.within / c.total) * 100 : 0
              return (
                <div key={c.variable}>
                  <div className="flex justify-between text-sm">
                    <span>{varLabel(m, c.variable)}</span>
                    <span className="font-medium">{c.within}/{c.total} days</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-grey-50">
                    <div className={`h-2 rounded-full ${pct === 100 ? 'bg-success-100' : 'bg-warning-100'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 text-[11px] text-grey-500">{c.note}</div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Daily review */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <CalendarDays className="size-5 text-primary-300" />
        <h2 className="text-lg font-medium">Daily Record Review</h2>
        <span className="text-sm text-grey-500">Select a day to see how it compares with the whole dataset</span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,420px)_1fr]">
        <Card>
          <CardHeader title="Select Date" subtitle={`${available.length} days with records`} />
          {records.isLoading ? <Loading /> : (
            <DateCalendar available={available} flags={flags} selected={selected} onSelect={select} />
          )}
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-medium">{selected}</h3>
              <p className="text-xs text-grey-500">Normal range = IQR bounds (k = {d?.iqr_k ?? '—'}) computed from the whole dataset</p>
            </div>
            <div className="flex items-center gap-2">
              {d?.anomaly ? (
                Object.keys(d.anomaly).length === 2 ? <Badge tone="error" dot>Flagged by both methods</Badge>
                  : <Badge tone="warning" dot>Flagged by {METHOD_LABEL[Object.keys(d.anomaly)[0] as Method]}</Badge>
              ) : d && <Badge tone="success" dot>Not flagged</Badge>}
              <Button variant="outline" disabled={!d?.prev_date} onClick={() => d?.prev_date && select(d.prev_date)} icon={<ChevronLeft className="size-4" />}>Prev</Button>
              <Button variant="outline" disabled={!d?.next_date} onClick={() => d?.next_date && select(d.next_date)}>
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {day.isLoading && <Loading />}
          {day.error && <ErrorState error={day.error} />}
          {d && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {(Object.keys(m.variables) as VariableKey[]).map((k) => {
                  const v = d.variables[k]
                  return (
                    <div key={k} className="rounded-xl border border-grey-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm text-grey-500">{varLabel(m, k)}</div>
                        {v.status && <Badge tone={STATUS_TONE[v.status]}>{STATUS_LABEL[v.status]}</Badge>}
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-medium">{fmt(v.value)}</span>
                        <span className="text-xs text-grey-500">{varUnit(m, k)}</span>
                      </div>
                      <RangeBar v={v} />
                      <div className="mt-2 flex justify-between text-[11px] text-grey-500">
                        <span>Range {fmt(v.lower)}–{fmt(v.upper)}</span>
                        <span>Median {fmt(v.median)}</span>
                        <span title="Percentile within the dataset">P{fmt(v.percentile, 0)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {d.anomaly && (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {(Object.keys(d.anomaly) as Method[]).map((method) => (
                    <div key={method} className="rounded-xl border-l-2 border-warning-100 bg-warning-0/60 p-3 text-sm">
                      <div className="mb-1 font-medium">{METHOD_LABEL[method]}</div>
                      {d.anomaly![method]!.contributors.map((c) => (
                        <div key={c.variable} className="flex justify-between gap-3 text-paragraph">
                          <span>{varLabel(m, c.variable)}</span>
                          <span>
                            {fmt(c.value, 3)} {method === 'iqr' ? `(${c.direction})` : `(z ${c.z !== undefined && c.z > 0 ? '+' : ''}${fmt(c.z)})`}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 grid grid-cols-1 gap-4 2xl:grid-cols-2">
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Surrounding days (±3)</span>
                    <Select
                      value={trendVar}
                      onChange={setTrendVar}
                      options={(Object.keys(m.variables) as VariableKey[]).map((k) => ({ value: k, label: varLabel(m, k) }))}
                      className="w-52"
                    />
                  </div>
                  <Chart
                    height={200}
                    option={{
                      xAxis: { type: 'category', data: d.neighbours.map((r) => r.date.slice(5)), splitLine: { show: false } },
                      yAxis: (() => {
                        // Keep both IQR bounds visible even when the surrounding values sit inside them.
                        const vals = d.neighbours.map((r) => r[trendVar]).filter((x): x is number => x !== null)
                        const lo = Math.min(d.variables[trendVar].lower, ...vals)
                        const hi = Math.max(d.variables[trendVar].upper, ...vals)
                        const pad = (hi - lo) * 0.1 || 0.1
                        return { type: 'value', min: +(lo - pad).toFixed(3), max: +(hi + pad).toFixed(3) }
                      })(),
                      series: [
                        {
                          type: 'line',
                          data: d.neighbours.map((r) => ({
                            value: r[trendVar],
                            symbolSize: r.date === d.date ? 11 : 6,
                            itemStyle: { color: r.date === d.date ? '#2b6be2' : flags[r.date] ? '#ffbe4c' : '#80a6ee' },
                          })),
                          lineStyle: { color: '#80a6ee' },
                          markLine: {
                            symbol: 'none',
                            silent: true,
                            lineStyle: { color: '#ffbe4c', type: 'dashed' },
                            label: { fontSize: 10, color: '#966422' },
                            data: [{ yAxis: +d.variables[trendVar].upper.toFixed(3) }, { yAxis: +d.variables[trendVar].lower.toFixed(3) }],
                          },
                        },
                      ],
                    }}
                  />
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium">Model check for this day</div>
                  {Object.keys(d.predictions).length === 0 ? (
                    <Notice>
                      This day is outside the hold-out test period, so there is no out-of-sample prediction for it. Models are
                      only evaluated on the final 20% of days.
                    </Notice>
                  ) : (
                    <Table head={['Target', 'Actual', ...CHECK_MODELS.map((x) => MODEL_LABEL[x])]}>
                      {(Object.keys(d.predictions) as (keyof typeof d.predictions)[]).map((t) => {
                        const p = d.predictions[t]!
                        return (
                          <tr key={t}>
                            <td className="text-ink">{varLabel(m, t)}</td>
                            <td className="font-medium text-ink">{fmt(p.actual, 3)}</td>
                            {CHECK_MODELS.map((x) => (
                              <td key={x} className={isReference(x) ? 'text-grey-500' : ''}>{fmt(p[x], 3)}</td>
                            ))}
                          </tr>
                        )
                      })}
                    </Table>
                  )}
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <Notice>
        Flags are statistical signals that a record differs from the historical pattern; they do not indicate unsafe water.
        This dashboard summarises historical records and is not a real-time monitor.
      </Notice>
    </div>
  )
}
