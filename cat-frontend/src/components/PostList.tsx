import { useEffect, useRef } from 'react'
import { useInfinitePosts } from '../hooks/useApi'
import PostCard from './PostCard'
import EmptyState from './EmptyState'
import { MessageCircle } from 'lucide-react'

function SkeletonPost() {
  return (
    <div className="bg-white ring-1 ring-stone-900/5 shadow-e1 rounded-card p-4 space-y-3 animate-fade-in">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full skeleton" />
        <div className="space-y-2 flex-1">
          <div className="h-3 w-24 skeleton" />
          <div className="h-2.5 w-16 skeleton" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full skeleton" />
        <div className="h-3 w-3/4 skeleton" />
      </div>
      <div className="h-32 rounded-tile skeleton" />
      <div className="flex gap-4 pt-1">
        <div className="h-4 w-12 skeleton" />
        <div className="h-4 w-20 skeleton" />
      </div>
    </div>
  )
}

export default function PostList({ topic, refreshKey = 0, onReport, onTagClick }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } = useInfinitePosts({ topic })
  const sentinelRef = useRef(null)

  useEffect(() => {
    refetch()
  }, [refreshKey])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasNextPage) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const posts = data?.pages?.flatMap((page) => {
    if (Array.isArray(page)) return page
    if (page?.items) return page.items
    return []
  }) ?? []

  function handleDeleted(_postId) {
    refetch()
  }

  if (isLoading) {
    return (
      <div className="p-3 space-y-3">
        {[1, 2, 3].map((i) => <SkeletonPost key={i} />)}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="p-3">
        <EmptyState
          icon={MessageCircle}
          title="还没有帖子"
          description="来发第一条吧"
        />
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3">
      {posts.map((post) => <PostCard key={post.id} post={post} onReport={onReport} onDeleted={handleDeleted} onTagClick={onTagClick} />)}
      <div ref={sentinelRef} />
      {isFetchingNextPage && (
        <div className="py-4 text-center text-sm text-text-muted">加载更多…</div>
      )}
      {!hasNextPage && posts.length > 0 && (
        <div className="py-4 text-center text-xs text-text-muted">— 已经到底了 —</div>
      )}
    </div>
  )
}
