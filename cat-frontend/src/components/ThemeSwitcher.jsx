import { useEffect, useState } from 'react'

export const THEMES = [
  { key: 'original', label: '暖橙', dot: '#F97316' },
  { key: 'zen', label: '禅意', dot: '#0D9488' },
  { key: 'rustic', label: '田园', dot: '#B45309' },
  { key: 'modern', label: '现代', dot: '#2563EB' },
  { key: 'sugary', label: '糖果', dot: '#DB2777' },
  { key: 'cafe', label: '咖啡馆', dot: '#92400E' },
  { key: 'dark', label: '深色', dot: '#292524' },
]

export function getStoredTheme() {
  try {
    return localStorage.getItem('theme') || 'original'
  } catch {
    return 'original'
  }
}

export function applyTheme(key) {
  const theme = THEMES.some((t) => t.key === key) ? key : 'original'
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem('theme', theme) } catch {}
  return theme
}

export default function ThemeSwitcher() {
  const [current, setCurrent] = useState(getStoredTheme)

  useEffect(() => {
    setCurrent(applyTheme(getStoredTheme()))
  }, [])

  const handlePick = (key) => {
    setCurrent(applyTheme(key))
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text">主题外观</p>
      <div className="flex flex-wrap gap-2.5">
        {THEMES.map((t) => (
          <button
            key={t.key}
            onClick={() => handlePick(t.key)}
            aria-label={`切换到${t.label}主题`}
            aria-pressed={current === t.key}
            className={`flex flex-col items-center gap-1 transition-transform active:scale-90 ${current === t.key ? 'opacity-100' : 'opacity-60'}`}
          >
            <span
              className="w-9 h-9 rounded-full border-2 flex items-center justify-center"
              style={{
                background: t.key === 'dark' ? '#292524' : t.dot,
                borderColor: current === t.key ? 'var(--color-primary)' : 'transparent',
                boxShadow: current === t.key ? '0 0 0 2px var(--color-primary)' : 'none',
              }}
            >
              {current === t.key && (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5 L6.5 12 L13 4.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="text-[10px] text-text-secondary">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
