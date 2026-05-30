import { useEffect, useState } from 'react'
import { fetchPosts } from '../api'
import PostCard from './PostCard'

export default function PostList({ topic, refreshKey = 0 }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchPosts(topic)
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [topic, refreshKey])

  if (loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">加载中…</div>
  }

  if (posts.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-4xl mb-3">🐾</div>
        <div className="text-sm text-gray-400">还没有帖子，来发第一条吧</div>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3">
      {posts.map((post) => <PostCard key={post.id} post={post} />)}
    </div>
  )
}
