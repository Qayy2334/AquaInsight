import type { EChartsOption } from 'echarts'
import ReactECharts from 'echarts-for-react'
import { CHART_COLORS } from '../lib/format'

// Shared look matching the Figma kit: light grid lines, grey axis labels, white rounded tooltip.
const base: EChartsOption = {
  color: CHART_COLORS,
  textStyle: { fontFamily: 'Inter, sans-serif', color: '#666d80' },
  grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#fff',
    borderColor: '#eceff3',
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: '#0d0d12', fontSize: 12 },
    extraCssText: 'border-radius:10px;box-shadow:0 8px 24px -4px rgba(16,24,40,.12);',
  },
  legend: { bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: '#0d0d12', fontSize: 12 } },
}

const axisDefaults = {
  axisLine: { show: false },
  axisTick: { show: false },
  splitLine: { lineStyle: { color: '#eceff3' } },
  axisLabel: { color: '#666d80', fontSize: 11 },
}

function withAxisDefaults(axis: unknown) {
  if (!axis) return axis
  const apply = (a: object) => ({ ...axisDefaults, ...a })
  return Array.isArray(axis) ? axis.map(apply) : apply(axis as object)
}

export default function Chart({ option, height = 300 }: { option: EChartsOption; height?: number }) {
  const merged: EChartsOption = {
    ...base,
    ...option,
    tooltip: option.tooltip === undefined ? base.tooltip : { ...(base.tooltip as object), ...(option.tooltip as object) },
    legend: option.legend === undefined ? undefined : { ...(base.legend as object), ...(option.legend as object) },
    grid: { ...(base.grid as object), ...(option.grid as object) },
    xAxis: withAxisDefaults(option.xAxis) as EChartsOption['xAxis'],
    yAxis: withAxisDefaults(option.yAxis) as EChartsOption['yAxis'],
  }
  return <ReactECharts option={merged} style={{ height }} notMerge lazyUpdate />
}
