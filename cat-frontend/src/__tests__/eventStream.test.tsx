import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ApiError, clearToken, getUserProfile, setToken } from '../api'
import { useEventStream } from '../hooks/useEventStream'

vi.mock('../api', async original => ({
  ...await original<typeof import('../api')>(), getUserProfile: vi.fn(),
}))

class FakeSource {
  static instances: FakeSource[] = []
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  close = vi.fn()
  constructor(public url: string) { FakeSource.instances.push(this) }
}
const latest = () => FakeSource.instances[FakeSource.instances.length - 1]!
const fail = async () => { await act(async () => { latest().onerror?.() }) }

beforeEach(() => {
  vi.useFakeTimers()
  FakeSource.instances = []
  vi.stubGlobal('EventSource', FakeSource)
  setToken('session-a')
  vi.mocked(getUserProfile).mockResolvedValue({ id: 1 })
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('refreshes on every successful open and ignores a replaced source', async () => {
  const onOpen = vi.fn(), onEvent = vi.fn()
  renderHook(() => useEventStream(onEvent, { onOpen }))
  const first = latest()
  act(() => first.onopen?.())
  expect(onOpen).toHaveBeenCalledTimes(1)
  await fail()
  await act(async () => { vi.advanceTimersByTime(1000) })
  act(() => {
    first.onopen?.()
    first.onmessage?.({ data: '{"type":"post_new","data":{}}' })
    latest().onopen?.()
    latest().onmessage?.({ data: '{"type":"post_new","data":{"post_id":5}}' })
  })
  expect(onOpen).toHaveBeenCalledTimes(2)
  expect(onEvent).toHaveBeenCalledExactlyOnceWith({ type: 'post_new', data: { post_id: 5 } })
})

it('continues after five failures with a capped delay and preserves a valid session on 503', async () => {
  vi.mocked(getUserProfile).mockRejectedValue(new ApiError('Unavailable', 503))
  renderHook(() => useEventStream(vi.fn()))
  for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
    await fail()
    const count = FakeSource.instances.length
    await act(async () => { vi.advanceTimersByTime(delay - 1) })
    expect(FakeSource.instances).toHaveLength(count)
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(FakeSource.instances).toHaveLength(count + 1)
  }
  expect(localStorage.getItem('token')).toBe('session-a')
})

it('stops on an explicit unauthorized response', async () => {
  vi.mocked(getUserProfile).mockRejectedValue(new ApiError('Revoked', 401))
  const onUnauthorized = vi.fn(clearToken)
  renderHook(() => useEventStream(vi.fn(), { onUnauthorized }))
  await fail()
  await act(async () => { vi.advanceTimersByTime(120000) })
  expect(onUnauthorized).toHaveBeenCalledOnce()
  expect(FakeSource.instances).toHaveLength(1)
  expect(localStorage.getItem('token')).toBeNull()
})

it('does not schedule a retry when authentication completes after unmount', async () => {
  let resolve!: (value: object) => void
  vi.mocked(getUserProfile).mockReturnValue(new Promise(done => { resolve = done }))
  const { unmount } = renderHook(() => useEventStream(vi.fn()))
  await fail()
  unmount()
  await act(async () => { resolve({ id: 1 }) })
  await act(async () => { vi.advanceTimersByTime(120000) })
  expect(FakeSource.instances).toHaveLength(1)
})

it('cancels a scheduled retry and detaches an old token on session change', async () => {
  const onEvent = vi.fn()
  const { rerender, unmount } = renderHook(() => useEventStream(onEvent))
  const old = latest()
  await fail()
  setToken('session-b')
  rerender()
  expect(latest().url).toContain('token=session-b')
  act(() => old.onmessage?.({ data: '{"type":"post_new","data":{}}' }))
  expect(onEvent).not.toHaveBeenCalled()
  unmount()
  await act(async () => { vi.advanceTimersByTime(120000) })
  expect(FakeSource.instances).toHaveLength(2)
})

it('closes while offline and reconnects immediately when the browser comes online', async () => {
  const online = vi.spyOn(navigator, 'onLine', 'get')
  renderHook(() => useEventStream(vi.fn()))
  online.mockReturnValue(false)
  act(() => window.dispatchEvent(new Event('offline')))
  await act(async () => { vi.advanceTimersByTime(60000) })
  expect(latest().close).toHaveBeenCalledOnce()
  expect(FakeSource.instances).toHaveLength(1)
  online.mockReturnValue(true)
  act(() => window.dispatchEvent(new Event('online')))
  expect(FakeSource.instances).toHaveLength(2)
})
