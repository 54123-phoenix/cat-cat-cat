import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import CatDetail from '../pages/CatDetail'
import * as api from '../api'
import { LiveDataContext } from '../hooks/useLiveData'

vi.mock('../api', () => ({ getCat: vi.fn(), getSightings: vi.fn(), getHealthRecords: vi.fn(), checkFollow: vi.fn(), followCat: vi.fn(), unfollowCat: vi.fn(), createSighting: vi.fn() }))
vi.mock('../components/ContributionTitles', () => ({ default: () => <span>贡献头衔</span> }))
vi.mock('../components/CatDeskToken', () => ({ default: () => <span>猫猫纪念</span> }))
vi.mock('../components/SharePoster', () => ({ default: ({ children }) => children }))
vi.mock('../components/CatIdentityCard', () => ({ default: ({ sightingCount }) => <div role="dialog" aria-label="猫猫身份卡">{sightingCount === undefined ? '偶遇数量待确认' : `已加载偶遇 ${sightingCount} 条`}</div> }))
vi.mock('../components/PhotoViewer', () => ({ default: ({ initialIndex }) => <div role="dialog" aria-label="照片浏览">第 {initialIndex + 1} 张照片</div> }))

const cat = { id: 1, name: '皮球', avatar: '/皮球.jpg', location: '光华楼', story: '喜欢在草地晒太阳。', images: [{ id: 1, image_path: '/皮球-1.jpg' }, { id: 2, image_path: '/皮球-2.jpg' }] }
const sighting = { id: 1, cat_id: 1, location: '草坪', created_at: '2026-11-01T09:20:00', note: '正在晒太阳' }
const healthRecord = { id: 1, record_type: 'vaccine', title: '完成疫苗接种', record_date: '2026-10-01' }
function deferred<T = unknown>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise })
  return { promise, resolve, reject }
}
function Navigation() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate('/cats/2')}>查看另一只猫</button>
}
const frame = (revision = 0) => <MemoryRouter initialEntries={['/cats/1']}><LiveDataContext.Provider value={{ revision, event: null }}><Navigation /><Routes><Route path="/cats/:catId" element={<CatDetail />} /><Route path="/scan" element={<h1>拍照记录流程</h1>} /></Routes></LiveDataContext.Provider></MemoryRouter>
function openDetails(label: string) {
  const details = screen.getByText(label, { selector: 'summary' }).closest('details')!
  details.open = true
  fireEvent(details, new Event('toggle'))
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.getCat).mockResolvedValue(cat)
  vi.mocked(api.getSightings).mockResolvedValue([sighting])
  vi.mocked(api.getHealthRecords).mockResolvedValue([healthRecord])
  vi.mocked(api.checkFollow).mockResolvedValue({ following: false })
  vi.mocked(api.followCat).mockResolvedValue({})
  vi.mocked(api.unfollowCat).mockResolvedValue({})
})
afterEach(cleanup)

it('shows the archive while secondary sources are pending and retries only the failed source', async () => {
  const sightings = deferred<any[]>()
  const health = deferred()
  vi.mocked(api.getSightings).mockReturnValue(sightings.promise)
  vi.mocked(api.getHealthRecords).mockReturnValueOnce(health.promise)
  vi.mocked(api.checkFollow).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ following: true })
  render(frame())
  expect(await screen.findByRole('heading', { name: '皮球', level: 1 })).toBeVisible()
  expect(screen.getByText('喜欢在草地晒太阳。')).toBeVisible()
  expect(screen.getByText('正在加载偶遇记录…')).toBeVisible()
  expect(screen.getByText('正在加载健康记录…')).toBeVisible()
  expect(screen.queryByText(/还没有公开偶遇记录/)).not.toBeInTheDocument()
  await screen.findByText('关注状态暂时无法加载。')
  const unknownFollow = screen.getByRole('button', { name: '关注状态待确认' })
  expect(unknownFollow).toBeDisabled()
  expect(unknownFollow).not.toHaveAttribute('aria-pressed')
  fireEvent.click(screen.getByRole('button', { name: '重试加载关注状态' }))
  await screen.findByRole('button', { name: '取消关注' })
  expect(api.getCat).toHaveBeenCalledTimes(1)
  expect(api.getSightings).toHaveBeenCalledTimes(1)
  expect(api.getSightings).toHaveBeenCalledWith({ cat_id: '1', limit: 100 })
  expect(api.getHealthRecords).toHaveBeenCalledTimes(1)
  await act(async () => { health.reject(new Error('offline')) })
  await screen.findByText('健康记录暂时无法加载。')
  expect(screen.queryByText(/暂未录入公开健康记录/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '重试加载健康记录' }))
  await screen.findByText('查看 1 条健康记录')
  expect(api.getHealthRecords).toHaveBeenCalledTimes(2)
  expect(api.getSightings).toHaveBeenCalledTimes(1)
})

