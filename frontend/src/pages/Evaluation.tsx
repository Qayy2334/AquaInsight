import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { api, downloadFile, EXPORTS, fetchers, type AnyModel, type TargetKey, type VariableKey } from '../api/client'
import Chart from '../components/Chart'
import { Badge, Button, Card, CardHeader, ErrorState, Loading, Notice, Segmented, Table } from '../components/ui'
import { CHART_COLORS, fmt, isReference, MODEL_LABEL, varLabel, varUnit } from '../lib/format'
import { useMeta } from '../lib/hooks'

const ORDER: AnyModel[] = ['linear_regression', 'random_forest', 'persistence', 'historical_mean']
const COLOR: Record<AnyModel, string> = {
  linear_regression: CHART_COLORS[1],
  random_forest: CHART_COLORS[0],
  persistence: '#dfe1e7',
  historical_mean: '#666d80',
}

export default function Evaluation() {
  const meta = useMeta()
  const m = meta.data
  const qc = useQueryClient()
  const runs = useQuery({ queryKey: ['runs'], queryFn: fetchers.runs })
  const [metric, setMetric] = useState<'cv_mae' | 'mae' | 'rmse'>('cv_mae')
  const [fiTarget, setFiTarget] = useState<TargetKey>('outlet_free_chlorine')

  const retrain = useMutation({
    mutationFn: () => api.post('/models/train'),
    onSuccess: () => qc.invalidateQueries(),
  })

  if (!m || runs.isLoading) return <Loading />
  if (runs.error) return <ErrorState error={runs.error} />
  const data = runs.data ?? []
  const get = (t: TargetKey, mt: AnyModel) => data.find((r) => r.target === t && r.model_type === mt)
  const metricValue = (t: TargetKey, mt: AnyModel) => {
    const r = get(t, mt)
    return metric === 'cv_mae' ? r?.cv?.mae_mean : r?.[metric]
  }
  const rf = get(fiTarget, 'random_forest')
  const lr = get(fiTarget, 'linear_regression')
  const sortedVars = (fi: Record<VariableKey, number> | null | undefined) =>
    fi ? (Object.entries(fi) as [VariableKey, number][]).sort((a, b) => Math.abs(a[1]) - Math.abs(b[1])) : []

  // Does any ML model beat the historical-mean reference on CV MAE?
  const beatsMean = m.targets.map((t) => {
    const mean = get(t, 'historical_mean')?.cv?.mae_mean ?? Infinity
    return (['linear_regression', 'random_forest'] as const).some((mt) => (get(t, mt)?.cv?.mae_mean ?? Infinity) < mean)
  })
  const first = data[0]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={() => retrain.mutate()} disabled={retrain.isPending} icon={<RefreshCw className={`size-4 ${retrain.isPending ? 'animate-spin' : ''}`} />}>
          {retrain.isPending ? 'Training…' : 'Retrain models'}
        </Button>
        <Button onClick={() => downloadFile(EXPORTS.evaluation.path, EXPORTS.evaluation.file)} icon={<Download className="size-4" />}>
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader
          title="Model Comparison"
          subtitle={`Next-day prediction · hold-out test: last ${first?.test_size ?? '—'} days · time-series CV: ${first?.cv?.n_splits ?? '—'} expanding folds`}
        />
        <Table head={['Target', 'Model', 'Test MAE', 'Test RMSE', 'Test R²', 'CV MAE (mean ± sd)', 'Result']}>
          {m.targets.flatMap((t) => {
            const rows = ORDER.map((mt) => get(t, mt)).filter((r) => r !== undefined)
            const bestCv = Math.min(...rows.map((r) => r!.cv?.mae_mean ?? Infinity))
            return rows.map((r, i) => (
              <tr key={`${t}-${r!.model_type}`} className={isReference(r!.model_type) ? 'bg-grey-0' : ''}>
                {i === 0 && (
                  <td rowSpan={rows.length} className="align-top text-ink">
                    {varLabel(m, t)} <span className="text-grey-500">{varUnit(m, t) && `(${varUnit(m, t)})`}</span>
                  </td>
                )}
                <td>
                  {MODEL_LABEL[r!.model_type]} {isReference(r!.model_type) && <Badge tone="grey">reference</Badge>}
                </td>
                <td>{fmt(r!.mae, 4)}</td>
                <td>{fmt(r!.rmse, 4)}</td>
                <td>{fmt(r!.r2, 3)}</td>
                <td>{fmt(r!.cv?.mae_mean, 4)} ± {fmt(r!.cv?.mae_std, 4)}</td>
                <td>{r!.cv?.mae_mean === bestCv ? <Badge tone="success" dot>Lowest CV MAE</Badge> : <span className="text-grey-500">—</span>}</td>
              </tr>
            ))
          })}
        </Table>
      </Card>

      <Notice tone={beatsMean.every(Boolean) ? 'primary' : 'warning'}>
        <strong>Interpretation.</strong> The two references show what is achievable without learning: “Persistence” repeats
        today’s value, “Historical Mean” always predicts the training average.{' '}
        {beatsMean.every((b) => !b)
          ? 'On this dataset neither Linear Regression nor Random Forest achieved a lower cross-validated MAE than the historical mean for any target, so the available records show little next-day predictive signal.'
          : `A model beat the historical mean on CV MAE for: ${m.targets.filter((_, i) => beatsMean[i]).map((t) => varLabel(m, t)).join(', ')}.`}{' '}
        With {first ? first.train_size + first.test_size : '—'} usable day pairs, these results are preliminary.
      </Notice>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Error by Target"
            subtitle="Lower is better (in target units)"
            actions={
              <Segmented value={metric} onChange={setMetric} options={[{ value: 'cv_mae', label: 'CV MAE' }, { value: 'mae', label: 'Test MAE' }, { value: 'rmse', label: 'Test RMSE' }]} />
            }
          />
          <Chart
            height={300}
            option={{
              legend: {},
              grid: { bottom: 32 },
              xAxis: { type: 'category', data: m.targets.map((t) => varLabel(m, t)), splitLine: { show: false } },
              yAxis: { type: 'value' },
              series: ORDER.map((mt) => ({
                name: MODEL_LABEL[mt],
                type: 'bar',
                barMaxWidth: 26,
                itemStyle: { color: COLOR[mt], borderRadius: [4, 4, 0, 0] },
                data: m.targets.map((t) => +(metricValue(t, mt) ?? 0).toFixed(4)),
              })),
            }}
          />
        </Card>

        <Card>
          <CardHeader
            title="Feature Influence"
            subtitle="RF: impurity importance · LR: standardized coefficient"
            actions={
              <Segmented value={fiTarget} onChange={setFiTarget} options={m.targets.map((t) => ({ value: t, label: varLabel(m, t).replace('Outlet ', '') }))} />
            }
          />
          <div className="grid grid-cols-2 gap-2">
            {[{ run: rf, title: 'Random Forest', color: COLOR.random_forest }, { run: lr, title: 'Linear Regression', color: COLOR.linear_regression }].map(({ run, title, color }) => {
              const entries = sortedVars(run?.feature_importance)
              return (
                <div key={title}>
                  <div className="mb-1 text-center text-xs text-grey-500">{title}</div>
                  <Chart
                    height={260}
                    option={{
                      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                      grid: { left: 4, right: 12, top: 4, bottom: 4 },
                      xAxis: { type: 'value', axisLabel: { fontSize: 9 } },
                      yAxis: { type: 'category', data: entries.map(([k]) => varLabel(m, k).replace('Influent', 'In.').replace('Outlet', 'Out.')), axisLabel: { fontSize: 10 }, splitLine: { show: false } },
                      series: [{ type: 'bar', barMaxWidth: 14, itemStyle: { color, borderRadius: 3 }, data: entries.map(([, v]) => +v.toFixed(4)) }],
                    }}
                  />
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Cross-validation Folds" subtitle={`${varLabel(m, fiTarget)} · MAE per fold (each fold trains on all earlier days)`} />
        <Chart
          height={260}
          option={{
            legend: {},
            grid: { bottom: 32 },
            xAxis: {
              type: 'category',
              data: (get(fiTarget, 'linear_regression')?.cv?.folds ?? []).map((f, i) => `Fold ${i + 1} · from ${f.test_start.slice(5)} (train ${f.train_size})`),
              splitLine: { show: false },
              axisLabel: { fontSize: 10 },
            },
            yAxis: { type: 'value' },
            series: ORDER.map((mt) => ({
              name: MODEL_LABEL[mt],
              type: 'line',
              symbolSize: 6,
              itemStyle: { color: COLOR[mt] === '#dfe1e7' ? '#b5bac6' : COLOR[mt] },
              data: (get(fiTarget, mt)?.cv?.folds ?? []).map((f) => +f.mae.toFixed(4)),
            })),
          }}
        />
      </Card>

      <Notice>
        Feature influence shows what each model relied on; it does not establish causal relationships.
      </Notice>
    </div>
  )
}
