import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { likePost, deletePost, getStoredUser } from '../api'
import { Flag, Trash2, Heart, MessageCircle } from 'lucide-react'
import CommentSection from './CommentSection'
import Avatar from './Avatar'

const TOPIC_LABEL = {
  find: '寻猫问猫',
  daily: '铲屎日常',
  health: '健康互助',
  suggest: '建议反馈',
}

const TOPIC_COLORS = {
  find: { bg: 'bg-primary-light', text: 'text-primary' },
  daily: { bg: 'bg-mint-light', text: 'text-mint' },
  health: { bg: 'bg-info/10', text: 'text-info' },
  suggest: { bg: 'bg-warning/10', text: 'text-warning' },
}

export default function PostCard({ post, onReport, onDeleted, onTagClick }) {
  const navigate = useNavigate()
  const [liked, setLiked] = useState(Boolean(post.liked))
  const [likes, setLikes] = useState(post.likes || 0)
  const [liking, setLiking] = useState(false)
  const [burst, setBurst] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const mountedRef = useRef(true)
  useEffect(() => { return () => { mountedRef.current = false } }, [])
  const currentUser = getStoredUser()
  const canDelete = currentUser && (currentUser.id === post.userId || currentUser.role === 'admin')

  function goToDetail() {
    navigate(`/posts/${post.id}`)
  }

  async function handleLike() {
    if (liking) return
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikes((value) => Math.max(0, value + (nextLiked ? 1 : -1)))
    setLiking(true)
    if (nextLiked) {
      setBurst({ id: Math.random().toString(36).slice(2) })
      setTimeout(() => { if (mountedRef.current) setBurst(null) }, 600)
    }
    try {
      await likePost(post.id)
    } catch {
      setLiked(!nextLiked)
      setLikes((value) => Math.max(0, value + (nextLiked ? -1 : 1)))
    } finally {
      setTimeout(() => { if (mountedRef.current) setLiking(false) }, 300)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deletePost(post.id)
      onDeleted?.(post.id)
    } catch (e) {
      console.error(e)
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="bg-white ring-1 ring-stone-900/5 shadow-e1 rounded-card p-4 space-y-3 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar user={post.user} />
          <div>
            <div className="text-body-sm font-medium text-text">{post.user?.nickname || `铲屎官 #${post.userId}`}</div>
            <div className="text-caption text-text-muted">{post.createdAt}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-caption px-2 py-0.5 rounded-full font-medium ${
            TOPIC_COLORS[post.topic]?.bg || 'bg-gray-50'
          } ${
            TOPIC_COLORS[post.topic]?.text || 'text-gray-400'
          }`}>
            {TOPIC_LABEL[post.topic] || '铲屎日常'}
          </span>
          {canDelete && (
            <button onClick={() => setShowDeleteConfirm(true)} className="text-gray-300 hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onReport && (
            <button onClick={() => onReport(post)} className="text-gray-300 hover:text-red-400 transition-colors">
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {post.relatedCat && (
        <Link to={`/cats/${post.relatedCat.id}`} className="flex items-center gap-2 bg-primary-light rounded-lg px-3 py-2 active:bg-orange-100">
          <span className="text-sm text-primary font-medium">{post.relatedCat.name}</span>
        </Link>
      )}

      {/* Clickable content area → navigate to detail page */}
      <div
        className="cursor-pointer active:bg-gray-50/50 -mx-1 px-1 rounded-lg"
        onClick={goToDetail}
      >
        <p className="text-body text-text leading-relaxed whitespace-pre-wrap">{post.content}</p>

        {post.images?.length > 0 && (
          <div className={`grid gap-2 mt-3 ${
            post.images.length === 1 ? 'grid-cols-1' :
            post.images.length === 2 ? 'grid-cols-2' :
            post.images.length === 3 ? 'grid-cols-2' :
            'grid-cols-3'
          }`}>
            {post.images.map((img, i) => (
              <div
                key={i}
                className={`rounded-xl overflow-hidden bg-gray-100 ${
                  post.images.length === 3 && i === 0 ? 'row-span-2' : ''
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" style={{ minHeight: 120 }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {post.tags?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <button
              key={tag}
              onClick={() => onTagClick?.(tag)}
              className="text-xs text-primary bg-primary-light px-2 py-0.5 rounded-full active:bg-orange-200 transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 pt-1 border-t border-gray-50">
        <button onClick={handleLike} className={`relative flex items-center gap-2 text-xs transition-colors ${liked ? 'text-primary' : 'text-gray-400'}`}>
          <Heart className={`w-4 h-4 ${liked ? 'fill-primary' : ''} ${liking ? 'animate-like-pop' : ''}`} />
          {likes}
          {burst && (
            <>
              <span key={`${burst.id}-1`} className="like-burst-item" style={{ top: '-4px', left: '0px', animation: 'like-fish-1 0.6s ease-out forwards' }}>🐟</span>
              <span key={`${burst.id}-2`} className="like-burst-item" style={{ top: '-4px', left: '8px', animation: 'like-fish-2 0.6s ease-out forwards' }}>🐠</span>
              <span key={`${burst.id}-3`} className="like-burst-item" style={{ top: '-4px', left: '16px', animation: 'like-fish-3 0.6s ease-out forwards' }}>🐡</span>
            </>
          )}
        </button>
        <button onClick={goToDetail} className="flex items-center gap-2 text-xs text-gray-400 hover:text-primary transition-colors">
          <MessageCircle className="w-3.5 h-3.5" />
          {post.comments || 0} 条回复 ›
        </button>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-72 space-y-4 animate-scale-in">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-sm text-gray-700 font-medium">确定要删除这条帖子吗？</p>
              <p className="text-xs text-gray-400">删除后无法恢复</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm text-gray-500 btn-ghost"
              >
                算了
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-full bg-red-500 text-white text-sm disabled:opacity-40"
              >
                {deleting ? '推走中…' : '推走'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
