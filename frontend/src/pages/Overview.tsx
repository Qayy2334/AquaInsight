import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Droplet, FlaskConical, Gauge, TriangleAlert, Waves } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchers, type TargetKey, type VariableKey } from '../api/client'
import Chart from '../components/Chart'
import { Badge, Card, CardHeader, ErrorState, Loading, Notice, Select, StatCard, Table } from '../components/ui'
import { fmt, MODEL_LABEL, METHOD_LABEL, varLabel, varUnit } from '../lib/format'
import { useMeta } from '../lib/hooks'

const GAUGE_RANGE: Record<TargetKey, [number, number]> = {
  outlet_turbidity: [0, 1],
  outlet_ph: [6, 9],
  outlet_free_chlorine: [0, 1],
}

export default function Overview() {
  const meta = useMeta()
  const overview = useQuery({ queryKey: ['overview'], queryFn: fetchers.overview })
  const records = useQuery({ queryKey: ['records'], queryFn: () => fetchers.records() })
  const nextDay = useQuery({ queryKey: ['next-day'], queryFn: fetchers.nextDay })
  const [gaugeVar, setGaugeVar] = useState<TargetKey>('outlet_ph')

  if (overview.isLoading) return <Loading />
  if (overview.error) return <ErrorState error={overview.error} />
  const o = overview.data!
  const m = meta.data

  const recent = (records.data ?? []).slice(-30)
  const gaugeValue = o.kpis[gaugeVar].latest ?? 0
  const [gMin, gMax] = GAUGE_RANGE[gaugeVar]
  const ref = m?.reference_ranges[gaugeVar]
  const inRef = ref ? (ref.min === undefined || gaugeValue >= ref.min) && (ref.max === undefined || gaugeValue <= ref.max) : true
  const completeness = (o.quality?.completeness ?? 0) * 100

  const kpi = (key: VariableKey) => o.kpis[key]

  return (
    <div className="space-y-4">
      {o.dataset.source === 'demo' && (
        <Notice tone="warning">
          You are viewing a <strong>synthetic demo dataset</strong>. Upload the plant&apos;s Excel records in{' '}
          <Link to="/data" className="underline">
            Data Management
          </Link>{' '}
          to analyse real data.
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Waves className="size-5" />}
          title="Outlet Turbidity"
          subtitle={`Last record · ${o.latest_date}`}
          value={fmt(kpi('outlet_turbidity').latest)}
          unit="NTU"
          footer={`7-day avg ${fmt(kpi('outlet_turbidity').avg_7d)}`}
        />
        <StatCard
          icon={<FlaskConical className="size-5" />}
          title="Outlet pH"
          subtitle={`Last record · ${o.latest_date}`}
          value={fmt(kpi('outlet_ph').latest)}
          footer={`7-day avg ${fmt(kpi('outlet_ph').avg_7d)}`}
        />
        <StatCard
          icon={<Droplet className="size-5" />}
          title="Outlet Free Chlorine"
          subtitle={`Last record · ${o.latest_date}`}
          value={fmt(kpi('outlet_free_chlorine').latest)}
          unit="mg/L"
          footer={`7-day avg ${fmt(kpi('outlet_free_chlorine').avg_7d)}`}
        />
        <StatCard
          icon={<TriangleAlert className="size-5" />}
          title="Potential Anomalies"
          subtitle="Flagged records in dataset"
          value={String(o.anomaly_counts.iforest)}
          unit="Isolation Forest"
          footer={`${o.anomaly_counts.iqr} flagged by IQR`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Gauge + recent anomalies */}
        <Card>
          <CardHeader
            title="Indicator Gauge"
            subtitle={`Last record · ${o.latest_date}`}
            icon={<Gauge className="size-4" />}
            actions={<Badge tone={inRef ? 'success' : 'warning'} dot>{inRef ? 'Within ref.' : 'Outside ref.'}</Badge>}
          />
          <Select
            value={gaugeVar}
            onChange={setGaugeVar}
            options={(m?.targets ?? []).map((t) => ({ value: t, label: varLabel(m, t) }))}
          />
          <Chart
            height={220}
            option={{
              tooltip: { show: false },
              series: [
                {
                  type: 'gauge',
                  min: gMin,
                  max: gMax,
                  startAngle: 200,
                  endAngle: -20,
                  radius: '95%',
                  center: ['50%', '62%'],
                  progress: { show: true, width: 14, roundCap: true, itemStyle: { color: '#2b6be2' } },
                  axisLine: { lineStyle: { width: 14, color: [[1, '#eceff3']] }, roundCap: true },
                  axisTick: { show: false },
                  splitLine: { length: 6, distance: -26, lineStyle: { color: '#dfe1e7' } },
                  axisLabel: { distance: -12, color: '#666d80', fontSize: 11 },
                  pointer: { length: '45%', width: 5, itemStyle: { color: '#2b6be2' } },
                  anchor: { show: true, size: 10, itemStyle: { color: '#2b6be2' } },
                  detail: { valueAnimation: true, offsetCenter: [0, '42%'], fontSize: 26, color: '#0d0d12', formatter: (v: number) => v.toFixed(2) },
                  data: [{ value: gaugeValue }],
                },
              ],
            }}
          />
          {ref && <p className="-mt-2 text-center text-xs text-grey-500">{ref.note}</p>}

          <h4 className="mb-2 mt-5 font-medium">Recent Flagged Records</h4>
          <div className="space-y-2">
            {o.recent_anomalies.length === 0 && <p className="text-sm text-grey-500">No records flagged.</p>}
            {o.recent_anomalies.slice(0, 3).map((a, i) => (
              <div key={i} className="rounded-xl bg-grey-25 p-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <TriangleAlert className="size-4 text-warning-100" />
                  {a.date}
                  <Badge tone="grey">{METHOD_LABEL[a.method]}</Badge>
                </div>
                <div className="mt-1 text-xs text-paragraph">
                  {a.contributors
                    .slice(0, 2)
                    .map((c) => `${varLabel(m, c.variable)} ${fmt(c.value)} ${varUnit(m, c.variable)}`)
                    .join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Trend + completeness */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Last 30 Days"
              subtitle="Outlet indicators"
              actions={
                <Link to="/trends" className="rounded-lg border border-grey-100 p-1.5 text-grey-500 hover:text-ink">
                  <ArrowRight className="size-4" />
                </Link>
              }
            />
            <Chart
              height={250}
              option={{
                legend: {},
                grid: { bottom: 32 },
                xAxis: { type: 'category', data: recent.map((r) => r.date.slice(5)), splitLine: { show: false } },
                yAxis: [{ type: 'value' }, { type: 'value', position: 'right', splitLine: { show: false } }],
                series: [
                  { name: 'Turbidity', type: 'line', smooth: true, showSymbol: false, data: recent.map((r) => r.outlet_turbidity) },
                  { name: 'Free Cl', type: 'line', smooth: true, showSymbol: false, data: recent.map((r) => r.outlet_free_chlorine) },
                  { name: 'pH', type: 'line', smooth: true, showSymbol: false, yAxisIndex: 1, data: recent.map((r) => r.outlet_ph) },
                ],
              }}
            />
          </Card>
          <Card>
            <CardHeader title="Data Completeness" subtitle={`${o.quality.start_date} → ${o.quality.end_date}`} />
            <div className="flex h-7 gap-[3px]">
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-sm ${i < Math.round(completeness * 0.4) ? 'bg-primary-200' : 'bg-grey-50'}`}
                />
              ))}
            </div>
            <div className="mt-3 space-y-1 text-sm text-paragraph">
              <div>
                Values present: <span className="font-medium text-ink">{completeness.toFixed(1)}%</span>
              </div>
              <div>
                Missing calendar days: <span className="font-medium text-ink">{o.quality.missing_days}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Next-day prediction */}
        <Card>
          <CardHeader
            title="Model Output on Last Record"
            subtitle={nextDay.data ? `Inputs: ${nextDay.data.based_on} → estimate for ${nextDay.data.for_date}` : ''}
            icon={<FlaskConical className="size-4" />}
          />
          {nextDay.isLoading && <Loading />}
          {nextDay.data && (
            <div className="space-y-3">
              {(m?.targets ?? []).map((t) => {
                const p = nextDay.data.predictions[t]
                return (
                  <div key={t} className="rounded-xl border border-grey-50 p-3">
                    <div className="text-sm font-medium">{varLabel(m, t)}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(['linear_regression', 'random_forest'] as const).map((mt) => (
                        <div key={mt} className="rounded-lg bg-grey-25 px-3 py-2">
                          <div className="text-[11px] text-grey-500">{MODEL_LABEL[mt]}</div>
                          <div className="text-lg font-medium">
                            {fmt(p?.[mt]?.value)} <span className="text-xs font-normal text-grey-500">{varUnit(m, t)}</span>
                          </div>
                          <div className="text-[11px] text-grey-500">± MAE {fmt(p?.[mt]?.mae, 3)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-4">
            <Notice>
              Illustrates what the trained models output for the final record. This is a historical-analysis tool, not
              an operational forecast; see Model Evaluation for how reliable these models are.
            </Notice>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Latest Records" subtitle="Most recent 7 days" />
        <Table head={['Date', ...(m ? Object.values(m.variables).map((v) => (v.unit ? `${v.label} (${v.unit})` : v.label)) : [])]}>
          {(records.data ?? [])
            .slice(-7)
            .reverse()
            .map((r) => (
              <tr key={r.date}>
                <td className="text-ink">{r.date}</td>
                {m && (Object.keys(m.variables) as VariableKey[]).map((k) => <td key={k}>{fmt(r[k])}</td>)}
              </tr>
            ))}
        </Table>
      </Card>
    </div>
  )
}
