import clsx from 'clsx'
import {
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Droplets,
  LineChart,
  Menu,
  TriangleAlert,
  UploadCloud,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { session } from '../api/client'

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` })

const NAV = [
  { href: '#problem', label: 'Problem' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#product', label: 'Product' },
  { href: '#impact', label: 'Impact' },
]

const INSIGHTS = [
  {
    icon: BrainCircuit,
    title: 'Next-day forecast',
    copy: "Estimate tomorrow's outlet turbidity, pH and free chlorine from today's readings.",
  },
  {
    icon: TriangleAlert,
    title: 'Anomaly review',
    copy: "IQR and Isolation Forest surface the days that break from your plant's usual pattern.",
  },
  {
    icon: CalendarDays,
    title: 'Daily record review',
    copy: 'Open any day and see how every reading sits against the rest of the record.',
  },
]

const RAIL = [
  'SDG 6 · Clean Water and Sanitation',
  'SDG 3 · Good Health and Well-being',
  'SDG 9 · Industry, Innovation and Infrastructure',
  'Python',
  'scikit-learn',
  'FastAPI',
  'React',
  'MySQL',
]

/** Adds .is-visible to .lp-reveal children of the returned ref once they scroll into view. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const items = root.querySelectorAll<HTMLElement>('.lp-reveal')
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
    )
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return ref
}

function Logo({ light }: { light?: boolean }) {
  return (
    <span className={clsx('flex items-center gap-2', light ? 'text-white' : 'text-ink')}>
      <span className={clsx('flex size-8 items-center justify-center rounded-lg', light ? 'bg-white/15' : 'bg-primary-300')}>
        <Droplets className="size-[18px] text-white" />
      </span>
      <span className="text-lg font-semibold tracking-tight">AquaInsight</span>
    </span>
  )
}

/* ------------------------------------------------------------------ hero sky */

function Sky() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#1f6db0] via-[#4c97d6] to-[#93c6ee]" aria-hidden>
      {/* soft clouds */}
      {[
        'left-[-8%] top-[8%] h-[38%] w-[60%] opacity-70 [animation-duration:38s]',
        'left-[30%] top-[22%] h-[30%] w-[55%] opacity-50 [animation-duration:46s] [animation-direction:alternate-reverse]',
        'left-[55%] top-[2%] h-[26%] w-[48%] opacity-60 [animation-duration:52s]',
        'left-[10%] top-[48%] h-[24%] w-[50%] opacity-40 [animation-duration:44s] [animation-direction:alternate-reverse]',
      ].map((c, i) => (
        <div
          key={i}
          className={clsx('lp-cloud absolute rounded-full blur-3xl', c)}
          style={{
            background: 'radial-gradient(closest-side, rgba(255,255,255,.95), rgba(255,255,255,0))',
            animationName: 'lp-drift',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationDirection: i % 2 ? 'alternate-reverse' : 'alternate',
          }}
        />
      ))}
      {/* water surface */}
      <div className="absolute inset-x-0 bottom-0 h-[34%]">
        {[
          { fill: 'rgba(255,255,255,.18)', dur: '16s', y: 0 },
          { fill: 'rgba(43,107,226,.22)', dur: '22s', y: 18 },
          { fill: 'rgba(255,255,255,.28)', dur: '28s', y: 36 },
        ].map((w, i) => (
          <svg key={i} className="lp-wave absolute bottom-0 left-0 h-full w-[200%]" viewBox="0 0 2400 300" preserveAspectRatio="none"
            style={{ animation: `lp-wave ${w.dur} linear infinite`, transform: 'translateX(0)' }}>
            <path
              fill={w.fill}
              d={`M0 ${120 + w.y} C 200 ${80 + w.y}, 400 ${160 + w.y}, 600 ${120 + w.y} S 1000 ${80 + w.y}, 1200 ${120 + w.y} S 1600 ${160 + w.y}, 1800 ${120 + w.y} S 2200 ${80 + w.y}, 2400 ${120 + w.y} V 300 H 0 Z`}
            />
          </svg>
        ))}
      </div>
    </div>
  )
}

function Sparkline({ points, color = '#fff' }: { points: number[]; color?: string }) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const d = points.map((p, i) => `${(i / (points.length - 1)) * 100},${28 - ((p - min) / (max - min || 1)) * 24}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" className="h-7 w-24" preserveAspectRatio="none">
      <polyline points={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function GlassChip({ label, value, unit, children, className, style }: {
  label: string; value: string; unit?: string; children?: ReactNode; className?: string; style?: CSSProperties
}) {
  return (
    <div className={clsx('absolute rounded-xl border border-white/25 bg-white/15 px-4 py-3 text-white shadow-[0_10px_30px_-12px_rgba(0,14,35,.35)] backdrop-blur-xl', className)} style={style}>
      <div className="text-[11px] uppercase tracking-wider text-white/75">{label}</div>
      <div className="mt-0.5 flex items-end justify-between gap-4">
        <span className="text-xl font-medium">
          {value} {unit && <span className="text-xs font-normal text-white/75">{unit}</span>}
        </span>
        {children}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ hero */

function Hero() {
  const [open, setOpen] = useState(false)
  const [slide, setSlide] = useState(0)
  const [paused, setPaused] = useState(false)
  const signedIn = !!session.token()

  useEffect(() => {
    if (paused) return
    const t = window.setInterval(() => setSlide((s) => (s + 1) % INSIGHTS.length), 6000)
    return () => window.clearInterval(t)
  }, [paused])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const insight = INSIGHTS[slide]
  const primary = signedIn
    ? { to: '/dashboard', label: 'Open dashboard' }
    : { to: '/register', label: 'Get started' }

  return (
    <header id="top" className="relative p-3 md:p-4 lg:h-screen lg:min-h-[640px]">
      <div className="relative grid min-h-[calc(100svh-24px)] grid-cols-1 grid-rows-[auto_auto_minmax(300px,1fr)] gap-2 overflow-hidden rounded-[6px] p-2 md:min-h-[calc(100svh-32px)] lg:h-full lg:min-h-0 lg:grid-cols-2 lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-2.5 lg:p-3">
        <Sky />

        {/* nav: white block on the left, frosted block on the right */}
        <div className="lp-wipe-right relative z-10 flex h-16 items-center justify-between rounded-[4px] bg-white px-4 lg:px-5" style={delay(40)}>
          <a href="#top" className="lp-enter" style={delay(150)} aria-label="AquaInsight home"><Logo /></a>
          <button
            className="flex size-10 items-center justify-center rounded-lg text-ink hover:bg-grey-25 lg:hidden"
            onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        <nav className="lp-wipe-right relative z-10 hidden h-16 items-center justify-between rounded-[4px] bg-white/10 pl-6 pr-2 backdrop-blur-[20px] lg:flex" style={delay(110)}>
          <div className="lp-enter flex items-center gap-10 xl:gap-14" style={delay(240)}>
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-sm font-semibold tracking-tight text-white/85 transition hover:text-white">{n.label}</a>
            ))}
          </div>
          <Link to={signedIn ? '/dashboard' : '/login'} className="lp-enter flex h-12 items-center rounded-[3px] bg-white px-6 text-sm font-semibold text-[#252525] transition hover:bg-white/90" style={delay(310)}>
            {signedIn ? 'Dashboard' : 'Sign in'}
          </Link>
        </nav>

        {/* mobile drawer */}
        <div className={clsx(
          'absolute right-4 top-[84px] z-30 w-[min(300px,calc(100%-2rem))] rounded-[6px] border border-white/15 bg-[#000e23]/90 p-3 backdrop-blur-xl transition lg:hidden',
          open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1.5 opacity-0',
        )}>
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-[3px] px-3 text-sm font-semibold text-white/85 hover:bg-white/10">
              {n.label}
            </a>
          ))}
          <Link to={signedIn ? '/dashboard' : '/login'} className="mt-2 flex h-12 items-center justify-center rounded-[3px] bg-white text-sm font-semibold text-[#252525]">
            {signedIn ? 'Dashboard' : 'Sign in'}
          </Link>
        </div>

        {/* white copy panel */}
        <section className="lp-wipe-down relative z-10 flex min-h-0 flex-col rounded-[4px] bg-white" style={delay(230)} aria-labelledby="hero-title">
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center lg:px-12">
            <div className="lp-enter mb-7 flex gap-2" style={delay(430)} aria-hidden>
              {[0, 1, 2].map((i) => <i key={i} className="block size-2.5 bg-[#000e23]" />)}
            </div>
            <h1 id="hero-title" className="text-[clamp(38px,5.2vw,76px)] font-medium uppercase leading-[1.02] tracking-[-0.055em] text-black">
              <span className="lp-type block" style={delay(500)}>Groundwater</span>
              <span className="lp-type block font-serif text-[1.08em] normal-case italic tracking-[-0.04em] text-primary-300" style={delay(610)}>quality,</span>
              <span className="lp-type block" style={delay(720)}>made clear</span>
            </h1>
            <p className="lp-enter mt-7 max-w-[30rem] text-[clamp(15px,1.15vw,17px)] leading-snug tracking-[-0.01em] text-paragraph" style={delay(940)}>
              One place to explore your plant&apos;s daily treatment records, forecast tomorrow&apos;s outlet quality and surface the days that need a closer look.
            </p>
            <div className="lp-enter mt-8 flex flex-wrap items-center justify-center gap-3" style={delay(1080)}>
              <Link to={primary.to} className="group inline-flex h-14 items-center gap-2 rounded-[2px] bg-[#000e23] px-7 text-sm font-medium uppercase tracking-[-0.01em] text-white transition hover:bg-[#0b2244]">
                {primary.label} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </Link>
              <a href="#how-it-works" className="inline-flex h-14 items-center rounded-[2px] border border-grey-100 px-7 text-sm font-medium uppercase tracking-[-0.01em] text-ink transition hover:bg-grey-25">
                See how it works
              </a>
            </div>
          </div>

          <div className="lp-enter border-t border-[#000e23]/10 px-6 pb-6 pt-5" style={delay(1200)}>
            <p className="text-center text-[13px] font-medium uppercase tracking-[-0.01em] text-[#4a4a4a]">Built around the UN Sustainable Development Goals</p>
            <div className="relative mx-auto mt-4 max-w-[620px] overflow-hidden">
              <div className="lp-marquee flex w-max gap-10 whitespace-nowrap">
                {[...RAIL, ...RAIL].map((r, i) => (
                  <span key={i} className="text-sm font-semibold tracking-tight text-[#9aa1ad]">{r}</span>
                ))}
              </div>
              <span className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-white to-white/0" />
              <span className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-white to-white/0" />
            </div>
          </div>
        </section>

        {/* sky side: floating readings, insight card, carousel controls */}
        <div className="relative z-10 min-h-0">
          <GlassChip label="Outlet turbidity" value="0.14" unit="NTU" className="lp-float right-[14%] top-[12%] hidden lg:block" style={{ animationDelay: '0s' }}>
            <Sparkline points={[0.12, 0.15, 0.13, 0.33, 0.19, 0.14, 0.12, 0.14]} />
          </GlassChip>
          <GlassChip label="Free chlorine · tomorrow" value="0.29" unit="mg/L" className="lp-float left-[10%] top-[34%] hidden xl:block" style={{ animationDelay: '-2s' }}>
            <span className="rounded-md bg-white/20 px-2 py-0.5 text-[11px]">Forecast</span>
          </GlassChip>
          <GlassChip label="Outlet pH" value="7.59" className="lp-float right-[22%] top-[50%] hidden lg:block" style={{ animationDelay: '-4s' }}>
            <span className="rounded-md bg-white/20 px-2 py-0.5 text-[11px]">Normal</span>
          </GlassChip>

          <aside
            className="lp-enter absolute bottom-3 left-3 w-[calc(100%-24px)] rounded-[4px] sm:w-[min(320px,calc(100%-140px))] border border-white/20 bg-[#0b3566]/30 p-5 text-white backdrop-blur-[31px] lg:bottom-4 lg:left-4"
            style={delay(1160)} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-live="polite"
          >
            <insight.icon className="size-6" />
            <h2 className="mt-10 text-lg font-medium uppercase tracking-[-0.05em] lg:mt-16">{insight.title}</h2>
            <p className="mt-2 text-[15px] leading-snug tracking-[-0.01em] text-white/90">{insight.copy}</p>
            <div className="mt-4 flex gap-1.5">
              {INSIGHTS.map((_, i) => (
                <span key={i} className={clsx('h-1 rounded-full transition-all', i === slide ? 'w-6 bg-white' : 'w-2 bg-white/40')} />
              ))}
            </div>
          </aside>
          <div className="lp-enter absolute right-3 top-3 flex gap-0.5 sm:bottom-3 sm:top-auto lg:bottom-4 lg:right-4" style={delay(1380)}>
            {[
              { icon: ChevronLeft, dir: -1, label: 'Previous' },
              { icon: ChevronRight, dir: 1, label: 'Next' },
            ].map(({ icon: Icon, dir, label }) => (
              <button key={label} aria-label={`${label} feature`}
                onClick={() => setSlide((s) => (s + dir + INSIGHTS.length) % INSIGHTS.length)}
                className="flex size-12 items-center justify-center rounded-[3px] border border-white/20 bg-[#0b3566]/30 text-white backdrop-blur-[31px] transition hover:bg-[#0b3566]/45">
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ illustrations */

function GridCard({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative aspect-[821/538] overflow-hidden rounded-[4px] bg-[#e0e0e0]/30"
      style={{
        backgroundImage:
          'linear-gradient(rgba(0,14,35,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,14,35,.06) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      <div className="absolute inset-[9%]">{children}</div>
    </div>
  )
}

function IllustrationRows() {
  const rows = [0.33, 0.25, 0.16, 0.25, 0.22, 0.19, 0.17]
  return (
    <svg viewBox="0 0 400 260" className="size-full">
      {rows.map((v, i) => (
        <g key={i} transform={`translate(0 ${i * 30})`}>
          <rect width="150" height="20" rx="3" fill="#fff" />
          <rect x="10" y="7" width={40 + v * 120} height="6" rx="3" fill="#dfe1e7" />
        </g>
      ))}
      <path d="M170 105 h40" stroke="#80a6ee" strokeWidth="2" strokeDasharray="4 4" />
      <path d="M205 99 l8 6 -8 6" fill="none" stroke="#80a6ee" strokeWidth="2" />
      <rect x="225" y="20" width="175" height="200" rx="4" fill="#fff" />
      <polyline points="240,170 265,140 290,155 315,95 340,120 365,70 385,85" fill="none" stroke="#2b6be2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="240,190 265,180 290,185 315,160 340,170 365,150 385,155" fill="none" stroke="#ffbe4c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IllustrationForecast() {
  return (
    <svg viewBox="0 0 400 260" className="size-full">
      <rect x="0" y="10" width="400" height="240" rx="4" fill="#fff" />
      <line x1="280" y1="30" x2="280" y2="230" stroke="#dfe1e7" strokeDasharray="4 4" />
      <path d="M280 120 C 310 90, 340 80, 380 70 L 380 170 C 340 160, 310 150, 280 130 Z" fill="#2b6be2" opacity=".12" />
      <polyline points="20,160 60,140 100,150 140,110 180,130 220,100 260,120 280,125" fill="none" stroke="#2b6be2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="280,125 320,110 350,118 380,112" fill="none" stroke="#2b6be2" strokeWidth="3" strokeDasharray="6 6" strokeLinecap="round" />
      <circle cx="280" cy="125" r="6" fill="#fff" stroke="#2b6be2" strokeWidth="3" />
      <text x="292" y="52" fill="#666d80" fontSize="14" fontFamily="Inter">Tomorrow?</text>
    </svg>
  )
}

function IllustrationAnomaly() {
  const pts = [0.3, 0.35, 0.3, 0.35, 0.3, 0.45, 0.3, 0.35, 0.3, 0.05, 0.1, 0.15, 0.35, 0.3, 0.4]
  return (
    <svg viewBox="0 0 400 260" className="size-full">
      <rect x="0" y="10" width="400" height="240" rx="4" fill="#fff" />
      <rect x="20" y="70" width="360" height="90" fill="#2b6be2" opacity=".07" />
      <line x1="20" y1="70" x2="380" y2="70" stroke="#ffbe4c" strokeDasharray="5 5" />
      <line x1="20" y1="160" x2="380" y2="160" stroke="#ffbe4c" strokeDasharray="5 5" />
      <polyline
        points={pts.map((v, i) => `${20 + i * (360 / (pts.length - 1))},${230 - v * 380}`).join(' ')}
        fill="none" stroke="#80a6ee" strokeWidth="2.5" strokeLinejoin="round"
      />
      {pts.map((v, i) => {
        const out = v > 0.42 || v < 0.2
        return (
          <circle key={i} cx={20 + i * (360 / (pts.length - 1))} cy={230 - v * 380} r={out ? 7 : 3.5}
            fill={out ? '#df1c41' : '#2b6be2'} stroke="#fff" strokeWidth={out ? 2.5 : 0} />
        )
      })}
    </svg>
  )
}

/* ------------------------------------------------------------------ sections */

function Kicker({ children }: { children: string }) {
  return (
    <div className="flex items-center justify-between text-[13px] font-medium uppercase tracking-[-0.01em] text-[#4a4a4a]">
      <i className="block size-2.5 bg-[#000e23] opacity-30" />
      <span>{children}</span>
      <i className="block size-2.5 bg-[#000e23] opacity-30" />
    </div>
  )
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="lp-reveal mx-auto mt-16 max-w-[1000px] text-balance text-center text-[clamp(28px,3.4vw,46px)] font-medium uppercase leading-[1.08] tracking-[-0.055em] text-black md:mt-24">
      {children}
    </h2>
  )
}

function Problem() {
  const ref = useReveal<HTMLElement>()
  const cards = [
    {
      art: <IllustrationRows />,
      title: 'Patterns hide in spreadsheets',
      copy: 'Influent, dosage and outlet readings sit in rows. Trends and relationships stay invisible.',
    },
    {
      art: <IllustrationForecast />,
      title: 'Tomorrow is a guess',
      copy: "Nobody knows whether today's readings say anything about tomorrow's water until it is tested.",
    },
    {
      art: <IllustrationAnomaly />,
      title: 'Unusual days slip through',
      copy: 'A low dosage or a turbidity spike is easy to miss among hundreds of ordinary entries.',
    },
  ]
  return (
    <section id="problem" ref={ref} className="mx-auto max-w-[1720px] px-4 pt-14 md:px-8">
      <div className="lp-reveal"><Kicker>The problem</Kicker></div>
      <div className="lp-reveal -mx-4 mt-8 h-px bg-[#000e23]/[.13] md:-mx-8" />
      <SectionHeading>
        Treatment logs grow every day. Reading them shouldn&apos;t take all day.
      </SectionHeading>
      <div className="mt-12 grid grid-cols-1 gap-x-3 gap-y-10 md:mt-16 md:grid-cols-3">
        {cards.map((c, i) => (
          <article key={c.title} className="lp-reveal" style={{ transitionDelay: `${i * 90}ms` }}>
            <GridCard>{c.art}</GridCard>
            <h3 className="mt-6 px-[2.3%] text-[clamp(18px,1.6vw,24px)] font-medium uppercase leading-[1.1] tracking-[-0.06em]">{c.title}</h3>
            <p className="mt-2 max-w-[34rem] px-[2.3%] text-[15px] leading-snug tracking-[-0.01em] text-black/60">{c.copy}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function HowItWorks() {
  const ref = useReveal<HTMLElement>()
  const steps = [
    { icon: UploadCloud, title: 'Import daily records', copy: 'Drop in Excel, CSV or a Word table. New days merge in; changed days are shown before anything is replaced.' },
    { icon: LineChart, title: 'Explore trends', copy: 'Distributions, correlations and influent-to-outlet comparisons across every indicator you record.' },
    { icon: BrainCircuit, title: 'Forecast tomorrow', copy: 'Linear Regression and Random Forest are trained on your history and checked against honest baselines.' },
    { icon: TriangleAlert, title: 'Review anomalies', copy: 'Two complementary methods flag unusual days and show exactly which readings made them stand out.' },
  ]
  return (
    <section id="how-it-works" ref={ref} className="mx-auto max-w-[1720px] px-4 pt-28 md:px-8 md:pt-40">
      <div className="lp-reveal"><Kicker>How it works</Kicker></div>
      <div className="lp-reveal -mx-4 mt-8 h-px bg-[#000e23]/[.13] md:-mx-8" />
      <SectionHeading>From raw logs to clear answers in four steps</SectionHeading>
      <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 md:mt-16 xl:grid-cols-4">
        {steps.map((s, i) => (
          <div key={s.title} className="lp-reveal flex flex-col rounded-[4px] bg-[#e0e0e0]/30 p-7" style={{ transitionDelay: `${i * 80}ms` }}>
            <div className="flex items-center justify-between">
              <span className="flex size-11 items-center justify-center rounded-[3px] bg-white text-primary-300"><s.icon className="size-5" /></span>
              <span className="text-[13px] font-medium text-[#9aa1ad]">0{i + 1}</span>
            </div>
            <h3 className="mt-16 text-xl font-medium uppercase tracking-[-0.06em]">{s.title}</h3>
            <p className="mt-2 text-[15px] leading-snug tracking-[-0.01em] text-black/60">{s.copy}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function MiniGauge({ value, low, high }: { value: number; low: number; high: number }) {
  // Values 0..1 mapped onto a 240° dial; low/high mark the normal band.
  const cx = 60, cy = 60, r = 46
  const angle = (v: number) => ((-210 + v * 240) * Math.PI) / 180
  const pt = (v: number, rad = r) => [cx + rad * Math.cos(angle(v)), cy + rad * Math.sin(angle(v))]
  const arc = (a: number, b: number) => {
    const [x1, y1] = pt(a)
    const [x2, y2] = pt(b)
    return `M ${x1} ${y1} A ${r} ${r} 0 ${(b - a) * 240 > 180 ? 1 : 0} 1 ${x2} ${y2}`
  }
  const [nx, ny] = pt(value, 32)
  return (
    <svg viewBox="0 0 120 100" className="w-full">
      <path d={arc(0, 1)} fill="none" stroke="#ffe3a8" strokeWidth="10" strokeLinecap="round" />
      <path d={arc(low, high)} fill="none" stroke="#c9d9f8" strokeWidth="10" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#2b6be2" strokeWidth="4" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="6" fill="#fff" stroke="#2b6be2" strokeWidth="3" />
    </svg>
  )
}

function Product() {
  const ref = useReveal<HTMLElement>()
  return (
    <section id="product" ref={ref} className="mx-auto max-w-[1720px] px-4 pt-28 md:px-8 md:pt-40">
      <div className="lp-reveal"><Kicker>Product</Kicker></div>
      <div className="lp-reveal -mx-4 mt-8 h-px bg-[#000e23]/[.13] md:-mx-8" />
      <SectionHeading>Every day of your plant, on one screen</SectionHeading>

      <div className="lp-reveal relative mt-12 overflow-hidden rounded-[6px] bg-gradient-to-b from-[#1f6db0] via-[#4c97d6] to-[#93c6ee] p-3 md:mt-16 md:p-10">
        <div className="mx-auto max-w-[1180px] rounded-[6px] bg-grey-25 p-3 shadow-[0_30px_80px_-30px_rgba(0,14,35,.55)] md:p-5">
          {/* window bar */}
          <div className="mb-4 flex items-center gap-2 px-1">
            {['#f07a8c', '#ffbe4c', '#40c4aa'].map((c) => <span key={c} className="size-2.5 rounded-full" style={{ background: c }} />)}
            <span className="ml-3 rounded-md bg-white px-3 py-1 text-xs text-grey-500">aquainsight.app/dashboard</span>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ['Outlet Turbidity', '0.14', 'NTU', 'Normal'],
              ['Outlet pH', '7.59', '', 'Normal'],
              ['Outlet Free Chlorine', '0.35', 'mg/L', 'Normal'],
              ['NaOCl Dosage', '4.00', 'mg/kt', 'Normal'],
            ].map(([l, v, u, s]) => (
              <div key={l} className="rounded-xl border border-grey-50 bg-white p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{l}</span>
                  <span className="rounded-md bg-success-0 px-2 py-0.5 text-[11px] text-success-200">{s}</span>
                </div>
                <div className="mt-3 text-2xl font-medium">{v} <span className="text-xs font-normal text-grey-500">{u}</span></div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-grey-50 bg-white p-4">
              <div className="text-sm font-medium">Indicator Gauge</div>
              <div className="mx-auto mt-2 max-w-[220px]"><MiniGauge value={0.62} low={0.4} high={0.8} /></div>
              <div className="-mt-3 text-center text-2xl font-medium">0.35</div>
            </div>
            <div className="rounded-xl border border-grey-50 bg-white p-4 md:col-span-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Forecast for tomorrow</span>
                <span className="text-xs text-grey-500">Random Forest</span>
              </div>
              <svg viewBox="0 0 600 180" className="mt-3 w-full">
                {[40, 80, 120, 160].map((y) => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#eceff3" />)}
                <polyline points="0,90 50,100 100,80 150,95 200,70 250,85 300,60 350,90 400,75 450,140 470,110 500,95" fill="none" stroke="#2b6be2" strokeWidth="3" strokeLinejoin="round" />
                <polyline points="0,95 50,90 100,88 150,90 200,82 250,84 300,78 350,85 400,82 450,95 470,92 500,90 560,86" fill="none" stroke="#40c4aa" strokeWidth="2.5" strokeDasharray="6 6" />
                <circle cx="560" cy="86" r="6" fill="#fff" stroke="#40c4aa" strokeWidth="3" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Impact() {
  const ref = useReveal<HTMLElement>()
  const stats = [
    ['6', 'water quality indicators analysed together'],
    ['4', 'forecasting approaches compared on every run'],
    ['2', 'independent anomaly detection methods'],
    ['1', 'day ahead, refreshed whenever records change'],
  ]
  const goals = [
    ['SDG 6', 'Clean Water and Sanitation', 'Better understanding of treatment performance supports safe, reliable supply.'],
    ['SDG 3', 'Good Health and Well-being', 'Clearer water quality records help protect the people who depend on them.'],
    ['SDG 9', 'Industry, Innovation and Infrastructure', 'Practical machine learning brought to everyday treatment operations.'],
  ]
  return (
    <section id="impact" ref={ref} className="mx-auto max-w-[1720px] px-4 pt-28 md:px-8 md:pt-40">
      <div className="lp-reveal"><Kicker>Impact</Kicker></div>
      <div className="lp-reveal -mx-4 mt-8 h-px bg-[#000e23]/[.13] md:-mx-8" />
      <div className="mt-12 grid grid-cols-2 gap-3 md:mt-16 xl:grid-cols-4">
        {stats.map(([n, t], i) => (
          <div key={t} className="lp-reveal rounded-[4px] border border-[#000e23]/10 p-7" style={{ transitionDelay: `${i * 70}ms` }}>
            <div className="text-[clamp(48px,5vw,76px)] font-medium leading-none tracking-[-0.06em] text-primary-300">{n}</div>
            <p className="mt-4 max-w-[16rem] text-[15px] leading-snug text-black/60">{t}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        {goals.map(([code, name, copy], i) => (
          <div key={code} className="lp-reveal rounded-[4px] bg-[#e0e0e0]/30 p-7" style={{ transitionDelay: `${i * 80}ms` }}>
            <span className="inline-flex rounded-[3px] bg-[#000e23] px-2.5 py-1 text-xs font-medium text-white">{code}</span>
            <h3 className="mt-6 text-lg font-medium uppercase tracking-[-0.05em]">{name}</h3>
            <p className="mt-2 text-[15px] leading-snug text-black/60">{copy}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function CallToAction() {
  const ref = useReveal<HTMLElement>()
  const signedIn = !!session.token()
  return (
    <section ref={ref} className="mx-auto max-w-[1720px] px-4 pt-28 md:px-8 md:pt-40">
      <div className="lp-reveal relative overflow-hidden rounded-[6px] bg-[#000e23] px-6 py-20 text-center text-white md:py-28">
        <div className="pointer-events-none absolute -left-24 -top-32 size-[420px] rounded-full bg-primary-300/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-0 size-[480px] rounded-full bg-[#5fb7f0]/30 blur-3xl" />
        <h2 className="relative mx-auto max-w-[760px] text-[clamp(30px,3.8vw,54px)] font-medium uppercase leading-[1.05] tracking-[-0.055em]">
          See your plant&apos;s records <span className="font-serif normal-case italic tracking-[-0.03em] text-[#9cc9f5]">clearly</span>
        </h2>
        <p className="relative mx-auto mt-5 max-w-[34rem] text-[16px] leading-snug text-white/70">
          Import a year of logs or a single day. AquaInsight takes it from there.
        </p>
        <div className="relative mt-9 flex flex-wrap justify-center gap-3">
          <Link to={signedIn ? '/dashboard' : '/register'} className="inline-flex h-14 items-center gap-2 rounded-[2px] bg-white px-7 text-sm font-medium uppercase text-[#000e23] transition hover:bg-white/90">
            {signedIn ? 'Open dashboard' : 'Create an account'} <ArrowRight className="size-4" />
          </Link>
          {!signedIn && (
            <Link to="/login" className="inline-flex h-14 items-center rounded-[2px] border border-white/25 px-7 text-sm font-medium uppercase text-white transition hover:bg-white/10">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="mx-auto mt-16 max-w-[1720px] px-4 pb-10 md:px-8">
      <div className="flex flex-col gap-6 border-t border-[#000e23]/10 pt-8 md:flex-row md:items-center md:justify-between">
        <Logo />
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-grey-500">
          {NAV.map((n) => <a key={n.href} href={n.href} className="hover:text-ink">{n.label}</a>)}
        </div>
        <p className="text-sm text-grey-500">© 2026 AquaInsight</p>
      </div>
    </footer>
  )
}

export default function Landing() {
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'smooth'
    return () => { document.documentElement.style.scrollBehavior = prev }
  }, [])
  return (
    <div className="min-h-full bg-white">
      <Hero />
      <main>
        <Problem />
        <HowItWorks />
        <Product />
        <Impact />
        <CallToAction />
      </main>
      <Footer />
    </div>
  )
}
