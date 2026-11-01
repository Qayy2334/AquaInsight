import type { AnyModel, Meta, VariableKey } from '../api/client'

export const MODEL_LABEL: Record<AnyModel, string> = {
  linear_regression: 'Linear Regression',
  random_forest: 'Random Forest',
  persistence: 'Persistence (t+1 = t)',
  historical_mean: 'Historical Mean',
}

export const isReference = (m: AnyModel) => m === 'persistence' || m === 'historical_mean'

export const METHOD_LABEL = { iqr: 'IQR', iforest: 'Isolation Forest' } as const

// Chart palette from the Figma kit: primary blue, warning amber, success teal, a soft red, plus greys.
export const CHART_COLORS = ['#2b6be2', '#ffbe4c', '#40c4aa', '#f07a8c', '#80a6ee', '#666d80']

export function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return v.toFixed(digits)
}

export function varLabel(meta: Meta | undefined, key: VariableKey): string {
  return meta?.variables[key]?.label ?? key
}

export function varUnit(meta: Meta | undefined, key: VariableKey): string {
  return meta?.variables[key]?.unit ?? ''
}
