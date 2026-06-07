import { useState, useEffect } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { getPostComments, createComment, getStoredUser } from '../api'

const MOCK_USERS = [
  { id: 101, nickname: '橘猫守护者', avatar: null },
  { id: 102, nickname: '南区喂猫人', avatar: null },
  { id: 103, nickname: '图书馆常客', avatar: null },
  { id: 104, nickname: '猫协志愿者', avatar: null },
  { id: 105, nickname: '东区散步党', avatar: null },
]

function getUserDisplay(user) {
  if (user?.nickname) return user
  const mock = MOCK_USERS.find((m) => m.id === user?.id)
  if (mock) return mock
  return { nickname: `铲屎官 #${user?.id || '?'}` }
}

const AVATAR_COLORS = ['bg-orange-100 text-orange-600', 'bg-blue-100 text-blue-600', 'bg-green-100 text-green-600', 'bg-purple-100 text-purple-600', 'bg-pink-100 text-pink-600']

function Avatar({ user, size = 'sm' }) {
  const display = getUserDisplay(user)
  const colorIndex = (user?.id || 0) % AVATAR_COLORS.length
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'

  if (user?.avatar) {
    return (
      <img src={user.avatar} alt="" className={`${sizeClass} rounded-full object-cover`} />
    )
  }

  const initial = (display.nickname?.[0] || '?').toUpperCase()
  return (
    <div className={`${sizeClass} rounded-full ${AVATAR_COLORS[colorIndex]} flex items-center justify-center font-semibold shrink-0`}>
      {initial}
    </div>
  )
}

export default function CommentSection({ postId, initialCount = 0 }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState(false)

  async function loadComments() {
    if (loading) return
    setLoading(true)
    try {
      const data = await getPostComments(postId)
      setComments(Array.isArray(data) ? data : [])
    } catch {
      setComments([])
    } finally {
      setLoading(false)
    }
  }

  function toggleExpanded() {
    if (!expanded) loadComments()
    setExpanded(!expanded)
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

  const total = Math.max(initialCount, comments.length)

  return (
    <div className="border-t border-gray-50 pt-2 mt-1">
      <button
        onClick={toggleExpanded}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary transition-colors py-1"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {total} 条回复{!expanded ? ' ›' : ' ∧'}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2.5 animate-fade-up">
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
            comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <Avatar user={c.user} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-secondary">{getUserDisplay(c.user).nickname}</span>
                    <span className="text-xs text-gray-300">{c.createdAt}</span>
                  </div>
                  <p className="text-sm text-text leading-relaxed mt-0.5">{c.content}</p>
                </div>
              </div>
            ))
          ) : !loading && (
            <p className="text-xs text-text-muted text-center py-2">还没有评论，来说两句吧</p>
          )}

          {/* Comment input */}
          <form onSubmit={handleSubmit} className="flex gap-2 items-end pt-1">
            <Avatar user={getStoredUser()} />
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
