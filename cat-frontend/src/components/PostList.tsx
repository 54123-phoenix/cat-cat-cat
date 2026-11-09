import { useCallback, useEffect, useRef } from 'react'
import { useInfinitePosts } from '../hooks/useApi'
import PostCard from './PostCard'
import EmptyState from './EmptyState'
import { MessageCircle } from 'lucide-react'

function SkeletonPost() {
  return <div aria-hidden="true" className="rounded-card border border-border bg-surface-1 p-4 space-y-3"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full skeleton" /><div className="h-4 w-28 skeleton" /></div><div className="h-4 w-full skeleton" /><div className="h-4 w-3/4 skeleton" /><div className="aspect-[4/3] rounded-xl skeleton" /></div>
}

export default function PostList({ topic, refreshKey = 0, onReport, onTagClick }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching, isLoading, isError, isFetchNextPageError, refetch } = useInfinitePosts({ topic })
  const sentinelRef = useRef<HTMLDivElement>(null)
  const paginationLock = useRef(false)
  const previousRefresh = useRef(refreshKey)

  useEffect(() => {
    if (previousRefresh.current === refreshKey) return
    previousRefresh.current = refreshKey
    void refetch()
  }, [refreshKey, refetch])

  const loadMore = useCallback(async () => {
    if (paginationLock.current || isFetching || !hasNextPage) return
    paginationLock.current = true
    try { await fetchNextPage({ cancelRefetch: false }) } finally { paginationLock.current = false }
  }, [isFetching, hasNextPage, fetchNextPage])

  useEffect(() => {
    const element = sentinelRef.current
    if (!element || !hasNextPage || isError || isFetching || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) void loadMore()
    }, { rootMargin: '200px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasNextPage, isError, isFetching, loadMore])

  const allPosts = data?.pages?.flatMap(page => Array.isArray(page) ? page : page?.items || []) ?? []
  const posts = allPosts.filter((post, index) => allPosts.findIndex(item => item.id === post.id) === index)

  if (isLoading && posts.length === 0) {
    return <div className="space-y-4"><p role="status" className="text-sm text-text-secondary">正在加载社区帖子…</p>{[1, 2, 3].map(id => <SkeletonPost key={id} />)}</div>
  }
  if (isError && posts.length === 0) {
    return <div role="status"><EmptyState icon={MessageCircle} title="帖子暂时无法加载" description="请检查网络后重试。" action={{ label: isFetching ? '重试中…' : '重新加载帖子', onClick: () => { if (!isFetching) void refetch() } }} /></div>
  }
  if (posts.length === 0) {
    return <EmptyState icon={MessageCircle} title="这个话题还没有帖子" description="分享一次校园偶遇，和猫友聊聊吧。" />
  }
  return (
    <div className="space-y-4">
      {isError && !isFetchNextPageError && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-1 p-4"><p role="status" className="text-sm text-text-secondary">帖子暂时无法更新，下方保留已加载的内容。</p><button type="button" disabled={isFetching} onClick={() => void refetch()} className="btn btn-ghost">{isFetching ? '重试中…' : '重试更新'}</button></div>}
      {posts.map(post => <PostCard key={post.id} post={post} onReport={onReport} onDeleted={() => void refetch()} onTagClick={onTagClick} />)}
      <div ref={sentinelRef} aria-hidden="true" />
      {isFetchNextPageError && <p role="status" className="text-center text-sm text-text-secondary">后续帖子加载失败，已加载的帖子仍可浏览。</p>}
      {(hasNextPage || isFetchNextPageError) && <div className="flex justify-center"><button type="button" onClick={() => void loadMore()} disabled={isFetching} className="btn btn-ghost">{isFetchingNextPage ? '正在加载…' : isFetchNextPageError ? '重试加载更多' : '加载更多帖子'}</button></div>}
      {!hasNextPage && !isFetchNextPageError && <p className="py-4 text-center text-sm text-text-secondary">已浏览全部帖子</p>}
    </div>
  )
}
