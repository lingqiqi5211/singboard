import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import * as echarts from 'echarts/core'
import type { Connection } from '@/types'

const connections = ref<Connection[]>([])
const resolvedTheme = ref('light')
vi.mock('@/stores/connections', () => ({ useConnectionsStore: () => ({ connections, start: vi.fn() }) }))
vi.mock('@/stores/config', () => ({ useConfigStore: () => ({ resolvedTheme }) }))
import TopologyChart from './TopologyChart.vue'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()) })

describe('ECharts browser integration', () => {
  it('renders topology links and their updated connection counts', async () => {
    const connection = {
      id: '1', metadata: { sourceIP: '192.0.2.1' }, chains: ['exit', 'entry'],
      rule: 'Domain', rulePayload: 'example.com', download: 10, upload: 1,
    } as Connection
    connections.value = [connection]
    const wrapper = mount(TopologyChart, { attachTo: document.body, attrs: { style: 'width: 800px' } })
    wrappers.push(wrapper)
    const chart = echarts.getInstanceByDom(wrapper.get('[role="img"]').element as HTMLElement)!
    expect(chart).toBeDefined()
    await expect.poll(() => wrapper.find('canvas').exists()).toBe(true)
    connections.value = [connection, { ...connection, id: '2' }]
    await nextTick()
    await expect.poll(() => {
      const option = chart.getOption() as { series: { links: { originalValue: number }[] }[] }
      return option.series[0].links.map(link => link.originalValue)
    }).toEqual([2, 2, 2])
  })
})
