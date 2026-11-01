import { useMutation } from '@tanstack/react-query'
import { Droplets, Eye, EyeOff, LineChart, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api, session, type User } from '../api/client'

/** Split layout from the SmartyAir Figma sign-in screens; the image placeholder becomes a brand panel. */
function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full bg-white p-4">
      <aside className="relative hidden w-1/2 max-w-[720px] overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f3d91] via-primary-300 to-[#5fb7f0] p-10 text-white lg:flex lg:flex-col">
        <Link to="/" className="flex items-center gap-2">
          <Droplets className="size-7" />
          <span className="text-xl font-semibold">AquaInsight</span>
        </Link>
        <div className="my-auto max-w-md">
          <h2 className="text-[32px] font-medium leading-tight">Groundwater quality, understood day by day.</h2>
          <p className="mt-4 text-white/80">
            Review historical treatment records, forecast next-day outlet quality and find records that deserve a closer look.
          </p>
          <div className="mt-8 space-y-3 text-sm">
            {[
              [LineChart, 'Trends and relationships across influent, dosage and outlet'],
              [ShieldCheck, 'Next-day forecasts with an honest accuracy check'],
              [TriangleAlert, 'IQR and Isolation Forest anomaly review'],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof LineChart
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <I className="size-4 shrink-0" /> {text as string}
                </div>
              )
            })}
          </div>
        </div>
        <p className="text-xs text-white/60">© 2026 AquaInsight</p>
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-80 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -right-10 top-24 size-40 rounded-full bg-white/5" />
      </aside>
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-[350px]">
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <Droplets className="size-6 text-primary-300" />
            <span className="text-lg font-semibold">AquaInsight</span>
          </Link>
          {children}
        </div>
      </main>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-xs text-error-100">{error}</span>}
    </label>
  )
}

const inputClass = (invalid?: boolean) =>
  `w-full rounded-xl border bg-grey-25 px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-grey-500 focus:bg-white ${
    invalid ? 'border-error-100' : 'border-grey-50 focus:border-primary-200'
  }`

function PasswordInput({ value, onChange, placeholder, invalid, autoComplete }: {
  value: string; onChange: (v: string) => void; placeholder: string; invalid?: boolean; autoComplete: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${inputClass(invalid)} pr-10`}
      />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-grey-500 hover:text-ink"
        title={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

function SubmitButton({ children, pending }: { children: ReactNode; pending: boolean }) {
  return (
    <button type="submit" disabled={pending}
      className="w-full rounded-xl bg-gradient-to-b from-primary-200 to-primary-300 py-2.5 text-sm font-medium text-white shadow-sm transition hover:brightness-105 disabled:opacity-60">
      {pending ? 'Please wait…' : children}
    </button>
  )
}

const detail = (e: unknown) =>
  (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Something went wrong. Please try again.'

type AuthResponse = { token: string; user: User }

export function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const login = useMutation({
    mutationFn: () => api.post<AuthResponse>('/auth/login', { username, password }).then((r) => r.data),
    onSuccess: ({ token, user }) => {
      session.save(token, user)
      navigate('/dashboard', { replace: true })
    },
  })
  if (session.token()) return <Navigate to="/dashboard" replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate()
  }
  return (
    <AuthLayout>
      <h1 className="text-[28px] font-medium">Welcome Back!</h1>
      <p className="mt-2 text-sm text-paragraph">Sign in to review groundwater treatment records and analysis results.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Username">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username"
            autoComplete="username" className={inputClass(login.isError)} />
        </Field>
        <Field label="Password" error={login.isError ? detail(login.error) : undefined}>
          <PasswordInput value={password} onChange={setPassword} placeholder="Enter your password" invalid={login.isError}
            autoComplete="current-password" />
        </Field>
        <div className="pt-2">
          <SubmitButton pending={login.isPending}>Sign In</SubmitButton>
        </div>
      </form>
      <p className="mt-6 text-center text-sm text-grey-500">
        Don&apos;t have an account? <Link to="/register" className="font-medium text-primary-300">Sign Up</Link>
      </p>
    </AuthLayout>
  )
}

export function Register() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)

  const usernameError = touched && !/^[A-Za-z0-9_.-]{3,32}$/.test(username)
    ? '3–32 characters: letters, numbers, dot, dash or underscore.' : undefined
  const passwordError = touched && password.length < 6 ? 'At least 6 characters.' : undefined
  const confirmError = touched && confirm !== password ? 'Passwords do not match.' : undefined

  const register = useMutation({
    mutationFn: () =>
      api.post<AuthResponse>('/auth/register', { username, password, display_name: displayName || null }).then((r) => r.data),
    onSuccess: ({ token, user }) => {
      session.save(token, user)
      navigate('/dashboard', { replace: true })
    },
  })
  if (session.token()) return <Navigate to="/dashboard" replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (/^[A-Za-z0-9_.-]{3,32}$/.test(username) && password.length >= 6 && confirm === password) register.mutate()
  }
  return (
    <AuthLayout>
      <h1 className="text-[28px] font-medium">Create Account</h1>
      <p className="mt-2 text-sm text-paragraph">Choose a username and password. It only takes a minute.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Display Name (optional)">
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Wu Bingying"
            autoComplete="name" className={inputClass()} />
        </Field>
        <Field label="Username" error={usernameError ?? (register.isError ? detail(register.error) : undefined)}>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Choose a username"
            autoComplete="username" className={inputClass(!!usernameError || register.isError)} />
        </Field>
        <Field label="Create Password" error={passwordError}>
          <PasswordInput value={password} onChange={setPassword} placeholder="At least 6 characters" invalid={!!passwordError}
            autoComplete="new-password" />
        </Field>
        <Field label="Confirm Password" error={confirmError}>
          <PasswordInput value={confirm} onChange={setConfirm} placeholder="Re-enter your password" invalid={!!confirmError}
            autoComplete="new-password" />
        </Field>
        <div className="pt-2">
          <SubmitButton pending={register.isPending}>Get Started</SubmitButton>
        </div>
      </form>
      <p className="mt-6 text-center text-sm text-grey-500">
        Already have an account? <Link to="/login" className="font-medium text-primary-300">Sign In</Link>
      </p>
    </AuthLayout>
  )
}

/** Only render the app for signed-in users. */
export function RequireAuth({ children }: { children: ReactNode }) {
  if (!session.token()) return <Navigate to="/login" replace />
  return <>{children}</>
}
