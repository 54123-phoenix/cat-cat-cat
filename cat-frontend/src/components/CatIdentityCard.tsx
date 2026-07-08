import { useRef, useState, type CSSProperties } from 'react'
import { X } from 'lucide-react'
import type { Cat } from '../types'
import ImageWithShimmer from './ImageWithShimmer'
import ShareArtifact from './ShareArtifact'

interface CatIdentityCardProps {
  cat: Cat
  personalityTags?: string[]
  campusZone?: string
  collectorStatus?: string
  sightingCount?: number
  onClose?: () => void
}

export default function CatIdentityCard({
  cat,
  personalityTags = [],
  campusZone,
  collectorStatus,
  sightingCount,
  onClose,
}: CatIdentityCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const tags = personalityTags.length > 0
    ? personalityTags
    : cat.personality ? cat.personality.split(/[，,、]/).map(t => t.trim()).filter(Boolean).slice(0, 5) : []

  const zone = campusZone || cat.location || '校园某处'
  const status = collectorStatus || '校园观察员'

  function handleMove(e: React.MouseEvent) {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = (e.clientX - cx) / rect.width
    const dy = (e.clientY - cy) / rect.height
    setTilt({ x: -dy * 12, y: dx * 12 })
  }

  function handleLeave() {
    setTilt({ x: 0, y: 0 })
  }

  const cardStyle: CSSProperties = {
    transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
    transition: tilt.x === 0 && tilt.y === 0 ? 'transform 0.3s ease' : 'transform 0.05s ease',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        ref={cardRef}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        onClick={(e) => e.stopPropagation()}
        style={cardStyle}
        className="relative w-80 max-w-[90vw] rounded-2xl bg-gradient-to-b from-white to-primary-light/30 border border-primary/20 shadow-e3 overflow-hidden animate-scale-in"
      >
        <div className="absolute top-3 right-3 z-10">
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-text-secondary transition-colors" aria-label="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative h-40 bg-gradient-to-br from-primary-light/40 to-primary/10 overflow-hidden">
          {cat.avatar ? (
            <ImageWithShimmer src={cat.avatar} alt={cat.name} className="w-full h-full" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-5xl">🐱</div>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent" />
        </div>

        <div className="px-5 pb-5 -mt-6 relative">
          <div className="flex items-end justify-between">
            <h2 className="text-h1 font-bold text-text-primary">{cat.name}</h2>
            {cat.nickname && <span className="text-h3 text-text-secondary mb-1">{cat.nickname}</span>}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              📍 {zone}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
              🏅 {status}
            </span>
          </div>

          {sightingCount !== undefined && (
            <div className="mt-3 text-sm text-text-secondary">
              已被记录 <span className="font-bold text-primary">{sightingCount}</span> 次
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {tags.map((tag, i) => (
                <span key={i} className="px-2 py-1 rounded-lg bg-gray-50 text-text-secondary text-xs border border-gray-100">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {cat.quote && (
            <blockquote className="mt-3 px-3 py-2 rounded-xl bg-primary-light/20 text-sm text-text-secondary italic border-l-2 border-primary/30">
              "{cat.quote}"
            </blockquote>
          )}

          <ShareArtifact
            title={cat.name}
            subtitle={cat.nickname || zone}
            image={cat.avatar}
            proof={`已被记录 ${sightingCount ?? 0} 次 · ${status}`}
            sharePath={`/cats/public/${cat.id}`}
            slogan="来复旦找猫"
          >
            <button className="w-full mt-4 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors active:scale-[0.98]">
              📸 一键生成分享卡
            </button>
          </ShareArtifact>
        </div>
      </div>
    </div>
  )
}
