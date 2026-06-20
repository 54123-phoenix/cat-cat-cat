import { useEffect, useState } from 'react'
import MascotCat from './MascotCat'

const CONFETTI_COLORS = ['#F97316', '#FB923C', '#FDE68A', '#22C55E', '#3B82F6', '#DB2777', '#A855F7']

export default function CelebrationOverlay({ badgeName, onClose, autoMs = 2000 }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      if (onClose) onClose()
    }, autoMs)
    return () => clearTimeout(t)
  }, [autoMs, onClose])

  if (!visible) return null

  const pieces = Array.from({ length: 36 }, (_, i) => ({
    left: Math.random() * 100,
    bg: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: Math.random() * 0.4,
    dur: 1.6 + Math.random() * 0.8,
  }))

  return (
    <div className="celebration-overlay" role="dialog" aria-modal="true" aria-label={`解锁勋章 ${badgeName || ''}`}>
      <div className="celebration-card space-y-4">
        <div className="flex justify-center">
          <MascotCat mood="happy" size={96} />
        </div>
        <h2 className="text-xl font-bold theme-text">解锁勋章！</h2>
        <p className="text-base font-semibold theme-primary">{badgeName || '新成就'}</p>
        <p className="text-sm theme-muted">恭喜你，继续探索校园猫猫吧～</p>
      </div>
      <div className="confetti-container" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {pieces.map((p, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${p.left}%`,
              background: p.bg,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
