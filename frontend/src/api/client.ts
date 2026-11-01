import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

const TOKEN_KEY = 'aquainsight_token'
const USER_KEY = 'aquainsight_user'

export interface User {
  id: number
  username: string
  display_name: string
}

export const session = {
  token: () => localStorage.getItem(TOKEN_KEY),
  user: (): User | null => {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  },
  save: (token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
}

api.interceptors.request.use((config) => {
  const token = session.token()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// An expired or invalid token on any data request sends the user back to sign in.
api.interceptors.response.use(undefined, (error) => {
  const url: string = error.config?.url ?? ''
  if (error.response?.status === 401 && !url.startsWith('/auth/')) {
    session.clear()
    if (!location.pathname.startsWith('/login')) location.assign('/login')
  }
  return Promise.reject(error)
})

/** Download a CSV through the authenticated API (plain links cannot send the token). */
export async function downloadFile(path: string, filename: string) {
  const res = await api.get(path.replace(/^\/api/, ''), { responseType: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(res.data)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export type VariableKey =
  | 'influent_turbidity'
  | 'influent_ph'
  | 'naocl_dosage'
  | 'outlet_turbidity'
  | 'outlet_ph'
  | 'outlet_free_chlorine'

export type TargetKey = 'outlet_turbidity' | 'outlet_ph' | 'outlet_free_chlorine'
export type ModelType = 'linear_regression' | 'random_forest'
export type ReferenceType = 'persistence' | 'historical_mean'
export type AnyModel = ModelType | ReferenceType
export type Method = 'iqr' | 'iforest'

export interface VariableMeta {
  label: string
  unit: string
  stage: 'influent' | 'treatment' | 'outlet'
}

export interface Meta {
  variables: Record<VariableKey, VariableMeta>
  targets: TargetKey[]
  reference_ranges: Partial<Record<VariableKey, { min?: number; max?: number; note: string }>>
}

export type WaterRecord = { date: string; source?: string; updated_at?: string | null } & Record<VariableKey, number | null>

export interface QualityReport {
  rows: number
  start_date: string
  end_date: string
  missing_days: number
  missing_values: Record<VariableKey, number>
  completeness: number
  rows_in?: number
  invalid_dates_dropped?: number
  duplicate_dates_dropped?: number
  duplicate_dates?: string[]
  non_numeric_values?: Record<VariableKey, number>
  corrections?: { date: string; variable: VariableKey; raw: string; value: number }[]
  column_mapping?: Record<string, string>
  unmapped_columns?: string[]
  missing_columns?: string[]
}

export interface StoreSummary {
  name: string
  rows: number
  quality: QualityReport | null
}

export type DayValues = Record<VariableKey, number | null>

export interface UploadPreview {
  filename: string
  file_report: QualityReport
  new: { date: string; values: DayValues }[]
  conflicts: { date: string; old: DayValues; new: DayValues; changed: VariableKey[] }[]
  identical: string[]
}

export interface UploadResult {
  id: number
  filename: string
  added: number
  updated: number
  skipped: number
  file_report: QualityReport
  warnings: string[]
}

export interface UploadLog {
  id: number
  filename: string
  added: number
  updated: number
  skipped: number
  created_at: string | null
}

export interface RecordChange {
  action: 'create' | 'update' | 'delete'
  source: string
  old: DayValues | null
  new: DayValues | null
  at: string | null
}

export interface Contributor {
  variable: VariableKey
  value: number
  z?: number
  lower?: number
  upper?: number
  direction?: 'low' | 'high'
  excess?: number
}

export interface Overview {
  dataset: { id: number; name: string; source: string; row_count: number }
  latest_date: string
  kpis: Record<VariableKey, { latest: number | null; avg_7d: number | null; avg_all: number }>
  quality: QualityReport
  anomaly_counts: Record<Method, number>
  recent_anomalies: { date: string; method: Method; score: number; contributors: Contributor[] }[]
}

export interface Stat {
  variable: VariableKey
  count: number
  missing: number
  mean: number
  std: number
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

export interface CvSummary {
  n_splits: number
  mae_mean: number
  mae_std: number
  rmse_mean: number
  rmse_std: number
  folds: { train_size: number; test_size: number; test_start: string; mae: number; rmse: number }[]
}

export interface ModelRun {
  id: number
  model_type: AnyModel
  target: TargetKey
  mae: number
  rmse: number
  r2: number
  train_size: number
  test_size: number
  feature_importance: Record<VariableKey, number> | null
  cv: CvSummary | null
  created_at: string | null
}

export interface PredictionRows {
  target: TargetKey
  rows: ({ date: string; actual: number } & Partial<Record<AnyModel, number>>)[]
  runs: ModelRun[]
}

export interface Forecast {
  recommended_model: ModelType
  value: number
  error: number | null
  current: number
  reliability: 'usable' | 'limited'
  mean_cv_mae: number | null
  models: Partial<Record<ModelType, { value: number; test_mae: number; cv_mae: number | null }>>
}

export interface NextDay {
  based_on: string
  for_date: string
  forecasts: Partial<Record<TargetKey, Forecast>>
}

export interface AnomalyItem {
  date: string
  methods: Method[]
  details: Partial<Record<Method, { score: number; contributors: Contributor[] }>>
}

export interface AnomalyList {
  items: AnomalyItem[]
  params: { iqr_k: number; contamination: number } | null
  iqr_bounds: Record<VariableKey, [number, number]>
}

export interface DayVariable {
  value: number | null
  median: number
  min: number
  max: number
  q1: number
  q3: number
  lower: number
  upper: number
  percentile: number | null
  status: 'low' | 'normal' | 'high' | null
}

export interface DayView {
  date: string
  prev_date: string | null
  next_date: string | null
  iqr_k: number
  variables: Record<VariableKey, DayVariable>
  anomaly: Partial<Record<Method, { score: number; contributors: Contributor[] }>> | null
  predictions: Partial<Record<TargetKey, { actual: number } & Partial<Record<AnyModel, number>>>>
  neighbours: WaterRecord[]
}

const get = <T,>(url: string, params?: object) => api.get<T>(url, { params }).then((r) => r.data)

export const fetchers = {
  meta: () => get<Meta>('/meta'),
  overview: () => get<Overview>('/overview'),
  records: (start?: string, end?: string) => get<WaterRecord[]>('/records', { start, end }),
  stats: () => get<Stat[]>('/eda/stats'),
  histogram: (variable: VariableKey, bins = 20) =>
    get<{ counts: number[]; edges: number[] }>('/eda/histogram', { variable, bins }),
  correlation: (method: 'pearson' | 'spearman') =>
    get<{ variables: VariableKey[]; matrix: number[][] }>('/eda/correlation', { method }),
  scatter: (x: VariableKey, y: VariableKey) =>
    get<{ points: [number, number, string][]; trend: { slope: number; intercept: number } }>('/eda/scatter', { x, y }),
  runs: () => get<ModelRun[]>('/models/runs'),
  predictions: (target: TargetKey) => get<PredictionRows>('/models/predictions', { target }),
  nextDay: () => get<NextDay>('/models/next-day'),
  anomalies: () => get<AnomalyList>('/anomalies'),
  storeSummary: () => get<StoreSummary>('/records/summary'),
  uploads: () => get<UploadLog[]>('/uploads'),
  history: (date: string) => get<RecordChange[]>(`/records/${date}/history`),
  day: (date: string) => get<DayView>('/dashboard/day', { date }),
}

export const EXPORTS = {
  records: { path: '/export/records.csv', file: 'cleaned_records.csv' },
  evaluation: { path: '/export/evaluation.csv', file: 'model_evaluation.csv' },
  predictions: { path: '/export/predictions.csv', file: 'test_predictions.csv' },
  anomalies: { path: '/export/anomalies.csv', file: 'anomalies.csv' },
}
