import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Collection from '../pages/Collection'
import * as api from '../api'
import { LiveDataContext } from '../hooks/useLiveData'

vi.mock('../api', () => ({ getCats: vi.fn(), getFollowedCats: vi.fn(), getEncounteredCatIds: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.getCats).mockResolvedValue([])
  vi.mocked(api.getFollowedCats).mockResolvedValue([])
  vi.mocked(api.getEncounteredCatIds).mockResolvedValue([])
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('survives loading to populated data and search', async () => {
  vi.mocked(api.getCats).mockResolvedValue([{ id: 1, name: '小橘' }, { id: 2, name: '小白' }])
  vi.mocked(api.getEncounteredCatIds).mockResolvedValue([2])
  render(<MemoryRouter><Collection /></MemoryRouter>)
  expect(await screen.findByText('小橘')).toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '小白' } })
  expect(screen.queryByText('小橘')).not.toBeInTheDocument()
  expect(screen.getByText('小白')).toBeInTheDocument()
  expect(screen.getByText('已相遇', { selector: 'span' })).toBeInTheDocument()
})

it('survives loading to an empty collection', async () => {
  render(<MemoryRouter><Collection /></MemoryRouter>)
  expect(await screen.findByText('还没有校园猫猫')).toBeInTheDocument()
})

it('survives a failed request without a hook-order exception', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(api.getCats).mockRejectedValue(new Error('network unavailable'))
  render(<MemoryRouter><Collection /></MemoryRouter>)
  expect(await screen.findByText('猫猫档案暂时无法加载。')).toBeInTheDocument()
  expect(screen.queryByText('还没有校园猫猫')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '重试加载图鉴数据' })).toBeEnabled()
})

it('does not label unknown encounter data as unmet or zero progress', async () => {
  vi.mocked(api.getCats).mockResolvedValue([{ id: 1, name: '小橘' }])
  vi.mocked(api.getFollowedCats).mockRejectedValue(new Error('offline'))
  vi.mocked(api.getEncounteredCatIds).mockRejectedValue(new Error('offline'))
  render(<MemoryRouter><Collection /></MemoryRouter>)
  await screen.findByText('相遇记录暂时无法加载。')
  expect(screen.getByText('小橘')).toBeVisible()
  expect(screen.getByText('相遇待确认')).toBeVisible()
  expect(screen.queryByText('未相遇', { selector: 'span' })).not.toBeInTheDocument()
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '未相遇' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '已关注' })).toBeDisabled()
  vi.mocked(api.getFollowedCats).mockResolvedValue([])
  vi.mocked(api.getEncounteredCatIds).mockResolvedValue([1])
  fireEvent.click(screen.getByRole('button', { name: '重试加载图鉴数据' }))
  await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1'))
  expect(screen.getByText('已相遇', { selector: 'span' })).toBeVisible()
})

it('clears search, announces results and resets an active filter after no match', async () => {
  vi.mocked(api.getCats).mockResolvedValue([{ id: 1, name: '小橘', location: '光华楼' }, { id: 2, name: '小白', location: '图书馆' }])
  vi.mocked(api.getEncounteredCatIds).mockResolvedValue([2])
  render(<MemoryRouter><Collection /></MemoryRouter>)
  await screen.findByText('小橘')
  const search = screen.getByRole('textbox', { name: '搜索猫名、位置或颜色' })
  fireEvent.change(search, { target: { value: '  光华楼  ' } })
  expect(screen.getByText('显示 1 / 2 只')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '清除搜索' }))
  expect(search).toHaveValue('')
  expect(search).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: '已相遇' }))
  expect(screen.getByRole('button', { name: '已相遇' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.change(search, { target: { value: '小橘' } })
  expect(screen.getByText('没有找到匹配的猫猫')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '查看全部猫猫' }))
  expect(search).toHaveValue('')
  expect(screen.getByRole('button', { name: '全部' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('显示 2 / 2 只')).toBeVisible()
})

const frame = (revision: number) => <MemoryRouter><LiveDataContext.Provider value={{ revision, event: null }}><Collection /></LiveDataContext.Provider></MemoryRouter>

it('keeps known records and filters after refresh failure, then recovers on retry', async () => {
  vi.mocked(api.getCats).mockResolvedValue([{ id: 1, name: '小橘' }])
  vi.mocked(api.getEncounteredCatIds).mockResolvedValue([1])
  const { rerender } = render(frame(0))
  await screen.findByText('小橘')
  fireEvent.click(screen.getByRole('button', { name: '已相遇' }))
  vi.mocked(api.getCats).mockRejectedValue(new Error('offline'))
  vi.mocked(api.getEncounteredCatIds).mockRejectedValue(new Error('offline'))
  rerender(frame(1))
  await screen.findByText('猫猫档案暂时无法更新，保留上次读取的内容。')
  expect(screen.getByText('小橘')).toBeVisible()
  expect(screen.getByText('已相遇', { selector: 'span' })).toBeVisible()
  expect(screen.getByRole('button', { name: '已相遇' })).toHaveAttribute('aria-pressed', 'true')
  vi.mocked(api.getCats).mockResolvedValue([{ id: 1, name: '小橘更新' }])
  vi.mocked(api.getEncounteredCatIds).mockResolvedValue([1])
  fireEvent.click(screen.getByRole('button', { name: '重试加载图鉴数据' }))
  await screen.findByText('小橘更新')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('ignores an older catalogue response after a live refresh', async () => {
  let old!: (value: unknown) => void
  vi.mocked(api.getCats).mockReturnValueOnce(new Promise(resolve => { old = resolve })).mockResolvedValueOnce([{ id: 2, name: '新档案' }])
  const { rerender } = render(frame(0))
  await waitFor(() => expect(api.getCats).toHaveBeenCalledTimes(1))
  rerender(frame(1))
  await screen.findByText('新档案')
  await act(async () => { old([{ id: 1, name: '旧档案' }]) })
  expect(screen.getByText('新档案')).toBeVisible()
  expect(screen.queryByText('旧档案')).not.toBeInTheDocument()
})
