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
  find: { bg: 'bg-orange-50', text: 'text-orange-600' },
  daily: { bg: 'bg-green-50', text: 'text-green-600' },
  health: { bg: 'bg-blue-50', text: 'text-blue-600' },
  suggest: { bg: 'bg-purple-100', text: 'text-purple-700' },
}

export default function PostCard({ post, onReport, onDeleted, onTagClick }) {
  const navigate = useNavigate()
  const [liked, setLiked] = useState(Boolean(post.liked))
  const [likes, setLikes] = useState(post.likes || 0)
  const [liking, setLiking] = useState(false)
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
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Avatar user={post.user} />
          <div>
            <div className="text-xs font-medium text-gray-700">{post.user?.nickname || `铲屎官 #${post.userId}`}</div>
            <div className="text-xs text-gray-400">{post.createdAt}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
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
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{post.content}</p>

        {post.images?.length > 0 && (
          <div className={`grid gap-1.5 mt-3 ${
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
        <div className="flex flex-wrap gap-1.5">
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
        <button onClick={handleLike} className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? 'text-primary' : 'text-gray-400'}`}>
          <Heart className={`w-4 h-4 ${liked ? 'fill-primary' : ''} ${liking ? 'animate-like-pop' : ''}`} />
          {likes}
        </button>
        <button onClick={goToDetail} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary transition-colors">
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
