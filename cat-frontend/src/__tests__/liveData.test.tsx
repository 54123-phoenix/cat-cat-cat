import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { LiveDataContext } from '../hooks/useLiveData'
import Notifications from '../pages/Notifications'
import CommentSection from '../components/CommentSection'
import PostCard from '../components/PostCard'
import PostDetail from '../pages/PostDetail'
import PollView from '../components/PollView'
import { ApiError, getNotifications, getPost, getPostComments } from '../api'

vi.mock('../api', async original => ({
  ...await original<typeof import('../api')>(), getNotifications: vi.fn(), getPostComments: vi.fn(), getPost: vi.fn(),
}))
afterEach(() => { cleanup(); vi.resetAllMocks() })
const frame = (revision: number, children) => <MemoryRouter><LiveDataContext.Provider value={{ revision, event: null }}>{children}</LiveDataContext.Provider></MemoryRouter>

it('prevents a slow pre-reconnect notification request from replacing fresh data', async () => {
  let resolveOld!: (value: unknown) => void
  vi.mocked(getNotifications).mockReturnValueOnce(new Promise(done => { resolveOld = done }))
    .mockResolvedValueOnce([{ id: 2, title: '重连后的通知', is_read: false }])
  const { rerender } = render(frame(0, <Notifications />))
  rerender(frame(1, <Notifications />))
  await screen.findByText('重连后的通知')
  await act(async () => { resolveOld([{ id: 1, title: '已经过时的通知' }]) })
  expect(screen.getByText('重连后的通知')).toBeVisible()
  expect(screen.queryByText('已经过时的通知')).not.toBeInTheDocument()
})

it('refreshes expanded comments while retaining the unsent reply', async () => {
  vi.mocked(getPostComments).mockResolvedValue([])
  const { rerender } = render(frame(0, <CommentSection postId={1} />))
  fireEvent.click(screen.getByRole('button', { name: /条回复/ }))
  const input = screen.getByPlaceholderText('写评论…')
  fireEvent.change(input, { target: { value: '我的未发送评论' } })
  await waitFor(() => expect(getPostComments).toHaveBeenCalled())
  vi.mocked(getPostComments).mockResolvedValue([{ id: 3, content: '新收到的评论', user: { id: 2, nickname: '同学' } }])
  rerender(frame(1, <CommentSection postId={1} />))
  await screen.findByText('新收到的评论')
  expect(input).toHaveValue('我的未发送评论')
})

it('updates existing post cards when revalidation changes the like count', () => {
  const post = { id: 1, content: '同一篇帖子', likes: 0, liked: false, images: [], user: { nickname: '同学' } }
  const card = (value) => <MemoryRouter><PostCard post={value} onReport={vi.fn()} onDeleted={vi.fn()} onTagClick={vi.fn()} /></MemoryRouter>
  const { rerender } = render(card(post))
  rerender(card({ ...post, likes: 8 }))
  expect(screen.getByText('8')).toBeVisible()
})

it('updates an existing poll when the refreshed post contains new vote totals', () => {
  const post = { id: 1, pollOptions: ['选项一', '选项二'], pollData: [0, 0] }
  const { rerender } = render(<PollView post={post} />)
  rerender(<PollView post={{ ...post, pollData: [2, 1] }} />)
  expect(screen.getByText('共 3 票，点击选项投票')).toBeVisible()
})

const detailFrame = (revision: number) => <MemoryRouter initialEntries={['/posts/1']}>
  <LiveDataContext.Provider value={{ revision, event: null }}>
    <Link to="/posts/2">另一篇帖子</Link>
    <Routes><Route path="/posts/:postId" element={<PostDetail />} /></Routes>
  </LiveDataContext.Provider>
</MemoryRouter>
const detail = { id: 1, content: '原帖内容', likes: 0, images: [], user: { nickname: '同学' } }

it('keeps a reply through a transient refresh failure but removes a confirmed deleted post', async () => {
  vi.mocked(getPost).mockResolvedValue(detail)
  vi.mocked(getPostComments).mockResolvedValue([])
  const { rerender } = render(detailFrame(0))
  await screen.findByText('原帖内容')
  fireEvent.click(screen.getByRole('button', { name: /条回复/ }))
  const input = screen.getByPlaceholderText('写评论…')
  fireEvent.change(input, { target: { value: '暂时失败也要保留' } })
  vi.mocked(getPost).mockRejectedValue(new ApiError('Temporary error', 503))
  rerender(detailFrame(1))
  await waitFor(() => expect(getPost).toHaveBeenCalledTimes(2))
  expect(input).toHaveValue('暂时失败也要保留')
  expect(screen.getByText('原帖内容')).toBeVisible()
  vi.mocked(getPost).mockRejectedValue(new ApiError('帖子已删除', 404))
  rerender(detailFrame(2))
  await screen.findByText('帖子已删除')
  expect(screen.queryByText('原帖内容')).not.toBeInTheDocument()
})

it('does not show the previous post while a different route is loading or missing', async () => {
  vi.mocked(getPostComments).mockResolvedValue([])
  let rejectNew!: (error: Error) => void
  vi.mocked(getPost).mockResolvedValueOnce(detail)
    .mockReturnValueOnce(new Promise((_, reject) => { rejectNew = reject }))
  render(detailFrame(0))
  await screen.findByText('原帖内容')
  fireEvent.click(screen.getByText('另一篇帖子'))
  await waitFor(() => expect(getPost).toHaveBeenLastCalledWith('2'))
  expect(screen.queryByText('原帖内容')).not.toBeInTheDocument()
  await act(async () => { rejectNew(new ApiError('帖子不存在', 404)) })
  await screen.findByText('帖子不存在')
  expect(screen.queryByText('原帖内容')).not.toBeInTheDocument()
})
