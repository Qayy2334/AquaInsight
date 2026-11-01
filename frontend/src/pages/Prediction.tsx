import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, Droplet, FlaskConical, Target, Waves } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fetchers, type Forecast, type Meta, type TargetKey } from '../api/client'
import Chart from '../components/Chart'
import { Badge, Card, CardHeader, ErrorState, Loading, Notice, Segmented } from '../components/ui'
import { CHART_COLORS, fmt, MODEL_LABEL, varLabel, varUnit } from '../lib/format'
import { useMeta } from '../lib/hooks'

const ICON: Record<TargetKey, ReactNode> = {
  outlet_turbidity: <Waves className="size-5" />,
  outlet_ph: <FlaskConical className="size-5" />,
  outlet_free_chlorine: <Droplet className="size-5" />,
}
const DP = 2

function ForecastCard({ t, f, m, bounds }: { t: TargetKey; f: Forecast; m: Meta; bounds?: [number, number] }) {
  const delta = f.value - f.current
  const inRange = bounds ? f.value >= bounds[0] && f.value <= bounds[1] : null
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className="text-primary-300">{ICON[t]}</div>
          <div>
            <div className="text-[15px] font-medium leading-tight">{varLabel(m, t)}</div>
            <div className="text-xs text-grey-500">Forecast by {MODEL_LABEL[f.recommended_model]}</div>
          </div>
        </div>
        {f.reliability === 'usable'
          ? <Badge tone="success" dot>Usable</Badge>
          : <Badge tone="warning" dot>Limited accuracy</Badge>}
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-[28px] font-medium leading-none">{fmt(f.value, DP)}</span>
        <span className="text-sm text-grey-500">{varUnit(m, t)}</span>
        {f.error !== null && <span className="ml-1 text-sm text-grey-500">± {fmt(f.error, DP)}</span>}
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-grey-500">
        <div className="flex items-center gap-1">
          {delta > 0 ? <ArrowUpRight className="size-3.5" /> : delta < 0 ? <ArrowDownRight className="size-3.5" /> : <ArrowRight className="size-3.5" />}
          {delta > 0 ? '+' : ''}{fmt(delta, DP)} vs last record ({fmt(f.current, DP)})
        </div>
        {bounds && (
          <div className="flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${inRange ? 'bg-success-100' : 'bg-warning-100'}`} />
            {inRange ? 'Within' : 'Outside'} normal range {fmt(bounds[0], DP)}–{fmt(bounds[1], DP)}
          </div>
        )}
      </div>
    </Card>
  )
}

