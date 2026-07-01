import { useEffect, useState } from 'react'
import { getRouteStory, routeCheckIn, getRouteProgress } from '../api'
import type { RouteStory, RouteProgressResult } from '../types'
import ImageWithShimmer from './ImageWithShimmer'
import ShareArtifact from './ShareArtifact'

interface RouteStoryViewProps {
  timeSlot?: string
  onCheckIn?: (stop: RouteStory['stops'][0]) => void
  onViewCat?: (catId: number) => void
}

export default function RouteStoryView({ timeSlot = 'anytime', onCheckIn, onViewCat }: RouteStoryViewProps) {
  const [story, setStory] = useState<RouteStory | null>(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<RouteProgressResult | null>(null)
  const [checkinError, setCheckinError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
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
    return <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center text-text-secondary animate-pulse">加载路线故事中…</div>
  }
  if (!story || story.stops.length === 0) {
    return <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center text-text-secondary">暂无路线数据，去偶遇几只猫猫吧！</div>
  }

  const routeLimit = Math.min(6, Math.max(1, story.stops.length || 4))
  const checkedStops = new Set(progress?.checked_stops ?? [])
  const hasStamp = progress?.has_stamp ?? false
  const completed = progress?.completed ?? false

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

  const allChecked = completed || (routeLimit > 0 && story.stops.every(s => checkedStops.has(s.name)))

  return (
    <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-primary-light/30 to-primary/5 border-b border-gray-50">
        <h3 className="text-h2 font-bold text-text-primary">{story.title}</h3>
        <p className="text-sm text-text-secondary mt-1">{story.story_intro}</p>
      </div>

      <div className="p-5 space-y-3">
        {checkinError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 animate-fade-in">
            ⚠️ {checkinError}
          </div>
        )}
        {story.stops.map((stop, idx) => {
          const checked = checkedStops.has(stop.name)
          return (
            <div
              key={idx}
              className={`relative rounded-2xl border p-4 transition-all ${
                checked
                  ? 'bg-primary-light/20 border-primary/30'
                  : 'bg-white border-gray-100 hover:border-primary/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                  checked ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'
                }`}>
                  {checked ? '✓' : idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-text-primary truncate">{stop.name}</h4>
                    {stop.cat_avatar && (
                      <ImageWithShimmer src={stop.cat_avatar} alt={stop.cat_name} className="w-6 h-6 rounded-full flex-shrink-0" loading="lazy" compact />
                    )}
                  </div>
                  <div className="text-sm text-text-secondary mt-0.5">{stop.cat_name}</div>

                  <div className="mt-2 rounded-lg bg-amber-50/50 px-2.5 py-1.5 text-xs text-amber-700">
                    💡 {stop.clue}
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
                    <span>🕐 {stop.time_window}</span>
                    <span>📸 {stop.sightings_count}次记录</span>
                    {stop.confidence > 0 && <span>✓ {Math.round(stop.confidence * 100)}%</span>}
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => handleCheckIn(stop)}
                      disabled={checked}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all active:scale-[0.97] ${
                        checked
                          ? 'bg-gray-100 text-text-secondary cursor-default'
                          : 'bg-primary text-white hover:bg-primary-dark'
                      }`}
                    >
                      {checked ? '已打卡 ✓' : '📍 打卡'}
                    </button>
                    <button
                      onClick={() => onViewCat?.(stop.cat_id)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-50 text-text-secondary hover:bg-gray-100 transition-colors"
                    >
                      查看猫猫 →
                    </button>
                  </div>
                </div>
              </div>

              {idx < story.stops.length - 1 && (
                <div className="absolute left-9 -bottom-3 w-0.5 h-3 bg-gray-200" />
              )}
            </div>
          )
        })}
      </div>

      {allChecked && hasStamp && (
        <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-primary-light/20 border-t border-primary/20 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{story.route_stamp.emoji}</div>
            <div className="flex-1">
              <div className="font-bold text-text-primary">🎉 获得路线印章！</div>
              <div className="text-sm text-text-secondary">{story.route_stamp.name} · 全程{story.route_stamp.stop_count}站</div>
            </div>
            <ShareArtifact
              title={story.route_stamp.name}
              subtitle={`${story.route_stamp.stop_count} 站路线完成`}
              badge={story.route_stamp.emoji}
              proof={`跟随线索找到了 ${story.route_stamp.stop_count} 个偶遇点`}
              sharePath={`/routes?time_slot=${story.time_slot}`}
              slogan="校园猫路线"
            >
              <button className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors active:scale-[0.97]">
                📸 分享
              </button>
            </ShareArtifact>
          </div>
        </div>
      )}
    </div>
  )
}
