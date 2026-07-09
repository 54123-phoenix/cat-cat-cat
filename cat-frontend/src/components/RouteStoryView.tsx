import { useEffect, useState } from 'react'
import { AlertCircle, BadgeCheck, Camera, CheckCircle2, Clock, MapPin, PawPrint, Trophy } from 'lucide-react'
import { getRouteStory, routeCheckIn, getRouteProgress } from '../api'
import type { RouteStory, RouteProgressResult } from '../types'
import ImageWithShimmer from './ImageWithShimmer'
import ShareArtifact from './ShareArtifact'

interface RouteStoryViewProps {
  timeSlot?: string
  onCheckIn?: (stop: RouteStory['stops'][0]) => void
  onViewCat?: (catId: number) => void
  onScanAtStop?: (stop: RouteStory['stops'][0]) => void
}

export default function RouteStoryView({ timeSlot = 'anytime', onCheckIn, onViewCat, onScanAtStop }: RouteStoryViewProps) {
  const [story, setStory] = useState<RouteStory | null>(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<RouteProgressResult | null>(null)
  const [checkinError, setCheckinError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setCheckinError(null)
    getRouteStory({ time_slot: timeSlot })
      .then((data) => {
        setStory(data)
        getRouteProgress(timeSlot, data.stops.length)
          .then((prog) => setProgress(prog))
          .catch(() => {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [timeSlot])

  if (loading) {
    return (
      <section className="rounded-2xl bg-white p-4 shadow-e2">
        <div className="space-y-3">
          <div className="h-5 w-40 rounded bg-surface-2 animate-pulse" />
          <div className="h-4 w-64 max-w-full rounded bg-surface-2 animate-pulse" />
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 rounded-xl bg-surface-2 animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (!story || story.stops.length === 0) {
    return (
      <section className="rounded-2xl bg-white p-6 text-center shadow-e2">
        <PawPrint className="mx-auto h-10 w-10 text-text-muted" />
        <p className="mt-3 text-sm font-bold text-text">暂无路线数据</p>
        <p className="mt-1 text-xs text-text-secondary">先记录几次校园偶遇，路线故事会自动生成。</p>
      </section>
    )
  }

  const routeLimit = Math.min(6, Math.max(1, story.stops.length || 4))
  const checkedStops = new Set(progress?.checked_stops ?? [])
  const hasStamp = progress?.has_stamp ?? false
  const completed = progress?.completed ?? false
  const checkedCount = Math.min(progress?.checkin_count ?? checkedStops.size, story.stops.length)
  const allChecked = completed || (routeLimit > 0 && story.stops.every((stop) => checkedStops.has(stop.name)))

  function handleCheckIn(stop: RouteStory['stops'][0]) {
    setCheckinError(null)
    routeCheckIn({ time_slot: timeSlot, stop_name: stop.name, cat_id: stop.cat_id, route_limit: routeLimit })
      .then(() => {
        getRouteProgress(timeSlot, routeLimit)
          .then((prog) => setProgress(prog))
          .catch(() => {})
        onCheckIn?.(stop)
      })
      .catch(() => {
        setCheckinError('打卡失败，请稍后重试')
        getRouteProgress(timeSlot, routeLimit)
          .then((prog) => setProgress(prog))
          .catch(() => {})
      })
  }

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-e3">
      <div className="border-b border-border-light bg-gradient-to-br from-primary-light/60 via-white to-surface-0 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-h2 font-bold text-text">{story.title}</h3>
            <p className="mt-1 text-sm leading-6 text-text-secondary">{story.story_intro}</p>
          </div>
          <div className="shrink-0 rounded-xl bg-white px-3 py-2 text-center shadow-e1">
            <p className="text-[11px] text-text-muted">进度</p>
            <p className="mt-0.5 text-sm font-bold text-primary">{checkedCount}/{story.stops.length}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {checkinError && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {checkinError}
          </div>
        )}

        {story.stops.map((stop, idx) => {
          const checked = checkedStops.has(stop.name)
          return (
            <article
              key={`${stop.name}-${idx}`}
              className={`relative rounded-2xl border p-4 transition-colors ${
                checked ? 'border-primary/30 bg-primary-light/30' : 'border-border-light bg-white'
              }`}
            >
              {idx < story.stops.length - 1 && (
                <div className="absolute left-8 top-16 h-[calc(100%-28px)] w-px bg-border" />
              )}

              <div className="relative flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  checked ? 'bg-primary text-white' : 'bg-surface-3 text-text-secondary'
                }`}>
                  {checked ? <CheckCircle2 className="h-5 w-5" /> : idx + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    {stop.cat_avatar ? (
                      <ImageWithShimmer src={stop.cat_avatar} alt={stop.cat_name} className="h-14 w-14 rounded-2xl" loading="lazy" compact />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-light">
                        <PawPrint className="h-6 w-6 text-primary" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{stop.name}</span>
                      </div>
                      <button
                        onClick={() => onViewCat?.(stop.cat_id)}
                        className="mt-1 text-left text-lg font-bold leading-tight text-text hover:text-primary"
                      >
                        {stop.cat_name}
                      </button>
                      <p className="mt-1 text-xs text-text-secondary">{stop.reason}</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
                    {stop.clue}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-secondary">
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1">
                      <Clock className="h-3.5 w-3.5" />
                      {stop.time_window}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1">
                      <Camera className="h-3.5 w-3.5" />
                      {stop.sightings_count} 次记录
                    </span>
                    {stop.confidence > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {Math.round(stop.confidence * 100)}%
                      </span>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onScanAtStop?.(stop)}
                      className="rounded-full bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover active:scale-[0.98]"
                    >
                      到这里识猫
                    </button>
                    <button
                      onClick={() => handleCheckIn(stop)}
                      disabled={checked}
                      className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors active:scale-[0.98] ${
                        checked
                          ? 'bg-surface-3 text-text-muted'
                          : 'border border-border bg-white text-text-secondary hover:bg-surface-2'
                      }`}
                    >
                      {checked ? '已打卡' : '完成路线打卡'}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {allChecked && hasStamp && (
        <div className="border-t border-primary/20 bg-gradient-to-br from-stone-950 via-stone-900 to-orange-950 px-5 py-5 text-white animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-amber-200 bg-primary shadow-primary-glow">
              <div className="absolute inset-2 rounded-full border border-white/50" />
              <Trophy className="h-9 w-9 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-amber-100">
                {story.route_stamp.emoji} 路线完成
              </div>
              <div className="mt-2 text-xl font-extrabold tracking-tight">{story.route_stamp.name}</div>
              <div className="mt-1 text-sm text-amber-50/80">已完成 {story.route_stamp.stop_count} 个偶遇点，路线印章已收入护照。</div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/10 p-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-amber-100">可分享证明</div>
              <div className="mt-0.5 truncate text-xs text-white/70">扫码即可打开这条校园猫路线</div>
            </div>
            <ShareArtifact
              title={story.route_stamp.name}
              subtitle={`${story.route_stamp.stop_count} 站路线完成`}
              badge={story.route_stamp.emoji}
              proof={`跟随线索找到了 ${story.route_stamp.stop_count} 个偶遇点`}
              sharePath={`/routes?time_slot=${story.time_slot}`}
              slogan="校园猫路线"
            >
              <button className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-bold text-stone-950 transition-colors hover:bg-amber-50 active:scale-[0.98]">
                分享印章
              </button>
            </ShareArtifact>
          </div>
        </div>
      )}
    </section>
  )
}
