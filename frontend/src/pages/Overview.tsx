import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  Droplet,
  FlaskConical,
  Gauge,
  Pipette,
  TriangleAlert,
  Waves,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchers, type DayVariable, type DayView, type Meta, type Method, type VariableKey } from '../api/client'
import Chart from '../components/Chart'
import DatePicker from '../components/DatePicker'
import { Badge, Card, CardHeader, ErrorState, Loading, Notice, Select, Table } from '../components/ui'
import { fmt, isReference, METHOD_LABEL, MODEL_LABEL, varLabel, varUnit } from '../lib/format'
import { useMeta } from '../lib/hooks'

const STATUS_TONE = { low: 'warning', high: 'warning', normal: 'success' } as const
const STATUS_LABEL = { low: 'Low', high: 'High', normal: 'Normal' } as const
const CHECK_MODELS = ['linear_regression', 'random_forest', 'historical_mean'] as const
const DIGITS: Partial<Record<VariableKey, number>> = { influent_ph: 2, outlet_ph: 2 }

const dp = (k: VariableKey) => DIGITS[k] ?? 2

/** The value of `key` on the previous record, if that record is the previous calendar day. */
function prevValue(d: DayView, key: VariableKey): number | null {
  const prev = d.neighbours.find((r) => r.date === d.prev_date)
  if (!prev || !d.prev_date) return null
  const gap = (Date.parse(d.date) - Date.parse(d.prev_date)) / 86_400_000
  return gap === 1 ? prev[key] : null
}

function DayKpi({ d, k, m, icon }: { d: DayView; k: VariableKey; m: Meta; icon: ReactNode }) {
  const v = d.variables[k]
  const prev = prevValue(d, k)
  const delta = v.value !== null && prev !== null ? v.value - prev : null
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className="text-primary-300">{icon}</div>
          <div>
            <div className="text-[15px] font-medium leading-tight">{varLabel(m, k)}</div>
            <div className="text-xs text-grey-500">Median {fmt(v.median, dp(k))} · range {fmt(v.lower, dp(k))}–{fmt(v.upper, dp(k))}</div>
          </div>
        </div>
        {v.status && <Badge tone={STATUS_TONE[v.status]} dot>{STATUS_LABEL[v.status]}</Badge>}
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-[28px] font-medium leading-none">{fmt(v.value, dp(k))}</span>
        <span className="text-sm text-grey-500">{varUnit(m, k)}</span>
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-grey-500">
        {delta === null ? (
          'No previous-day record'
        ) : (
          <>
            {delta > 0 ? <ArrowUpRight className="size-3.5" /> : delta < 0 ? <ArrowDownRight className="size-3.5" /> : <ArrowRight className="size-3.5" />}
            {delta > 0 ? '+' : ''}{fmt(delta, dp(k))} vs previous day
          </>
        )}
      </div>
    </Card>
  )
}

/** Gauge whose dial is coloured by the dataset's normal range: amber below/above, blue inside. */
function DayGauge({ v, digits }: { v: DayVariable; digits: number }) {
  const lo0 = Math.min(v.min, v.lower)
  const hi0 = Math.max(v.max, v.upper)
  const pad = (hi0 - lo0) * 0.12 || 0.1
  const gMin = +(lo0 - pad).toFixed(3)
  const gMax = +(hi0 + pad).toFixed(3)
  const frac = (x: number) => Math.min(1, Math.max(0, (x - gMin) / (gMax - gMin)))
  const colour = v.status === 'normal' ? '#2b6be2' : '#ffbe4c'
  return (
    <Chart
      height={250}
      option={{
        tooltip: { show: false },
        series: [
          {
            type: 'gauge',
            min: gMin,
            max: gMax,
            startAngle: 210,
            endAngle: -30,
            radius: '92%',
            center: ['50%', '58%'],
            splitNumber: 5,
            axisLine: {
              roundCap: true,
              lineStyle: {
                width: 16,
                color: [
                  [frac(v.lower), '#ffe3a8'],
                  [frac(v.upper), '#c9d9f8'],
                  [1, '#ffe3a8'],
                ],
              },
            },
            progress: { show: false },
            axisTick: { distance: -22, length: 4, lineStyle: { color: '#dfe1e7' } },
            splitLine: { distance: -24, length: 8, lineStyle: { color: '#dfe1e7', width: 1.5 } },
            axisLabel: { distance: -8, color: '#666d80', fontSize: 11, formatter: (x: number) => x.toFixed(digits) },
            pointer: { length: '58%', width: 6, offsetCenter: [0, '6%'], itemStyle: { color: colour } },
            anchor: { show: true, size: 14, showAbove: true, itemStyle: { color: '#fff', borderColor: colour, borderWidth: 4 } },
            title: { show: false },
            detail: {
              valueAnimation: true,
              offsetCenter: [0, '52%'],
              fontSize: 30,
              fontWeight: 500,
              color: '#0d0d12',
              formatter: (x: number) => x.toFixed(digits),
            },
            data: [{ value: v.value ?? gMin }],
          },
        ],
      }}
    />
  )
}

