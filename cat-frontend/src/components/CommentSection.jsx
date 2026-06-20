import { useState, useRef } from 'react'
import { MessageCircle, Send, CheckCircle2 } from 'lucide-react'
import { getPostComments, createComment, acceptAnswer, getStoredUser } from '../api'
import Avatar from './Avatar'

function getUserDisplay(user) {
  if (user?.nickname) return user
  return { nickname: `铲屎官 #${user?.id || '?'}` }
}

export default function CommentSection({ postId, initialCount = 0, expanded: expandedProp, onExpand, isQuestion, acceptedCommentId, canAccept }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [internalExpanded, setInternalExpanded] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [acceptedId, setAcceptedId] = useState(acceptedCommentId || null)
  const requestIdRef = useRef(0)

  const expanded = expandedProp ?? internalExpanded

  async function loadComments() {
    const rid = ++requestIdRef.current
    setLoading(true)
    try {
      const data = await getPostComments(postId)
      if (rid === requestIdRef.current) {
        setComments(Array.isArray(data) ? data : [])
      }
    } catch {
      if (rid === requestIdRef.current) {
        setComments([])
      }
    } finally {
      if (rid === requestIdRef.current) {
        setLoading(false)
      }
    }
  }

  function toggleExpanded() {
    if (!expanded) loadComments()
    if (onExpand) onExpand()
    else setInternalExpanded(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim() || submitting) return
    setSubmitting(true)
    try {
      const newComment = await createComment(postId, { content: text.trim() })
      setComments((prev) => [...prev, newComment])
      setText('')
    } catch {
      // silent fail
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAccept(commentId) {
    if (accepting) return
    setAccepting(true)
    try {
      await acceptAnswer(postId, commentId)
      setAcceptedId(commentId)
    } catch (e) {
      alert(e.message || '采纳失败')
    } finally {
      setAccepting(false)
    }
  }

  const total = Math.max(initialCount, comments.length)
  const sortedComments = [...comments].sort((a, b) => {
    if (a.id === acceptedId) return -1
    if (b.id === acceptedId) return 1
    return 0
  })

  return (
    <div className="border-t border-gray-50 pt-2 mt-1">
      <button
        onClick={toggleExpanded}
        className="flex items-center gap-2 text-xs text-gray-400 hover:text-primary transition-colors py-1"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {total} 条回复{!expanded ? ' ›' : ' ∧'}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 animate-fade-up">
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-2">
                  <div className="w-6 h-6 rounded-full skeleton" />
                  <div className="flex-1 space-y-1">
                    <div className="h-2.5 w-16 skeleton" />
                    <div className="h-3 w-full skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length > 0 ? (
            sortedComments.map((c) => {
              const isAccepted = c.id === acceptedId
              return (
              <div key={c.id} className={`flex gap-2 ${isAccepted ? 'bg-green-50 rounded-lg p-2 -m-1' : ''}`}>
                <Avatar user={c.user} size="xs" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-secondary">{getUserDisplay(c.user).nickname}</span>
                    <span className="text-xs text-gray-300">{c.createdAt}</span>
                    {isAccepted && (
                      <span className="text-xs text-green-600 flex items-center gap-0.5 font-medium">
                        <CheckCircle2 className="w-3 h-3" />已采纳
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text leading-relaxed mt-0.5">{c.content}</p>
                  {isQuestion && canAccept && !isAccepted && (
                    <button
                      onClick={() => handleAccept(c.id)}
                      disabled={accepting}
                      className="mt-1 text-xs text-green-600 flex items-center gap-0.5 hover:text-green-700"
                    >
                      <CheckCircle2 className="w-3 h-3" />采纳为最佳答案
                    </button>
                  )}
                </div>
              </div>
              )
            })
          ) : (
            <p className="text-xs text-text-muted text-center py-2">还没有评论，来说两句吧</p>
          )}

          {/* Comment input */}
          <form onSubmit={handleSubmit} className="flex gap-2 items-end pt-1">
            <Avatar user={getStoredUser()} size="xs" />
            <div className="flex-1 flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="写评论…"
                maxLength={200}
                className="flex-1 text-sm bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5 outline-none focus:border-primary transition-colors placeholder:text-gray-300"
              />
              <button
                type="submit"
                disabled={!text.trim() || submitting}
                className="shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center disabled:opacity-30 active:bg-primary/20 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
