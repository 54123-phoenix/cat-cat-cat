import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PostInput from '../components/PostInput'
import PostList from '../components/PostList'
import PostCard from '../components/PostCard'
import PollView from '../components/PollView'
import Community from '../pages/Community'
import * as api from '../api'

vi.mock('../api', async original => ({
  ...await original<typeof import('../api')>(),
  getCats: vi.fn(), getPostsPage: vi.fn(), createPost: vi.fn(), likePost: vi.fn(), deletePost: vi.fn(), reportPost: vi.fn(), pollVote: vi.fn(), getStoredUser: vi.fn(),
}))
vi.mock('../components/Toast', () => ({ toast: vi.fn() }))

const post = { id: 12, userId: 1, user: { id: 1, nickname: '猫友' }, content: '图书馆旁的猫今天很好', topic: 'daily', likes: 4, liked: false, images: ['/uploads/posts/cat.jpg'], tags: ['#图书馆'], comments: 2, createdAt: '刚刚' }
const firstPage = { items: [post], has_more: false, total: 1 }
// jsdom does not implement the native dialog lifecycle; browser QA covers it.
Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, writable: true, value() { this.open = true } })
Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, writable: true, value() { this.open = false } })

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.getCats).mockResolvedValue([{ id: 8, name: '奶盖' }])
  vi.mocked(api.getPostsPage).mockResolvedValue(firstPage)
  vi.mocked(api.createPost).mockResolvedValue(post)
  vi.mocked(api.getStoredUser).mockReturnValue({ id: 1, nickname: '猫友' })
  vi.mocked(api.likePost).mockResolvedValue({ ...post, liked: true, likes: 5 })
  vi.mocked(api.deletePost).mockResolvedValue({})
  vi.mocked(api.reportPost).mockResolvedValue({})
  vi.mocked(api.pollVote).mockResolvedValue({ pollData: [1, 0] })
  URL.createObjectURL = vi.fn(file => 'blob:' + file.name)
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function () { this.open = true })
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function () { this.open = false })
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function () {
    return (this.matches('input[type="file"]') || (this.closest('details:not([open])') && this.tagName !== 'SUMMARY') ? [] : [new DOMRect(0, 0, 44, 44)]) as unknown as DOMRectList
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function frame(child) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return <MemoryRouter><QueryClientProvider client={client}>{child}</QueryClientProvider></MemoryRouter>
}
function openComposer() {
  const onClose = vi.fn(), onCreated = vi.fn()
  const view = render(<PostInput defaultTopic="daily" onClose={onClose} onCreated={onCreated} />)
  return { ...view, onClose, onCreated }
}
function openExtras() {
  const details = screen.getByText('话题、类型与更多信息（选填）').closest('details')!
  details.open = true
  fireEvent(details, new Event('toggle'))
}
function writeContent(value = '今天遇见奶盖') {
  fireEvent.change(screen.getByLabelText('想和猫友分享什么？'), { target: { value } })
}
function addImage(file = new File(['photo'], 'cat.jpg', { type: 'image/jpeg' })) {
  fireEvent.change(screen.getByLabelText('添加帖子图片'), { target: { files: [file] } })
  return file
}

it('focuses the composer content and preserves the current-page draft through Escape and reopening', async () => {
  const onClose = vi.fn()
  const view = render(<PostInput isOpen defaultTopic="daily" onClose={onClose} onCreated={vi.fn()} />)
  expect(screen.getByLabelText('想和猫友分享什么？')).toHaveFocus()
  writeContent()
  const dialog = screen.getByRole('dialog', { name: '分享校园日常' })
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(onClose).toHaveBeenCalledTimes(1)
  view.rerender(<PostInput isOpen={false} defaultTopic="daily" onClose={onClose} onCreated={vi.fn()} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  view.rerender(<PostInput isOpen defaultTopic="find" onClose={onClose} onCreated={vi.fn()} />)
  expect(screen.getByLabelText('想和猫友分享什么？')).toHaveValue('今天遇见奶盖')
  openExtras()
  await screen.findByRole('button', { name: '奶盖' })
  expect(screen.getByRole('button', { name: '铲屎日常' })).toHaveAttribute('aria-pressed', 'true')
  const close = screen.getByRole('button', { name: '关闭发帖，保留本页草稿' })
  close.focus()
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
  expect(screen.getByRole('button', { name: '发布帖子' })).toHaveFocus()
})

it('validates image types and the 10 MB limit while retaining valid photos and releasing previews', () => {
  const view = openComposer()
  const valid = new File(['photo'], 'valid.webp', { type: 'image/webp' })
  const wrong = new File(['bad'], 'bad.gif', { type: 'image/gif' })
  const large = new File(['large'], 'large.png', { type: 'image/png' })
  Object.defineProperty(large, 'size', { value: 10 * 1024 * 1024 + 1 })
  fireEvent.change(screen.getByLabelText('添加帖子图片'), { target: { files: [wrong, large, valid] } })
  expect(screen.getByRole('alert')).toHaveTextContent('JPG、PNG 或 WebP')
  expect(screen.getByRole('alert')).toHaveTextContent('不超过 10 MB')
  expect(screen.getByAltText('待发布图片 1：valid.webp')).toBeVisible()
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: '移除图片 1' }))
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:valid.webp')
  addImage()
  view.unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cat.jpg')
})

