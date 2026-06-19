import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { getWeeklyReport } from '../api'

export default function WeeklyReport() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getWeeklyReport()
      .then(setReport)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-warm-50">
      <PageHeader title="本周报告" />

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 skeleton" />)}
          </div>
        ) : report ? (
          <>
            <div className="bg-primary rounded-2xl p-5 text-white space-y-1">
              <p className="text-sm opacity-80">本周小结</p>
              <p className="text-2xl font-bold">
                {report.week_start?.substring(0, 10)} ~ {report.week_end?.substring(0, 10)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4 text-center space-y-1">
                <p className="text-display-xl text-text">{report.total_sightings || 0}</p>
                <p className="text-caption text-text-muted">本周偶遇</p>
              </div>
              <div className="card p-4 text-center space-y-1">
                <p className="text-display-xl text-text">{report.unique_cats || 0}</p>
                <p className="text-caption text-text-muted">遇到不同猫</p>
              </div>
              <div className="card p-4 text-center space-y-1">
                <p className="text-display-xl text-text">{report.streak_days || 0}</p>
                <p className="text-caption text-text-muted">连续天数</p>
              </div>
              <div className="card p-4 text-center space-y-1">
                <div className="flex items-center justify-center gap-1">
                  <p className="text-display-xl text-text">{report.last_week_count || 0}</p>
                  {report.trend === 'up' ? <TrendingUp className="w-5 h-5 text-green-500" /> :
                   report.trend === 'down' ? <TrendingDown className="w-5 h-5 text-red-500" /> :
                   <Minus className="w-5 h-5 text-gray-400" />}
                </div>
                <p className="text-caption text-text-muted">上周对比</p>
              </div>
            </div>

            {report.top_location && (
              <div className="card p-4 space-y-2">
                <p className="text-xs text-text-secondary">最常出没地点</p>
                <p className="text-lg font-bold text-text">{report.top_location}</p>
                <p className="text-xs text-text-secondary">本周出现 {report.top_location_count} 次</p>
              </div>
            )}

            <div className="card p-4 space-y-2">
              <p className="text-xs text-text-secondary">数据说明</p>
              <p className="text-sm text-text-secondary leading-relaxed">
                本周你共记录了 {report.total_sightings ?? 0} 次偶遇，遇见了 {report.unique_cats ?? 0} 只不同的猫猫。
                {report.streak_days > 1 ? ` 连续 ${report.streak_days} 天都有记录，继续保持！` : ' 明天也要去校园转转哦'}
              </p>
            </div>
          </>
        ) : (
          <EmptyState icon={TrendingUp} title="暂无本周数据" />
        )}
      </div>
    </div>
  )
}
