import { useEffect, useState } from 'react'
import { getContributionTitles } from '../api'
import type { ContributionTitle, ContributionTitlesResult } from '../types'

export { type ContributionTitle }

interface ContributionTitlesProps {
  variant?: 'full' | 'compact' | 'badge'
  className?: string
  onData?: (data: ContributionTitlesResult) => void
}

export default function ContributionTitles({ variant = 'full', className = '', onData }: ContributionTitlesProps) {
  const [data, setData] = useState<ContributionTitlesResult | null>(null)

  useEffect(() => {
    getContributionTitles()
      .then((d) => { setData(d); onData?.(d) })
      .catch(() => {})
  }, [])

  if (!data || data.titles.length === 0) return null

  if (variant === 'badge' && data.primary_title) {
    const t = data.primary_title
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium ${className}`}>
        🏅 {t.label}
      </span>
    )
  }

  if (variant === 'compact' && data.primary_title) {
    const t = data.primary_title
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary-light/20 border border-primary/10 ${className}`}>
        <span className="text-lg">🏅</span>
        <div>
          <div className="text-xs font-bold text-primary">{t.label}</div>
          <div className="text-[10px] text-text-secondary">{t.description}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl bg-white border border-gray-100 overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-gray-50">
        <h3 className="font-bold text-text-primary flex items-center gap-2">
          🏅 贡献头衔
          <span className="text-xs font-normal text-text-secondary">已获得 {data.total} 个</span>
        </h3>
      </div>
      <div className="p-4 space-y-2">
        {data.titles.map((title) => (
          <div
            key={title.key}
            className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-primary-light/10 to-transparent px-3 py-2 border border-primary/5"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg flex-shrink-0">
              🏅
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-text-primary text-sm">{title.label}</span>
                <span className="text-xs text-text-secondary">{title.label_en}</span>
              </div>
              <div className="text-xs text-text-secondary truncate">{title.description}</div>
            </div>
            <div className="text-lg font-bold text-primary/30 flex-shrink-0">{title.count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
