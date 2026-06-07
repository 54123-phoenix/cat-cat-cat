import { useEffect, useState } from 'react'
import { getPosts } from '../api'
import PostCard from './PostCard'

function SkeletonPost() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 animate-fade-in">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full skeleton" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3 w-24 skeleton" />
          <div className="h-2.5 w-16 skeleton" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full skeleton" />
        <div className="h-3 w-3/4 skeleton" />
      </div>
      <div className="h-32 rounded-xl skeleton" />
      <div className="flex gap-4 pt-1">
        <div className="h-4 w-12 skeleton" />
        <div className="h-4 w-20 skeleton" />
      </div>
    </div>
  )
}

export default function PostList({ topic, refreshKey = 0, onReport }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getPosts({ topic: topic === 'all' ? undefined : topic })
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [topic, refreshKey])

  function handleDeleted(postId) {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  if (loading) {
    return (
      <div className="p-3 space-y-3">
        {[1, 2, 3].map((i) => <SkeletonPost key={i} />)}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="p-8 text-center space-y-3">
        <span className="text-4xl block">🐱</span>
        <div className="text-sm text-gray-400">还没有帖子，来发第一条吧</div>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3">
      {posts.map((post) => <PostCard key={post.id} post={post} onReport={onReport} onDeleted={handleDeleted} />)}
    </div>
  )
}
