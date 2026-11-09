import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Home from '../pages/Home'
import * as api from '../api'
import { LiveDataContext } from '../hooks/useLiveData'

vi.mock('../api', () => ({ getCats: vi.fn(), getSightings: vi.fn(), getPostsPage: vi.fn(), getUserProfile: vi.fn(), getWeeklyReport: vi.fn(), getMyStats: vi.fn() }))
vi.mock('../components/DailyQuestCard', () => ({ default: () => <div>每日任务内容</div> }))
vi.mock('../components/CatGachaCard', () => ({ default: () => <div>今日猫缘内容</div> }))
vi.mock('../components/Avatar', () => ({ default: () => null }))
vi.mock('../components/Onboarding', () => ({ getPrefs: () => null }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.getCats).mockResolvedValue([{ id: 1, name: '皮球', avatar: '/皮球.jpg', location: '光华楼' }])
  vi.mocked(api.getSightings).mockResolvedValue([])
  vi.mocked(api.getPostsPage).mockResolvedValue({ items: [{ id: 2, content: '今天遇见皮球', user: { nickname: '猫友' } }], total: 1, has_more: false })
  vi.mocked(api.getUserProfile).mockResolvedValue({ nickname: '同学' })
  vi.mocked(api.getWeeklyReport).mockResolvedValue({ total_sightings: 2, unique_cats: 1 })
  vi.mocked(api.getMyStats).mockResolvedValue({ streak: 3 })
})
afterEach(cleanup)
const frame = (revision = 0) => <MemoryRouter><LiveDataContext.Provider value={{ revision, event: null }}><Home /></LiveDataContext.Provider></MemoryRouter>

it('keeps browsing and the primary scan action available when another source fails', async () => {
  vi.mocked(api.getSightings).mockRejectedValue(new Error('offline'))
  render(frame())
  await screen.findByText('最近偶遇暂时无法加载。')
  expect(screen.getByRole('button', { name: '查看皮球的档案' })).toBeVisible()
  expect(screen.getByText('今天遇见皮球')).toBeVisible()
  expect(screen.getAllByRole('button', { name: '拍照识猫' })).toHaveLength(1)
  expect(screen.queryByText('附近猫猫')).not.toBeInTheDocument()
  expect(screen.queryByText('每日任务内容')).not.toBeInTheDocument()
  const details = screen.getByText('今日任务与猫缘签').closest('details')!
  details.open = true
  fireEvent(details, new Event('toggle'))
  expect(screen.getByText('每日任务内容')).toBeVisible()
})

it('distinguishes a failed catalogue request from empty data and recovers with retry', async () => {
  vi.mocked(api.getCats).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([{ id: 3, name: '小橘' }])
  render(frame())
  await screen.findByText('猫猫档案暂时无法加载。')
  expect(screen.queryByText(/还没有校园猫猫档案/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '重试加载猫猫档案' }))
  await screen.findByRole('button', { name: '查看小橘的档案' })
  expect(screen.queryByText('猫猫档案暂时无法加载。')).not.toBeInTheDocument()
})

it('retains previous photos and posts during a refresh failure', async () => {
  const { rerender } = render(frame())
  await screen.findByText('皮球')
  await screen.findByText('今天遇见皮球')
  vi.mocked(api.getCats).mockRejectedValue(new Error('offline'))
  vi.mocked(api.getPostsPage).mockRejectedValue(new Error('offline'))
  rerender(frame(1))
  await screen.findByText('猫猫档案暂时无法更新。下方保留上次读取的内容。')
  expect(screen.getByText('皮球')).toBeVisible()
  expect(screen.getByText('今天遇见皮球')).toBeVisible()
})

it('keeps a later refresh when the initial photo request finishes last', async () => {
  let resolveOld!: (value: unknown) => void
  vi.mocked(api.getCats).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve })).mockResolvedValueOnce([{ id: 3, name: '新照片档案' }])
  const { rerender } = render(frame())
  expect(screen.getByText('正在加载猫猫档案…')).toBeVisible()
  await waitFor(() => expect(api.getCats).toHaveBeenCalledTimes(1))
  rerender(frame(1))
  await screen.findByText('新照片档案')
  await act(async () => { resolveOld([{ id: 1, name: '旧照片档案' }]) })
  expect(screen.getByText('新照片档案')).toBeVisible()
  expect(screen.queryByText('旧照片档案')).not.toBeInTheDocument()
})

it('does not invent zero weekly totals when optional personal sources fail', async () => {
  vi.mocked(api.getWeeklyReport).mockRejectedValue(new Error('offline'))
  vi.mocked(api.getMyStats).mockRejectedValue(new Error('offline'))
  render(frame())
  await screen.findByText('皮球')
  const details = screen.getByText('今日任务与猫缘签').closest('details')!
  details.open = true
  fireEvent(details, new Event('toggle'))
  await screen.findByText('本周记录暂时无法加载。')
  expect(screen.getByText('查看本周记录')).toBeVisible()
  expect(screen.queryByText(/本周 0 次偶遇/)).not.toBeInTheDocument()
  expect(screen.queryByTitle('连续 0 天')).not.toBeInTheDocument()
})