export default function Prediction() {
  const meta = useMeta()
  const m = meta.data
  const [target, setTarget] = useState<TargetKey>('outlet_free_chlorine')
  const next = useQuery({ queryKey: ['next-day'], queryFn: fetchers.nextDay })
  const anomalies = useQuery({ queryKey: ['anomalies'], queryFn: fetchers.anomalies })
  const q = useQuery({ queryKey: ['predictions', target], queryFn: () => fetchers.predictions(target) })

  if (!m || next.isLoading) return <Loading />
  if (next.error) return <ErrorState error={next.error} />
  const n = next.data!
  const bounds = anomalies.data?.iqr_bounds
  const limitedCount = Object.values(n.forecasts).filter((f) => f?.reliability === 'limited').length

  const data = q.data
  const fc = n.forecasts[target]
  const rec = fc?.recommended_model
  const recRun = data?.runs.find((r) => r.model_type === rec)
  const unit = varUnit(m, target)

  return (
    <div className="space-y-4">
      {/* Part 1: forecast for the day after the last record */}
      <div className="flex flex-wrap items-center gap-2">
        <CalendarClock className="size-5 text-primary-300" />
        <h2 className="text-lg font-medium">Forecast for {n.for_date}</h2>
        <span className="text-sm text-grey-500">Based on the measurements of {n.based_on}, the last record in the dataset</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {m.targets.map((t) => n.forecasts[t] && (
          <ForecastCard key={t} t={t} f={n.forecasts[t]!} m={m} bounds={bounds?.[t]} />
        ))}
      </div>

      {limitedCount > 0 && (
        <Notice tone="warning">
          <strong>Limited accuracy</strong> means the model did not predict better than simply using the historical average
          in cross-validation ({limitedCount} of {m.targets.length} indicators). Treat these values as rough reference only.
          The ± range is the model&apos;s typical error.
        </Notice>
      )}

      {/* Part 2: how accurate is the forecast */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Target className="size-5 text-primary-300" />
        <h2 className="text-lg font-medium">How accurate is this forecast?</h2>
        <span className="text-sm text-grey-500">Tested on days the model had not seen, where the real value is known</span>
      </div>

      <Card>
        <CardHeader
          title="Actual vs Predicted (test period)"
          subtitle={data ? `${data.rows[0]?.date} – ${data.rows[data.rows.length - 1]?.date} · trained on ${data.runs[0]?.train_size} earlier days` : ''}
          actions={<Segmented value={target} onChange={setTarget} options={m.targets.map((t) => ({ value: t, label: varLabel(m, t) }))} />}
        />
        {q.isLoading && <Loading />}
        {q.error && <ErrorState error={q.error} />}
        {data && (
          <>
            <Chart
              height={320}
              option={{
                legend: { selected: { [MODEL_LABEL.persistence]: false, [MODEL_LABEL.historical_mean]: false } },
                grid: { bottom: 32 },
                xAxis: { type: 'category', data: data.rows.map((r) => r.date), splitLine: { show: false } },
                yAxis: { type: 'value', scale: true, name: unit },
                series: [
                  { key: 'actual', name: 'Actual', color: CHART_COLORS[0] },
                  { key: 'linear_regression', name: MODEL_LABEL.linear_regression, color: CHART_COLORS[1] },
                  { key: 'random_forest', name: MODEL_LABEL.random_forest, color: CHART_COLORS[2] },
                  { key: 'persistence', name: MODEL_LABEL.persistence, color: '#b5bac6' },
                  { key: 'historical_mean', name: MODEL_LABEL.historical_mean, color: '#666d80' },
                ].map((s) => ({
                  name: s.name,
                  type: 'line',
                  showSymbol: s.key === 'actual',
                  symbolSize: 5,
                  smooth: s.key !== 'actual',
                  lineStyle: { width: s.key === 'actual' || s.key === rec ? 2.5 : 1.5, type: s.key === 'actual' ? 'solid' : 'dashed' },
                  itemStyle: { color: s.color },
                  data: data.rows.map((r) => r[s.key as keyof typeof r] ?? null),
                })),
              }}
            />
            {fc && recRun && (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-grey-25 px-4 py-3">
                  <div className="text-xs text-grey-500">Average error in test period ({MODEL_LABEL[rec!]})</div>
                  <div className="text-lg font-medium">{fmt(recRun.mae, 3)} <span className="text-xs font-normal text-grey-500">{unit}</span></div>
                </div>
                <div className="rounded-xl bg-grey-25 px-4 py-3">
                  <div className="text-xs text-grey-500">Typical error (cross-validation) vs historical average</div>
                  <div className="text-lg font-medium">
                    {fmt(fc.error, 3)} <span className="text-sm font-normal text-grey-500">vs {fmt(fc.mean_cv_mae, 3)}</span>
                  </div>
                </div>
                <div className={`rounded-xl px-4 py-3 ${fc.reliability === 'usable' ? 'bg-success-0' : 'bg-warning-0'}`}>
                  <div className="text-xs text-grey-500">Conclusion</div>
                  <div className={`text-sm font-medium ${fc.reliability === 'usable' ? 'text-success-200' : 'text-warning-200'}`}>
                    {fc.reliability === 'usable'
                      ? 'Better than the historical average: the forecast can be used as reference.'
                      : 'Not better than the historical average: use the forecast as rough reference only.'}
                  </div>
                </div>
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <Link to="/evaluation" className="inline-flex items-center gap-1 text-sm text-primary-300">
                Full model evaluation <ArrowRight className="size-4" />
              </Link>
            </div>
          </>
        )}
      </Card>

      <Notice>
        The model uses the six measurements of one day to predict the outlet indicators of the next day. Accuracy depends on
        the amount of data available; new uploads are re-evaluated automatically.
      </Notice>
    </div>
  )
}
