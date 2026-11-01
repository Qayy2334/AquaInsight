import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

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

export type WaterRecord = { date: string } & Record<VariableKey, number | null>

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
  non_numeric_values?: Record<VariableKey, number>
  corrections?: { date: string; variable: VariableKey; raw: string; value: number }[]
  column_mapping?: Record<string, string>
  unmapped_columns?: string[]
  missing_columns?: string[]
}

export interface Dataset {
  id: number
  name: string
  source: 'upload' | 'demo'
  row_count: number
  created_at: string | null
  quality_report: QualityReport | null
  warnings?: string[]
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
  dataset: Pick<Dataset, 'id' | 'name' | 'source' | 'row_count'>
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
  datasets: () => get<Dataset[]>('/datasets'),
  day: (date: string) => get<DayView>('/dashboard/day', { date }),
}

export const EXPORTS = {
  records: '/api/export/records.csv',
  evaluation: '/api/export/evaluation.csv',
  predictions: '/api/export/predictions.csv',
  anomalies: '/api/export/anomalies.csv',
}