it('distinguishes unknown sightings from zero and leaves identity counts unknown', async () => {
  vi.mocked(api.getSightings).mockRejectedValue(new Error('offline'))
  render(frame())
  await screen.findByText('偶遇记录暂时无法加载。')
  expect(screen.queryByText(/已加载最近 0 条/)).not.toBeInTheDocument()
  expect(screen.queryByText(/还没有公开偶遇记录/)).not.toBeInTheDocument()
  expect(screen.queryByText('已加载偶遇的时段分布')).not.toBeInTheDocument()
  openDetails('身份卡与猫猫纪念')
  fireEvent.click(screen.getByRole('button', { name: '打开猫猫身份卡' }))
  expect(screen.getByRole('dialog', { name: '猫猫身份卡' })).toHaveTextContent('偶遇数量待确认')
  vi.mocked(api.getSightings).mockResolvedValue([])
  fireEvent.click(screen.getByRole('button', { name: '重试加载偶遇记录' }))
  await screen.findByText(/还没有公开偶遇记录/)
  expect(api.getCat).toHaveBeenCalledTimes(1)
  expect(api.checkFollow).toHaveBeenCalledTimes(1)
})

it('retries the main archive without reloading the page or other sources', async () => {
  vi.mocked(api.getCat).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(cat)
  render(frame())
  await screen.findByText('猫猫档案暂时无法加载')
  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  await screen.findByRole('heading', { name: '皮球' })
  expect(screen.getByText('正在晒太阳')).toBeVisible()
  expect(api.getCat).toHaveBeenCalledTimes(2)
  expect(api.getSightings).toHaveBeenCalledTimes(1)
  expect(api.getHealthRecords).toHaveBeenCalledTimes(1)
})

it('keeps successfully loaded data on refresh failure and ignores older responses', async () => {
  const old = deferred()
  vi.mocked(api.getCat).mockReturnValueOnce(old.promise).mockResolvedValueOnce(cat)
  const { rerender } = render(frame())
  await waitFor(() => expect(api.getCat).toHaveBeenCalledTimes(1))
  rerender(frame(1))
  await screen.findByRole('heading', { name: '皮球' })
  await act(async () => { old.resolve({ ...cat, name: '旧档案' }) })
  expect(screen.queryByRole('heading', { name: '旧档案' })).not.toBeInTheDocument()
  vi.mocked(api.getCat).mockRejectedValue(new Error('offline'))
  vi.mocked(api.getSightings).mockRejectedValue(new Error('offline'))
  vi.mocked(api.getHealthRecords).mockRejectedValue(new Error('offline'))
  vi.mocked(api.checkFollow).mockRejectedValue(new Error('offline'))
  rerender(frame(2))
  await screen.findByText('猫猫档案暂时无法更新，保留上次读取的内容。')
  expect(screen.getByRole('heading', { name: '皮球' })).toBeVisible()
  expect(screen.getByText('正在晒太阳')).toBeVisible()
  expect(screen.getByText('查看 1 条健康记录')).toBeVisible()
  expect(screen.getByRole('button', { name: '关注猫猫' })).toBeEnabled()
})

it.each([false, true])('prevents duplicate follow writes and exposes a retry when following=%s', async following => {
  vi.mocked(api.checkFollow).mockResolvedValue({ following })
  const mutation = deferred()
  const method = following ? api.unfollowCat : api.followCat
  vi.mocked(method).mockReturnValueOnce(mutation.promise).mockResolvedValueOnce({})
  render(frame())
  const button = await screen.findByRole('button', { name: following ? '取消关注' : '关注猫猫' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(method).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: '正在保存…' })).toBeDisabled()
  expect(button).toHaveAttribute('aria-pressed', String(following))
  await act(async () => { mutation.reject(new Error('offline')) })
  await screen.findByText('无法确认关注结果，请先确认状态再重试。')
  expect(screen.getByRole('button', { name: '关注结果待确认' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '关注结果待确认' })).not.toHaveAttribute('aria-pressed')
  fireEvent.click(screen.getByRole('button', { name: '确认状态并重试' }))
  await screen.findByText(following ? '已取消关注。' : '已关注这只猫猫。')
  expect(method).toHaveBeenCalledTimes(2)
  expect(api.checkFollow).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button', { name: following ? '关注猫猫' : '取消关注' })).toHaveAttribute('aria-pressed', String(!following))
})

it('reconciles a committed follow with a lost response without a duplicate or opposite write', async () => {
  vi.mocked(api.followCat).mockRejectedValueOnce(new Error('response lost after commit'))
  vi.mocked(api.checkFollow).mockResolvedValueOnce({ following: false })
    .mockRejectedValueOnce(new Error('status still offline'))
    .mockResolvedValueOnce({ following: true })
  render(frame())
  fireEvent.click(await screen.findByRole('button', { name: '关注猫猫' }))
  await screen.findByText('无法确认关注结果，请先确认状态再重试。')
  fireEvent.click(screen.getByRole('button', { name: '确认状态并重试' }))
  await screen.findByText('无法确认关注结果，请先确认状态再重试。')
  expect(screen.getByRole('button', { name: '关注结果待确认' })).toBeDisabled()
  expect(api.followCat).toHaveBeenCalledTimes(1)
  expect(api.unfollowCat).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '确认状态并重试' }))
  await screen.findByText('已关注这只猫猫。')
  expect(screen.getByRole('button', { name: '取消关注' })).toHaveAttribute('aria-pressed', 'true')
  expect(api.followCat).toHaveBeenCalledTimes(1)
  expect(api.unfollowCat).not.toHaveBeenCalled()
  expect(api.checkFollow).toHaveBeenCalledTimes(3)
})

