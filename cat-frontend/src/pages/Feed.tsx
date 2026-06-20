import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import FeedItem from '../components/FeedItem'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { useInfiniteSightings } from '../hooks/useApi'
import { PawPrint, Cat } from 'lucide-react'

export default function Feed() {
  const navigate = useNavigate()
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteSightings({ limit: 20 })
  const sentinelRef = useRef(null)

  const sightings = data?.pages?.flatMap((page) => {
    if (Array.isArray(page)) return page
    if (page?.items) return page.items
    return []
  }) ?? []

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasNextPage) return
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

  return (
    <div className="pb-6">
      <PageHeader title="偶遇动态" subtitle="校园猫咪时间线" />

      <div className="p-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card flex gap-3 p-3">
                <div className="w-12 h-12 rounded-xl skeleton shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 skeleton" />
                  <div className="h-3 w-full skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : sightings.length > 0 ? (
          <>
            {sightings.map((sighting) => <FeedItem key={sighting.id} sighting={sighting} />)}
            <div ref={sentinelRef} />
            {isFetchingNextPage && <div className="py-4 text-center text-sm text-text-muted">加载更多…</div>}
            {!hasNextPage && <div className="py-4 text-center text-xs text-text-muted">— 已经到底了 —</div>}
          </>
        ) : (
          <EmptyState
            icon={Cat}
            title="还没有偶遇记录"
            description="去拍照识别页发现校园里的猫猫吧"
            action={{ label: '去拍第一张', onClick: () => navigate('/scan') }}
          />
        )}
      </div>
    </div>
  )
}
