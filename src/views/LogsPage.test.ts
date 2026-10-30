import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import type { LogEntry } from '@/types'

const logs = ref<LogEntry[]>([])
const filterText = ref('')
const filteredLogs = computed(() => logs.value.filter(log => log.payload.includes(filterText.value)))
vi.mock('@/stores/logs', () => ({
  useLogsStore: () => ({
    filteredLogs, filterText, logLevel: ref('info'), paused: ref(false),
    clear: () => { logs.value = [] }, changeLevel: vi.fn(),
  }),
}))
import LogsPage from './LogsPage.vue'

beforeEach(() => { logs.value = []; filterText.value = '' })

describe('log auto-scroll', () => {
  it('scrolls after append and cap rollover, but respects manual scrolling', async () => {
    logs.value = Array.from({ length: 5000 }, (_, i) => ({ type: 'info', payload: 'entry', seq: i + 1 }))
    const wrapper = mount(LogsPage)
    const container = wrapper.get('.card-scroll').element as HTMLElement
    Object.defineProperties(container, { scrollHeight: { value: 10000 }, clientHeight: { value: 400 } })
    logs.value = [...logs.value.slice(1), { type: 'info', payload: 'new', seq: 5001 }]
    await nextTick()
    expect(container.scrollTop).toBe(10000)
    container.scrollTop = 100
    await wrapper.get('.card-scroll').trigger('scroll')
    logs.value.push({ type: 'info', payload: 'next', seq: 5002 })
    await nextTick()
    expect(container.scrollTop).toBe(100)
    expect(wrapper.text()).toContain('跳转到底部')
    wrapper.unmount()
  })

  it('scrolls when the last matching entry changes with the same match count, and when cleared', async () => {
    logs.value = [{ type: 'info', payload: 'alpha', seq: 1 }, { type: 'info', payload: 'beta', seq: 2 }]
    filterText.value = 'alpha'
    const wrapper = mount(LogsPage)
    const container = wrapper.get('.card-scroll').element as HTMLElement
    Object.defineProperty(container, 'scrollHeight', { get: () => logs.value.length ? 200 : 0 })
    filterText.value = 'beta'
    await nextTick()
    expect(container.scrollTop).toBe(200)
    expect(wrapper.text()).toContain('beta')
    logs.value = []
    await nextTick()
    expect(container.scrollTop).toBe(0)
    expect(wrapper.text()).toContain('暂无日志')
    wrapper.unmount()
  })
})
