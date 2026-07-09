import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera, Cat, Copy, Heart, ImageOff, LogIn, MapPin, PawPrint, Share2, Sparkles } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import ImageWithShimmer from '../components/ImageWithShimmer'
import SharePoster from '../components/SharePoster'
import { getCat, getSightings, getToken } from '../api'
import { toast } from '../components/Toast'

function formatTime(value?: string) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PublicCat() {
  const { catId } = useParams()
  const navigate = useNavigate()
  const [cat, setCat] = useState<any>(null)
  const [sightings, setSightings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const authed = Boolean(getToken())

  useEffect(() => {
    setLoading(true)
    setError('')
    Promise.all([
      getCat(catId),
      getSightings({ cat_id: catId, limit: 6 }).catch(() => []),
    ])
      .then(([catData, sightingsData]) => {
        setCat(catData)
        setSightings(Array.isArray(sightingsData) ? sightingsData : [])
      })
      .catch((err) => setError(err.message || '猫猫名片加载失败'))
      .finally(() => setLoading(false))
  }, [catId])

  const personalityTags = useMemo(() => {
    if (!cat?.personality) return []
    return cat.personality.split(/[，,、]/).map((tag: string) => tag.trim()).filter(Boolean).slice(0, 5)
  }, [cat])

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
          <p className="text-sm text-text-secondary">正在打开猫猫名片…</p>
        </div>
      </main>
    )
  }

  if (error || !cat) {
    return (
      <main className="min-h-screen bg-surface-0 p-4 flex items-center justify-center">
        <div className="w-full max-w-md">
          <EmptyState
            icon={Cat}
            title={error || '没有找到这只猫'}
            description="这张猫猫名片可能已经失效"
            action={{ label: '返回登录', onClick: () => navigate('/login') }}
          />
        </div>
      </main>
    )
  }

  const heroImage = cat.avatar || cat.images?.[0]?.image_path
  const featuredImages = (cat.images || []).slice(0, 6)

  return (
    <main className="min-h-screen bg-surface-0 text-text">
      <section className="relative min-h-[72vh] overflow-hidden bg-primary-light">
        <div className="absolute inset-0">
          {heroImage ? (
            <ImageWithShimmer src={heroImage} alt={cat.name} className="w-full h-full" loading="eager" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary-light">
              <Cat className="w-20 h-20 text-primary/25" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
        </div>

        <div className="relative z-10 min-h-[72vh] flex flex-col justify-end px-5 pb-7 pt-5 max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-auto">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-2 text-xs font-medium text-text shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              进入社区
            </button>
            <div className="flex gap-2">
              <button
                onClick={copyLink}
                aria-label="复制链接"
                className="w-9 h-9 rounded-full bg-white/90 text-text flex items-center justify-center shadow-sm"
              >
                <Copy className="w-4 h-4" />
              </button>
              <SharePoster type="cat" data={{ name: cat.name, avatar: heroImage, personality: cat.personality }}>
                <button
                  aria-label="分享猫猫"
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
              复旦校园猫名片
            </div>
            <div>
              <h1 className="text-4xl font-bold leading-tight">{cat.name}</h1>
              {cat.nickname && <p className="mt-1 text-base text-white/85">{cat.nickname}</p>}
            </div>
            {cat.location && (
              <p className="inline-flex items-center gap-1.5 text-sm text-white/90">
                <MapPin className="w-4 h-4" />
                常出没：{cat.location}
              </p>
            )}
            {personalityTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {personalityTags.map((tag: string) => (
                  <span key={tag} className="rounded-full bg-white/20 px-3 py-1 text-xs text-white backdrop-blur">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white border border-border p-3 text-center">
            <p className="text-xs text-text-secondary">照片</p>
            <p className="text-lg font-bold text-text">{cat.images?.length || 0}</p>
          </div>
          <div className="rounded-xl bg-white border border-border p-3 text-center">
            <p className="text-xs text-text-secondary">偶遇</p>
            <p className="text-lg font-bold text-text">{sightings.length}</p>
          </div>
          <div className="rounded-xl bg-white border border-border p-3 text-center">
            <p className="text-xs text-text-secondary">状态</p>
            <p className="text-lg font-bold text-text">{cat.neutered || '待补'}</p>
          </div>
        </div>

        {cat.quote && (
          <blockquote className="rounded-xl border-l-4 border-primary bg-white px-4 py-3 text-sm text-text-secondary shadow-sm">
            “{cat.quote}”
          </blockquote>
        )}

        {cat.story && (
          <section className="space-y-2">
            <h2 className="text-base font-bold text-text">它的故事</h2>
            <p className="rounded-xl bg-white border border-border p-4 text-sm leading-7 text-text-secondary">
              {cat.story}
            </p>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-base font-bold text-text">精选照片</h2>
          {featuredImages.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {featuredImages.map((image: any) => (
                <div key={image.id} className="aspect-square rounded-xl overflow-hidden bg-primary-light">
                  <ImageWithShimmer src={image.image_path} alt={`${cat.name}的照片`} loading="lazy" className="w-full h-full" />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={ImageOff} title="还没有公开照片" description="也许你会拍到第一张。" />
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-text">最近偶遇</h2>
          {sightings.length > 0 ? (
            <div className="space-y-2">
              {sightings.map((sighting) => (
                <article key={sighting.id} className="rounded-xl bg-white border border-border p-3 flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
                    <PawPrint className="w-4 h-4 text-primary/60" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text">{sighting.location || sighting.location_name || '校园某处'}</p>
                    <p className="text-xs text-text-secondary">{formatTime(sighting.created_at)}</p>
                    {sighting.note && <p className="text-xs text-text-secondary mt-1">“{sighting.note}”</p>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={PawPrint} title="还没有公开偶遇" description="见到它时，可以帮它留下足迹。" />
          )}
        </section>

        <div className="sticky bottom-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate(authed ? `/cats/${cat.id}` : '/login')}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white border border-border px-4 py-3 text-sm font-medium text-text shadow-lg"
          >
            <Heart className="w-4 h-4 text-primary" />
            {authed ? '完整档案' : '关注它'}
          </button>
          <button
            onClick={() => navigate(authed ? '/scan' : '/login')}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-white shadow-lg"
          >
            <Camera className="w-4 h-4" />
            我也见过
          </button>
        </div>
      </section>
    </main>
  )
}
