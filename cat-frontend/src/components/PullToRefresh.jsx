import { useState, useRef, useCallback } from 'react'

export default function PullToRefresh({ onRefresh, children }) {
  const [state, setState] = useState('idle') // idle | pulling | ready | refreshing
  const startY = useRef(0)
  const pullDist = useRef(0)
  const containerRef = useRef(null)
  const THRESHOLD = 60

  const handleTouchStart = useCallback((e) => {
    if (containerRef.current?.scrollTop > 0) return
    startY.current = e.touches[0].clientY
    pullDist.current = 0
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (state === 'refreshing') return
    if (containerRef.current?.scrollTop > 0) return

    const dist = Math.max(0, (e.touches[0].clientY - startY.current) * 0.5)
    pullDist.current = dist

    if (dist > THRESHOLD) {
      setState('ready')
    } else if (dist > 5) {
      setState('pulling')
    } else {
      setState('idle')
    }
  }, [state])

  const handleTouchEnd = useCallback(async () => {
    if (state === 'ready') {
      setState('refreshing')
      try {
        await onRefresh()
      } finally {
        setState('idle')
        pullDist.current = 0
      }
    } else {
      setState('idle')
      pullDist.current = 0
    }
  }, [state, onRefresh])

  const progress = Math.min(pullDist.current / THRESHOLD, 1)

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center transition-all"
        style={{
          height: state === 'refreshing' ? 48 : Math.min(pullDist.current, 80),
          opacity: state === 'idle' && pullDist.current < 5 ? 0 : 1,
        }}
      >
        {state === 'refreshing' ? (
          <div className="flex items-center gap-2 text-primary">
            <CatIcon className="animate-bounce" />
            <span className="text-xs font-medium">刷新中…</span>
          </div>
        ) : state === 'ready' ? (
          <div className="flex items-center gap-2 text-primary">
            <CatStretch progress={1} />
            <span className="text-xs font-medium">释放刷新 ✨</span>
          </div>
        ) : pullDist.current > 10 ? (
          <div className="flex items-center gap-2 text-text-secondary">
            <CatStretch progress={progress} />
            <span className="text-xs">继续下拉…</span>
          </div>
        ) : null}
      </div>

      {children}
    </div>
  )
}

function CatIcon({ className }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className}>
      <ellipse cx="12" cy="15" rx="6" ry="5" fill="currentColor" opacity="0.9" />
      <circle cx="12" cy="9" r="5" fill="currentColor" />
      <polygon points="8,6 6.5,1 10.5,5" fill="currentColor" />
      <polygon points="16,6 17.5,1 13.5,5" fill="currentColor" />
      <circle cx="10" cy="8" r="1" fill="white" />
      <circle cx="14" cy="8" r="1" fill="white" />
      <circle cx="10" cy="8" r="0.5" fill="#1C1917" />
      <circle cx="14" cy="8" r="0.5" fill="#1C1917" />
    </svg>
  )
}

function CatStretch({ progress }) {
  const backY = 3 - progress * 6
  const headY = -2 + progress * 3

  return (
    <svg width="28" height="24" viewBox="0 0 28 24" fill="none">
      {/* Body */}
      <ellipse cx="14" cy={18 + backY} rx="6" ry="4" fill="#F97316" opacity="0.8" />
      {/* Head */}
      <circle cx="14" cy={11 + headY} r="4.5" fill="#F97316" />
      {/* Ears */}
      <polygon points="11,8 10,4 13,7" fill="#F97316" />
      <polygon points="17,8 18,4 15,7" fill="#F97316" />
      {/* Front paws stretching */}
      <ellipse cx="8" cy={22 - progress * 3} rx="2.5" ry="1.5" fill="#F97316" opacity="0.7" />
      <ellipse cx="20" cy={22 - progress * 3} rx="2.5" ry="1.5" fill="#F97316" opacity="0.7" />
      {/* Eyes */}
      {progress > 0.5 && (
        <>
          <circle cx="12" cy={10 + headY} r="0.8" fill="#1C1917" />
          <circle cx="16" cy={10 + headY} r="0.8" fill="#1C1917" />
        </>
      )}
    </svg>
  )
}