it('blocks duplicate publish requests and retains every draft field after failure before retrying', async () => {
  let reject!: (error: Error) => void
  vi.mocked(api.createPost).mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest }))
  const { onClose, onCreated } = openComposer()
  writeContent()
  const file = addImage()
  openExtras()
  fireEvent.click(await screen.findByRole('button', { name: '奶盖' }))
  fireEvent.click(screen.getByRole('button', { name: '#图书馆' }))
  const form = screen.getByRole('button', { name: '发布帖子' }).closest('form')!
  act(() => { fireEvent.submit(form); fireEvent.submit(form) })
  expect(api.createPost).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText('想和猫友分享什么？')).toBeDisabled()
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => reject(new Error('网络中断')))
  expect(screen.getByRole('alert')).toHaveFocus()
  expect(screen.getByLabelText('想和猫友分享什么？')).toHaveValue('今天遇见奶盖')
  expect(screen.getByAltText('待发布图片 1：cat.jpg')).toBeVisible()
  fireEvent.submit(form)
  await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
  expect(onClose).toHaveBeenCalledTimes(1)
  for (const [data] of vi.mocked(api.createPost).mock.calls) {
    expect(data.get('content')).toBe('今天遇见奶盖')
    expect(data.get('tags')).toBe('["#图书馆"]')
    expect(data.get('relatedCatId')).toBe('8')
    expect(data.get('pollOptions')).toBe('[]')
    expect(data.getAll('files')).toEqual([file])
  }
})

it('rejects incomplete or duplicate polls and submits trimmed arrays with custom tags', async () => {
  openComposer()
  writeContent('哪个地点更常遇到猫？')
  openExtras()
  fireEvent.click(screen.getByRole('button', { name: '投票' }))
  fireEvent.click(screen.getByRole('button', { name: '发布帖子' }))
  expect(screen.getByRole('alert')).toHaveTextContent('至少两个')
  fireEvent.change(screen.getByLabelText('投票选项 1'), { target: { value: ' 食堂 ' } })
  fireEvent.change(screen.getByLabelText('投票选项 2'), { target: { value: '食堂' } })
  fireEvent.click(screen.getByRole('button', { name: '发布帖子' }))
  expect(screen.getByRole('alert')).toHaveTextContent('不能重复')
  expect(api.createPost).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('投票选项 2'), { target: { value: ' 图书馆 ' } })
  const tag = screen.getByLabelText('自定义标签')
  fireEvent.change(tag, { target: { value: '校园投票' } })
  fireEvent.keyDown(tag, { key: 'Enter' })
  expect(screen.getByRole('button', { name: '移除标签 #校园投票' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '发布帖子' }))
  await waitFor(() => expect(api.createPost).toHaveBeenCalledTimes(1))
  const data = vi.mocked(api.createPost).mock.calls[0][0]
  expect(data.get('postType')).toBe('poll')
  expect(JSON.parse(data.get('pollOptions'))).toEqual(['食堂', '图书馆'])
  expect(JSON.parse(data.get('tags'))).toEqual(['#校园投票'])
})

it('shows an initial request error instead of a false empty state and recovers', async () => {
  vi.mocked(api.getPostsPage).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(firstPage)
  render(frame(<PostList topic="all" onReport={vi.fn()} onTagClick={vi.fn()} />))
  await screen.findByText('帖子暂时无法加载')
  expect(screen.queryByText('这个话题还没有帖子')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '重新加载帖子' }))
  await screen.findByText(post.content)
})

it('keeps previous posts when pagination fails and retries the missing page', async () => {
  vi.mocked(api.getPostsPage).mockResolvedValueOnce({ ...firstPage, has_more: true })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ items: [{ ...post, id: 13, content: '第二页的猫猫' }], total: 2, has_more: false })
  render(frame(<PostList topic="all" onReport={vi.fn()} onTagClick={vi.fn()} />))
  await screen.findByText(post.content)
  fireEvent.click(screen.getByRole('button', { name: '加载更多帖子' }))
  await screen.findByText('后续帖子加载失败，已加载的帖子仍可浏览。')
  expect(screen.getByText(post.content)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '重试加载更多' }))
  await screen.findByText('第二页的猫猫')
  expect(screen.getByText(post.content)).toBeVisible()
  expect(screen.getByText('已浏览全部帖子')).toBeVisible()
})

