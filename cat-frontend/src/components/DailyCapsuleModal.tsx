import { useEffect, useState } from 'react'
import { Gift, Sparkles, X } from 'lucide-react'
import { getDailyCapsule, claimDailyCapsule } from '../api'
import type { DailyCapsule } from '../types'
import ImageWithShimmer from './ImageWithShimmer'
import ShareArtifact from './ShareArtifact'

interface DailyCapsuleModalProps {
  onClose?: () => void
  onViewCat?: (catId: number) => void
}

const STORAGE_KEY = 'cat-capsule-seen'

export default function DailyCapsuleModal({ onClose, onViewCat }: DailyCapsuleModalProps) {
  const [capsule, setCapsule] = useState<DailyCapsule | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const seen = localStorage.getItem(STORAGE_KEY)
    if (seen === today) {
      setDismissed(true)
      setLoading(false)
      return
    }
    getDailyCapsule()
      .then((data) => {
        setCapsule(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function handleClose() {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem(STORAGE_KEY, today)
    setDismissed(true)
    onClose?.()
  }

  if (loading || dismissed) return null
  if (!capsule || !capsule.available || !capsule.cat) return null

  const { cat, reward } = capsule
  const personalityTags = cat.personality_tags || []

  return (
    <div className="fixed bottom-20 left-1/2 z-50 w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 animate-slide-up">
      <div
        className="relative overflow-hidden rounded-2xl border border-primary/20 bg-white shadow-e4"
      >
        <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10" />
        <div className="absolute top-3 right-3 z-10">
          <button onClick={handleClose} className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-text-secondary transition-colors" aria-label="跳过">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative bg-gradient-to-b from-primary-light/60 to-white px-5 pt-6 pb-4 text-center">
          <div className="mx-auto mb-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-primary shadow-e1">
            <Sparkles className="h-3.5 w-3.5" />
            今日校园猫胶囊
          </div>
          <div className="text-4xl mb-2">{reward?.sticker || '🐱'}</div>

          <div className="relative mx-auto w-28 h-28 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-e2">
            {cat.avatar ? (
              <ImageWithShimmer src={cat.avatar} alt={cat.name} className="w-full h-full" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl">🐱</div>
            )}
          </div>

          <h2 className="text-h1 font-bold text-text-primary mt-3">{cat.name}</h2>
          {cat.nickname && <p className="text-h3 text-text-secondary">{cat.nickname}</p>}
        </div>

        <div className="px-5 pb-5">
          {personalityTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center mb-3">
              {personalityTags.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-gray-50 text-text-secondary text-xs border border-gray-100">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {cat.quote && (
            <blockquote className="mb-3 rounded-xl border border-primary/15 bg-primary-light/20 px-3 py-2 text-sm italic text-text-secondary">
              "{cat.quote}"
            </blockquote>
          )}

          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-3 text-center">
            <div className="mb-1 flex items-center justify-center gap-1.5 text-xs font-bold text-amber-700">
              <Gift className="h-3.5 w-3.5" />
              今日称号
            </div>
            <div className="text-base font-extrabold text-amber-900">{reward?.title}</div>
            {reward?.route_hint && (
              <div className="text-xs text-amber-600 mt-1">{reward.route_hint}</div>
            )}
          </div>

          <button
            onClick={() => { handleClose(); onViewCat?.(cat.id) }}
            className="w-full mt-3 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark transition-colors active:scale-[0.98]"
          >
            去看看 {cat.name} →
          </button>
          <button
            onClick={() => {
              setClaiming(true)
              claimDailyCapsule()
                .then((res) => { setClaimed(!!res.claimed || !!res.claim); setClaiming(false) })
                .catch(() => setClaiming(false))
            }}
            disabled={claiming || claimed}
            className={`w-full mt-2 py-2.5 rounded-xl font-medium transition-colors active:scale-[0.98] ${
              claimed
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            {claimed ? '✓ 今日奖励已领取' : claiming ? '领取中…' : '🎁 领取今日奖励'}
          </button>
          <ShareArtifact
            title={`今日校园猫 · ${cat.name}`}
            subtitle={reward?.title}
            image={cat.avatar}
            badge={reward?.sticker}
            proof={reward?.route_hint || undefined}
            sharePath={`/cats/${cat.id}`}
            slogan="今日猫猫胶囊"
          >
            <button className="w-full mt-2 py-2.5 rounded-xl bg-amber-50 text-amber-700 font-medium hover:bg-amber-100 transition-colors active:scale-[0.98] border border-amber-200">
              📸 分享今日胶囊
            </button>
          </ShareArtifact>
          <button
            onClick={handleClose}
            className="w-full mt-2 py-2 rounded-xl text-text-secondary text-sm hover:bg-gray-50 transition-colors"
          >
            跳过
          </button>
        </div>
      </div>
    </div>
  )
}
