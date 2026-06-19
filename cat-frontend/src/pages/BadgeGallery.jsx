import { useEffect, useState } from 'react'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { getBadges } from '../api'
import { Eye, PenLine, Trophy, Sparkles, Medal } from 'lucide-react'

const SERIES_LABEL = {
  sighting: { name: '偶遇系列', Icon: Eye },
  community: { name: '社区系列', Icon: PenLine },
  collect: { name: '收集系列', Icon: Trophy },
  special: { name: '特殊成就', Icon: Sparkles },
}

function getBadgeFromApi(b) {
  return b
}

export default function BadgeGallery() {
  const [badges, setBadges] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBadges()
      .then((data) => {
        if (Array.isArray(data)) setBadges(data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const grouped = {}
  badges.forEach((b) => {
    const series = b.series || 'special'
    if (!grouped[series]) grouped[series] = []
    grouped[series].push(b)
  })

  const earned = badges.filter((b) => b.earned).length
  const total = badges.length

  return (
    <div className="min-h-screen bg-warm-50">
      <PageHeader
        title="勋章库"
        subtitle={loading ? '加载中…' : `已获得 ${earned}/${total}`}
      />

      {loading ? (
        <div className="p-4 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-5 w-24 skeleton" />
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-16 skeleton" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 space-y-6">
          {Object.entries(grouped).map(([seriesKey, items]) => {
            const info = SERIES_LABEL[seriesKey] || { name: seriesKey, Icon: Medal }
            const SeriesIcon = info.Icon
            return (
              <section key={seriesKey} className="space-y-2">
                <h2 className="font-bold text-text flex items-center gap-2">
                  <SeriesIcon className="w-4 h-4 text-primary" />
                  {info.name}
                </h2>
                <div className="space-y-2">
                  {items.map((badge) => {
                    const isEarned = badge.earned
                    const pct = badge.progress_total > 0
                      ? Math.round((badge.progress_current / badge.progress_total) * 100)
                      : 0

                    return (
                      <div
                        key={badge.badge_key}
                        className={`card flex items-center gap-4 ${
                          isEarned ? 'badge-earned' : 'opacity-60'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          isEarned ? 'bg-primary-light text-primary' : 'bg-gray-100 text-gray-400'
                        }`}>
                          <span className="text-base font-bold">{(badge.name || '?')[0]}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`font-semibold text-sm ${isEarned ? 'text-text' : 'text-text-secondary'}`}>
                              {badge.name}
                            </span>
                            {isEarned && (
                              <span className="text-xs text-success font-medium shrink-0">已获得</span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {badge.condition_text}
                          </p>
                          {!isEarned && badge.progress_total > 1 && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-700"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-text-secondary shrink-0">
                                {badge.progress_current}/{badge.progress_total}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}

          {badges.length === 0 && (
            <EmptyState icon={Medal} title="暂无勋章数据" />
          )}
        </div>
      )}
    </div>
  )
}
