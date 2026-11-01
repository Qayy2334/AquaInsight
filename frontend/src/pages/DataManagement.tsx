import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Download, FileSpreadsheet, Trash2, UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'
import { api, EXPORTS, fetchers, type Dataset, type VariableKey } from '../api/client'
import Chart from '../components/Chart'
import { Badge, Card, CardHeader, ErrorState, Loading, Notice, Table } from '../components/ui'
import { varLabel } from '../lib/format'
import { useMeta } from '../lib/hooks'

export default function DataManagement() {
  const meta = useMeta()
  const m = meta.data
  const qc = useQueryClient()
  const datasets = useQuery({ queryKey: ['datasets'], queryFn: fetchers.datasets })
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [lastUpload, setLastUpload] = useState<Dataset | null>(null)

  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post<Dataset>('/datasets/upload', fd).then((r) => r.data)
    },
    onSuccess: (ds) => {
      setLastUpload(ds)
      qc.invalidateQueries()
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/datasets/${id}`),
    onSuccess: () => qc.invalidateQueries(),
  })

  const onFiles = (files: FileList | null) => {
    if (files?.[0]) upload.mutate(files[0])
  }

  if (!m) return <Loading />
  const active = datasets.data?.[0]
  const report = (lastUpload ?? active)?.quality_report

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="Upload Records" subtitle="Excel, CSV or Word table (.docx), one row per day" />
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files) }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
              dragOver ? 'border-primary-300 bg-primary-0' : 'border-grey-100 bg-grey-0 hover:border-primary-100'
            }`}
          >
            <UploadCloud className="mb-2 size-8 text-primary-300" />
            <div className="text-sm font-medium">{upload.isPending ? 'Uploading & analysing…' : 'Click or drop a file here'}</div>
            <div className="mt-1 text-xs text-grey-500">Columns: Date + the six variables</div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.docx" className="hidden" onChange={(e) => onFiles(e.target.files)} />
          </div>
          {upload.error && <div className="mt-3"><ErrorState error={upload.error} /></div>}
          {lastUpload && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-success-0 px-3 py-2 text-sm text-success-200">
              <CheckCircle2 className="size-4" /> {lastUpload.name}: {lastUpload.row_count} rows loaded, models retrained.
            </div>
          )}
          {lastUpload?.warnings?.map((w) => <div key={w} className="mt-2"><Notice tone="warning">{w}</Notice></div>)}
          <div className="mt-4 text-xs text-grey-500">
            Expected headers (case-insensitive), e.g. <code>Date</code>, <code>Influent Turbidity</code>, <code>Influent pH</code>,{' '}
            <code>NaOCl Dosage</code>, <code>Outlet Turbidity</code>, <code>Outlet pH</code>, <code>Outlet Free Chlorine</code>.
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Data Quality Report" subtitle={report ? `${report.start_date} → ${report.end_date}` : 'No dataset'} />
          {report && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ['Valid rows', report.rows],
                  ['Completeness', `${(report.completeness * 100).toFixed(1)}%`],
                  ['Missing days', report.missing_days],
                  ['Duplicates removed', report.duplicate_dates_dropped ?? 0],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-xl bg-grey-25 px-3 py-2.5">
                    <div className="text-xs text-grey-500">{label}</div>
                    <div className="text-xl font-medium">{value}</div>
                  </div>
                ))}
              </div>
              <Chart
                height={220}
                option={{
                  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                  xAxis: { type: 'category', data: (Object.keys(m.variables) as VariableKey[]).map((k) => varLabel(m, k)), axisLabel: { fontSize: 10, interval: 0 }, splitLine: { show: false } },
                  yAxis: { type: 'value', name: 'Missing values', minInterval: 1 },
                  series: [{ type: 'bar', barMaxWidth: 32, itemStyle: { color: '#80a6ee', borderRadius: [4, 4, 0, 0] }, data: (Object.keys(m.variables) as VariableKey[]).map((k) => report.missing_values[k] ?? 0) }],
                }}
              />
              {report.corrections && report.corrections.length > 0 && (
                <div className="mt-3 rounded-xl bg-warning-0 px-3 py-2 text-xs text-warning-200">
                  Auto-corrected values:{' '}
                  {report.corrections.map((c) => `${c.date} ${varLabel(m, c.variable)} "${c.raw}" → ${c.value}`).join('; ')}
                </div>
              )}
              {report.column_mapping && (
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {Object.entries(report.column_mapping).map(([src, dst]) => (
                    <Badge key={src} tone="grey">{src} → {dst}</Badge>
                  ))}
                  {report.unmapped_columns?.map((c) => <Badge key={c} tone="warning">ignored: {c}</Badge>)}
                  {report.missing_columns?.map((c) => <Badge key={c} tone="error">not found: {c}</Badge>)}
                </div>
              )}
              <p className="mt-3 text-xs text-grey-500">
                Missing values are stored as-is. For modelling and Isolation Forest they are filled by time interpolation; IQR uses raw values only.
              </p>
            </>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Export (CSV)" subtitle="For the report appendix and reproducibility · active dataset" />
        <div className="flex flex-wrap gap-2">
          {[
            ['Cleaned records', EXPORTS.records],
            ['Model evaluation', EXPORTS.evaluation],
            ['Test-set predictions', EXPORTS.predictions],
            ['Anomaly results', EXPORTS.anomalies],
          ].map(([label, href]) => (
            <a key={href} href={href}
              className="inline-flex items-center gap-2 rounded-xl border border-grey-100 bg-white px-4 py-2 text-sm hover:bg-grey-25">
              <Download className="size-4 text-primary-300" /> {label}
            </a>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Datasets" subtitle="The most recent dataset is used across the dashboard" />
        {datasets.isLoading ? <Loading /> : (
          <Table head={['', 'Name', 'Source', 'Rows', 'Uploaded', 'Status', '']}>
            {(datasets.data ?? []).map((d, i) => (
              <tr key={d.id}>
                <td><FileSpreadsheet className="size-4 text-primary-300" /></td>
                <td className="text-ink">{d.name}</td>
                <td>{d.source === 'demo' ? <Badge tone="warning">Synthetic</Badge> : <Badge tone="primary">Upload</Badge>}</td>
                <td>{d.row_count}</td>
                <td>{d.created_at?.replace('T', ' ').slice(0, 16)}</td>
                <td>{i === 0 ? <Badge tone="success" dot>Active</Badge> : <Badge tone="grey">Archived</Badge>}</td>
                <td>
                  <button onClick={() => confirm(`Delete dataset "${d.name}" and its results?`) && remove.mutate(d.id)}
                    className="text-grey-500 hover:text-error-100" title="Delete">
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
