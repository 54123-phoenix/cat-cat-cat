import { useState, type CSSProperties } from 'react'
import CatDeskToken from './CatDeskToken'

export interface MiniSceneCat {
  id: number
  name: string
  avatar?: string
  color?: string
  x: number
  y: number
}

interface CampusMiniSceneProps {
  cats: MiniSceneCat[]
  onSelectCat?: (catId: number) => void
  className?: string
  height?: number
}

export default function CampusMiniScene({ cats, onSelectCat, className = '', height = 280 }: CampusMiniSceneProps) {
  const [selected, setSelected] = useState<number | null>(null)

  if (cats.length === 0) return null

  const sceneCats = cats.slice(0, 5)

  function handleClick(catId: number) {
    setSelected(catId)
    onSelectCat?.(catId)
  }

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-gray-100 ${className}`}
      style={{
        height,
        background: 'linear-gradient(180deg, #E0F2FE 0%, #FEF3C7 60%, #F0F9FF 100%)',
      }}
    >
      <div className="absolute inset-0 opacity-30">
        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 400 280">
          <path d="M0 200 Q100 180 200 190 T400 195 L400 280 L0 280 Z" fill="#86EFAC" opacity="0.4" />
          <path d="M0 220 Q150 210 250 215 T400 220 L400 280 L0 280 Z" fill="#4ADE80" opacity="0.3" />
          <circle cx="80" cy="60" r="25" fill="#FBBF24" opacity="0.3" />
          <ellipse cx="320" cy="80" rx="40" ry="20" fill="#BFDBFE" opacity="0.3" />
        </svg>
      </div>

      <div className="absolute top-3 left-3 z-10">
        <h4 className="text-sm font-bold text-text-primary bg-white/70 backdrop-blur-sm px-3 py-1 rounded-lg">
          🏫 校园猫迷你场景
        </h4>
        <p className="text-xs text-text-secondary mt-1 bg-white/70 backdrop-blur-sm px-3 py-0.5 rounded-lg inline-block">
          附近 {sceneCats.length} 只猫猫
        </p>
      </div>

      <div className="absolute inset-0">
        {sceneCats.map((cat, idx) => {
          const left = `${cat.x * 100}%`
          const top = `${cat.y * 100}%`
          const isSelected = selected === cat.id
          return (
            <div
              key={`${cat.id ?? 'cat'}-${idx}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left, top }}
            >
              {isSelected && (
                <div
                  className="absolute -inset-2 rounded-2xl border-2 border-primary/40 animate-ping"
                  style={{ borderRadius: 16 }}
                />
              )}
              <CatDeskToken
                name={cat.name}
                avatar={cat.avatar}
                color={cat.color}
                size={72}
                mood={isSelected ? 'blink' : 'sit'}
                onClick={() => handleClick(cat.id)}
              />
            </div>
          )
        })}
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.6), transparent)' }}
      />
    </div>
  )
}
