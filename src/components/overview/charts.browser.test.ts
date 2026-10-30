import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import * as echarts from 'echarts/core'
import type { Connection } from '@/types'

const connections = ref<Connection[]>([])
const resolvedTheme = ref('light')
vi.mock('@/stores/connections', () => ({ useConnectionsStore: () => ({ connections, start: vi.fn() }) }))
vi.mock('@/stores/config', () => ({ useConfigStore: () => ({ resolvedTheme }) }))
import SparkLine from './SparkLine.vue'
import TopologyChart from './TopologyChart.vue'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })

describe('ECharts browser integration', () => {
  it('renders and updates the speed chart with ECharts 6', async () => {
    const wrapper = mount(SparkLine, {
      attachTo: document.body,
      attrs: { style: 'width: 600px; height: 200px' },
      props: { data: [{ name: 1, value: 10 }], color: '#0088ff', labelFormatter: String },
    })
    wrappers.push(wrapper)
    const chart = echarts.getInstanceByDom(wrapper.element as HTMLElement)!
    expect(chart).toBeDefined()
    expect(wrapper.find('canvas').exists()).toBe(true)
    expect(chart.getWidth()).toBe(600)
    await wrapper.setProps({ data: [{ name: 1, value: 10 }, { name: 2, value: 25 }] })
    const option = chart.getOption() as { series: { data: { value: number }[] }[] }
    expect(option.series[0].data.map(point => point.value)).toEqual([10, 25])
  })

  it('renders topology links and their updated connection counts', async () => {
    const connection = {
      id: '1', metadata: { sourceIP: '192.0.2.1' }, chains: ['exit', 'entry'],
      rule: 'Domain', rulePayload: 'example.com', download: 10, upload: 1,
    } as Connection
    connections.value = [connection]
    const wrapper = mount(TopologyChart, { attachTo: document.body, attrs: { style: 'width: 800px' } })
    wrappers.push(wrapper)
    const chart = echarts.getInstanceByDom(wrapper.get('.h-80').element as HTMLElement)!
    expect(chart).toBeDefined()
    expect(wrapper.find('canvas').exists()).toBe(true)
    connections.value = [connection, { ...connection, id: '2' }]
    await nextTick()
    const option = chart.getOption() as { series: { links: { originalValue: number }[] }[] }
    expect(option.series[0].links.map(link => link.originalValue)).toEqual([2, 2, 2])
  })
})
