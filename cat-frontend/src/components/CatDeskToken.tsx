import { useRef, useState, type CSSProperties } from 'react'
import ImageWithShimmer from './ImageWithShimmer'

interface CatDeskTokenProps {
  name: string
  avatar?: string
  color?: string
  size?: number
  mood?: 'sit' | 'blink' | 'look'
  onClick?: () => void
  className?: string
}

export default function CatDeskToken({
  name,
  avatar,
  color = '#FED7AA',
  size = 120,
  mood = 'sit',
  onClick,
  className = '',
}: CatDeskTokenProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)

  function handleMove(e: React.MouseEvent) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = (e.clientX - cx) / rect.width
    const dy = (e.clientY - cy) / rect.height
    setTilt({ x: -dy * 15, y: dx * 15 })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  const tokenStyle: CSSProperties = {
    transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${hovered ? '8px' : '0'})`,
    transition: tilt.x === 0 && tilt.y === 0 ? 'transform 0.4s ease' : 'transform 0.08s ease',
  }

  const shadowStyle: CSSProperties = {
    transform: `scaleX(${1 + Math.abs(tilt.y) / 30}) scaleY(${1 - Math.abs(tilt.x) / 40})`,
    opacity: hovered ? 0.15 : 0.25,
    transition: 'all 0.3s ease',
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setTilt({ x: 0, y: 0 }) }}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`relative flex flex-col items-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ width: size }}
      role={onClick ? 'button' : 'img'}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`${name}桌面徽章`}
    >
      <div style={tokenStyle} className="relative" >
        <div
          className="relative rounded-2xl overflow-hidden border-2 shadow-e2"
          style={{
            width: size,
            height: size,
            borderColor: color,
            background: `linear-gradient(135deg, ${color}33, ${color}11)`,
          }}
        >
          {avatar ? (
            <div
              className="w-full h-full object-cover"
              style={{ transform: hovered ? 'scale(1.05)' : 'scale(1)', transition: 'transform 0.3s ease' }}
            >
              <ImageWithShimmer src={avatar} alt={name} className="w-full h-full" loading="lazy" compact />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ fontSize: size * 0.4 }}>
              🐱
            </div>
          )}

          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)',
              transform: hovered ? 'translateX(100%)' : 'translateX(-100%)',
              transition: 'transform 0.6s ease',
            }}
          />

          {mood === 'blink' && hovered && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 animate-fade-in">
              <span className="text-2xl">😺</span>
            </div>
          )}
        </div>

        <div
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/10 blur-md"
          style={{ ...shadowStyle, width: size * 0.7, height: 8 }}
        />
      </div>

      <div className="mt-3 text-sm font-medium text-text-secondary text-center truncate max-w-full">
        {name}
      </div>
    </div>
  )
}
