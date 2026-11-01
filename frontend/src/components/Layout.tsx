import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  BrainCircuit,
  Database,
  Droplets,
  FileBarChart,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  PanelLeft,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { fetchers } from '../api/client'
import { Badge } from './ui'

const NAV = [
  {
    section: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/trends', label: 'Historical Trends', icon: LineChart },
    ],
  },
  {
    section: 'Analysis',
    items: [
      { to: '/prediction', label: 'Next-day Prediction', icon: BrainCircuit },
      { to: '/testing', label: 'Model Testing', icon: FlaskConical },
      { to: '/anomalies', label: 'Anomaly Detection', icon: TriangleAlert },
    ],
  },
  {
    section: 'Reports',
    items: [
      { to: '/evaluation', label: 'Model Evaluation', icon: FileBarChart },
      { to: '/data', label: 'Data Management', icon: Database },
    ],
  },
]

const TITLES: Record<string, string> = Object.fromEntries(NAV.flatMap((s) => s.items.map((i) => [i.to, i.label])))

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const { pathname } = useLocation()
  const overview = useQuery({ queryKey: ['overview'], queryFn: fetchers.overview, retry: false })
  const ds = overview.data?.dataset

  return (
    <div className="flex h-full">
      <aside
        className={clsx(
          'flex shrink-0 flex-col border-r border-grey-50 bg-white px-3 py-5 transition-all',
          collapsed ? 'w-[72px]' : 'w-[248px]',
        )}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Droplets className="size-6 text-primary-300" />
            {!collapsed && <span className="text-lg font-semibold">AquaInsight</span>}
          </div>
          <button onClick={() => setCollapsed((c) => !c)} className="text-grey-500 hover:text-ink">
            <PanelLeft className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5">
          {NAV.map((group) => (
            <div key={group.section}>
              {!collapsed && <div className="mb-1.5 px-2 text-sm text-grey-500">{group.section}</div>}
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    title={label}
                    className={({ isActive }) =>
                      clsx(
                        'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
                        isActive
                          ? 'bg-grey-25 font-medium text-ink before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded before:bg-primary-300'
                          : 'text-paragraph hover:bg-grey-25',
                      )
                    }
                  >
                    <Icon className="size-4 shrink-0" />
                    {!collapsed && label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {!collapsed && (
          <div className="rounded-xl border border-grey-50 bg-grey-0 p-3 text-xs text-grey-500">
            Analytical support tool for historical records. Results do not replace laboratory testing or professional
            judgement.
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-medium">{TITLES[pathname] ?? 'AquaInsight'}</h1>
            <p className="text-xs text-grey-500">
              {overview.data
                ? `Historical dataset · ${overview.data.quality?.start_date} to ${overview.data.latest_date} · ${ds?.row_count} daily records`
                : 'Groundwater Quality Prediction & Anomaly Detection'}
            </p>
          </div>
          {ds && (
            <div className="flex items-center gap-2 rounded-xl border border-grey-50 bg-white px-3 py-2 text-sm">
              <Database className="size-4 text-primary-300" />
              <span className="max-w-[240px] truncate">{ds.name}</span>
              {ds.source === 'demo' && <Badge tone="warning">Synthetic</Badge>}
            </div>
          )}
        </header>
        <main className="min-h-0 flex-1 overflow-auto px-6 pb-6">
          <div className="rounded-3xl bg-white/60 p-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
