import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PostDetail from '../pages/PostDetail'
import CommentSection from '../components/CommentSection'
import { LiveDataContext } from '../hooks/useLiveData'
import * as api from '../api'

vi.mock('../api', async original => ({
  ...await original<typeof import('../api')>(),
  getPost: vi.fn(), getPostComments: vi.fn(), createComment: vi.fn(), acceptAnswer: vi.fn(),
  likePost: vi.fn(), deletePost: vi.fn(), getStoredUser: vi.fn(),
}))
const post = { id: 12, userId: 1, user: { id: 1, nickname: '猫友' }, content: '图书馆旁的猫今天很好', topic: 'daily', likes: 4, liked: false, images: ['/uploads/posts/one.jpg', '/uploads/posts/two.jpg'], tags: ['#图书馆'], comments: 1, createdAt: '刚刚' }
const comment = { id: 3, content: '原有的回复', user: { id: 2, nickname: '同学' }, createdAt: '刚刚' }

Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, writable: true, value() { this.open = true } })
Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, writable: true, value() { this.open = false } })

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.getPost).mockResolvedValue(post)
  vi.mocked(api.getPostComments).mockResolvedValue([comment])
  vi.mocked(api.createComment).mockResolvedValue({ ...comment, id: 4, content: '我的新回复' })
  vi.mocked(api.acceptAnswer).mockResolvedValue({})
  vi.mocked(api.likePost).mockResolvedValue({ ...post, liked: true, likes: 5 })
  vi.mocked(api.deletePost).mockResolvedValue({})
  vi.mocked(api.getStoredUser).mockReturnValue({ id: 1, nickname: '猫友' })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function detail() {
  return render(<MemoryRouter initialEntries={['/posts/12']}><Routes><Route path="/posts/:postId" element={<PostDetail />} /><Route path="/community" element={<p>社区页面</p>} /></Routes></MemoryRouter>)
}
function comments(revision = 0) {
  return <LiveDataContext.Provider value={{ revision, event: null }}><CommentSection postId={12} expanded /></LiveDataContext.Provider>
}

it('distinguishes failed comment loading from empty data and keeps the input available for recovery', async () => {
  vi.mocked(api.getPostComments).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([comment])
  render(comments())
  await screen.findByText('评论暂时无法加载，请重试。')
  expect(screen.queryByText('还没有评论，来说两句吧。')).not.toBeInTheDocument()
  const input = screen.getByLabelText('写下你的回复')
  fireEvent.change(input, { target: { value: '保留这段回复' } })
  fireEvent.click(screen.getByRole('button', { name: '重试加载评论' }))
  await screen.findByText('原有的回复')
  expect(input).toHaveValue('保留这段回复')
})

it('locks duplicate comment submissions and keeps the draft after failure until retry succeeds', async () => {
  let reject!: (error: Error) => void
  vi.mocked(api.createComment).mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest }))
  render(comments())
  await screen.findByText('原有的回复')
  const input = screen.getByLabelText('写下你的回复')
  fireEvent.change(input, { target: { value: ' 我的新回复 ' } })
  const form = input.closest('form')!
  act(() => { fireEvent.submit(form); fireEvent.submit(form) })
  expect(api.createComment).toHaveBeenCalledExactlyOnceWith(12, { content: '我的新回复' })
  expect(input).toBeDisabled()
  await act(async () => reject(new Error('发送失败')))
  expect(screen.getByRole('alert')).toHaveTextContent('内容已保留')
  expect(screen.getByRole('alert')).toHaveFocus()
  expect(input).toHaveValue(' 我的新回复 ')
  fireEvent.submit(form)
  await screen.findByText('我的新回复')
  expect(screen.getByText('原有的回复')).toBeVisible()
  expect(input).toHaveValue('')
  expect(screen.getByText('评论已发送。')).toBeVisible()
})

it('retains previous comments and the draft while a refresh is pending and after it fails', async () => {
  let reject!: (error: Error) => void
  const view = render(comments())
  await screen.findByText('原有的回复')
  const input = screen.getByLabelText('写下你的回复')
  fireEvent.change(input, { target: { value: '正在写的回复' } })
  vi.mocked(api.getPostComments).mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest }))
  view.rerender(comments(1))
  expect(screen.getByText('原有的回复')).toBeVisible()
  expect(input).toHaveValue('正在写的回复')
  await act(async () => reject(new Error('offline')))
  expect(screen.getByText('评论暂时无法更新，已加载的回复仍可浏览。')).toBeVisible()
  expect(screen.getByText('原有的回复')).toBeVisible()
  expect(input).toHaveValue('正在写的回复')
})

