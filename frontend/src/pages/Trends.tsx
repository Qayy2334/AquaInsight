import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { fetchers, type VariableKey, type WaterRecord } from '../api/client'
import Chart from '../components/Chart'
import { Card, CardHeader, ErrorState, Loading, Segmented, Select, Table } from '../components/ui'
import { fmt, varLabel, varUnit } from '../lib/format'
import { useMeta } from '../lib/hooks'

type Range = '1W' | '2W' | '1M' | 'ALL'
const RANGE_DAYS: Record<Range, number> = { '1W': 7, '2W': 14, '1M': 30, ALL: Infinity }

function rolling(rows: WaterRecord[], key: VariableKey, window = 7) {
  return rows.map((_, i) => {
    const vals = rows.slice(Math.max(0, i - window + 1), i + 1).map((r) => r[key]).filter((v): v is number => v !== null)
    return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3) : null
  })
}

const PAIRS = {
  turbidity: ['influent_turbidity', 'outlet_turbidity'],
  ph: ['influent_ph', 'outlet_ph'],
} as const

export default function Trends() {
  const meta = useMeta()
  const m = meta.data
  const records = useQuery({ queryKey: ['records'], queryFn: () => fetchers.records() })
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchers.stats })
  const [variable, setVariable] = useState<VariableKey>('outlet_free_chlorine')
  const [range, setRange] = useState<Range>('ALL')
  const [pair, setPair] = useState<keyof typeof PAIRS>('turbidity')
  const [corrMethod, setCorrMethod] = useState<'pearson' | 'spearman'>('pearson')
  const [distView, setDistView] = useState<'hist' | 'box'>('hist')
  const [sx, setSx] = useState<VariableKey>('naocl_dosage')
  const [sy, setSy] = useState<VariableKey>('outlet_free_chlorine')

  const hist = useQuery({ queryKey: ['hist', variable], queryFn: () => fetchers.histogram(variable, 12) })
  const corr = useQuery({ queryKey: ['corr', corrMethod], queryFn: () => fetchers.correlation(corrMethod) })
  const scatter = useQuery({ queryKey: ['scatter', sx, sy], queryFn: () => fetchers.scatter(sx, sy) })

  const rows = useMemo(() => {
    const all = records.data ?? []
    const n = RANGE_DAYS[range]
    return Number.isFinite(n) ? all.slice(-n) : all
  }, [records.data, range])

  if (records.isLoading || !m) return <Loading />
  if (records.error) return <ErrorState error={records.error} />

  const varOptions = (Object.keys(m.variables) as VariableKey[]).map((k) => ({ value: k, label: varLabel(m, k) }))
  const short = (k: VariableKey) => varLabel(m, k).replace('Influent', 'In.').replace('Outlet', 'Out.')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={variable} onChange={setVariable} options={varOptions} className="w-64" />
        <Segmented
          value={range}
          onChange={setRange}
          options={(Object.keys(RANGE_DAYS) as Range[]).map((r) => ({ value: r, label: r === 'ALL' ? 'All' : r }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title={`${varLabel(m, variable)} History`}
            subtitle={rows.length ? `${rows[0].date} – ${rows[rows.length - 1].date}` : ''}
          />
          <Chart
            height={300}
            option={{
              legend: {},
              grid: { bottom: 32 },
              xAxis: { type: 'category', data: rows.map((r) => r.date), splitLine: { show: false } },
              yAxis: { type: 'value', scale: true, name: varUnit(m, variable) },
              dataZoom: [{ type: 'inside' }],
              series: [
                { name: 'Daily', type: 'line', step: 'middle', showSymbol: false, lineStyle: { width: 1.5 }, data: rows.map((r) => r[variable]) },
                { name: '7-day avg', type: 'line', smooth: true, showSymbol: false, lineStyle: { width: 2 }, data: rolling(rows, variable) },
              ],
            }}
          />
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Influent vs Outlet"
            subtitle="Weekly averages (week starting Monday)"
            actions={
              <Segmented value={pair} onChange={setPair} options={[{ value: 'turbidity', label: 'Turbidity' }, { value: 'ph', label: 'pH' }]} />
            }
          />
          {(() => {
            const [a, b] = PAIRS[pair]
            const months = new Map<string, { a: number[]; b: number[] }>()
            for (const r of records.data ?? []) {
              const d = new Date(`${r.date}T00:00:00Z`)
              d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
              const k = d.toISOString().slice(5, 10)
              const e = months.get(k) ?? { a: [], b: [] }
              if (r[a] !== null) e.a.push(r[a]!)
              if (r[b] !== null) e.b.push(r[b]!)
              months.set(k, e)
            }
            const avg = (xs: number[]) => (xs.length ? +(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(3) : null)
            const keys = [...months.keys()]
            return (
              <Chart
                height={300}
                option={{
                  legend: {},
                  grid: { bottom: 32 },
                  color: ['#80a6ee', '#2b6be2'],
                  xAxis: { type: 'category', data: keys, splitLine: { show: false } },
                  yAxis: { type: 'value', scale: pair === 'ph' },
                  series: [
                    { name: varLabel(m, a), type: 'bar', barGap: '15%', itemStyle: { borderRadius: [4, 4, 0, 0] }, data: keys.map((k) => avg(months.get(k)!.a)) },
                    { name: varLabel(m, b), type: 'bar', itemStyle: { borderRadius: [4, 4, 0, 0] }, data: keys.map((k) => avg(months.get(k)!.b)) },
                  ],
                }}
              />
            )
          })()}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="Distribution"
            subtitle={distView === 'box' ? `${varLabel(m, variable)} · whiskers at 1.5 × IQR` : varLabel(m, variable)}
            actions={<Segmented value={distView} onChange={setDistView} options={[{ value: 'hist', label: 'Histogram' }, { value: 'box', label: 'Box plot' }]} />}
          />
          {distView === 'hist' && hist.data && (
            <Chart
              height={280}
              option={{
                tooltip: { trigger: 'axis' },
                xAxis: {
                  type: 'category',
                  data: hist.data.counts.map((_, i) => `${fmt(hist.data.edges[i])}–${fmt(hist.data.edges[i + 1])}`),
                  axisLabel: { show: false },
                  splitLine: { show: false },
                },
                yAxis: { type: 'value', name: 'Days' },
                series: [{ type: 'bar', barCategoryGap: '8%', itemStyle: { color: '#5589e8', borderRadius: [3, 3, 0, 0] }, data: hist.data.counts }],
              }}
            />
          )}
          {distView === 'box' && (() => {
            const s = stats.data?.find((x) => x.variable === variable)
            if (!s) return <Loading />
            const iqr = s.q3 - s.q1
            const [lo, hi] = [s.q1 - 1.5 * iqr, s.q3 + 1.5 * iqr]
            const vals = (records.data ?? []).map((r) => [r.date, r[variable]] as const).filter((x): x is readonly [string, number] => x[1] !== null)
            const inside = vals.map(([, v]) => v).filter((v) => v >= lo - 1e-9 && v <= hi + 1e-9)
            const outliers = vals.filter(([, v]) => v < lo - 1e-9 || v > hi + 1e-9)
            return (
              <Chart
                height={280}
                option={{
                  tooltip: { trigger: 'item' },
                  xAxis: { type: 'category', data: [varLabel(m, variable)], splitLine: { show: false } },
                  yAxis: { type: 'value', scale: true, name: varUnit(m, variable) },
                  series: [
                    {
                      type: 'boxplot',
                      itemStyle: { color: '#f4f7ff', borderColor: '#2b6be2', borderWidth: 1.5 },
                      boxWidth: [40, 80],
                      data: [[Math.min(...inside), s.q1, s.median, s.q3, Math.max(...inside)]],
                      tooltip: { formatter: () => `Q1 ${fmt(s.q1, 3)} · median ${fmt(s.median, 3)} · Q3 ${fmt(s.q3, 3)}<br/>IQR bounds ${fmt(lo, 3)} – ${fmt(hi, 3)}` },
                    },
                    {
                      type: 'scatter',
                      symbolSize: 8,
                      itemStyle: { color: '#ffbe4c' },
                      data: outliers.map(([d, v]) => ({ value: [0, v], name: d })),
                      tooltip: { formatter: (p: unknown) => { const q = p as { name: string; value: number[] }; return `${q.name}: ${fmt(q.value[1], 3)}` } },
                    },
                  ],
                }}
              />
            )
          })()}
        </Card>

        <Card>
          <CardHeader
            title="Correlation"
            subtitle="Between the six variables"
            actions={
              <Segmented value={corrMethod} onChange={setCorrMethod} options={[{ value: 'pearson', label: 'Pearson' }, { value: 'spearman', label: 'Spearman' }]} />
            }
          />
          {corr.data && (
            <Chart
              height={280}
              option={{
                tooltip: { trigger: 'item', formatter: (p: unknown) => {
                  const d = (p as { data: [number, number, number] }).data
                  return `${varLabel(m, corr.data.variables[d[0]])}<br/>${varLabel(m, corr.data.variables[d[1]])}<br/><b>${d[2].toFixed(2)}</b>`
                } },
                grid: { left: 4, top: 4, right: 4, bottom: 4 },
                xAxis: { type: 'category', data: corr.data.variables.map(short), axisLabel: { rotate: 40, fontSize: 10 }, splitLine: { show: false } },
                yAxis: { type: 'category', data: corr.data.variables.map(short), axisLabel: { fontSize: 10 }, splitLine: { show: false } },
                visualMap: { min: -1, max: 1, show: false, inRange: { color: ['#f07a8c', '#f6f8fa', '#2b6be2'] } },
                series: [
                  {
                    type: 'heatmap',
                    data: corr.data.matrix.flatMap((row, i) => row.map((v, j) => [j, i, v])),
                    label: { show: true, fontSize: 10, formatter: (p: unknown) => (p as { data: number[] }).data[2].toFixed(2) },
                    itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 4 },
                  },
                ],
              }}
            />
          )}
        </Card>

        <Card>
          <CardHeader title="Relationship" subtitle="Scatter with linear trend" />
          <div className="mb-2 grid grid-cols-2 gap-2">
            <Select value={sx} onChange={setSx} options={varOptions} />
            <Select value={sy} onChange={setSy} options={varOptions} />
          </div>
          {scatter.data && (() => {
            const xs = scatter.data.points.map((p) => p[0])
            const [lo, hi] = [Math.min(...xs), Math.max(...xs)]
            const { slope, intercept } = scatter.data.trend
            return (
              <Chart
                height={236}
                option={{
                  tooltip: { trigger: 'item', formatter: (p: unknown) => {
                    const d = (p as { data: [number, number, string?] }).data
                    return d[2] ? `${d[2]}<br/>x ${d[0].toFixed(2)} · y ${d[1].toFixed(2)}` : ''
                  } },
                  xAxis: { type: 'value', scale: true, name: short(sx), nameLocation: 'middle', nameGap: 24 },
                  yAxis: { type: 'value', scale: true },
                  series: [
                    { type: 'scatter', symbolSize: 5, itemStyle: { color: '#2b6be2', opacity: 0.55 }, data: scatter.data.points },
                    { type: 'line', showSymbol: false, lineStyle: { color: '#ffbe4c', width: 2 }, data: [[lo, slope * lo + intercept], [hi, slope * hi + intercept]] },
                  ],
                }}
              />
            )
          })()}
        </Card>
      </div>

      <Card>
        <CardHeader title="Descriptive Statistics" subtitle="All records in the dataset (raw values)" />
        <Table head={['Variable', 'Count', 'Missing', 'Mean', 'Std', 'Min', 'Q1', 'Median', 'Q3', 'Max']}>
          {(stats.data ?? []).map((s) => (
            <tr key={s.variable}>
              <td className="text-ink">
                {varLabel(m, s.variable)} {varUnit(m, s.variable) && <span className="text-grey-500">({varUnit(m, s.variable)})</span>}
              </td>
              <td>{s.count}</td>
              <td>{s.missing}</td>
              {[s.mean, s.std, s.min, s.q1, s.median, s.q3, s.max].map((v, i) => (
                <td key={i}>{fmt(v, 3)}</td>
              ))}
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
