import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { likePost, deletePost, getStoredUser } from '../api'
import { Flag, Trash2, Heart, MessageCircle } from 'lucide-react'
import Avatar from './Avatar'
import ImageWithShimmer from './ImageWithShimmer'
import PollView from './PollView'
import { TOPIC_LABEL, TAG_TOPIC_MAP } from '../constants/topics'
import { toast } from './Toast'

export default function PostCard({ post, onReport = undefined, onDeleted = undefined, onTagClick = undefined }) {
  const [liked, setLiked] = useState(Boolean(post.liked))
  const [likes, setLikes] = useState(post.likes || 0)
  const [liking, setLiking] = useState(false)
  const [burst, setBurst] = useState(false)
  const [likeError, setLikeError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const mountedRef = useRef(true)
  const likeLock = useRef(false)
  const deleteLock = useRef(false)
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestPost = useRef(post)
  useEffect(() => { latestPost.current = post }, [post])
  const deleteDialog = useRef<HTMLDialogElement>(null)
  const cancelDelete = useRef<HTMLButtonElement>(null)
  const deleteErrorRef = useRef<HTMLParagraphElement>(null)
  const currentUser = getStoredUser()
  const canDelete = currentUser && (currentUser.id === post.userId || currentUser.role === 'admin')

  useEffect(() => {
    if (!likeLock.current) { setLiked(Boolean(post.liked)); setLikes(post.likes || 0) }
  }, [post.liked, post.likes])
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; if (burstTimer.current) clearTimeout(burstTimer.current) }
  }, [])
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
    if (likeLock.current) return
    likeLock.current = true
    const nextLiked = !liked
    setLiked(nextLiked); setLikes(value => Math.max(0, value + (nextLiked ? 1 : -1)))
    setLiking(true); setLikeError('')
    if (nextLiked) {
      setBurst(true)
      if (burstTimer.current) clearTimeout(burstTimer.current)
      burstTimer.current = setTimeout(() => { if (mountedRef.current) setBurst(false) }, 600)
    }
    try {
      const result = await likePost(post.id)
      if (mountedRef.current && result) { setLiked(Boolean(result.liked)); setLikes(result.likes || 0) }
    } catch {
      if (mountedRef.current) {
        setLiked(Boolean(latestPost.current.liked)); setLikes(latestPost.current.likes || 0)
        setBurst(false); setLikeError('点赞暂时未能保存，请重试。')
      }
    } finally {
      likeLock.current = false
      if (mountedRef.current) setLiking(false)
    }
  }

  function closeDelete() { if (!deleteLock.current) { setShowDeleteConfirm(false); setDeleteError('') } }

  async function handleDelete() {
    if (deleteLock.current) return
    deleteLock.current = true
    setDeleting(true); setDeleteError('')
    try {
      await deletePost(post.id)
      if (mountedRef.current) { setShowDeleteConfirm(false); toast('帖子已删除'); onDeleted?.(post.id) }
    } catch (error) {
      if (mountedRef.current) setDeleteError((error.message || '删除失败') + '。暂时无法确认删除结果，请重试或刷新帖子。')
    } finally {
      deleteLock.current = false
      if (mountedRef.current) setDeleting(false)
    }
  }

  return (
    <article className="space-y-4 rounded-card border border-border bg-surface-1 p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><Avatar user={post.user} size="md" /><div className="min-w-0"><p className="text-sm font-semibold text-text [overflow-wrap:anywhere]">{post.user?.nickname || '铲屎官 #' + post.userId}</p><p className="mt-0.5 text-sm text-text-secondary [overflow-wrap:anywhere]">{post.createdAt}</p></div></div>
        <div className="flex shrink-0 items-center">
          {canDelete && <button type="button" onClick={() => setShowDeleteConfirm(true)} className="icon-button hover:text-danger" aria-label="删除帖子"><Trash2 size={18} aria-hidden="true" /></button>}
          {onReport && <button type="button" onClick={() => onReport(post)} className="icon-button hover:text-danger" aria-label="举报帖子"><Flag size={18} aria-hidden="true" /></button>}
        </div>
      </header>
      <div className="flex flex-wrap gap-2 text-sm text-text-secondary"><span className="rounded-full bg-primary-light px-3 py-1 text-primary">{TOPIC_LABEL[post.topic] || '铲屎日常'}</span>{post.postType === 'poll' && <span className="rounded-full bg-surface-3 px-3 py-1">投票</span>}{post.postType === 'question' && <span className="rounded-full bg-surface-3 px-3 py-1">求助</span>}</div>
      {post.relatedCat && <Link to={'/cats/' + post.relatedCat.id} className="flex min-h-11 items-center rounded-xl bg-primary-light px-3 py-2 text-sm font-medium text-primary">关于 {post.relatedCat.name}</Link>}
      <Link to={'/posts/' + post.id} className="block rounded-xl">
        <p className="ui-body whitespace-pre-wrap text-text">{post.content}</p>
        {post.images?.length > 0 && <div className={'mt-3 grid gap-2 ' + (post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
          {post.images.map((image, index) => <div key={index} className={'overflow-hidden rounded-xl bg-surface-3 ' + (post.images.length === 1 ? 'aspect-[4/3]' : 'aspect-square')}><ImageWithShimmer src={image} alt={'帖子图片 ' + (index + 1) + '，共 ' + post.images.length + ' 张'} loading="lazy" width={post.images.length === 1 ? 960 : 320} sizes={post.images.length === 1 ? '(min-width: 1024px) 780px, 90vw' : post.images.length === 2 ? '(min-width: 1024px) 380px, 42vw' : '(min-width: 1024px) 250px, 28vw'} className="h-full w-full" /></div>)}
        </div>}
      </Link>
      {post.postType === 'poll' && post.pollOptions?.length > 0 && <PollView post={post} />}
      {post.tags?.length > 0 && <div className="flex flex-wrap gap-2">{post.tags.map(tag => onTagClick && TAG_TOPIC_MAP[tag] ? <button type="button" key={tag} onClick={() => onTagClick(tag)} className="min-h-11 rounded-full bg-primary-light px-3 text-sm text-primary [overflow-wrap:anywhere]">{tag}</button> : <span key={tag} className="inline-flex min-h-11 items-center rounded-full bg-surface-3 px-3 text-sm text-text-secondary [overflow-wrap:anywhere]">{tag}</span>)}</div>}
      <footer className="flex flex-wrap items-center gap-3 border-t border-border pt-2">
        <button type="button" onClick={handleLike} disabled={liking} aria-label={liked ? '取消赞' : '赞'} aria-pressed={liked} className={'relative flex min-h-11 min-w-11 items-center gap-2 rounded-xl px-3 text-sm ' + (liked ? 'text-primary' : 'text-text-secondary')}><Heart size={20} aria-hidden="true" className={liked ? 'fill-primary' : ''} /><span>{likes}</span>{burst && <span aria-hidden="true" className="like-burst-item" style={{ top: '-4px', left: '8px', animation: 'like-fish-2 0.6s ease-out forwards' }}>🐠</span>}</button>
        <Link to={'/posts/' + post.id} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-text-secondary hover:text-primary"><MessageCircle size={20} aria-hidden="true" />{post.comments || 0} 条回复</Link>
      </footer>
      {likeError && <p role="alert" className="text-sm text-danger">{likeError}</p>}
      <dialog ref={deleteDialog} aria-labelledby={'delete-post-title-' + post.id} aria-describedby={'delete-post-help-' + post.id} className="!m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-24px)] max-w-sm overflow-y-auto rounded-2xl border border-border bg-surface-1 p-5 text-text shadow-e3 backdrop:bg-black/50"
        onCancel={event => { event.preventDefault(); closeDelete() }}
        onKeyDown={event => {
          if (event.key !== 'Tab') return
          const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
          const first = controls[0], last = controls[controls.length - 1]
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }}>
        <div className="space-y-4" aria-busy={deleting}><h2 id={'delete-post-title-' + post.id} className="text-xl font-bold">删除这条帖子？</h2><p id={'delete-post-help-' + post.id} className="text-sm leading-6 text-text-secondary">删除后无法恢复，相关讨论也将不再显示。</p>{deleteError && <p ref={deleteErrorRef} role="alert" tabIndex={-1} className="rounded-xl bg-danger/5 p-3 text-sm leading-6 text-danger">{deleteError}</p>}<div className="flex flex-wrap justify-end gap-2"><button ref={cancelDelete} type="button" onClick={closeDelete} disabled={deleting} className="btn btn-ghost">保留帖子</button><button type="button" onClick={handleDelete} disabled={deleting} className="btn btn-danger">{deleting ? '删除中…' : '确认删除'}</button></div></div>
      </dialog>
    </article>
  )
}
