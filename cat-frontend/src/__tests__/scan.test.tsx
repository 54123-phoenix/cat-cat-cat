import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Scan from '../pages/Scan'
import * as api from '../api'
import type { RecognizeResult, Sighting } from '../types'

vi.mock('../api', async importOriginal => ({
  ...await importOriginal<typeof import('../api')>(),
  identifyCat: vi.fn(), createSighting: vi.fn(), createDiscovery: vi.fn(),
}))
vi.mock('../components/PawRain', () => ({ default: () => null }))

const confirmed: RecognizeResult = { status: 'confirmed', cat_id: 8, cat_name: '奶盖', confidence: 0.83 }
const uncertain: RecognizeResult = {
  status: 'uncertain', confidence: 0.64,
  candidates: [
    { cat_id: 8, cat_name: '奶盖', confidence: 0.64 },
    { cat_id: 9, cat_name: '小狸', confidence: 0.61 },
  ],
}
const saved: Sighting = { id: 42, cat_id: 8, status: 'pending', confirmations: 0, grade: 'casual', created_at: '2026-11-08T00:00:00Z' }

beforeEach(() => {
  vi.mocked(api.identifyCat).mockReset().mockResolvedValue(confirmed)
  vi.mocked(api.createSighting).mockReset().mockResolvedValue(saved)
  vi.mocked(api.createDiscovery).mockReset().mockResolvedValue({ id: 12 })
  URL.createObjectURL = vi.fn(() => 'blob:cat-photo')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function openScan(path = '/scan') {
  return render(<MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/scan" element={<Scan />} />
      <Route path="/cats/:catId" element={<p>猫咪档案页面</p>} />
    </Routes>
  </MemoryRouter>)
}

async function identify(result = confirmed) {
  vi.mocked(api.identifyCat).mockResolvedValueOnce(result)
  const file = new File(['cat image'], 'cat.jpg', { type: 'image/jpeg' })
  fireEvent.change(screen.getByLabelText('拍照或上传图片'), { target: { files: [file] } })
  fireEvent.click(screen.getByRole('button', { name: '开始识别' }))
  await waitFor(() => expect(screen.queryByText('AI 正在识别中…')).not.toBeInTheDocument())
  return file
}

it('only submits a confirmed result after explicit confirmation, with the current photo and encounter fields', async () => {
  openScan('/scan?point=东门草坪&lat=31.29&lng=121.5')
  const file = await identify()
  expect(api.createSighting).not.toHaveBeenCalled()
  expect(screen.getByText('识别结果，尚未提交')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '分享' })).not.toBeInTheDocument()
  expect(screen.getByText('相似度用于比较照片，不代表识别正确的概率。')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /补充偶遇信息/ }))
  fireEvent.click(screen.getByRole('button', { name: /睡觉/ }))
  fireEvent.click(screen.getByRole('button', { name: /晴/ }))
  fireEvent.click(screen.getByRole('button', { name: /开心/ }))
  fireEvent.click(screen.getByRole('button', { name: '确认并提交偶遇' }))
  await screen.findByRole('status')
  expect(api.createSighting).toHaveBeenCalledExactlyOnceWith({
    catId: 8, location: '东门草坪', confidence: 0.83, file,
    activity_type: 'sleeping', weather: 'sunny', mood: 'happy', latitude: 31.29, longitude: 121.5,
    client_request_id: expect.stringMatching(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/),
  })
  expect(screen.getByRole('status')).toHaveTextContent('偶遇已提交，等待猫协审核')
  expect(screen.getByRole('status')).toHaveFocus()
  expect(screen.queryByRole('button', { name: '确认并提交偶遇' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '查看公开偶遇页' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('偶遇地点')).toBeDisabled()
  expect(screen.getByText('偶遇待审核 · 链接为猫咪档案')).toBeInTheDocument()
  expect(screen.getByText('扫码查看猫咪档案')).toBeInTheDocument()
  expect(screen.getByText(/匹配相似度 83%（非正确概率）/)).toBeInTheDocument()
})

