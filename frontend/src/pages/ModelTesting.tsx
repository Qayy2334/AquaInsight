import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Target } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchers, type ModelType, type TargetKey } from '../api/client'
import Chart from '../components/Chart'
import { Badge, Card, CardHeader, ErrorState, Loading, Notice, Segmented, StatCard, Table } from '../components/ui'
import { CHART_COLORS, fmt, MODEL_LABEL, varLabel, varUnit } from '../lib/format'
import { useMeta } from '../lib/hooks'

const SERIES = [
  { key: 'actual', label: 'Actual', color: CHART_COLORS[0] },
  { key: 'linear_regression', label: 'Linear Regression', color: CHART_COLORS[1] },
  { key: 'random_forest', label: 'Random Forest', color: CHART_COLORS[2] },
  { key: 'persistence', label: 'Persistence (ref.)', color: '#b5bac6' },
  { key: 'historical_mean', label: 'Historical Mean (ref.)', color: '#666d80' },
] as const

/** Hold-out test results: how the next-day models performed on days they had not seen. */
export default function ModelTesting() {
  const meta = useMeta()
  const m = meta.data
  const [target, setTarget] = useState<TargetKey>('outlet_free_chlorine')
  const [visible, setVisible] = useState<Record<string, boolean>>({
    actual: true, linear_regression: true, random_forest: true, persistence: false, historical_mean: false,
  })
  const [scatterModel, setScatterModel] = useState<ModelType>('random_forest')
  const q = useQuery({ queryKey: ['predictions', target], queryFn: () => fetchers.predictions(target) })
  const next = useQuery({ queryKey: ['next-day'], queryFn: fetchers.nextDay })

  if (!m) return <Loading />
  const data = q.data
  const run = (mt: ModelType) => data?.runs.find((r) => r.model_type === mt)
  const unit = varUnit(m, target)
  const fc = next.data?.forecasts[target]
  const best = run('linear_regression') && run('random_forest')
    ? (run('random_forest')!.mae < run('linear_regression')!.mae ? 'random_forest' : 'linear_regression')
    : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={target} onChange={setTarget} options={m.targets.map((t) => ({ value: t, label: varLabel(m, t) }))} />
        {data && (
          <span className="text-sm text-grey-500">
            Trained on {data.runs[0]?.train_size} days · tested on {data.runs[0]?.test_size} unseen days ({data.rows[0]?.date} – {data.rows[data.rows.length - 1]?.date})
          </span>
        )}
      </div>

      <Notice>
        Each model learned from the earlier days only, then predicted the next-day value for the last days of the dataset.
        Those days&apos; real measurements were hidden from the model and are used here as the answer key.
      </Notice>

      {q.isLoading && <Loading />}
      {q.error && <ErrorState error={q.error} />}

      {data && (
        <>
          {/* Conclusion */}
          {fc && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <div className="text-xs text-grey-500">Model used for the forecast</div>
                <div className="mt-1 text-lg font-medium">{MODEL_LABEL[fc.recommended_model]}</div>
                <div className="text-xs text-grey-500">Lower cross-validated error of LR and RF</div>
              </Card>
              <Card>
                <div className="text-xs text-grey-500">Typical error (cross-validation) vs historical average</div>
                <div className="mt-1 text-lg font-medium">
                  {fmt(fc.error, 3)} <span className="text-sm font-normal text-grey-500">vs {fmt(fc.mean_cv_mae, 3)} {unit}</span>
                </div>
                <div className="text-xs text-grey-500">Lower is better</div>
              </Card>
              <Card className={fc.reliability === 'usable' ? 'bg-success-0' : 'bg-warning-0'}>
                <div className="text-xs text-grey-500">Conclusion</div>
                <div className={`mt-1 text-sm font-medium ${fc.reliability === 'usable' ? 'text-success-200' : 'text-warning-200'}`}>
                  {fc.reliability === 'usable'
                    ? 'Better than the historical average: the forecast can be used as reference.'
                    : 'Not better than the historical average: the forecast is rough reference only.'}
                </div>
              </Card>
            </div>
          )}

          {/* Test-set metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(['linear_regression', 'random_forest'] as const).flatMap((mt) => [
              <StatCard
                key={`${mt}-mae`}
                icon={<Target className="size-5" />}
                title={`${MODEL_LABEL[mt]} · MAE`}
                subtitle="Mean Absolute Error (test set)"
                value={fmt(run(mt)?.mae, 4)}
                unit={unit}
                footer={best === mt ? <Badge tone="success" dot>Lower MAE</Badge> : `R² ${fmt(run(mt)?.r2, 3)}`}
              />,
              <StatCard
                key={`${mt}-rmse`}
                icon={<Target className="size-5" />}
                title={`${MODEL_LABEL[mt]} · RMSE`}
                subtitle="Root Mean Squared Error (test set)"
                value={fmt(run(mt)?.rmse, 4)}
                unit={unit}
                footer={`R² ${fmt(run(mt)?.r2, 3)}`}
              />,
            ])}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[200px_1fr]">
            <Card>
              <h4 className="mb-3 font-medium">Select Series</h4>
              <div className="space-y-2.5">
                {SERIES.map((s) => (
                  <label key={s.key} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={visible[s.key]}
                      onChange={(e) => setVisible((v) => ({ ...v, [s.key]: e.target.checked }))}
                      className="size-4 accent-primary-300"
                    />
                    <span className="size-2 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </label>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader
                title="Actual vs Predicted"
                subtitle={`${data.rows[0]?.date} – ${data.rows[data.rows.length - 1]?.date} · ${varLabel(m, target)}`}
              />
              <Chart
                height={320}
                option={{
                  legend: {},
                  grid: { bottom: 32 },
                  xAxis: { type: 'category', data: data.rows.map((r) => r.date), splitLine: { show: false } },
                  yAxis: { type: 'value', scale: true, name: unit },
                  series: SERIES.filter((s) => visible[s.key]).map((s) => ({
                    name: s.label,
                    type: 'line',
                    showSymbol: s.key === 'actual',
                    symbolSize: 5,
                    smooth: s.key !== 'actual',
                    lineStyle: { width: s.key === 'actual' ? 2.5 : 1.5, type: s.key === 'actual' ? 'solid' : 'dashed' },
                    itemStyle: { color: s.color },
                    data: data.rows.map((r) => r[s.key as keyof typeof r] ?? null),
                  })),
                }}
              />
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader
                title="Predicted vs Actual"
                subtitle="Points on the diagonal are perfect predictions"
                actions={
                  <Segmented
                    value={scatterModel}
                    onChange={setScatterModel}
                    options={[{ value: 'linear_regression', label: 'LR' }, { value: 'random_forest', label: 'RF' }]}
                  />
                }
              />
              {(() => {
                const pts = data.rows.map((r) => [r.actual, r[scatterModel] ?? null])
                const all = pts.flat().filter((v): v is number => v !== null)
                const [lo, hi] = [Math.min(...all), Math.max(...all)]
                return (
                  <Chart
                    height={280}
                    option={{
                      tooltip: { trigger: 'item' },
                      xAxis: { type: 'value', scale: true, name: 'Actual', nameLocation: 'middle', nameGap: 24 },
                      yAxis: { type: 'value', scale: true, name: 'Predicted' },
                      series: [
                        { type: 'scatter', symbolSize: 7, itemStyle: { color: '#2b6be2', opacity: 0.65 }, data: pts },
                        { type: 'line', showSymbol: false, lineStyle: { color: '#dfe1e7', type: 'dashed' }, data: [[lo, lo], [hi, hi]] },
                      ],
                    }}
                  />
                )
              })()}
            </Card>
            <Card>
              <CardHeader title="Residuals" subtitle="Actual − Predicted (above 0 = model predicted too low)" />
              <Chart
                height={280}
                option={{
                  legend: {},
                  grid: { bottom: 32 },
                  xAxis: { type: 'category', data: data.rows.map((r) => r.date), splitLine: { show: false } },
                  yAxis: { type: 'value' },
                  series: (['linear_regression', 'random_forest'] as const).map((mt, i) => ({
                    name: MODEL_LABEL[mt],
                    type: 'bar',
                    itemStyle: { color: CHART_COLORS[i + 1] },
                    data: data.rows.map((r) => (r[mt] !== undefined ? +(r.actual - r[mt]!).toFixed(4) : null)),
                  })),
                }}
              />
            </Card>
          </div>

          <Card>
            <CardHeader title="Test Log" subtitle="Every test day: real value and each model's prediction" />
            <div className="max-h-[360px] overflow-auto">
              <Table head={['Date (predicted day)', `Actual (${unit || '-'})`, 'Linear Regression', 'Error', 'Random Forest', 'Error']}>
                {[...data.rows].reverse().map((r) => (
                  <tr key={r.date}>
                    <td className="text-ink">{r.date}</td>
                    <td className="font-medium text-ink">{fmt(r.actual, 3)}</td>
                    <td>{fmt(r.linear_regression, 3)}</td>
                    <td>{fmt(r.linear_regression !== undefined ? r.actual - r.linear_regression : null, 3)}</td>
                    <td>{fmt(r.random_forest, 3)}</td>
                    <td>{fmt(r.random_forest !== undefined ? r.actual - r.random_forest : null, 3)}</td>
                  </tr>
                ))}
              </Table>
            </div>
          </Card>

          {data.runs[0] && data.runs[0].test_size < 30 && (
            <Notice tone="warning">
              Only <strong>{data.runs[0].test_size} test days</strong> are available, so these error metrics are highly
              uncertain. Test R²: {data.runs.map((r) => `${MODEL_LABEL[r.model_type]} ${fmt(r.r2, 3)}`).join(', ')}.
            </Notice>
          )}

          <div className="flex justify-end">
            <Link to="/evaluation" className="inline-flex items-center gap-1 text-sm text-primary-300">
              Full model evaluation (cross-validation, feature influence) <ArrowRight className="size-4" />
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
