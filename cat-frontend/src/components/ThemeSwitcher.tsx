import { useEffect, useState } from 'react'

export const THEMES = [
  { key: 'original', label: '复旦蓝', dot: '#0E419C' },
  { key: 'orange', label: '暖橙', dot: '#F97316' },
  { key: 'zen', label: '禅意', dot: '#0D9488' },
  { key: 'rustic', label: '田园', dot: '#B45309' },
  { key: 'modern', label: '现代', dot: '#2563EB' },
  { key: 'sugary', label: '糖果', dot: '#DB2777' },
  { key: 'cafe', label: '咖啡馆', dot: '#92400E' },
  { key: 'dark', label: '深色', dot: '#292524' },
] as const

type ThemeKey = typeof THEMES[number]['key']
const DEFAULT_THEME: ThemeKey = 'original'

function isThemeKey(value: unknown): value is ThemeKey {
  return THEMES.some(theme => theme.key === value)
}

export function getStoredTheme(): ThemeKey {
  try {
    const stored = localStorage.getItem('theme')
    return isThemeKey(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function applyTheme(key: unknown, { persist = false }: { persist?: boolean } = {}): ThemeKey {
  const theme = isThemeKey(key) ? key : DEFAULT_THEME
  document.documentElement.dataset.theme = theme
  if (persist) {
    try { localStorage.setItem('theme', theme) } catch { /* Storage can be blocked; the DOM theme still applies. */ }
  }
  return theme
}

function getCurrentTheme(): ThemeKey {
  const current = document.documentElement.dataset.theme
  return isThemeKey(current) ? current : getStoredTheme()
}

export default function ThemeSwitcher() {
  const [current, setCurrent] = useState(getCurrentTheme)

  useEffect(() => {
    applyTheme(current)
  }, [current])

  const handlePick = (key: ThemeKey) => {
    setCurrent(applyTheme(key, { persist: true }))
  }

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium text-text">主题外观</legend>
      <div className="mt-2 flex flex-wrap gap-2.5">
        {THEMES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => handlePick(t.key)}
            aria-label={`切换到${t.label}主题`}
            aria-pressed={current === t.key}
            className="focus-ring flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-lg px-1 py-1 transition-transform active:scale-95"
          >
            <span
              className="w-9 h-9 rounded-full border-2 flex items-center justify-center"
              aria-hidden="true"
              style={{
                background: t.dot,
                borderColor: current === t.key ? 'var(--color-primary)' : 'transparent',
                boxShadow: current === t.key ? '0 0 0 2px var(--color-primary)' : 'none',
              }}
            >
              {current === t.key && (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5 L6.5 12 L13 4.5" stroke={t.key === 'orange' ? '#1C1917' : '#fff'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className={`text-sm leading-5 ${current === t.key ? 'font-medium text-text' : 'text-text-secondary'}`}>{t.label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