it('locks duplicate submissions and preserves the result, inputs, and request ID when retrying a failed save', async () => {
  let rejectSave: (reason: Error) => void
  vi.mocked(api.createSighting).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject }))
  openScan()
  await identify()
  fireEvent.change(screen.getByLabelText('偶遇地点'), { target: { value: '图书馆门口' } })
  const submit = screen.getByRole('button', { name: '确认并提交偶遇' })
  fireEvent.click(submit)
  fireEvent.click(submit)
  expect(api.createSighting).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText('偶遇地点')).toBeDisabled()
  expect(screen.getByRole('button', { name: '重新选择照片' })).toBeDisabled()
  const original = vi.mocked(api.createSighting).mock.calls[0][0]
  await act(async () => rejectSave(new Error('网络中断')))
  expect(screen.getByRole('alert')).toHaveTextContent('照片和填写内容已保留')
  expect(screen.getByRole('alert')).toHaveFocus()
  expect(screen.getByText('识别结果，尚未提交')).toBeInTheDocument()
  expect(screen.getByAltText('预览')).toHaveAttribute('src', 'blob:cat-photo')
  expect(screen.getByLabelText('偶遇地点')).toHaveValue('图书馆门口')
  expect(screen.getByLabelText('偶遇地点')).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: '确认并提交偶遇' }))
  await screen.findByRole('status')
  expect(api.identifyCat).toHaveBeenCalledTimes(1)
  expect(api.createSighting).toHaveBeenCalledTimes(2)
  expect(vi.mocked(api.createSighting).mock.calls[1][0]).toEqual(original)
})

it('uses a new request ID when a failed submission is edited', async () => {
  vi.mocked(api.createSighting).mockRejectedValueOnce(new Error('请求超时'))
  openScan()
  await identify()
  fireEvent.click(screen.getByRole('button', { name: '确认并提交偶遇' }))
  await screen.findByRole('alert')
  const firstId = vi.mocked(api.createSighting).mock.calls[0][0].client_request_id
  fireEvent.change(screen.getByLabelText('偶遇地点'), { target: { value: '光华楼' } })
  fireEvent.click(screen.getByRole('button', { name: '确认并提交偶遇' }))
  await screen.findByRole('status')
  expect(vi.mocked(api.createSighting).mock.calls[1][0]).toMatchObject({ location: '光华楼', latitude: 31.3001, longitude: 121.5005 })
  expect(vi.mocked(api.createSighting).mock.calls[1][0].client_request_id).not.toBe(firstId)
})

