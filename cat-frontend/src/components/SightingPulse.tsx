import { useEffect, useState, useRef } from 'react'
import ImageWithShimmer from './ImageWithShimmer'

export interface PulseSighting {
  id: number
  cat_id: number
  cat_name: string
  cat_avatar?: string
  location_name?: string
  created_at: string
}

interface SightingPulseProps {
  sightings: PulseSighting[]
  onFollowCat?: (catId: number) => void
  onViewCat?: (catId: number) => void
  duration?: number
}

export default function SightingPulse({ sightings, onFollowCat, onViewCat, duration = 5000 }: SightingPulseProps) {
  const [active, setActive] = useState<PulseSighting[]>([])
  const seenRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    const now = Date.now()
    const fresh = sightings.filter(s => {
      const age = now - new Date(s.created_at).getTime()
      return age < duration && !seenRef.current.has(s.id)
    })
    if (fresh.length > 0) {
      fresh.forEach(s => seenRef.current.add(s.id))
      setActive(prev => [...prev, ...fresh])
      const timers = fresh.map(s => setTimeout(() => {
        setActive(prev => prev.filter(p => p.id !== s.id))
      }, duration))
      return () => timers.forEach(t => clearTimeout(t))
    }
  }, [sightings, duration])

  if (active.length === 0) return null

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2 items-center pointer-events-none">
      {active.map(s => (
        <div
          key={s.id}
          className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white border border-primary/20 shadow-e3 animate-slide-up"
        >
          <div className="relative">
            {s.cat_avatar ? (
              <ImageWithShimmer src={s.cat_avatar} alt={s.cat_name} className="w-10 h-10 rounded-full" loading="lazy" compact />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-xl">🐱</div>
            )}
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-ping" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500" />
          </div>

          <div className="min-w-0">
            <div className="text-sm font-bold text-text-primary truncate">
              {s.cat_name} 被偶遇了！
            </div>
            {s.location_name && (
              <div className="text-xs text-text-secondary truncate">📍 {s.location_name}</div>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => onViewCat?.(s.cat_id)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-text-secondary hover:bg-gray-100 transition-colors"
            >
              查看
            </button>
            {onFollowCat && (
              <button
                onClick={() => onFollowCat(s.cat_id)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary-dark transition-colors"
              >
                关注
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
