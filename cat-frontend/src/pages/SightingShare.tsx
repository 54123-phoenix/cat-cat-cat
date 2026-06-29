import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera, Cat, Clock, Copy, MapPin, PawPrint, Share2, Sparkles } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import ImageWithShimmer from '../components/ImageWithShimmer'
import SharePoster from '../components/SharePoster'
import { getCat, getSighting, getToken } from '../api'
import { toast } from '../components/Toast'

function formatTime(value?: string) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function activityText(value?: string) {
  const labels: Record<string, string> = {
    eating: '正在吃饭',
    sleeping: '正在休息',
    playing: '正在玩耍',
    walking: '正在散步',
    hiding: '正在躲猫猫',
  }
  return value ? labels[value] || value : '被温柔遇见'
}

export default function SightingShare() {
  const { sightingId } = useParams()
  const navigate = useNavigate()
  const [sighting, setSighting] = useState<any>(null)
  const [cat, setCat] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const authed = Boolean(getToken())

  useEffect(() => {
    setLoading(true)
    setError('')
    getSighting(sightingId)
      .then(async (data) => {
        setSighting(data)
        if (data.cat) {
          setCat(data.cat)
        } else if (data.cat_id) {
          setCat(await getCat(data.cat_id).catch(() => null))
        }
      })
      .catch((err) => setError(err.message || '偶遇分享加载失败'))
      .finally(() => setLoading(false))
  }, [sightingId])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast('链接已复制', { emoji: '🔗' })
    } catch {
      toast('复制失败，可以直接分享当前页面', { emoji: '⚠️' })
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-surface-0 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-secondary">正在打开偶遇记录…</p>
        </div>
      </main>
    )
  }

  if (error || !sighting) {
    return (
      <main className="min-h-screen bg-surface-0 p-4 flex items-center justify-center">
        <div className="w-full max-w-md">
          <EmptyState
            icon={PawPrint}
            title={error || '没有找到这次偶遇'}
            description="这条分享链接可能已经失效"
            action={{ label: '进入社区', onClick: () => navigate('/login') }}
          />
        </div>
      </main>
    )
  }

  const image = sighting.image_path || cat?.avatar || cat?.images?.[0]?.image_path
  const catName = sighting.cat?.name || cat?.name || sighting.cat_name || '校园猫猫'
  const location = sighting.location || sighting.location_name || '复旦校园某处'

  return (
    <main className="min-h-screen bg-surface-0 text-text">
      <section className="relative min-h-[68vh] overflow-hidden bg-primary-light">
        <div className="absolute inset-0">
          {image ? (
            <ImageWithShimmer src={image} alt={catName} className="w-full h-full" loading="eager" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary-light">
              <PawPrint className="w-20 h-20 text-primary/25" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
        </div>

        <div className="relative z-10 min-h-[68vh] flex flex-col justify-end px-5 pb-7 pt-5 max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-auto">
            <button
              onClick={() => navigate(cat?.id ? `/cats/public/${cat.id}` : '/login')}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-2 text-xs font-medium text-text shadow-sm"
            >
              <Cat className="w-3.5 h-3.5" />
              猫猫名片
            </button>
            <div className="flex gap-2">
              <button
                onClick={copyLink}
                aria-label="复制链接"
                className="w-9 h-9 rounded-full bg-white/90 text-text flex items-center justify-center shadow-sm"
              >
                <Copy className="w-4 h-4" />
              </button>
              <SharePoster type="sighting" data={{ cat_name: catName, image, location }}>
                <button
                  aria-label="分享偶遇"
                  className="w-9 h-9 rounded-full bg-white/90 text-text flex items-center justify-center shadow-sm"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </SharePoster>
            </div>
          </div>

          <div className="space-y-3 text-white">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs backdrop-blur">
              <Sparkles className="w-3.5 h-3.5" />
              一次校园猫偶遇
            </div>
            <div>
              <p className="text-sm text-white/80">我遇见了</p>
              <h1 className="text-4xl font-bold leading-tight">{catName}</h1>
            </div>
            <p className="inline-flex items-center gap-1.5 text-sm text-white/90">
              <MapPin className="w-4 h-4" />
              {location}
            </p>
            <p className="inline-flex items-center gap-1.5 text-sm text-white/90">
              <Clock className="w-4 h-4" />
              {formatTime(sighting.created_at)}
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white border border-border p-3 text-center">
            <p className="text-xs text-text-secondary">状态</p>
            <p className="text-sm font-bold text-text">{activityText(sighting.activity_type)}</p>
          </div>
          <div className="rounded-xl bg-white border border-border p-3 text-center">
            <p className="text-xs text-text-secondary">确认</p>
            <p className="text-lg font-bold text-text">{sighting.confirmations || 0}</p>
          </div>
          <div className="rounded-xl bg-white border border-border p-3 text-center">
            <p className="text-xs text-text-secondary">等级</p>
            <p className="text-sm font-bold text-text">{sighting.grade || 'casual'}</p>
          </div>
        </div>

        {sighting.note && (
          <section className="rounded-xl bg-white border border-border p-4">
            <h2 className="text-base font-bold text-text mb-2">偶遇备注</h2>
            <p className="text-sm leading-7 text-text-secondary">“{sighting.note}”</p>
          </section>
        )}

        {cat && (
          <section className="rounded-xl bg-white border border-border p-4 flex gap-3 items-center">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-primary-light flex items-center justify-center shrink-0">
              {cat.avatar ? (
                <ImageWithShimmer src={cat.avatar} alt={cat.name} className="w-full h-full" loading="lazy" />
              ) : (
                <Cat className="w-7 h-7 text-primary/30" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-text">{cat.name}</p>
              <p className="text-xs text-text-secondary truncate">{cat.location || '校园猫猫'}</p>
            </div>
            <button
              onClick={() => navigate(`/cats/public/${cat.id}`)}
              className="rounded-full border border-border px-3 py-2 text-xs font-medium text-text-secondary"
            >
              看名片
            </button>
          </section>
        )}

        <div className="sticky bottom-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate(cat?.id ? `/cats/public/${cat.id}` : '/login')}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white border border-border px-4 py-3 text-sm font-medium text-text shadow-lg"
          >
            <Cat className="w-4 h-4 text-primary" />
            猫猫名片
          </button>
          <button
            onClick={() => navigate(authed ? '/scan' : '/login')}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-white shadow-lg"
          >
            <Camera className="w-4 h-4" />
            我也偶遇
          </button>
        </div>
      </section>
    </main>
  )
}
