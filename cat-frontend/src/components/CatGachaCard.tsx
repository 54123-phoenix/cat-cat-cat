import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Gift, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { drawDailyGacha, getDailyGacha } from '../api'
import type { DailyGacha, DailyGachaPrize } from '../types'
import ImageWithShimmer from './ImageWithShimmer'
import ShareArtifact from './ShareArtifact'

interface CatGachaCardProps {
  onViewCat?: (catId: number) => void
}

const rarityStyle = {
  common: {
    label: 'bg-white/90 text-stone-700',
    ring: 'ring-white/50',
    glow: 'shadow-[0_18px_34px_-18px_rgba(255,255,255,0.7)]',
  },
  rare: {
    label: 'bg-sky-100 text-sky-700',
    ring: 'ring-sky-200',
    glow: 'shadow-[0_18px_34px_-18px_rgba(56,189,248,0.8)]',
  },
  epic: {
    label: 'bg-amber-100 text-amber-800',
    ring: 'ring-amber-200',
    glow: 'shadow-[0_18px_34px_-16px_rgba(251,191,36,0.9)]',
  },
}

function getStyle(rarity?: string) {
  return rarityStyle[rarity as keyof typeof rarityStyle] || rarityStyle.common
}

function PrizePortrait({ prize, drawing }: { prize?: DailyGachaPrize; drawing: boolean }) {
  const cat = prize?.cat
  const style = getStyle(prize?.rarity)

  return (
    <div className={`relative mx-auto flex h-28 w-28 items-center justify-center rounded-[24px] bg-white/10 ring-1 ${style.ring} ${style.glow}`}>
      <div className={`absolute inset-3 rounded-[20px] bg-gradient-to-br from-white/25 to-white/5 ${drawing ? 'animate-cat-spin motion-reduce:animate-none' : ''}`} />
      <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white text-4xl shadow-e2">
        {cat?.avatar ? (
          <ImageWithShimmer src={cat.avatar} alt={cat.name} className="h-full w-full" loading="lazy" compact />
        ) : (
          <span>{prize?.emoji || '🎁'}</span>
        )}
      </div>
      <div className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xl text-white shadow-primary-glow">
        {prize?.emoji || '🐾'}
      </div>
    </div>
  )
}

export default function CatGachaCard({ onViewCat }: CatGachaCardProps) {
  const [data, setData] = useState<DailyGacha | null>(null)
  const [loading, setLoading] = useState(true)
  const [drawing, setDrawing] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getDailyGacha()
      .then((res) => {
        setData(res)
        setRevealed(!!res.drawn)
      })
      .catch(() => setError('今天的扭蛋机暂时开不了'))
      .finally(() => setLoading(false))
  }, [])

  async function handleDraw() {
    if (drawing || data?.drawn) return
    setDrawing(true)
    setError('')
    try {
      const [result] = await Promise.all([
        drawDailyGacha(),
        new Promise((resolve) => window.setTimeout(resolve, 720)),
      ])
      setData(result)
      setRevealed(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '抽取失败，请稍后再试')
    } finally {
      setDrawing(false)
    }
  }

  if (loading) {
    return <section className="h-44 rounded-2xl bg-stone-100 skeleton" aria-label="今日猫缘加载中" />
  }

  if (!data?.available || !data.prize) {
    return (
      <section className="rounded-2xl bg-white p-4 shadow-e2 ring-1 ring-stone-900/5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-2xl">🎁</div>
          <div>
            <h2 className="text-base font-bold text-text">今日猫缘扭蛋</h2>
            <p className="text-sm text-text-secondary">{data?.message || error || '先记录一次猫猫偶遇，再回来抽猫签。'}</p>
          </div>
        </div>
      </section>
    )
  }

  const prize = data.prize
  const cat = prize.cat
  const style = getStyle(prize.rarity)
  const canShare = revealed || data.drawn

  return (
    <section className="overflow-hidden rounded-2xl bg-stone-950 text-white shadow-e3" aria-live="polite">
      <div className="relative p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(251,191,36,0.28),transparent_32%),radial-gradient(circle_at_90%_18%,rgba(94,200,167,0.20),transparent_30%),linear-gradient(135deg,#24150f_0%,#12100f_58%,#1f2937_100%)]" />
        <div className="absolute -bottom-16 left-1/2 h-36 w-36 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-orange-100 ring-1 ring-white/10">
                <Sparkles className="h-3.5 w-3.5" />
                今日猫缘扭蛋
              </div>
              <h2 className="mt-2 text-lg font-extrabold text-white">
                {canShare ? '今天的猫签已入袋' : '每天一次，抽一张校园猫签'}
              </h2>
              <p className="mt-1 text-sm leading-5 text-white/70">
                {canShare ? prize.share_text : '抽到的猫签会进入收藏品，也可以生成分享图。'}
              </p>
            </div>
            {canShare && (
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${style.label}`}>
                {prize.rarity_label}
              </span>
            )}
          </div>

          <PrizePortrait prize={prize} drawing={drawing} />

          {canShare ? (
            <div className="animate-pop-in space-y-3">
              <div className="rounded-2xl bg-white px-4 py-3 text-stone-950">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-extrabold">{prize.title}</p>
                    <p className="mt-0.5 text-xs font-medium text-stone-500">
                      {cat.location || '校园某处'} · {data.date}
                    </p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                </div>
                <p className="mt-3 text-sm leading-6 text-stone-700">{prize.fortune}</p>
                <div className="mt-3 rounded-xl bg-primary-light px-3 py-2 text-xs font-bold text-primary">
                  {prize.action_hint}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onViewCat?.(cat.id)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/15 active:scale-[0.98]"
                >
                  <ExternalLink className="h-4 w-4" />
                  看这只猫
                </button>
                <ShareArtifact
                  title={`今日猫缘 · ${cat.name}`}
                  subtitle={prize.base_title}
                  image={cat.avatar}
                  badge={prize.emoji}
                  proof={prize.fortune}
                  sharePath={`/cats/${cat.id}`}
                  accent="from-stone-100 via-orange-50 to-amber-100"
                  slogan="今日猫签"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-stone-950 transition-colors hover:bg-orange-50 active:scale-[0.98]"
                  >
                    <Gift className="h-4 w-4" />
                    分享猫签
                  </button>
                </ShareArtifact>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleDraw}
                disabled={drawing}
                className="btn-sweep flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-extrabold text-stone-950 transition-transform hover:bg-orange-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {drawing ? <Loader2 className="h-4 w-4 animate-cat-spin motion-reduce:animate-none" /> : <Wand2 className="h-4 w-4" />}
                {drawing ? '猫签滚动中' : '抽今日猫签'}
              </button>
              {error && <p className="text-center text-xs font-medium text-red-200">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
