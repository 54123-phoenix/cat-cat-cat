import { useEffect, useState, useRef } from 'react'
import { useLiveData } from '../hooks/useLiveData'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Heart, Trash2, MessageCircle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import CommentSection from '../components/CommentSection'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import ImageWithShimmer from '../components/ImageWithShimmer'
import PhotoViewer from '../components/PhotoViewer'
import PollView from '../components/PollView'
import { ApiError, getPost, likePost, deletePost, getStoredUser } from '../api'
import { TOPIC_LABEL } from '../constants/topics'

export default function PostDetail() {
  const { revision } = useLiveData()
  const { postId } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [unavailable, setUnavailable] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(0)
  const [liking, setLiking] = useState(false)
  const [likeError, setLikeError] = useState('')
  const [likeBurst, setLikeBurst] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const generationRef = useRef(0)
  const likeLock = useRef(false)
  const deleteLock = useRef(false)
  const latestPost = useRef(null)
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deleteDialog = useRef<HTMLDialogElement>(null)
  const cancelDelete = useRef<HTMLButtonElement>(null)
  const deleteErrorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    generationRef.current++
    latestPost.current = null
    likeLock.current = false; deleteLock.current = false
    setPost(null); setLoading(true); setShowDeleteConfirm(false); setViewerIndex(null)
    setLikeError(''); setDeleteError(''); setLiking(false); setDeleting(false); setLikeBurst(false)
    return () => { generationRef.current++; if (burstTimer.current) clearTimeout(burstTimer.current) }
  }, [postId])

  useEffect(() => {
    let cancelled = false
    setError(''); setUnavailable(false); setRefreshing(true)
    getPost(postId).then(data => {
      if (cancelled) return
      latestPost.current = data
      setPost(data)
      if (!likeLock.current) { setLiked(Boolean(data.liked)); setLikes(data.likes || 0) }
    }).catch(err => {
      if (cancelled) return
      setError(err.message || '帖子暂时无法加载')
      if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
        setUnavailable(true); setPost(null); setViewerIndex(null); setShowDeleteConfirm(false)
      }
    }).finally(() => { if (!cancelled) { setLoading(false); setRefreshing(false) } })
    return () => { cancelled = true }
  }, [postId, revision, retryKey])

  useEffect(() => {
    const dialog = deleteDialog.current
    if (!dialog || !showDeleteConfirm) return undefined
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    cancelDelete.current?.focus()
    return () => { dialog.close(); document.body.style.overflow = previousOverflow }
  }, [showDeleteConfirm])
  useEffect(() => { if (deleteError) deleteErrorRef.current?.focus() }, [deleteError])

  async function handleLike() {
    if (!post || likeLock.current) return
    const generation = generationRef.current
    const nextLiked = !liked
    likeLock.current = true
    setLiked(nextLiked); setLikes(value => Math.max(0, value + (nextLiked ? 1 : -1)))
    setLiking(true); setLikeError('')
    if (nextLiked) {
      setLikeBurst(true)
      if (burstTimer.current) clearTimeout(burstTimer.current)
      burstTimer.current = setTimeout(() => { if (generation === generationRef.current) setLikeBurst(false) }, 500)
    }
    try {
      const result = await likePost(post.id)
      if (generation === generationRef.current && result) {
        setLiked(Boolean(result.liked)); setLikes(result.likes || 0)
        latestPost.current = { ...latestPost.current, liked: result.liked, likes: result.likes }
      }
    } catch {
      if (generation === generationRef.current) {
        setLiked(Boolean(latestPost.current?.liked)); setLikes(latestPost.current?.likes || 0)
        setLikeBurst(false); setLikeError('点赞暂时未能保存，请重试。')
      }
    } finally {
      if (generation === generationRef.current) { likeLock.current = false; setLiking(false) }
    }
  }

  function closeDelete() {
    if (!deleteLock.current) { setShowDeleteConfirm(false); setDeleteError('') }
  }

  async function handleDelete() {
    if (!post || deleteLock.current) return
    const generation = generationRef.current
    deleteLock.current = true
    setDeleting(true); setDeleteError('')
    try {
      await deletePost(post.id)
      if (generation === generationRef.current) navigate('/community')
    } catch (err) {
      if (generation === generationRef.current) setDeleteError((err.message || '删除失败') + '。暂时无法确认删除结果，请重试或刷新帖子。')
    } finally {
      if (generation === generationRef.current) { deleteLock.current = false; setDeleting(false) }
    }
  }

  if (loading && !post) {
    return <div className="space-y-6"><PageHeader title="帖子详情" /><p role="status" className="ui-meta text-sm text-text-secondary">正在加载帖子…</p><div aria-hidden="true" className="space-y-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full skeleton" /><div className="h-4 w-28 skeleton" /></div><div className="h-4 w-full skeleton" /><div className="h-4 w-3/4 skeleton" /><div className="aspect-[4/3] rounded-xl skeleton" /></div></div>
  }

  if (!post) {
    return <div className="space-y-6"><PageHeader title="帖子详情" /><EmptyState icon={MessageCircle} title={error || '帖子不存在'} description={unavailable ? '这条帖子当前无法查看，可以返回社区浏览其他内容。' : '请检查网络后重试。'} action={unavailable ? { label: '返回社区', onClick: () => navigate('/community') } : { label: refreshing ? '重试中…' : '重新加载帖子', onClick: () => { if (!refreshing) setRetryKey(value => value + 1) } }} /></div>
  }

  const currentUser = getStoredUser()
  const canDelete = Boolean(currentUser && (currentUser.id === post.userId || currentUser.role === 'admin'))

  return (
    <div className="space-y-6">
      <PageHeader title="帖子详情" />
      {error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-1 p-3"><p role="status" className="ui-meta text-sm leading-6 text-text-secondary">帖子暂时无法更新，下面保留已加载的内容。</p><button type="button" disabled={refreshing} onClick={() => setRetryKey(value => value + 1)} className="btn btn-ghost">重试更新帖子</button></div>}
      <article className="space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3"><Avatar user={post.user} size="md" /><div className="min-w-0"><p className="text-sm font-semibold text-text [overflow-wrap:anywhere]">{post.user?.nickname || '铲屎官 #' + post.userId}</p><p className="ui-meta mt-1 text-sm text-text-secondary [overflow-wrap:anywhere]">{post.createdAt}</p></div></div>
          {canDelete && <button type="button" onClick={() => setShowDeleteConfirm(true)} className="icon-button shrink-0 hover:text-danger" aria-label="删除帖子"><Trash2 size={20} aria-hidden="true" /></button>}
        </header>
        <div className="flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-primary-light px-3 py-1 text-primary">{TOPIC_LABEL[post.topic] || '铲屎日常'}</span>{post.postType === 'poll' && <span className="rounded-full bg-surface-3 px-3 py-1 text-text-secondary">投票</span>}{post.postType === 'question' && <span className="rounded-full bg-surface-3 px-3 py-1 text-text-secondary">求助</span>}</div>
        {post.relatedCat && <Link to={'/cats/' + post.relatedCat.id} className="flex min-h-11 items-center rounded-xl bg-primary-light px-3 py-2 text-sm font-medium text-primary">关于 {post.relatedCat.name}</Link>}
        <p className="ui-body whitespace-pre-wrap text-base leading-8 text-text [overflow-wrap:anywhere]">{post.content}</p>
        {post.images?.length > 0 && <div className={'grid gap-3 ' + (post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>{post.images.map((image, index) => <button type="button" key={index} onClick={() => setViewerIndex(index)} aria-label={'查看帖子图片 ' + (index + 1) + '，共 ' + post.images.length + ' 张'} className={'overflow-hidden rounded-xl bg-surface-3 ' + (post.images.length === 1 ? 'aspect-[4/3]' : 'aspect-square')}><ImageWithShimmer src={image} alt={'帖子图片 ' + (index + 1)} loading="lazy" width={post.images.length === 1 ? 960 : 320} sizes={post.images.length === 1 ? '(min-width: 1024px) 800px, 90vw' : post.images.length === 2 ? '(min-width: 1024px) 380px, 43vw' : '(min-width: 1024px) 250px, 28vw'} className="h-full w-full" /></button>)}</div>}
        {post.tags?.length > 0 && <div className="flex flex-wrap gap-2">{post.tags.map(tag => <span key={tag} className="rounded-full bg-primary-light px-3 py-1.5 text-sm text-primary [overflow-wrap:anywhere]">{tag}</span>)}</div>}
        {post.postType === 'poll' && post.pollOptions?.length > 0 && <PollView post={post} />}
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <button type="button" onClick={handleLike} disabled={liking} aria-label={liked ? '取消赞' : '赞'} aria-pressed={liked} className={'relative flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm ' + (liked ? 'text-primary' : 'text-text-secondary')}><Heart size={20} aria-hidden="true" className={liked ? 'fill-primary' : ''} /><span>{likes} 赞</span>{likeBurst && <span aria-hidden="true" className="absolute -top-3 left-2 animate-burst-up">🐟</span>}</button>
          <a href={'#comments-' + post.id} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-text-secondary hover:text-primary"><MessageCircle size={20} aria-hidden="true" />参与讨论</a>
        </div>
        {likeError && <p role="alert" className="ui-meta text-sm leading-6 text-danger">{likeError}</p>}
      </article>
      <CommentSection key={post.id} postId={post.id} initialCount={post.comments || 0} expanded isQuestion={post.postType === 'question'} acceptedCommentId={post.acceptedCommentId} canAccept={canDelete} />
      {viewerIndex !== null && post.images?.length > 0 && <PhotoViewer images={post.images.map((url, index) => ({ url, alt: '帖子图片 ' + (index + 1) }))} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />}
      <dialog ref={deleteDialog} aria-labelledby="delete-detail-title" aria-describedby="delete-detail-help" className="!m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-24px)] max-w-sm overflow-y-auto rounded-2xl border border-border bg-surface-1 p-5 text-text backdrop:bg-black/50"
        onCancel={event => { event.preventDefault(); closeDelete() }}
        onKeyDown={event => {
          if (event.key !== 'Tab') return
          const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
          const first = controls[0], last = controls[controls.length - 1]
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }}>
        <div className="space-y-4" aria-busy={deleting}><h2 id="delete-detail-title" className="ui-section-title text-xl font-bold">删除这条帖子？</h2><p id="delete-detail-help" className="ui-meta text-sm leading-6 text-text-secondary">删除后无法恢复，相关讨论也将不再显示。</p>{deleteError && <p ref={deleteErrorRef} role="alert" tabIndex={-1} className="ui-meta rounded-xl bg-danger/5 p-3 text-sm leading-6 text-danger">{deleteError}</p>}<div className="flex flex-wrap justify-end gap-2"><button ref={cancelDelete} type="button" onClick={closeDelete} disabled={deleting} className="btn btn-ghost">保留帖子</button><button type="button" onClick={handleDelete} disabled={deleting} className="btn btn-danger">{deleting ? '删除中…' : '确认删除'}</button></div></div>
      </dialog>
    </div>
  )
}
