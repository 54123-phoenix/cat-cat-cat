import type { BadgeDetail } from '../types'
import BadgeIcon from './BadgeIcon'
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
  const completion = badges.length > 0 ? Math.round((earnedCount / badges.length) * 100) : 0

  return (
    <div className={`overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-b from-[#FFF7ED] to-white shadow-e3 ${className}`}>
      <div className="relative overflow-hidden border-b border-amber-200/70 bg-stone-950 px-5 py-5 text-white">
        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/30" />
        <div className="absolute -bottom-16 left-12 h-32 w-32 rounded-full bg-amber-300/10" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-amber-100">
              <span>CAT PASSPORT</span>
              <span className="h-1 w-1 rounded-full bg-amber-200" />
              <span>{completion}%</span>
            </div>
            <h3 className="mt-3 text-2xl font-extrabold tracking-tight">
              猫猫协会护照
            </h3>
            <p className="mt-1 text-sm text-amber-50/80">
              已收集 {earnedCount} / {badges.length} 枚印章
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-amber-300 transition-all duration-700"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
          <ShareArtifact
            title="我的猫猫协会护照"
            subtitle={`已收集 ${earnedCount} / ${badges.length} 枚印章`}
            badge="📖"
            proof={`${earnedCount} 枚印章 · ${sortedSeries.length} 个系列`}
            sharePath="/badges"
            slogan="猫猫协会护照"
          >
            <button className="shrink-0 rounded-full bg-white px-3 py-2 text-sm font-bold text-stone-900 shadow-e2 transition-colors hover:bg-amber-50 active:scale-[0.97]">
              分享护照
            </button>
          </ShareArtifact>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {sortedSeries.map(series => {
          const group = seriesGroups.get(series)!
          const meta = SERIES_LABELS[series] || { label: series, icon: '📌', color: 'from-gray-50 to-gray-100' }
          const groupEarned = group.filter(b => b.earned).length

          return (
            <section key={series} className="rounded-2xl bg-white p-4 shadow-e1 ring-1 ring-amber-100/70">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-lg">{meta.icon}</span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-text-primary">{meta.label}</h4>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${group.length ? (groupEarned / group.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <span className="rounded-full bg-surface-2 px-2 py-1 text-xs font-bold text-text-secondary">{groupEarned}/{group.length}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {group.map(badge => {
                  const earned = badge.earned
                  const progress = badge.progress_total > 0
                    ? Math.min(1, badge.progress_current / badge.progress_total)
                    : 0

                  return (
                    <div
                      key={badge.badge_key}
                      className={`relative min-h-[132px] overflow-hidden rounded-2xl border p-3 transition-all ${
                        earned
                          ? 'border-amber-200 bg-gradient-to-br ' + meta.color + ' shadow-e1'
                          : 'border-gray-100 bg-gray-50 opacity-75'
                      }`}
                    >
                      {earned && (
                        <div className="absolute right-2 top-2 rotate-6 rounded-full border border-amber-300 bg-white/80 px-2 py-0.5 text-[10px] font-black text-amber-700">
                          已盖章
                        </div>
                      )}

                      <div className={`mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 ${earned ? '' : 'grayscale opacity-60'}`}>
                        <BadgeIcon series={badge.series || series} size={48} earned={earned} />
                      </div>
                      <div className={`text-center text-xs font-bold leading-5 ${earned ? 'text-text-primary' : 'text-text-secondary'}`}>
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
                          <div className="mt-0.5 text-center text-[10px] text-text-secondary">
                            {badge.progress_current}/{badge.progress_total}
                          </div>
                        </div>
                      )}

                      {earned && (
                        <div className="absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400">
                          <span className="text-[10px] text-white">✓</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
