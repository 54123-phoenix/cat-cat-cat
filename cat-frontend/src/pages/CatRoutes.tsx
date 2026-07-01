import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { MapPin, PawPrint, Share2, Navigation, ScanLine, Clock } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import RouteStoryView from '../components/RouteStoryView'
import ImageWithShimmer from '../components/ImageWithShimmer'
import { ROUTES } from '../constants/routes'
import { getRouteRecommendations } from '../api'
import { useNavigate } from 'react-router-dom'

const TIME_SLOTS = [
  { key: 'anytime', label: '任意' },
  { key: 'morning', label: '早晨' },
  { key: 'noon', label: '中午' },
  { key: 'afternoon', label: '下午' },
  { key: 'evening', label: '傍晚' },
]

function formatTime(v) {
  if (!v) return ''
  return new Date(v).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function CatRoutes() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSlot = searchParams.get('time_slot') || 'anytime'
  const [timeSlot, setTimeSlot] = useState(initialSlot)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setLoading(true); setError('')
    getRouteRecommendations({ time_slot: timeSlot, limit: 4, days: 14 })
      .then(setData)
      .catch((e) => setError(e.message || '路线加载失败'))
      .finally(() => setLoading(false))
  }, [timeSlot])

  const switchSlot = (key) => {
    setTimeSlot(key)
    setSearchParams(key === 'anytime' ? {} : { time_slot: key })
  }

  const shareUrl = () => {
    const base = `${window.location.origin}${ROUTES.ROUTES_PAGE}`
    return timeSlot === 'anytime' ? base : `${base}?time_slot=${timeSlot}`
  }

  const handleShare = async () => {
    const url = shareUrl()
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="min-h-screen bg-warm-50">
      <PageHeader title="猫猫路线" subtitle="基于近期偶遇热度推荐" />
      <div className="p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {TIME_SLOTS.map((s) => (
            <button
              key={s.key}
              onClick={() => switchSlot(s.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                timeSlot === s.key ? 'bg-primary text-white' : 'bg-card text-text-secondary border border-border'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {error && <div className="rounded-2xl px-4 py-3 text-sm font-bold bg-red-50 text-red-500">{error}</div>}

        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && data && (
          <>
            <div className="card p-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <PawPrint className="w-5 h-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-bold text-text truncate">{data.title}</h2>
                  <p className="text-xs text-text-secondary">{data.stops?.length || 0} 个推荐路线点</p>
                </div>
              </div>
              <button onClick={handleShare} className="btn btn-ghost btn-sm flex items-center gap-1 shrink-0">
                <Share2 className="w-4 h-4" />{copied ? '已复制' : '分享'}
              </button>
            </div>

            {data.stops?.length > 0 ? (
              <ol className="space-y-3">
                {data.stops.map((stop, i) => (
                  <li key={i} className="card p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-text-secondary shrink-0" />
                          <p className="font-bold text-text truncate">{stop.name}</p>
                        </div>
                        <p className="text-xs text-text-secondary mt-1">{stop.reason} · {stop.sightings_count} 次偶遇</p>
                        {stop.latest_sighting_at && (
                          <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />最近 {formatTime(stop.latest_sighting_at)}
                          </p>
                        )}
                      </div>
                    </div>

                    {(stop.cat_name || stop.cat_avatar) && (
                      <Link to={`${ROUTES.CAT_DETAIL.replace(':catId', stop.cat_id)}`} className="flex items-center gap-2 ml-10">
                        {stop.cat_avatar
                          ? <ImageWithShimmer src={stop.cat_avatar} alt={stop.cat_name || '猫猫'} className="w-8 h-8 rounded-full" loading="lazy" compact />
                          : <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center"><PawPrint className="w-4 h-4 text-text-secondary" /></div>}
                        <span className="text-sm font-medium text-text">{stop.cat_name || '校园猫猫'}</span>
                      </Link>
                    )}

                    <div className="grid grid-cols-2 gap-2 ml-10">
                      <Link
                        to={ROUTES.MAP}
                        className="btn btn-ghost btn-sm flex items-center justify-center gap-1"
                      >
                        <Navigation className="w-4 h-4" />查看地图
                      </Link>
                      <Link
                        to={`${ROUTES.SCAN}?point=${encodeURIComponent(stop.name)}${stop.latitude ? `&lat=${stop.latitude}&lng=${stop.longitude}` : ''}`}
                        className="btn btn-primary btn-sm flex items-center justify-center gap-1"
                      >
                        <ScanLine className="w-4 h-4" />去识猫
                      </Link>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="card p-6 text-center space-y-2">
                <PawPrint className="w-10 h-10 text-text-muted mx-auto" />
                <p className="text-sm font-bold text-text">还没有足够的偶遇数据</p>
                <p className="text-xs text-text-secondary">先去校园里记录几次猫猫偶遇，路线推荐会自动生成。</p>
                <Link to={ROUTES.SCAN} className="inline-block btn btn-primary btn-sm mt-2">去识猫打卡</Link>
              </div>
            )}
          </>
        )}

        <div className="pt-2">
          <h3 className="font-bold text-text mb-3 flex items-center gap-2">
            <PawPrint className="w-5 h-5 text-primary" />
            路线故事化探索
          </h3>
          <RouteStoryView
            timeSlot={timeSlot}
            onViewCat={(catId) => navigate(ROUTES.CAT_DETAIL.replace(':catId', String(catId)))}
          />
        </div>
      </div>
    </div>
  )
}
