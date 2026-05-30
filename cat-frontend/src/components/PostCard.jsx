import { useState } from 'react'
import { Link } from 'react-router-dom'
import { likePost } from '../api'

const TOPIC_LABEL = {
  find: '🔍 寻猫问猫',
  daily: '💬 铲屎日常',
  health: '🏥 健康互助',
  suggest: '💡 建议反馈',
}

export default function PostCard({ post }) {
  const [liked, setLiked] = useState(Boolean(post.liked))
  const [likes, setLikes] = useState(post.likes || 0)

  async function handleLike() {
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikes((value) => Math.max(0, value + (nextLiked ? 1 : -1)))
    try {
      await likePost(post.id)
    } catch {
      setLiked(!nextLiked)
      setLikes((value) => Math.max(0, value + (nextLiked ? -1 : 1)))
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 animate-fadeup">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-cat-warm flex items-center justify-center text-base">
            {post.userEmoji || '🧑‍💻'}
          </div>
          <div>
            <div className="text-xs font-medium text-gray-700">铲屎官 #{post.userId}</div>
            <div className="text-[10px] text-gray-400">{post.createdAt}</div>
          </div>
        </div>
        <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
          {TOPIC_LABEL[post.topic] || '💬 铲屎日常'}
        </span>
      </div>

      {post.relatedCat && (
        <Link to={`/cats/${post.relatedCat.id}`} className="flex items-center gap-2 bg-cat-warm rounded-lg px-3 py-2 active:bg-orange-100">
          <span className="text-lg">{post.relatedCat.emoji || '🐱'}</span>
          <span className="text-xs text-orange-800 font-medium">{post.relatedCat.name}</span>
        </Link>
      )}

      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{post.content}</p>

      {post.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span key={tag} className="text-[11px] text-cat-orange bg-cat-orange-lt px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {post.image && <img src={post.image} alt="" className="w-full rounded-xl object-cover max-h-48" />}

      <div className="flex items-center gap-4 pt-1 border-t border-gray-50">
        <button onClick={handleLike} className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? 'text-cat-orange' : 'text-gray-400'}`}>
          <span className="text-base">{liked ? '🧡' : '🤍'}</span>
          {likes}
        </button>
        <button className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="text-base">💬</span>
          {post.comments || 0} 条回复
        </button>
        <button className="flex items-center gap-1.5 text-xs text-gray-400 ml-auto">
          <span className="text-base">↗</span>
          分享
        </button>
      </div>
    </div>
  )
}