it('does not let an older follow read overwrite a successful write', async () => {
  const oldRead = deferred()
  vi.mocked(api.checkFollow).mockResolvedValueOnce({ following: false }).mockReturnValueOnce(oldRead.promise)
  const { rerender } = render(frame())
  await screen.findByRole('button', { name: '关注猫猫' })
  rerender(frame(1))
  await waitFor(() => expect(api.checkFollow).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: '关注猫猫' }))
  await screen.findByRole('button', { name: '取消关注' })
  await act(async () => { oldRead.resolve({ following: false }) })
  expect(screen.getByRole('button', { name: '取消关注' })).toHaveAttribute('aria-pressed', 'true')
})

it('resets route state and ignores an old follow write after changing cats', async () => {
  const write = deferred()
  const nextCat = deferred()
  vi.mocked(api.followCat).mockReturnValueOnce(write.promise)
  vi.mocked(api.getCat).mockResolvedValueOnce(cat).mockReturnValueOnce(nextCat.promise)
  const { container } = render(frame())
  fireEvent.click(await screen.findByRole('button', { name: '关注猫猫' }))
  fireEvent.click(screen.getByRole('button', { name: '查看另一只猫' }))
  expect(screen.queryByRole('heading', { name: '皮球' })).not.toBeInTheDocument()
  expect(screen.getByText('正在加载猫猫档案…')).toBeVisible()
  await act(async () => { nextCat.resolve({ ...cat, id: 2, name: '小橘' }); write.resolve({}) })
  await screen.findByRole('heading', { name: '小橘' })
  expect(api.getSightings).toHaveBeenLastCalledWith({ cat_id: '2', limit: 100 })
  expect(screen.getByRole('button', { name: '关注猫猫' })).toHaveAttribute('aria-pressed', 'false')
  expect(container).not.toHaveTextContent('已关注这只猫猫。')
})

it('opens the existing scan flow without silently creating a sighting', async () => {
  render(frame())
  fireEvent.click(await screen.findByRole('button', { name: '记录这次偶遇' }))
  expect(screen.getByRole('heading', { name: '拍照记录流程' })).toBeVisible()
  expect(api.createSighting).not.toHaveBeenCalled()
})

it('displays hourly sample counts with proportional heights, real zero and invalid-time exclusions', async () => {
  vi.mocked(api.getSightings).mockResolvedValue([
    sighting, { ...sighting, id: 2, created_at: '2026-10-01T09:00:00' },
    { ...sighting, id: 3, created_at: '2026-11-02T12:00:00' }, { ...sighting, id: 4, created_at: 'invalid' },
  ])
  render(frame())
  await screen.findByText('已加载偶遇的时段分布')
  openDetails('已加载偶遇的时段分布')
  expect(screen.queryByText('24h 出没热力')).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: /时段分布，共 3 条/ })).toBeVisible()
  expect(screen.getByTitle('9时：2次').firstElementChild).toHaveStyle({ height: '96px' })
  expect(screen.getByTitle('12时：1次').firstElementChild).toHaveStyle({ height: '48px' })
  expect(screen.getByTitle('0时：0次').firstElementChild).toHaveStyle({ height: '0px' })
  expect(screen.getByText(/另有 1 条因时间缺失未计入/)).toBeVisible()
})

it('keeps photo viewing and collapsible personality, health and relationship details', async () => {
  vi.mocked(api.getCat).mockResolvedValue({ ...cat, personality_radar: [4, 3, 2, 5, 1], relationships_list: [{ cat_id: 2, cat_name: '小橘', relation: '朋友' }], aliases_list: ['胖球'] })
  render(frame())
  await screen.findByRole('heading', { name: '皮球' })
  fireEvent.click(screen.getByRole('button', { name: '放大查看皮球的第 2 张照片' }))
  expect(screen.getByRole('dialog', { name: '照片浏览' })).toHaveTextContent('第 2 张照片')
  openDetails('查看 1 条健康记录')
  expect(screen.getByText('完成疫苗接种')).toBeVisible()
  openDetails('性格与猫猫关系')
  expect(screen.getByRole('img', { name: /性格雷达/ })).toBeVisible()
  expect(screen.getByRole('button', { name: '查看小橘的档案（朋友）' })).toBeVisible()
  expect(screen.getByText('大家也叫它：胖球')).toBeVisible()
})
