import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, CheckCircle2, Download, FileSpreadsheet, History, Pencil, Plus, Trash2, UploadCloud, X } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  api,
  EXPORTS,
  fetchers,
  type DayValues,
  type Meta,
  type UploadPreview,
  type UploadResult,
  type VariableKey,
  type WaterRecord,
} from '../api/client'
import { Badge, Button, Card, CardHeader, ErrorState, Loading, Notice, Table } from '../components/ui'
import { fmt, varLabel, varUnit } from '../lib/format'
import { useMeta } from '../lib/hooks'

type Row = { date: string; record: WaterRecord | null }

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium">{title}</h3>
            {subtitle && <p className="text-sm text-grey-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-grey-500 hover:text-ink"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Add or edit one day's six values. Empty fields are saved as missing. */
function DayForm({ m, initial, onClose }: { m: Meta; initial: { date: string; values?: DayValues }; onClose: () => void }) {
  const qc = useQueryClient()
  const editing = !!initial.values
  const keys = Object.keys(m.variables) as VariableKey[]
  const [date, setDate] = useState(initial.date)
  const [vals, setVals] = useState<Record<VariableKey, string>>(
    Object.fromEntries(keys.map((k) => {
      const v = initial.values?.[k]
      return [k, v === null || v === undefined ? '' : String(v)]
    })) as Record<VariableKey, string>,
  )
  const save = useMutation({
    mutationFn: () => {
      const body = Object.fromEntries(keys.map((k) => [k, vals[k].trim() === '' ? null : Number(vals[k])]))
      return (editing ? api.put(`/records/${date}`, body) : api.post('/records', { date, ...body })).then(() => undefined)
    },
    onSuccess: () => {
      qc.invalidateQueries()
      onClose()
    },
  })
  const invalid = !date || keys.some((k) => vals[k].trim() !== '' && Number.isNaN(Number(vals[k])))

  return (
    <Modal title={editing ? `Edit ${date}` : 'Add a day'} subtitle="Analysis re-runs automatically after saving" onClose={onClose}>
      <label className="block text-xs text-grey-500">
        Date
        <input type="date" value={date} disabled={editing || !!initial.date} onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-xl border border-grey-100 px-3 py-2 text-sm text-ink outline-none focus:border-primary-200 disabled:bg-grey-25" />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {keys.map((k) => (
          <label key={k} className="block text-xs text-grey-500">
            {varLabel(m, k)} {varUnit(m, k) && `(${varUnit(m, k)})`}
            <input inputMode="decimal" value={vals[k]} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))}
              placeholder="—"
              className="mt-1 w-full rounded-xl border border-grey-100 px-3 py-2 text-sm text-ink outline-none focus:border-primary-200" />
          </label>
        ))}
      </div>
      {save.error && <div className="mt-3"><ErrorState error={save.error} /></div>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={invalid || save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
      </div>
    </Modal>
  )
}

