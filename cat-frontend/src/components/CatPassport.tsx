import type { BadgeDetail } from '../types'
import ShareArtifact from './ShareArtifact'

interface CatPassportProps {
  badges: BadgeDetail[]
  className?: string
}

const SERIES_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  sighting: { label: '观察员', icon: '🔭', color: 'from-blue-50 to-blue-100' },
  community: { label: '社区员', icon: '💬', color: 'from-green-50 to-green-100' },
  collect: { label: '档案员', icon: '📚', color: 'from-purple-50 to-purple-100' },
  special: { label: '特别成就', icon: '⭐', color: 'from-amber-50 to-amber-100' },
}

export default function CatPassport({ badges, className = '' }: CatPassportProps) {
  const seriesGroups = new Map<string, BadgeDetail[]>()
  for (const badge of badges) {
    const series = badge.series || 'default'
    if (!seriesGroups.has(series)) seriesGroups.set(series, [])
    seriesGroups.get(series)!.push(badge)
  }
  const sortedSeries = [...seriesGroups.keys()].sort((a, b) => {
    const order: Record<string, number> = { sighting: 0, community: 1, collect: 2, special: 3, default: 4 }
    return (order[a] ?? 5) - (order[b] ?? 5)
  })

  const earnedCount = badges.filter(b => b.earned).length

  return (
    <div className={`rounded-2xl bg-gradient-to-b from-amber-50/50 to-white border border-amber-100 overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-amber-100/50 bg-gradient-to-r from-amber-100/30 to-amber-50/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-h2 font-bold text-text-primary flex items-center gap-2">
              📖 猫猫协会护照
            </h3>
            <p className="text-sm text-text-secondary mt-0.5">
              已收集 {earnedCount} / {badges.length} 枚印章
            </p>
          </div>
          <div className="text-3xl">🐾</div>
          <ShareArtifact
            title="我的猫猫协会护照"
            subtitle={`已收集 ${earnedCount} / ${badges.length} 枚印章`}
            badge="📖"
            proof={`${earnedCount} 枚印章 · ${sortedSeries.length} 个系列`}
            sharePath="/badges"
            slogan="猫猫协会护照"
          >
            <button className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-sm font-medium hover:bg-amber-200 transition-colors active:scale-[0.97]">
              📸 分享
            </button>
          </ShareArtifact>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {sortedSeries.map(series => {
          const group = seriesGroups.get(series)!
          const meta = SERIES_LABELS[series] || { label: series, icon: '📌', color: 'from-gray-50 to-gray-100' }
          const groupEarned = group.filter(b => b.earned).length

          return (
            <div key={series}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{meta.icon}</span>
                <h4 className="font-bold text-text-primary text-sm">{meta.label}</h4>
                <span className="text-xs text-text-secondary">{groupEarned}/{group.length}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {group.map(badge => {
                  const earned = badge.earned
                  const progress = badge.progress_total > 0
                    ? Math.min(1, badge.progress_current / badge.progress_total)
                    : 0

                  return (
                    <div
                      key={badge.badge_key}
                      className={`relative rounded-xl border p-3 transition-all ${
                        earned
                          ? 'bg-gradient-to-br ' + meta.color + ' border-amber-200 shadow-e1'
                          : 'bg-gray-50 border-gray-100 opacity-60'
                      }`}
                    >
                      {earned && (
                        <div className="absolute top-1 right-1 text-xs text-amber-600 font-bold rotate-12">
                          {badge.earned_at ? new Date(badge.earned_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : ''}
                        </div>
                      )}

                      <div className={`text-2xl text-center mb-1 ${earned ? '' : 'grayscale opacity-40'}`}>
                        {badge.emoji}
                      </div>
                      <div className={`text-xs font-medium text-center ${earned ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {badge.name}
                      </div>

                      {!earned && badge.progress_total > 0 && (
                        <div className="mt-1.5">
                          <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className="h-full bg-primary/40 rounded-full transition-all"
                              style={{ width: `${progress * 100}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-text-secondary text-center mt-0.5">
                            {badge.progress_current}/{badge.progress_total}
                          </div>
                        </div>
                      )}

                      {earned && (
                        <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
                          <span className="text-[8px] text-white">✓</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
