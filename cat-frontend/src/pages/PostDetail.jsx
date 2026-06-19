import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Heart, Flag, Trash2 } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import CommentSection from '../components/CommentSection'
import Avatar from '../components/Avatar'
import { getPost, likePost, deletePost, getStoredUser } from '../api'

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

export default function PostDetail() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const mountedRef = useRef(true)
  useEffect(() => { return () => { mountedRef.current = false } }, [])
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(0)
  const [liking, setLiking] = useState(false)
  const [likeBurst, setLikeBurst] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getPost(postId)
      .then((data) => {
        setPost(data)
        setLiked(Boolean(data.liked))
        setLikes(data.likes || 0)
      })
      .catch((err) => setError(err.message || '帖子加载失败'))
      .finally(() => setLoading(false))
  }, [postId])

  async function handleLike() {
    if (liking) return
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikes((v) => Math.max(0, v + (nextLiked ? 1 : -1)))
    setLiking(true)
    if (nextLiked) {
      setLikeBurst(true)
      setTimeout(() => { if (mountedRef.current) setLikeBurst(false) }, 500)
    }
    try {
      await likePost(post.id)
    } catch {
      setLiked(!nextLiked)
      setLikes((v) => Math.max(0, v + (nextLiked ? -1 : 1)))
    } finally {
      setTimeout(() => { if (mountedRef.current) setLiking(false) }, 300)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deletePost(post.id)
      navigate(-1)
    } catch (e) {
      console.error(e)
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="pb-6">
        <PageHeader title="帖子详情" />
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full skeleton" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-24 skeleton" />
              <div className="h-3 w-16 skeleton" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full skeleton" />
            <div className="h-4 w-3/4 skeleton" />
          </div>
          <div className="h-48 rounded-xl skeleton" />
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="pb-6">
        <PageHeader title="帖子详情" />
        <div className="p-8 text-center space-y-3">
          <p className="text-sm text-text-secondary">{error || '帖子不存在'}</p>
        </div>
      </div>
    )
  }

  const currentUser = getStoredUser()
  const canDelete = currentUser && (currentUser.id === post.userId || currentUser.role === 'admin')

  return (
    <div className="pb-6">
      <PageHeader title="帖子详情" />

      <div className="p-4 space-y-4">
        {/* Author info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar user={post.user} />
            <div>
              <div className="text-sm font-medium text-gray-800">{post.user?.nickname || `铲屎官 #${post.userId}`}</div>
              <div className="text-xs text-gray-400">{post.createdAt}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              TOPIC_COLORS[post.topic]?.bg || 'bg-gray-50'
            } ${
              TOPIC_COLORS[post.topic]?.text || 'text-gray-400'
            }`}>
              {TOPIC_LABEL[post.topic] || '铲屎日常'}
            </span>
            {canDelete && (
              <button onClick={() => setShowDeleteConfirm(true)} className="text-gray-300 hover:text-red-400 transition-colors p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Related cat */}
        {post.relatedCat && (
          <Link to={`/cats/${post.relatedCat.id}`} className="flex items-center gap-2 bg-primary-light rounded-lg px-3 py-2.5 active:bg-orange-100">
            <span className="text-sm text-primary font-medium">{post.relatedCat.name}</span>
          </Link>
        )}

        {/* Content */}
        <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap">{post.content}</p>

        {/* Images - larger view in detail */}
        {post.images?.length > 0 && (
          <div className={`grid gap-2 ${
            post.images.length === 1 ? 'grid-cols-1' :
            post.images.length === 2 ? 'grid-cols-2' :
            'grid-cols-3'
          }`}>
            {post.images.map((img, i) => (
              <div
                key={i}
                className={`rounded-xl overflow-hidden bg-gray-100 ${
                  post.images.length === 3 && i === 0 ? 'row-span-2' : ''
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" style={{ minHeight: 160 }} />
              </div>
            ))}
          </div>
        )}

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="text-xs text-primary bg-primary-light px-2.5 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Like + Comment count bar */}
        <div className="flex items-center gap-6 py-3 border-t border-b border-gray-100">
          <button onClick={handleLike} className={`relative flex items-center gap-2 text-sm transition-colors ${liked ? 'text-primary' : 'text-gray-400'}`}>
            <Heart className={`w-5 h-5 ${liked ? 'fill-primary' : ''} ${liking ? 'animate-like-pop' : ''}`} />
            <span>{likes} 赞</span>
            {likeBurst && (
              <>
                <span className="absolute -top-3 left-2 animate-burst-up font-bold">🐟</span>
                <span className="absolute -top-3 right-2 animate-burst-up" style={{ animationDelay: '0.1s' }}>🐟</span>
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 animate-burst-up" style={{ animationDelay: '0.15s' }}>❤️</span>
              </>
            )}
          </button>
          <span className="text-sm text-gray-400">{post.comments || 0} 条评论</span>
        </div>

        {/* Comments - always expanded in detail page */}
        <CommentSection postId={post.id} initialCount={post.comments || 0} expanded />
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
                {deleting ? '删除中…' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