function HistoryModal({ m, date, onClose }: { m: Meta; date: string; onClose: () => void }) {
  const h = useQuery({ queryKey: ['history', date], queryFn: () => fetchers.history(date) })
  const keys = Object.keys(m.variables) as VariableKey[]
  return (
    <Modal title={`History · ${date}`} subtitle="Every change to this day, newest first" onClose={onClose}>
      {h.isLoading && <Loading />}
      {h.data?.length === 0 && <p className="text-sm text-grey-500">No changes recorded.</p>}
      <div className="space-y-3">
        {h.data?.map((c, i) => (
          <div key={i} className="rounded-xl border border-grey-50 p-3 text-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <Badge tone={c.action === 'create' ? 'success' : c.action === 'delete' ? 'error' : 'primary'}>{c.action}</Badge>
              <span className="text-xs text-grey-500">{c.at?.replace('T', ' ').slice(0, 16)} · {c.source}</span>
            </div>
            {keys
              .filter((k) => c.action !== 'update' || c.old?.[k] !== c.new?.[k])
              .map((k) => (
                <div key={k} className="flex justify-between text-xs text-paragraph">
                  <span>{varLabel(m, k)}</span>
                  <span>{c.action === 'update' ? `${fmt(c.old?.[k], 3)} → ${fmt(c.new?.[k], 3)}` : fmt((c.new ?? c.old)?.[k], 3)}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </Modal>
  )
}

function PreviewPanel({ m, file, preview, onDone, onCancel }: {
  m: Meta; file: File; preview: UploadPreview; onDone: (r: UploadResult) => void; onCancel: () => void
}) {
  const qc = useQueryClient()
  const [overwrite, setOverwrite] = useState<Set<string>>(new Set())
  const commit = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('overwrite', JSON.stringify([...overwrite]))
      return api.post<UploadResult>('/records/upload', fd).then((r) => r.data)
    },
    onSuccess: (r) => {
      qc.invalidateQueries()
      onDone(r)
    },
  })
  const rep = preview.file_report
  const toggle = (d: string) => setOverwrite((s) => {
    const n = new Set(s)
    if (n.has(d)) n.delete(d)
    else n.add(d)
    return n
  })
  const allTicked = overwrite.size === preview.conflicts.length
  const nothing = preview.new.length === 0 && overwrite.size === 0
  const issues = [
    ...(rep.corrections ?? []).map((c) => `Corrected ${c.date} ${varLabel(m, c.variable)} “${c.raw}” → ${c.value}`),
    ...(rep.duplicate_dates?.length ? [`Repeated dates in file (first row used): ${rep.duplicate_dates.join(', ')}`] : []),
    ...(rep.invalid_dates_dropped ? [`${rep.invalid_dates_dropped} row(s) with an unreadable date were skipped`] : []),
    ...(rep.unmapped_columns?.length ? [`Ignored columns: ${rep.unmapped_columns.join(', ')}`] : []),
    ...(rep.missing_columns?.length ? [`Columns not found (stored as missing): ${rep.missing_columns.join(', ')}`] : []),
  ]

  return (
    <div className="mt-4 rounded-xl border border-primary-100/50 bg-primary-0/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="truncate text-sm font-medium">Preview · {preview.filename}</div>
        <button onClick={onCancel} className="text-grey-500 hover:text-ink"><X className="size-4" /></button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {([
          ['New days', preview.new.length, 'text-success-200'],
          ['Different values', preview.conflicts.length, 'text-warning-200'],
          ['Already identical', preview.identical.length, 'text-grey-500'],
        ] as const).map(([l, n, c]) => (
          <div key={l} className="rounded-lg bg-white px-2 py-2">
            <div className={`text-xl font-medium ${c}`}>{n}</div>
            <div className="text-[11px] text-grey-500">{l}</div>
          </div>
        ))}
      </div>
      {preview.new.length > 0 && (
        <p className="mt-2 text-xs text-grey-500">
          New: {preview.new[0].date}{preview.new.length > 1 && ` → ${preview.new[preview.new.length - 1].date}`}
        </p>
      )}

      {preview.conflicts.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium">Tick the days to replace with the file&apos;s values</span>
            <button className="text-primary-300" onClick={() => setOverwrite(allTicked ? new Set() : new Set(preview.conflicts.map((c) => c.date)))}>
              {allTicked ? 'Keep all' : 'Replace all'}
            </button>
          </div>
          <div className="max-h-48 space-y-1.5 overflow-auto">
            {preview.conflicts.map((c) => (
              <label key={c.date} className="flex cursor-pointer items-start gap-2 rounded-lg bg-white px-2 py-1.5 text-xs">
                <input type="checkbox" checked={overwrite.has(c.date)} onChange={() => toggle(c.date)} className="mt-0.5 accent-primary-300" />
                <span className="font-medium">{c.date}</span>
                <span className="text-paragraph">
                  {c.changed.map((k) => `${varLabel(m, k)} ${fmt(c.old[k], 3)} → ${fmt(c.new[k], 3)}`).join('; ')}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <div className="mt-3 space-y-1 rounded-lg bg-warning-0 px-3 py-2 text-xs text-warning-200">
          {issues.map((t) => <div key={t}>{t}</div>)}
        </div>
      )}

      {commit.error && <div className="mt-3"><ErrorState error={commit.error} /></div>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => commit.mutate()} disabled={nothing || commit.isPending}>
          {commit.isPending ? 'Importing…' : `Import ${preview.new.length + overwrite.size} day(s)`}
        </Button>
      </div>
    </div>
  )
}

export default function DataManagement() {
  const meta = useMeta()
  const m = meta.data
  const qc = useQueryClient()
  const records = useQuery({ queryKey: ['records'], queryFn: () => fetchers.records() })
  const summary = useQuery({ queryKey: ['store-summary'], queryFn: fetchers.storeSummary })
  const uploads = useQuery({ queryKey: ['uploads'], queryFn: fetchers.uploads })
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pending, setPending] = useState<{ file: File; preview: UploadPreview } | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [form, setForm] = useState<{ date: string; values?: DayValues } | null>(null)
  const [historyDate, setHistoryDate] = useState<string | null>(null)
  const [showGapsOnly, setShowGapsOnly] = useState(false)

  const previewMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post<UploadPreview>('/records/upload/preview', fd).then((r) => ({ file, preview: r.data }))
    },
    onSuccess: (p) => {
      setResult(null)
      setPending(p)
    },
  })
  const remove = useMutation({
    mutationFn: (d: string) => api.delete(`/records/${d}`),
    onSuccess: () => qc.invalidateQueries(),
  })

  // Every calendar day between the first and last record, newest first, so gaps are visible and can be filled.
  const rows: Row[] = useMemo(() => {
    const recs = records.data ?? []
    if (!recs.length) return []
    const byDate = new Map(recs.map((r) => [r.date, r]))
    const out: Row[] = []
    const d = new Date(`${recs[0].date}T00:00:00Z`)
    const end = new Date(`${recs[recs.length - 1].date}T00:00:00Z`)
    while (d <= end) {
      const iso = d.toISOString().slice(0, 10)
      out.push({ date: iso, record: byDate.get(iso) ?? null })
      d.setUTCDate(d.getUTCDate() + 1)
    }
    return out.reverse()
  }, [records.data])

  if (!m) return <Loading />
  const keys = Object.keys(m.variables) as VariableKey[]
  const q = summary.data?.quality
  const gaps = rows.filter((r) => !r.record).length
  const shown = showGapsOnly ? rows.filter((r) => !r.record) : rows
  const onFiles = (files: FileList | null) => {
    if (files?.[0]) previewMut.mutate(files[0])
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          ['Days recorded', summary.data?.rows ?? '—'],
          ['Date range', q?.start_date ? `${q.start_date} → ${q.end_date}` : '—'],
          ['Missing days in range', q?.missing_days ?? '—'],
          ['Values present', q?.completeness !== undefined ? `${(q.completeness * 100).toFixed(1)}%` : '—'],
        ].map(([l, v]) => (
          <Card key={l as string}>
            <div className="text-xs text-grey-500">{l}</div>
            <div className="mt-1 text-xl font-medium">{v}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        {/* Import, history, export */}

          <Card>
            <CardHeader title="Import Records" subtitle="Excel, CSV or Word table · one row per day" icon={<UploadCloud className="size-4" />} />
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files) }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
                dragOver ? 'border-primary-300 bg-primary-0' : 'border-grey-100 bg-grey-0 hover:border-primary-100'
              }`}
            >
              <UploadCloud className="mb-2 size-7 text-primary-300" />
              <div className="text-sm font-medium">{previewMut.isPending ? 'Reading file…' : 'Click or drop a file'}</div>
              <div className="mt-1 text-xs text-grey-500">Only new or changed days are imported</div>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.docx" className="hidden"
                onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} />
            </div>
            {previewMut.error && <div className="mt-3"><ErrorState error={previewMut.error} /></div>}
            {pending && (
              <PreviewPanel m={m} file={pending.file} preview={pending.preview}
                onCancel={() => setPending(null)} onDone={(r) => { setPending(null); setResult(r) }} />
            )}
            {result && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 rounded-xl bg-success-0 px-3 py-2 text-sm text-success-200">
                  <CheckCircle2 className="size-4 shrink-0" />
                  {result.filename}: {result.added} added, {result.updated} replaced, {result.skipped} unchanged. Analysis updated.
                </div>
                {result.warnings.map((w) => <Notice key={w} tone="warning">{w}</Notice>)}
              </div>
            )}
            <div className="mt-3 text-xs text-grey-500">
              Headers are matched automatically, e.g. <code>日期</code>/<code>Date</code>, <code>入水浑浊度</code>/<code>Influent Turbidity</code>.
            </div>
          </Card>

          <Card>
            <CardHeader title="Import History" subtitle="Files imported into the records" icon={<FileSpreadsheet className="size-4" />} />
            {uploads.isLoading ? <Loading /> : (
              <div className="space-y-2">
                {(uploads.data ?? []).map((u) => (
                  <div key={u.id} className="rounded-xl bg-grey-25 px-3 py-2 text-xs">
                    <div className="truncate font-medium text-ink">{u.filename}</div>
                    <div className="text-grey-500">
                      {u.created_at?.replace('T', ' ').slice(0, 16)} · +{u.added} added · {u.updated} replaced · {u.skipped} unchanged
                    </div>
                  </div>
                ))}
                {uploads.data?.length === 0 && <p className="text-sm text-grey-500">No imports yet.</p>}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Export (CSV)" subtitle="For the report appendix" icon={<Download className="size-4" />} />
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Records', EXPORTS.records],
                ['Evaluation', EXPORTS.evaluation],
                ['Predictions', EXPORTS.predictions],
                ['Anomalies', EXPORTS.anomalies],
              ].map(([label, href]) => (
                <a key={href} href={href}
                  className="inline-flex items-center gap-2 rounded-xl border border-grey-100 bg-white px-3 py-2 text-sm hover:bg-grey-25">
                  <Download className="size-4 text-primary-300" /> {label}
                </a>
              ))}
            </div>
          </Card>
      </div>

        {/* Day-by-day records */}
        <Card>
          <CardHeader
            title="Daily Records"
            subtitle={`${summary.data?.rows ?? 0} days · ${gaps} missing day(s) in range`}
            icon={<CalendarPlus className="size-4" />}
            actions={
              <>
                {gaps > 0 && (
                  <Button variant="outline" onClick={() => setShowGapsOnly((s) => !s)}>
                    {showGapsOnly ? 'Show all days' : `Show missing (${gaps})`}
                  </Button>
                )}
                <Button onClick={() => setForm({ date: '' })} icon={<Plus className="size-4" />}>Add day</Button>
              </>
            }
          />
          {records.isLoading && <Loading />}
          {records.error && <ErrorState error={records.error} />}
          {remove.error && <div className="mb-3"><ErrorState error={remove.error} /></div>}
          {!records.isLoading && rows.length === 0 && <p className="text-sm text-grey-500">No records yet. Import a file or add a day.</p>}
          {rows.length > 0 && (
            <div className="max-h-[720px] overflow-auto">
              <Table head={['Date', ...keys.map((k) => varLabel(m, k).replace('Influent', 'In.').replace('Outlet', 'Out.')), 'Source', '']}>
                {shown.map(({ date, record }) =>
                  record ? (
                    <tr key={date}>
                      <td className="whitespace-nowrap text-ink">{date}</td>
                      {keys.map((k) => <td key={k}>{fmt(record[k], 2)}</td>)}
                      <td className="max-w-[170px] truncate text-xs" title={record.source}>
                        {record.source === 'manual' ? <Badge tone="primary">Manual</Badge> : record.source?.replace('upload: ', '')}
                      </td>
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-2 text-grey-500">
                          <button title="Edit" className="hover:text-ink"
                            onClick={() => setForm({ date, values: Object.fromEntries(keys.map((k) => [k, record[k]])) as DayValues })}>
                            <Pencil className="size-4" />
                          </button>
                          <button title="History" className="hover:text-ink" onClick={() => setHistoryDate(date)}><History className="size-4" /></button>
                          <button title="Delete" className="hover:text-error-100"
                            onClick={() => confirm(`Delete the record for ${date}? Analysis will re-run.`) && remove.mutate(date)}>
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={date} className="bg-warning-0/50">
                      <td className="whitespace-nowrap text-ink">{date}</td>
                      <td colSpan={keys.length + 1} className="text-xs !text-warning-200">No record for this day</td>
                      <td>
                        <button className="inline-flex items-center gap-1 text-xs text-primary-300" onClick={() => setForm({ date })}>
                          <Plus className="size-3" /> Add
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </Table>
            </div>
          )}
        </Card>


      {form && <DayForm key={form.date} m={m} initial={form} onClose={() => setForm(null)} />}
      {historyDate && <HistoryModal m={m} date={historyDate} onClose={() => setHistoryDate(null)} />}
    </div>
  )
}
