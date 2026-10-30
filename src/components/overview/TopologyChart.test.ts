import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Connection } from '@/types'

const chart = vi.hoisted(() => ({
  setOption: vi.fn(), clear: vi.fn(), resize: vi.fn(), dispose: vi.fn(), on: vi.fn(),
}))
vi.mock('echarts/core', () => ({ use: vi.fn(), init: () => chart }))
vi.mock('echarts/charts', () => ({ SankeyChart: {} }))
vi.mock('echarts/components', () => ({ TooltipComponent: {} }))
vi.mock('echarts/renderers', () => ({ CanvasRenderer: {} }))
const connections = ref<Connection[]>([])
const resolvedTheme = ref('light')
vi.mock('@/stores/connections', () => ({ useConnectionsStore: () => ({ connections, start: vi.fn() }) }))
vi.mock('@/stores/config', () => ({ useConfigStore: () => ({ resolvedTheme }) }))
import TopologyChart from './TopologyChart.vue'

function connection(id: number, overrides: Partial<Connection> = {}): Connection {
  return {
    id: String(id), metadata: { sourceIP: '192.0.2.1' } as Connection['metadata'],
    chains: ['exit', 'entry'], rule: 'Domain', rulePayload: 'example.com',
    upload: 0, download: 0, uploadSpeed: 0, downloadSpeed: 0,
    start: '2026-10-01T00:00:00Z', ...overrides,
  }
}

function latestGraph() {
  return chart.setOption.mock.lastCall![0].series[0] as {
    data: { name: string }[]; links: { originalValue: number }[]
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  connections.value = []
  resolvedTheme.value = 'light'
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
})
afterEach(() => vi.unstubAllGlobals())

describe('connection topology', () => {
  it('skips 59 traffic-only updates for 5000 connections, including reordered snapshots', async () => {
    connections.value = Array.from({ length: 5000 }, (_, i) => connection(i))
    const wrapper = mount(TopologyChart)
    expect(latestGraph().links.map(link => link.originalValue)).toEqual([5000, 5000, 5000])
    const started = performance.now()
    for (let frame = 1; frame < 60; frame++) {
      connections.value = Array.from({ length: 5000 }, (_, i) => connection(4999 - i, {
        download: frame * 100, upload: frame * 10,
      }))
      await nextTick()
    }
    console.info('5000 connections × 59 traffic snapshots:', (performance.now() - started).toFixed(1), 'ms; chart submissions:', chart.setOption.mock.calls.length)
    expect(chart.setOption).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  }, 20000)

  it('updates endpoint labels and counts, refreshes themes, and catches up after pause', async () => {
    connections.value = [connection(1), connection(2)]
    const wrapper = mount(TopologyChart)
    connections.value = [connection(1, {
      metadata: { sourceIP: '192.0.2.2' } as Connection['metadata'],
      rulePayload: 'changed.example', chains: ['new-exit'],
    })]
    await nextTick()
    expect(latestGraph().data.map(node => node.name)).toEqual(['192.0.2.2', 'Domain: changed.example', 'new-exit'])
    expect(latestGraph().links.map(link => link.originalValue)).toEqual([1, 1])
    resolvedTheme.value = 'dark'
    await nextTick()
    expect(chart.setOption).toHaveBeenCalledTimes(3)
    await wrapper.get('button').trigger('click')
    connections.value = [connection(3)]
    await nextTick()
    expect(chart.setOption).toHaveBeenCalledTimes(3)
    await wrapper.get('button').trigger('click')
    expect(chart.setOption).toHaveBeenCalledTimes(4)
    expect(latestGraph().data.map(node => node.name)).toContain('Domain: example.com')
    connections.value = []
    await nextTick()
    expect(chart.clear).toHaveBeenCalledOnce()
    wrapper.unmount()
    expect(chart.dispose).toHaveBeenCalledOnce()
  })

  it('distinguishes tuples with delimiters and ignores connections without an exit', async () => {
    connections.value = [
      connection(1, { rule: 'a|b', rulePayload: '', chains: ['c'] }),
      connection(2, { rule: 'a', rulePayload: '', chains: ['b|c'] }),
      connection(3, { chains: [] }),
    ]
    const wrapper = mount(TopologyChart)
    expect(latestGraph().data.map(node => node.name)).toEqual(['192.0.2.1', 'a', 'a|b', 'b|c', 'c'])
    expect(latestGraph().links.map(link => link.originalValue)).toEqual([1, 1, 1, 1])
    wrapper.unmount()
  })
})