it('keeps a successful reply when an earlier read finishes late', async () => {
  let resolveOld!: (data: unknown) => void
  vi.mocked(api.getPostComments).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve }))
    .mockResolvedValueOnce([comment, { ...comment, id: 4, content: '我的新回复' }])
  render(comments())
  fireEvent.change(screen.getByLabelText('写下你的回复'), { target: { value: '我的新回复' } })
  fireEvent.click(screen.getByRole('button', { name: '发送回复' }))
  await screen.findByText('我的新回复')
  await act(async () => resolveOld([]))
  expect(screen.getByText('我的新回复')).toBeVisible()
  await screen.findByText('原有的回复')
})

it('shows failed answer acceptance and only marks the answer after a successful retry', async () => {
  vi.mocked(api.acceptAnswer).mockRejectedValueOnce(new Error('暂时无法采纳'))
  render(<CommentSection postId={12} expanded isQuestion canAccept />)
  fireEvent.click(await screen.findByRole('button', { name: '采纳为最佳答案' }))
  await screen.findByRole('alert')
  expect(screen.queryByText('已采纳')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '采纳为最佳答案' }))
  await screen.findByText('已采纳')
  expect(api.acceptAnswer).toHaveBeenCalledTimes(2)
})

it('opens the selected detail image in the shared viewer and returns on cancel', async () => {
  detail()
  const image = await screen.findByRole('button', { name: '查看帖子图片 2，共 2 张' })
  image.focus()
  fireEvent.click(image)
  const viewer = screen.getByRole('dialog', { name: '查看照片' })
  expect(within(viewer).getByRole('status')).toHaveTextContent('2 / 2')
  expect(within(viewer).getByRole('img', { name: '帖子图片 2' })).toHaveAttribute('src', '/uploads/posts/two.jpg')
  fireEvent(viewer, new Event('cancel', { cancelable: true }))
  expect(screen.queryByRole('dialog', { name: '查看照片' })).not.toBeInTheDocument()
  expect(image).toHaveFocus()
})

it('rolls back a failed detail like with feedback and permits a later retry', async () => {
  let reject!: (error: Error) => void
  vi.mocked(api.likePost).mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest }))
  detail()
  const like = await screen.findByRole('button', { name: '赞' })
  act(() => { fireEvent.click(like); fireEvent.click(like) })
  expect(api.likePost).toHaveBeenCalledTimes(1)
  await act(async () => reject(new Error('offline')))
  expect(screen.getByRole('alert')).toHaveTextContent('点赞暂时未能保存')
  expect(screen.getByRole('button', { name: '赞' })).toHaveTextContent('4 赞')
  fireEvent.click(screen.getByRole('button', { name: '赞' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '取消赞' })).toHaveTextContent('5 赞'))
})

it('keeps delete confirmation after a failure, then returns to the community on success', async () => {
  vi.mocked(api.deletePost).mockRejectedValueOnce(new Error('网络中断'))
  detail()
  fireEvent.click(await screen.findByRole('button', { name: '删除帖子' }))
  const dialog = screen.getByRole('dialog', { name: '删除这条帖子？' })
  expect(within(dialog).getByRole('button', { name: '保留帖子' })).toHaveFocus()
  fireEvent.click(within(dialog).getByRole('button', { name: '确认删除' }))
  await screen.findByRole('alert')
  expect(dialog).toBeVisible()
  expect(screen.getByText(post.content)).toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: '确认删除' }))
  await screen.findByText('社区页面')
})

it('retries a transient detail loading failure without reloading the browser', async () => {
  vi.mocked(api.getPost).mockRejectedValueOnce(new Error('网络中断')).mockResolvedValueOnce(post)
  detail()
  await screen.findByText('网络中断')
  fireEvent.click(screen.getByRole('button', { name: '重新加载帖子' }))
  await screen.findByText(post.content)
  expect(api.getPost).toHaveBeenCalledTimes(2)
})
