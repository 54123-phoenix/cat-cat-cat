import { useEffect, useState } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { Clock, MapPin, PawPrint, Share2, Sparkles } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import RouteStoryView from '../components/RouteStoryView'
import ImageWithShimmer from '../components/ImageWithShimmer'
import ShareArtifact from '../components/ShareArtifact'
import { ROUTES } from '../constants/routes'
import { getRouteRecommendations } from '../api'

const TIME_SLOTS = [
  { key: 'anytime', label: '今天', hint: '全天可走' },
  { key: 'morning', label: '清晨', hint: '5:00-11:00' },
  { key: 'noon', label: '午间', hint: '11:00-14:00' },
  { key: 'afternoon', label: '午后', hint: '14:00-18:00' },
  { key: 'evening', label: '傍晚', hint: '18:00-24:00' },
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

  const activeSlot = TIME_SLOTS.find((slot) => slot.key === timeSlot) || TIME_SLOTS[0]
  const stops = data?.stops ?? []
  const totalSightings = stops.reduce((sum, stop) => sum + (stop.sightings_count || 0), 0)
  const leadStop = stops[0]

  useEffect(() => {
    setLoading(true)
    setError('')
    getRouteRecommendations({ time_slot: timeSlot, limit: 4, days: 14 })
      .then(setData)
      .catch((e) => setError(e.message || '路线加载失败'))
      .finally(() => setLoading(false))
  }, [timeSlot])

  const switchSlot = (key) => {
    setTimeSlot(key)
    setSearchParams(key === 'anytime' ? {} : { time_slot: key })
  }

  const sharePath = timeSlot === 'anytime' ? ROUTES.ROUTES_PAGE : `${ROUTES.ROUTES_PAGE}?time_slot=${timeSlot}`

  function scanAtStop(stop) {
    const lat = stop.latitude ? `&lat=${stop.latitude}&lng=${stop.longitude}` : ''
    navigate(`${ROUTES.SCAN}?point=${encodeURIComponent(stop.name)}${lat}`)
  }

  return (
    <div className="min-h-screen bg-warm-50">
      <PageHeader title="寻猫路线" subtitle="按时间段推荐校园偶遇点" />

      <div className="p-4 space-y-4">
        <section className="overflow-hidden rounded-2xl bg-stone-950 text-white shadow-e3">
          <div className="relative p-5">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/45 via-stone-900 to-stone-950" />
            <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/14 px-3 py-1.5 text-xs font-semibold text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                  今日校园寻猫路线
                </span>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary">
                  {activeSlot.hint}
                </span>
              </div>

              <div>
                <p className="text-sm text-white/72">根据近 14 天偶遇热度，为你挑出最值得走的一段路。</p>
                <h2 className="mt-2 text-3xl font-bold leading-tight">
                  {leadStop ? `先去 ${leadStop.name} 看看` : '从一次偶遇开始生成路线'}
                </h2>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white/12 px-3 py-2">
                  <p className="text-[11px] text-white/62">路线点</p>
                  <p className="mt-1 text-lg font-bold">{stops.length || 0}</p>
                </div>
                <div className="rounded-xl bg-white/12 px-3 py-2">
                  <p className="text-[11px] text-white/62">偶遇记录</p>
                  <p className="mt-1 text-lg font-bold">{totalSightings}</p>
                </div>
                <div className="rounded-xl bg-white/12 px-3 py-2">
                  <p className="text-[11px] text-white/62">当前时段</p>
                  <p className="mt-1 text-lg font-bold">{activeSlot.label}</p>
                </div>
              </div>

              <ShareArtifact
                title={`${activeSlot.label}校园寻猫路线`}
                subtitle={leadStop ? `从 ${leadStop.name} 出发` : '先记录几次偶遇'}
                proof={`${stops.length || 0} 个路线点 · ${totalSightings} 次近期偶遇`}
                sharePath={sharePath}
                badge="🗺️"
                slogan="跟着线索去找校园猫"
                accent="from-stone-900 via-orange-100 to-primary/10"
              >
                <button className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-stone-950 transition-colors hover:bg-orange-50 active:scale-[0.98]">
                  <Share2 className="h-4 w-4" />
                  生成路线分享卡
                </button>
              </ShareArtifact>
            </div>
          </div>
        </section>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot.key}
              onClick={() => switchSlot(slot.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                timeSlot === slot.key ? 'bg-primary text-white shadow-e2' : 'bg-white text-text-secondary border border-border'
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        <RouteStoryView
          timeSlot={timeSlot}
          onViewCat={(catId) => navigate(ROUTES.CAT_DETAIL.replace(':catId', String(catId)))}
          onScanAtStop={scanAtStop}
        />

        <section className="rounded-2xl bg-white p-4 shadow-e2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-text">路线热度依据</h3>
              <p className="mt-0.5 text-xs text-text-secondary">展示近期偶遇最多的地点，方便说明推荐从哪里来。</p>
            </div>
            <PawPrint className="h-5 w-5 shrink-0 text-primary" />
          </div>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-16 rounded-xl bg-surface-2 animate-pulse" />
              ))}
            </div>
          ) : stops.length > 0 ? (
            <div className="space-y-2">
              {stops.slice(0, 3).map((stop, index) => (
                <div key={`${stop.name}-${index}`} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  {stop.cat_avatar ? (
                    <ImageWithShimmer src={stop.cat_avatar} alt={stop.cat_name || '猫猫'} className="h-9 w-9 rounded-full" loading="lazy" compact />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light">
                      <PawPrint className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                      <p className="truncate text-sm font-semibold text-text">{stop.name}</p>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-text-secondary">
                      {stop.cat_name || '校园猫猫'}，{stop.sightings_count || 0} 次近期记录
                    </p>
                  </div>
                  <div className="hidden text-right text-[11px] text-text-muted sm:block">
                    <Clock className="mb-0.5 ml-auto h-3.5 w-3.5" />
                    {formatTime(stop.latest_sighting_at)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-surface-2 p-5 text-center">
              <PawPrint className="mx-auto h-8 w-8 text-text-muted" />
              <p className="mt-2 text-sm font-semibold text-text">还没有足够的路线数据</p>
              <p className="mt-1 text-xs text-text-secondary">先记录几次偶遇，路线会自动变丰富。</p>
              <Link to={ROUTES.SCAN} className="mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">
                去识猫打卡
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
