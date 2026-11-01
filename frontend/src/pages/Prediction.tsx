import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, ClipboardList, Droplet, FlaskConical, Waves } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fetchers, type Forecast, type Meta, type TargetKey, type VariableKey } from '../api/client'
import { Badge, Card, CardHeader, ErrorState, Loading, Notice } from '../components/ui'
import { fmt, MODEL_LABEL, varLabel, varUnit } from '../lib/format'
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
  const next = useQuery({ queryKey: ['next-day'], queryFn: fetchers.nextDay })
  const anomalies = useQuery({ queryKey: ['anomalies'], queryFn: fetchers.anomalies })
  const inputs = useQuery({
    queryKey: ['day', next.data?.based_on],
    queryFn: () => fetchers.day(next.data!.based_on),
    enabled: !!next.data,
  })

  if (!m || next.isLoading) return <Loading />
  if (next.error) return <ErrorState error={next.error} />
  const n = next.data!
  const bounds = anomalies.data?.iqr_bounds
  const limitedCount = Object.values(n.forecasts).filter((f) => f?.reliability === 'limited').length

  return (
    <div className="space-y-4">
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
          ({limitedCount} of {m.targets.length} indicators). Treat these values as rough reference only; the ± range is the
          model&apos;s typical error.{' '}
          <Link to="/testing" className="underline">See model testing</Link>
        </Notice>
      )}

      <Card>
        <CardHeader
          title="Input Measurements"
          subtitle={`The six values recorded on ${n.based_on} that the forecast is based on`}
          icon={<ClipboardList className="size-4" />}
        />
        {inputs.isLoading ? <Loading /> : inputs.data && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {(Object.keys(m.variables) as VariableKey[]).map((k) => (
              <div key={k} className="rounded-xl bg-grey-25 px-3 py-2.5">
                <div className="text-xs text-grey-500">{varLabel(m, k)}</div>
                <div className="mt-0.5 text-lg font-medium">
                  {fmt(inputs.data.variables[k].value, DP)} <span className="text-xs font-normal text-grey-500">{varUnit(m, k)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Notice>
        The model uses the six measurements of one day to predict the outlet indicators of the next day. Forecasts update
        automatically when a new dataset is uploaded.
      </Notice>
    </div>
  )
}
