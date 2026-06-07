import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { getWeeklyReport } from '../api'

export default function WeeklyReport() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getWeeklyReport()
      .then(setReport)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="sticky top-0 z-40 bg-warm-50/80 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-border">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-lg hover:bg-primary-light">
          <ArrowLeft className="w-5 h-5 text-text" />
        </button>
        <h1 className="text-lg font-bold text-text">本周报告</h1>
      </header>

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
                <p className="text-2xl font-bold text-text">{report.total_sightings || 0}</p>
                <p className="text-xs text-text-secondary">本周偶遇</p>
              </div>
              <div className="card p-4 text-center space-y-1">
                <p className="text-2xl font-bold text-text">{report.unique_cats || 0}</p>
                <p className="text-xs text-text-secondary">遇到不同猫</p>
              </div>
              <div className="card p-4 text-center space-y-1">
                <p className="text-2xl font-bold text-text">{report.streak_days || 0}</p>
                <p className="text-xs text-text-secondary">连续天数</p>
              </div>
              <div className="card p-4 text-center space-y-1">
                <div className="flex items-center justify-center gap-1">
                  <p className="text-2xl font-bold text-text">{report.last_week_count || 0}</p>
                  {report.trend === 'up' ? <TrendingUp className="w-5 h-5 text-green-500" /> :
                   report.trend === 'down' ? <TrendingDown className="w-5 h-5 text-red-500" /> :
                   <Minus className="w-5 h-5 text-gray-400" />}
                </div>
                <p className="text-xs text-text-secondary">上周对比</p>
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
                本周你共记录了 {report.total_sightings} 次偶遇，遇见了 {report.unique_cats} 只不同的猫猫。
                {report.streak_days > 1 ? ` 连续 {report.streak_days} 天都有记录，继续保持！` : ' 明天也要去校园转转哦 🐱'}
              </p>
            </div>
          </>
        ) : (
          <div className="card p-8 text-center text-sm text-text-secondary">
            暂无本周数据
          </div>
        )}
      </div>
    </div>
  )
}
