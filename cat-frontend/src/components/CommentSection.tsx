import { useState, useRef, useEffect } from 'react'
import { useLiveData } from '../hooks/useLiveData'
import { MessageCircle, Send, CheckCircle2 } from 'lucide-react'
import { getPostComments, createComment, acceptAnswer } from '../api'
import Avatar from './Avatar'

function getUserDisplay(user) {
  if (user?.nickname) return user
  return { nickname: '铲屎官 #' + (user?.id || '?') }
}

interface CommentSectionProps {
  postId: any
  initialCount?: number
  expanded?: boolean
  onExpand?: () => void
  isQuestion?: boolean
  acceptedCommentId?: any
  canAccept?: boolean
}

export default function CommentSection({ postId, initialCount = 0, expanded: expandedProp, onExpand, isQuestion, acceptedCommentId, canAccept }: CommentSectionProps) {
  const { revision } = useLiveData()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(Boolean(expandedProp))
  const [loadError, setLoadError] = useState('')
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitStatus, setSubmitStatus] = useState('')
  const [internalExpanded, setInternalExpanded] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState('')
  const [acceptedId, setAcceptedId] = useState(acceptedCommentId || null)
  const [retryKey, setRetryKey] = useState(0)
  const requestIdRef = useRef(0)
  const generationRef = useRef(0)
  const submitLock = useRef(false)
  const acceptLock = useRef(false)
  const loadingRef = useRef(false)
  const submitErrorRef = useRef<HTMLParagraphElement>(null)
  const expanded = expandedProp ?? internalExpanded

  useEffect(() => {
    generationRef.current++
    setComments([]); setText(''); setLoadError(''); setSubmitError(''); setSubmitStatus(''); setAcceptError('')
    setSubmitting(false); setAccepting(false)
    submitLock.current = false; acceptLock.current = false
    return () => { generationRef.current++ }
  }, [postId])
  useEffect(() => { setAcceptedId(acceptedCommentId || null) }, [acceptedCommentId, postId])
  useEffect(() => { if (submitError) submitErrorRef.current?.focus() }, [submitError])

  useEffect(() => {
    if (!expanded) return undefined
    const requestId = ++requestIdRef.current
    setLoading(true); setLoadError('')
    loadingRef.current = true
    getPostComments(postId).then(data => {
      if (requestId === requestIdRef.current) setComments(Array.isArray(data) ? data : [])
    }).catch(() => {
      if (requestId === requestIdRef.current) setLoadError('评论暂时无法加载，请重试。')
    }).finally(() => {
      if (requestId === requestIdRef.current) { setLoading(false); loadingRef.current = false }
    })
    return () => { requestIdRef.current++; loadingRef.current = false }
  }, [revision, postId, expanded, retryKey])

  function toggleExpanded() {
    if (onExpand) onExpand()
    else setInternalExpanded(previous => !previous)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!text.trim() || submitLock.current) return
    const generation = generationRef.current
    submitLock.current = true
    setSubmitting(true); setSubmitError(''); setSubmitStatus('')
    try {
      const newComment = await createComment(postId, { content: text.trim() })
      if (generation !== generationRef.current) return
      setComments(previous => previous.some(comment => comment.id === newComment.id) ? previous : [...previous, newComment])
      setText('')
      setSubmitStatus('评论已发送。')
      // A read started before this write must not hide the newly created reply.
      if (loadingRef.current) {
        requestIdRef.current++
        setRetryKey(value => value + 1)
      }
    } catch (error) {
      if (generation === generationRef.current) setSubmitError((error.message || '评论发送失败') + '。内容已保留，可以重试。')
    } finally {
      if (generation === generationRef.current) { submitLock.current = false; setSubmitting(false) }
    }
  }

  async function handleAccept(commentId) {
    if (acceptLock.current) return
    const generation = generationRef.current
    acceptLock.current = true
    setAccepting(true); setAcceptError('')
    try {
      await acceptAnswer(postId, commentId)
      if (generation === generationRef.current) setAcceptedId(commentId)
    } catch (error) {
      if (generation === generationRef.current) setAcceptError((error.message || '采纳失败') + '，请重试。')
    } finally {
      if (generation === generationRef.current) { acceptLock.current = false; setAccepting(false) }
    }
  }

  const total = Math.max(initialCount, comments.length)
  const sortedComments = [...comments].sort((a, b) => a.id === acceptedId ? -1 : b.id === acceptedId ? 1 : 0)
  const listId = 'comments-' + postId

  return (
    <section id={listId} tabIndex={-1} className="space-y-4 border-t border-border pt-5" aria-label="帖子回复">
      {expandedProp === true
        ? <h2 className="ui-section-title text-lg font-semibold text-text">{total} 条回复</h2>
        : <button type="button" onClick={toggleExpanded} aria-expanded={expanded} aria-controls={listId + '-content'} className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-text-secondary hover:text-primary"><MessageCircle size={20} aria-hidden="true" />{total} 条回复 · {expanded ? '收起' : '展开'}</button>}
      {expanded && <div id={listId + '-content'} className="space-y-5">
        {loadError && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-1 p-3"><p role="status" className="ui-meta text-sm leading-6 text-text-secondary">{comments.length > 0 ? '评论暂时无法更新，已加载的回复仍可浏览。' : loadError}</p><button type="button" disabled={loading} onClick={() => setRetryKey(value => value + 1)} className="btn btn-ghost">重试加载评论</button></div>}
        {loading && <p role="status" className="ui-meta text-sm text-text-secondary">{comments.length ? '正在更新评论…' : '正在加载评论…'}</p>}
        {loading && comments.length === 0 && <div aria-hidden="true" className="space-y-4">{[1, 2].map(id => <div key={id} className="flex gap-3"><div className="h-8 w-8 rounded-full skeleton" /><div className="flex-1 space-y-2"><div className="h-3 w-20 skeleton" /><div className="h-4 w-full skeleton" /></div></div>)}</div>}
        {comments.length > 0 && <ol className="space-y-5">{sortedComments.map(comment => {
          const isAccepted = comment.id === acceptedId
          return <li key={comment.id} className={'flex gap-3 ' + (isAccepted ? 'rounded-xl border border-success/20 bg-success/5 p-3' : '')}>
            <Avatar user={comment.user} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"><span className="font-semibold text-text [overflow-wrap:anywhere]">{getUserDisplay(comment.user).nickname}</span><span className="ui-meta text-text-secondary">{comment.createdAt}</span>{isAccepted && <span className="flex items-center gap-1 font-medium text-success"><CheckCircle2 size={16} aria-hidden="true" />已采纳</span>}</div>
              <p className="ui-body mt-2 whitespace-pre-wrap text-base leading-7 text-text [overflow-wrap:anywhere]">{comment.content}</p>
              {isQuestion && canAccept && !isAccepted && <button type="button" onClick={() => handleAccept(comment.id)} disabled={accepting} className="mt-2 flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-success disabled:opacity-50"><CheckCircle2 size={18} aria-hidden="true" />{accepting ? '正在采纳…' : '采纳为最佳答案'}</button>}
            </div>
          </li>
        })}</ol>}
        {!loading && !loadError && comments.length === 0 && <p className="ui-meta py-3 text-sm leading-6 text-text-secondary">还没有评论，来说两句吧。</p>}
        {acceptError && <p role="alert" className="ui-meta text-sm leading-6 text-danger">{acceptError}</p>}
        <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border bg-surface-1 p-4" aria-busy={submitting}>
          <label htmlFor={listId + '-input'} className="block text-sm font-semibold text-text">写下你的回复</label>
          <textarea id={listId + '-input'} value={text} disabled={submitting} onChange={event => { setText(event.target.value); setSubmitStatus('') }} placeholder="写评论…" maxLength={200} aria-describedby={listId + '-help'} className="ui-input min-h-28 w-full resize-y rounded-xl border border-border bg-surface-1 p-3 text-base leading-7 text-text" />
          <div className="flex flex-wrap items-center justify-between gap-3"><p id={listId + '-help'} className="ui-meta text-sm text-text-secondary">{text.length}/200 字</p><button type="submit" disabled={!text.trim() || submitting} className="btn btn-primary"><Send size={18} aria-hidden="true" />{submitting ? '发送中…' : '发送回复'}</button></div>
          {submitError && <p ref={submitErrorRef} role="alert" tabIndex={-1} className="ui-meta rounded-xl bg-danger/5 p-3 text-sm leading-6 text-danger">{submitError}</p>}
          <p role="status" className="ui-meta text-sm text-success">{submitStatus}</p>
        </form>
      </div>}
    </section>
  )
}
