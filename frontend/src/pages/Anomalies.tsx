import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, CalendarDays, Play, TriangleAlert, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fetchers, type AnomalyItem, type VariableKey } from '../api/client'
import Chart from '../components/Chart'
import { Badge, Button, Card, CardHeader, ErrorState, Loading, Notice, Segmented, Select, StatCard, Table } from '../components/ui'
import { fmt, METHOD_LABEL, varLabel, varUnit } from '../lib/format'
import { useMeta } from '../lib/hooks'

type Filter = 'all' | 'both' | 'iqr' | 'iforest'

function MethodTags({ item }: { item: AnomalyItem }) {
  if (item.methods.length === 2) return <Badge tone="error" dot>Both methods</Badge>
  return item.methods[0] === 'iqr' ? <Badge tone="warning" dot>IQR</Badge> : <Badge tone="primary" dot>Isolation Forest</Badge>
}

export default function Anomalies() {
  const meta = useMeta()
  const m = meta.data
  const qc = useQueryClient()
  const list = useQuery({ queryKey: ['anomalies'], queryFn: fetchers.anomalies })
  const records = useQuery({ queryKey: ['records'], queryFn: () => fetchers.records() })
  const [variable, setVariable] = useState<VariableKey>('outlet_free_chlorine')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<AnomalyItem | null>(null)
  const [k, setK] = useState(1.5)
  const [contamination, setContamination] = useState(0.05)
  const used = list.data?.params
  useEffect(() => {
    if (used) {
      setK(used.iqr_k)
      setContamination(used.contamination)
    }
  }, [used?.iqr_k, used?.contamination])

  const detect = useMutation({
    mutationFn: () => api.post('/anomalies/detect', { iqr_k: k, contamination }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['anomalies'] })
      qc.invalidateQueries({ queryKey: ['overview'] })
    },
  })

  const items = list.data?.items ?? []
  const filtered = useMemo(
    () =>
      items.filter((i) =>
        filter === 'all' ? true : filter === 'both' ? i.methods.length === 2 : i.methods.length === 1 && i.methods[0] === filter,
      ),
    [items, filter],
  )

  if (!m || list.isLoading) return <Loading />
  if (list.error) return <ErrorState error={list.error} />

  const counts = {
    iqr: items.filter((i) => i.methods.includes('iqr')).length,
    iforest: items.filter((i) => i.methods.includes('iforest')).length,
    both: items.filter((i) => i.methods.length === 2).length,
  }
  const flaggedDates = new Map(items.map((i) => [i.date, i]))
  const rows = records.data ?? []
  const bounds = list.data?.iqr_bounds[variable]

  return (
    <div className="space-y-4">
      <Notice tone="warning">
        A flagged record only means it <strong>differs from the historical pattern</strong> identified by the method. It
        does not indicate unsafe water or treatment failure, and should be reviewed alongside other information.
      </Notice>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<TriangleAlert className="size-5" />} title="IQR" subtitle="Single-variable outliers" value={String(counts.iqr)} unit="days" />
        <StatCard icon={<TriangleAlert className="size-5" />} title="Isolation Forest" subtitle="Multi-variable outliers" value={String(counts.iforest)} unit="days" />
        <StatCard icon={<TriangleAlert className="size-5" />} title="Agreement" subtitle="Flagged by both methods" value={String(counts.both)} unit="days" />
        <Card>
          <div className="mb-3 text-[15px] font-medium">Parameters</div>
          <div className="grid grid-cols-2 gap-2 text-xs text-grey-500">
            <label>
              IQR k
              <input type="number" step={0.1} min={0.5} max={5} value={k} onChange={(e) => setK(+e.target.value)}
                className="mt-1 w-full rounded-lg border border-grey-100 px-2 py-1.5 text-sm text-ink outline-none focus:border-primary-200" />
            </label>
            <label>
              Contamination
              <input type="number" step={0.01} min={0.01} max={0.5} value={contamination} onChange={(e) => setContamination(+e.target.value)}
                className="mt-1 w-full rounded-lg border border-grey-100 px-2 py-1.5 text-sm text-ink outline-none focus:border-primary-200" />
            </label>
          </div>
          <div className="mt-3">
            <Button onClick={() => detect.mutate()} disabled={detect.isPending} icon={<Play className="size-4" />}>
              {detect.isPending ? 'Running…' : 'Re-run detection'}
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Flagged Records on Timeline"
          subtitle={`${varLabel(m, variable)} with IQR bounds (k = ${used?.iqr_k ?? '—'}, contamination = ${used?.contamination ?? '—'})`}
          actions={
            <Select
              value={variable}
              onChange={setVariable}
              options={(Object.keys(m.variables) as VariableKey[]).map((v) => ({ value: v, label: varLabel(m, v) }))}
              className="w-60"
            />
          }
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
              {
                name: varLabel(m, variable),
                type: 'line',
                showSymbol: false,
                lineStyle: { width: 1.5 },
                data: rows.map((r) => r[variable]),
                markLine: bounds
                  ? {
                      symbol: 'none',
                      silent: true,
                      lineStyle: { color: '#ffbe4c', type: 'dashed' },
                      label: { color: '#966422', fontSize: 10, formatter: '{b}' },
                      data: [
                        { name: 'IQR upper', yAxis: +bounds[1].toFixed(3) },
                        { name: 'IQR lower', yAxis: +bounds[0].toFixed(3) },
                      ],
                    }
                  : undefined,
              },
              {
                name: 'IQR flag',
                type: 'scatter',
                symbolSize: 9,
                itemStyle: { color: '#ffbe4c' },
                data: rows.map((r) => (flaggedDates.get(r.date)?.methods.includes('iqr') ? r[variable] : null)),
              },
              {
                name: 'Isolation Forest flag',
                type: 'scatter',
                symbol: 'diamond',
                symbolSize: 10,
                itemStyle: { color: '#df1c41' },
                data: rows.map((r) => (flaggedDates.get(r.date)?.methods.includes('iforest') ? r[variable] : null)),
              },
            ],
          }}
        />
      </Card>

      <Card>
        <CardHeader
          title="Flagged Record Log"
          subtitle={`${filtered.length} of ${items.length} dates`}
          actions={
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'both', label: 'Both' },
                { value: 'iqr', label: 'IQR only' },
                { value: 'iforest', label: 'IF only' },
              ]}
            />
          }
        />
        <div className="max-h-[420px] overflow-auto">
          <Table head={['Date', 'Method', 'Main contributing variables', 'IF score', 'Action']}>
            {[...filtered].reverse().map((item) => {
              const contrib = item.details.iforest?.contributors ?? item.details.iqr?.contributors ?? []
              return (
                <tr key={item.date}>
                  <td className="text-ink">{item.date}</td>
                  <td><MethodTags item={item} /></td>
                  <td>
                    {contrib.slice(0, 3).map((c) => `${varLabel(m, c.variable)} (${fmt(c.value)})`).join(', ')}
                  </td>
                  <td>{fmt(item.details.iforest?.score, 3)}</td>
                  <td className="whitespace-nowrap">
                    <button onClick={() => setSelected(item)}
                      className="inline-flex items-center gap-1 rounded-md border border-primary-100/50 bg-primary-0 px-2 py-0.5 text-xs text-primary-300">
                      <ArrowUpRight className="size-3" /> View
                    </button>{' '}
                    <Link to={`/?date=${item.date}`} title="Open in Daily Record Review"
                      className="inline-flex items-center gap-1 rounded-md border border-grey-100 bg-white px-2 py-0.5 text-xs text-grey-500 hover:text-ink">
                      <CalendarDays className="size-3" /> Day
                    </Link>
                  </td>
                </tr>
              )
            })}
          </Table>
        </div>
      </Card>

      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function DetailModal({ item, onClose }: { item: AnomalyItem; onClose: () => void }) {
  const m = useMeta().data!
  const [tab, setTab] = useState(item.methods[0])
  const detail = item.details[tab]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium">Flagged Record · {item.date}</h3>
            <p className="text-sm text-grey-500">Which variables made this record stand out</p>
          </div>
          <button onClick={onClose} className="text-grey-500 hover:text-ink"><X className="size-5" /></button>
        </div>
        <div className="my-4">
          <Segmented value={tab} onChange={setTab} options={item.methods.map((x) => ({ value: x, label: METHOD_LABEL[x] }))} />
        </div>
        {detail && (
          <div className="rounded-xl border-l-2 border-primary-300 bg-grey-25 p-3">
            <div className="mb-2 text-sm font-medium">
              {tab === 'iqr' ? 'Values outside the IQR bounds' : 'Largest deviations from the mean (z-score)'}
            </div>
            <div className="space-y-2 rounded-lg bg-white p-3 text-sm">
              {detail.contributors.map((c) => (
                <div key={c.variable} className="flex justify-between gap-4">
                  <span>{varLabel(m, c.variable)}</span>
                  <span className="text-grey-500">
                    {fmt(c.value, 3)} {varUnit(m, c.variable)}
                    {tab === 'iqr'
                      ? ` · bounds ${fmt(c.lower)}–${fmt(c.upper)}`
                      : ` · z ${c.z !== undefined && c.z > 0 ? '+' : ''}${fmt(c.z)}`}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-grey-500">Score: {fmt(detail.score, 3)}</div>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-grey-500">
            This is a statistical signal for further review, not a verified water quality problem.
          </p>
          <Link to={`/?date=${item.date}`} className="inline-flex shrink-0 items-center gap-1 text-xs text-primary-300">
            <CalendarDays className="size-3" /> Open day view
          </Link>
        </div>
      </div>
    </div>
  )
}