it('shows a candidate save failure in place and retries the same candidate without navigating away', async () => {
  vi.mocked(api.createSighting).mockRejectedValueOnce(new Error('保存失败'))
  openScan()
  const file = await identify(uncertain)
  fireEvent.change(screen.getByLabelText('偶遇地点'), { target: { value: '二食堂' } })
  fireEvent.click(screen.getByRole('button', { name: '确认是奶盖并提交偶遇' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('region', { name: '奶盖 候选' })).toBeInTheDocument()
  expect(screen.queryByText('猫咪档案页面')).not.toBeInTheDocument()
  const original = vi.mocked(api.createSighting).mock.calls[0][0]
  fireEvent.click(screen.getByRole('button', { name: '确认是奶盖并提交偶遇' }))
  await screen.findByRole('status')
  expect(vi.mocked(api.createSighting).mock.calls[1][0]).toEqual(original)
  expect(original).toMatchObject({ catId: 8, file, location: '二食堂', latitude: 31.2996, longitude: 121.5018, confidence: 0.64 })
  expect(screen.queryByRole('button', { name: /确认.*提交偶遇/ })).not.toBeInTheDocument()
})

it('uses a new request ID when the user chooses another candidate after a failure', async () => {
  vi.mocked(api.createSighting).mockRejectedValueOnce(new Error('请求超时'))
  openScan()
  await identify(uncertain)
  fireEvent.click(screen.getByRole('button', { name: '确认是奶盖并提交偶遇' }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: '确认是小狸并提交偶遇' }))
  await screen.findByRole('status')
  const [first, second] = vi.mocked(api.createSighting).mock.calls.map(([input]) => input)
  expect(second.catId).toBe(9)
  expect(second.client_request_id).not.toBe(first.client_request_id)
})

it('opening a candidate archive never submits a sighting', async () => {
  openScan()
  await identify(uncertain)
  fireEvent.click(screen.getByRole('button', { name: '查看奶盖档案' }))
  expect(screen.getByText('猫咪档案页面')).toBeInTheDocument()
  expect(api.createSighting).not.toHaveBeenCalled()
})

it('allows a failed identification to retry with the same photo without submitting a sighting', async () => {
  openScan()
  const file = new File(['cat image'], 'cat.jpg', { type: 'image/jpeg' })
  vi.mocked(api.identifyCat).mockRejectedValueOnce(new Error('识别超时'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  fireEvent.change(screen.getByLabelText('拍照或上传图片'), { target: { files: [file] } })
  fireEvent.click(screen.getByRole('button', { name: '开始识别' }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: '重试识别' }))
  await screen.findByRole('button', { name: '确认并提交偶遇' })
  expect(api.identifyCat).toHaveBeenNthCalledWith(2, file)
  expect(api.createSighting).not.toHaveBeenCalled()
})

it('starts a new draft and request ID only when explicitly recording another encounter', async () => {
  openScan()
  await identify()
  fireEvent.click(screen.getByRole('button', { name: '确认并提交偶遇' }))
  await screen.findByRole('status')
  fireEvent.click(screen.getByRole('button', { name: '记录下一次偶遇' }))
  const nextFile = await identify()
  fireEvent.click(screen.getByRole('button', { name: '确认并提交偶遇' }))
  await screen.findByRole('status')
  const [first, second] = vi.mocked(api.createSighting).mock.calls.map(([input]) => input)
  expect(second.client_request_id).not.toBe(first.client_request_id)
  expect(second.file).toBe(nextFile)
})

it('offers a focusable upload button, moves focus through recognition, and keeps one live announcement region', async () => {
  const { container } = openScan()
  const liveRegion = container.querySelector('[aria-live="polite"]')
  const uploadButton = screen.getByRole('button', { name: /^拍照或上传图片/ })
  const fileInput = screen.getByLabelText('拍照或上传图片')
  const openPicker = vi.spyOn(fileInput, 'click')
  uploadButton.focus()
  expect(uploadButton).toHaveFocus()
  fireEvent.click(uploadButton)
  expect(openPicker).toHaveBeenCalledOnce()

  let resolveRecognition: (value: RecognizeResult) => void
  vi.mocked(api.identifyCat).mockImplementationOnce(() => new Promise(resolve => { resolveRecognition = resolve }))
  fireEvent.change(fileInput, { target: { files: [new File(['photo'], 'cat.jpg', { type: 'image/jpeg' })] } })
  expect(screen.getByRole('button', { name: '开始识别' })).toHaveFocus()
  expect(liveRegion).toHaveTextContent('照片已选择')
  fireEvent.click(screen.getByRole('button', { name: '开始识别' }))
  expect(liveRegion).toHaveTextContent('正在识别中')
  await act(async () => resolveRecognition(confirmed))
  expect(screen.getByRole('heading', { name: '请核对猫咪身份' })).toHaveFocus()
  expect(container.querySelector('[aria-live="polite"]')).toBe(liveRegion)
  expect(liveRegion).toHaveTextContent('识别完成，建议匹配奶盖')
  expect(screen.getAllByAltText('预览')).toHaveLength(1)
  expect(api.createSighting).not.toHaveBeenCalled()
})

it('keeps optional details collapsed and preserves selections with their accessible pressed states', async () => {
  openScan()
  await identify()
  const disclosure = screen.getByRole('button', { name: /补充偶遇信息/ })
  expect(disclosure).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: '睡觉' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('偶遇地点')).toBeVisible()
  fireEvent.click(disclosure)
  const sleeping = screen.getByRole('button', { name: '睡觉' })
  expect(sleeping).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(sleeping)
  expect(sleeping).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(disclosure)
  expect(disclosure).toHaveTextContent('睡觉')
  fireEvent.click(disclosure)
  expect(screen.getByRole('button', { name: '睡觉' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: '确认并提交偶遇' }))
  await screen.findByRole('status')
  expect(vi.mocked(api.createSighting).mock.calls[0][0].activity_type).toBe('sleeping')
})

it('keeps an unavailable recognition note labeled and counted, then preserves it after a failed clue submission', async () => {
  vi.mocked(api.createDiscovery).mockRejectedValueOnce(new Error('线索提交超时'))
  openScan()
  await identify({ status: 'unavailable' })
  const note = screen.getByRole('textbox', { name: '补充线索（选填）' })
  expect(note).toHaveAttribute('maxlength', '500')
  expect(note).toHaveAccessibleDescription(/描述毛色、明显特征或当时状态/)
  fireEvent.change(note, { target: { value: '左耳缺角' } })
  fireEvent.change(screen.getByLabelText('偶遇地点'), { target: { value: '二食堂' } })
  expect(screen.getByText('4/500')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '先提交线索' }))
  await screen.findByRole('alert')
  expect(note).toHaveValue('左耳缺角')
  expect(screen.getByRole('alert')).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: '先提交线索' }))
  await screen.findByRole('status')
  expect(screen.getByRole('status')).toHaveFocus()
  expect(vi.mocked(api.createDiscovery).mock.calls[1][0]).toMatchObject({ note: '左耳缺角', locationName: '二食堂', latitude: 31.2996, longitude: 121.5018 })
  expect(api.createSighting).not.toHaveBeenCalled()
})

it('rejects unsupported photos before recognition and allows another upload', async () => {
  openScan()
  fireEvent.change(screen.getByLabelText('拍照或上传图片'), { target: { files: [new File(['not a supported image'], 'cat.gif', { type: 'image/gif' })] } })
  expect(screen.getByRole('alert')).toHaveTextContent('请选择 10 MB 以内的 JPG、PNG 或 WebP 照片')
  expect(screen.queryByRole('button', { name: '开始识别' })).not.toBeInTheDocument()
  await identify()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(api.identifyCat).toHaveBeenCalledTimes(1)
})
