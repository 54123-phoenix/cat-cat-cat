import { useEffect, useState } from 'react'

export default function PawRain({ count = 10, duration = 1500, onDone }) {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setActive(false)
      if (onDone) onDone()
    }, duration)
    return () => clearTimeout(t)
  }, [duration, onDone])

  if (!active) return null

  const paws = Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    dur: 1 + Math.random() * 0.5,
    size: 22 + Math.random() * 14,
  }))

  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
      {paws.map((p, i) => (
        <span
          key={i}
          className="paw-rain-piece"
          style={{
            left: `${p.left}%`,
            fontSize: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        >
          🐾
        </span>
      ))}
    </div>
  )
}