function RangeBar({ v }: { v: DayVariable }) {
  const span = v.upper - v.lower || 1
  const lo = Math.min(v.min, v.lower) - span * 0.1
  const hi = Math.max(v.max, v.upper) + span * 0.1
  const pos = (x: number) => `${Math.min(100, Math.max(0, ((x - lo) / (hi - lo)) * 100))}%`
  return (
    <div className="relative h-1.5 rounded-full bg-grey-50">
      <div className="absolute inset-y-0 rounded-full bg-primary-0 ring-1 ring-primary-100/50" style={{ left: pos(v.lower), right: `calc(100% - ${pos(v.upper)})` }} />
      <div className="absolute inset-y-[-3px] w-px bg-grey-500" style={{ left: pos(v.median) }} />
      {v.value !== null && (
        <div
          className={`absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${v.status === 'normal' ? 'bg-primary-300' : 'bg-warning-100'}`}
          style={{ left: pos(v.value) }}
        />
      )}
    </div>
  )
}

export default function Overview() {
  const meta = useMeta()
  const m = meta.data
  const records = useQuery({ queryKey: ['records'], queryFn: () => fetchers.records() })
  const anomalies = useQuery({ queryKey: ['anomalies'], queryFn: fetchers.anomalies })
  const [params, setParams] = useSearchParams()
  const [gaugeVar, setGaugeVar] = useState<VariableKey>('outlet_free_chlorine')
  const [trendVar, setTrendVar] = useState<VariableKey>('outlet_free_chlorine')

  const available = useMemo(() => (records.data ?? []).map((r) => r.date), [records.data])
  // Default to the last record in the dataset, not today's date: this is a historical-analysis tool.
  const selected = params.get('date') ?? available[available.length - 1] ?? ''
  const select = (d: string) => setParams({ date: d }, { replace: true })
  const day = useQuery({ queryKey: ['day', selected], queryFn: () => fetchers.day(selected), enabled: !!selected })

  const flags = useMemo(() => {
    const out: Record<string, Method[]> = {}
    for (const i of anomalies.data?.items ?? []) out[i.date] = i.methods
    return out
  }, [anomalies.data])

  if (!m || records.isLoading) return <Loading />
  if (records.error) return <ErrorState error={records.error} />
  const d = day.data
  const flaggedBy = d?.anomaly ? (Object.keys(d.anomaly) as Method[]) : []
  const varOptions = (Object.keys(m.variables) as VariableKey[]).map((k) => ({ value: k, label: varLabel(m, k) }))

  return (
    <div className="space-y-4">
      {/* Date bar */}
      <Card className="flex flex-wrap items-center justify-between gap-3 py-3">
        <DatePicker available={available} flags={flags} value={selected} onChange={select} />
        <div className="flex items-center gap-2 text-sm">
          {d && (flaggedBy.length === 2 ? <Badge tone="error" dot>Flagged by both methods</Badge>
            : flaggedBy.length === 1 ? <Badge tone="warning" dot>Flagged by {METHOD_LABEL[flaggedBy[0]]}</Badge>
              : <Badge tone="success" dot>No flags</Badge>)}
          <span className="text-grey-500">Day {available.indexOf(selected) + 1} of {available.length}</span>
        </div>
      </Card>

      {day.isLoading && <Loading />}
      {day.error && <ErrorState error={day.error} />}
      {d && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DayKpi d={d} k="outlet_turbidity" m={m} icon={<Waves className="size-5" />} />
            <DayKpi d={d} k="outlet_ph" m={m} icon={<FlaskConical className="size-5" />} />
            <DayKpi d={d} k="outlet_free_chlorine" m={m} icon={<Droplet className="size-5" />} />
            <DayKpi d={d} k="naocl_dosage" m={m} icon={<Pipette className="size-5" />} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* Gauge */}
            <Card>
              <CardHeader
                title="Indicator Gauge"
                subtitle={`${d.date} · blue band = normal range`}
                icon={<Gauge className="size-4" />}
                actions={d.variables[gaugeVar].status && (
                  <Badge tone={STATUS_TONE[d.variables[gaugeVar].status!]} dot>{STATUS_LABEL[d.variables[gaugeVar].status!]}</Badge>
                )}
              />
              <Select value={gaugeVar} onChange={setGaugeVar} options={varOptions} />
              <DayGauge v={d.variables[gaugeVar]} digits={dp(gaugeVar)} />
              <div className="-mt-4 text-center text-sm text-grey-500">{varUnit(m, gaugeVar) || ' '}</div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  ['Normal range', `${fmt(d.variables[gaugeVar].lower, dp(gaugeVar))}–${fmt(d.variables[gaugeVar].upper, dp(gaugeVar))}`],
                  ['Median', fmt(d.variables[gaugeVar].median, dp(gaugeVar))],
                  ['Percentile', `P${fmt(d.variables[gaugeVar].percentile, 0)}`],
                ].map(([l, val]) => (
                  <div key={l} className="rounded-xl bg-grey-25 px-2 py-2">
                    <div className="text-[11px] text-grey-500">{l}</div>
                    <div className="text-sm font-medium">{val}</div>
                  </div>
                ))}
              </div>
              {m.reference_ranges[gaugeVar] && (
                <p className="mt-3 text-center text-xs text-grey-500">Reference: {m.reference_ranges[gaugeVar]!.note}</p>
              )}
            </Card>

            {/* Treatment + surrounding days */}
            <div className="space-y-4">
              <Card>
                <CardHeader title="Influent → Outlet" subtitle={`Treatment on ${d.date}`} />
                <div className="space-y-3">
                  {([
                    ['Turbidity', 'influent_turbidity', 'outlet_turbidity', 'NTU', 3],
                    ['pH', 'influent_ph', 'outlet_ph', '', 2],
                  ] as const).map(([label, a, b, unit, digits]) => {
                    const va = d.variables[a].value
                    const vb = d.variables[b].value
                    const pct = va && vb !== null ? ((vb - va) / va) * 100 : null
                    return (
                      <div key={label} className="flex items-center justify-between rounded-xl bg-grey-25 px-3 py-2.5">
                        <span className="text-sm text-grey-500">{label}</span>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{fmt(va, digits)}</span>
                          <ArrowRight className="size-4 text-grey-500" />
                          <span className="font-medium">{fmt(vb, digits)}</span>
                          <span className="text-xs text-grey-500">{unit}</span>
                          {pct !== null && (
                            <Badge tone={label === 'Turbidity' ? (pct <= 0 ? 'success' : 'warning') : 'grey'}>
                              {pct > 0 ? '+' : ''}{fmt(pct, 1)}%
                            </Badge>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Card>
              <Card>
                <CardHeader
                  title="Nearby Days"
                  subtitle="±3 days · dashed = normal range"
                  actions={<Select value={trendVar} onChange={setTrendVar} options={varOptions} className="w-44" />}
                />
                <Chart
                  height={215}
                  option={{
                    grid: { top: 12 },
                    xAxis: { type: 'category', data: d.neighbours.map((r) => r.date.slice(5)), splitLine: { show: false } },
                    yAxis: (() => {
                      const vals = d.neighbours.map((r) => r[trendVar]).filter((x): x is number => x !== null)
                      const lo = Math.min(d.variables[trendVar].lower, ...vals)
                      const hi = Math.max(d.variables[trendVar].upper, ...vals)
                      const pad = (hi - lo) * 0.1 || 0.1
                      return { type: 'value', min: +(lo - pad).toFixed(3), max: +(hi + pad).toFixed(3) }
                    })(),
                    series: [
                      {
                        type: 'line',
                        smooth: true,
                        lineStyle: { color: '#80a6ee', width: 2 },
                        areaStyle: { color: 'rgba(43,107,226,0.06)' },
                        data: d.neighbours.map((r) => ({
                          value: r[trendVar],
                          symbolSize: r.date === d.date ? 12 : 6,
                          itemStyle: { color: r.date === d.date ? '#2b6be2' : flags[r.date] ? '#ffbe4c' : '#80a6ee' },
                        })),
                        markLine: {
                          symbol: 'none',
                          silent: true,
                          lineStyle: { color: '#ffbe4c', type: 'dashed' },
                          label: { show: false },
                          data: [{ yAxis: +d.variables[trendVar].upper.toFixed(3) }, { yAxis: +d.variables[trendVar].lower.toFixed(3) }],
                        },
                      },
                    ],
                  }}
                />
              </Card>
            </div>

            {/* Alerts + all indicators */}
            <div className="space-y-4">
              <Card>
                <CardHeader title="Alert Information" subtitle="Anomaly detection result for this day" icon={<TriangleAlert className="size-4" />} />
                {flaggedBy.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-xl bg-success-0 px-3 py-3 text-sm text-success-200">
                    <CheckCircle2 className="size-4" /> Not flagged by IQR or Isolation Forest
                  </div>
                ) : (
                  <div className="space-y-2">
                    {flaggedBy.map((method) => (
                      <div key={method} className="rounded-xl bg-grey-25 p-3 text-sm">
                        <div className="mb-1 flex items-center gap-2 font-medium">
                          <TriangleAlert className="size-4 text-warning-100" /> {METHOD_LABEL[method]}
                        </div>
                        {d.anomaly![method]!.contributors.map((c) => (
                          <div key={c.variable} className="flex justify-between gap-3 text-xs text-paragraph">
                            <span>{varLabel(m, c.variable)}</span>
                            <span>
                              {fmt(c.value, 3)} {varUnit(m, c.variable)}{' '}
                              {method === 'iqr' ? `· ${c.direction}` : `· z ${c.z !== undefined && c.z > 0 ? '+' : ''}${fmt(c.z)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                    <p className="text-[11px] text-grey-500">A flag means the record differs from the historical pattern, not that the water is unsafe.</p>
                  </div>
                )}
              </Card>
              <Card>
                <CardHeader title="All Indicators" subtitle="Dot = this day · band = normal range · tick = median" />
                <div className="space-y-3">
                  {(Object.keys(m.variables) as VariableKey[]).map((k) => {
                    const v = d.variables[k]
                    return (
                      <div key={k}>
                        <div className="mb-1.5 flex items-center justify-between text-sm">
                          <span className="text-paragraph">{varLabel(m, k)}</span>
                          <span className={`font-medium ${v.status && v.status !== 'normal' ? 'text-warning-200' : ''}`}>
                            {fmt(v.value, dp(k))} <span className="text-xs font-normal text-grey-500">{varUnit(m, k)}</span>
                          </span>
                        </div>
                        <RangeBar v={v} />
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>
          </div>

          {/* Model check (only for hold-out test days) */}
          <Card>
            <CardHeader
              title="Model Check"
              subtitle="Out-of-sample next-day prediction for this date (hold-out test period only)"
              icon={<BrainCircuit className="size-4" />}
              actions={<Link to="/evaluation" className="text-xs text-primary-300">Model evaluation →</Link>}
            />
            {Object.keys(d.predictions).length === 0 ? (
              <p className="text-sm text-grey-500">
                {d.date} is in the training period, so there is no out-of-sample prediction for it. Select a date in the final
                20% of the dataset to compare predictions with the actual value.
              </p>
            ) : (
              <Table head={['Target', 'Actual', ...CHECK_MODELS.map((x) => MODEL_LABEL[x])]}>
                {(Object.keys(d.predictions) as (keyof typeof d.predictions)[]).map((t) => {
                  const p = d.predictions[t]!
                  return (
                    <tr key={t}>
                      <td className="text-ink">{varLabel(m, t)}</td>
                      <td className="font-medium text-ink">{fmt(p.actual, 3)}</td>
                      {CHECK_MODELS.map((x) => (
                        <td key={x} className={isReference(x) ? 'text-grey-500' : ''}>
                          {fmt(p[x], 3)} <span className="text-xs text-grey-500">({p[x] !== undefined ? `${p.actual - p[x]! > 0 ? '+' : ''}${fmt(p.actual - p[x]!, 3)}` : '—'})</span>
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </Table>
            )}
          </Card>

          <Notice>
            Single-day view of the historical dataset. Normal ranges are IQR bounds (k = {d.iqr_k}) computed from all records;
            this is not a real-time monitor.
          </Notice>
        </>
      )}
    </div>
  )
}