it('keeps posts and offers recovery when a refresh fails', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const renderList = (refreshKey: number) => <MemoryRouter><QueryClientProvider client={client}><PostList topic="all" refreshKey={refreshKey} onReport={vi.fn()} onTagClick={vi.fn()} /></QueryClientProvider></MemoryRouter>
  const view = render(renderList(0))
  await screen.findByText(post.content)
  vi.mocked(api.getPostsPage).mockRejectedValueOnce(new Error('offline'))
  view.rerender(renderList(1))
  await screen.findByText('帖子暂时无法更新，下方保留已加载的内容。')
  expect(screen.getByText(post.content)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '重试更新' }))
  await waitFor(() => expect(screen.queryByText('帖子暂时无法更新，下方保留已加载的内容。')).not.toBeInTheDocument())
})

it('uses semantic detail links and rolls back a failed like with an explicit error and request lock', async () => {
  let reject!: (error: Error) => void
  vi.mocked(api.likePost).mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest }))
  render(frame(<PostCard post={post} />))
  expect(screen.getByRole('link', { name: /图书馆旁的猫今天很好/ })).toHaveAttribute('href', '/posts/12')
  const like = screen.getByRole('button', { name: '赞' })
  act(() => { fireEvent.click(like); fireEvent.click(like) })
  expect(api.likePost).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: '取消赞' })).toHaveAttribute('aria-pressed', 'true')
  await act(async () => reject(new Error('offline')))
  expect(screen.getByRole('alert')).toHaveTextContent('点赞暂时未能保存')
  expect(screen.getByRole('button', { name: '赞' })).toHaveTextContent('4')
  fireEvent.click(screen.getByRole('button', { name: '赞' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '取消赞' })).toHaveTextContent('5'))
})

it('keeps the accessible delete confirmation open after failure and only removes after success', async () => {
  vi.mocked(api.deletePost).mockRejectedValueOnce(new Error('删除失败'))
  const onDeleted = vi.fn()
  render(frame(<PostCard post={post} onDeleted={onDeleted} />))
  fireEvent.click(screen.getByRole('button', { name: '删除帖子' }))
  const dialog = screen.getByRole('dialog', { name: '删除这条帖子？' })
  expect(within(dialog).getByRole('button', { name: '保留帖子' })).toHaveFocus()
  fireEvent.click(within(dialog).getByRole('button', { name: '确认删除' }))
  await screen.findByRole('alert')
  expect(onDeleted).not.toHaveBeenCalled()
  expect(dialog).toBeVisible()
  fireEvent.click(within(dialog).getByRole('button', { name: '确认删除' }))
  await waitFor(() => expect(onDeleted).toHaveBeenCalledExactlyOnceWith(12))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('retains the report reason after failure and closes cleanly after successful retry', async () => {
  vi.mocked(api.reportPost).mockRejectedValueOnce(new Error('网络中断'))
  render(frame(<Community />))
  fireEvent.click(await screen.findByRole('button', { name: '举报帖子' }))
  const reason = screen.getByLabelText('举报原因')
  expect(reason).toHaveFocus()
  fireEvent.change(reason, { target: { value: '内容存在不实信息' } })
  fireEvent.click(screen.getByRole('button', { name: '提交举报' }))
  await screen.findByRole('alert')
  expect(reason).toHaveValue('内容存在不实信息')
  fireEvent.click(screen.getByRole('button', { name: '提交举报' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(api.reportPost).toHaveBeenCalledTimes(2)
})

it('locks duplicate poll votes and retains counts after a failed vote', async () => {
  let reject!: (error: Error) => void
  vi.mocked(api.pollVote).mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest }))
  render(<PollView post={{ id: 12, pollOptions: ['食堂', '图书馆'], pollData: [2, 1] }} />)
  const option = screen.getByRole('button', { name: /食堂/ })
  act(() => { fireEvent.click(option); fireEvent.click(option) })
  expect(api.pollVote).toHaveBeenCalledTimes(1)
  await act(async () => reject(new Error('投票失败')))
  expect(screen.getByRole('alert')).toHaveTextContent('投票失败')
  expect(screen.getByText('共 3 票，点击选项投票')).toBeVisible()
  expect(option).toBeEnabled()
})
