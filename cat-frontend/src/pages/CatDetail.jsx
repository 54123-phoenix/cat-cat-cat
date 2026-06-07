import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { Cat, Heart, PawPrint, Syringe, Scissors, Bandage, Stethoscope, MapPin } from 'lucide-react'
import { getCat, getSightings, getHealthRecords, followCat, unfollowCat, checkFollow } from '../api'

function formatTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric' })
}

const RECORD_TYPE_ICON = {
  vaccine: Syringe,
  deworm: Stethoscope,
  sterilization: Scissors,
  injury: Bandage,
  illness: Stethoscope,
  checkup: Stethoscope,
}

export default function CatDetail() {
  const { catId } = useParams()
  const [cat, setCat] = useState(null)
  const [sightings, setSightings] = useState([])
  const [healthRecords, setHealthRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      getCat(catId),
      getSightings({ catId, limit: 10 }),
      getHealthRecords(catId),
      checkFollow(catId).then(r => setFollowing(r.following)).catch(() => {}),
    ])
      .then(([catData, sightingsData, healthData]) => {
        setCat(catData)
        setSightings(Array.isArray(sightingsData) ? sightingsData : [])
        setHealthRecords(Array.isArray(healthData) ? healthData : [])
      })
      .catch((err) => setError(err.message || '猫猫档案加载失败'))
      .finally(() => setLoading(false))
  }, [catId])

  async function toggleFollow() {
    if (followLoading) return
    setFollowLoading(true)
    const next = !following
    setFollowing(next)
    try {
      if (next) await followCat(catId)
      else await unfollowCat(catId)
    } catch {
      setFollowing(!next)
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !cat) {
    return (
      <div className="pb-6">
        <PageHeader title="猫猫档案" />
        <div className="p-4 text-center space-y-4">
          <p className="text-text-secondary">{error || '没有找到这只猫'}</p>
        </div>
      </div>
    )
  }

  const personalityTags = cat.personality
    ? cat.personality.split(/[，,、]/).map((tag) => tag.trim()).filter(Boolean)
    : []

  return (
    <div className="pb-6">
      <PageHeader title={cat.name} subtitle={cat.location || '校园猫猫'} />

      <div className="space-y-4 p-3">
        <section className="card overflow-hidden p-0">
          <div className="aspect-[4/3] bg-primary-light flex items-center justify-center overflow-hidden">
            {cat.avatar ? (
              <img src={cat.avatar} alt={cat.name} className="w-full h-full object-cover" />
            ) : (
              <Cat className="w-12 h-12 text-primary/30" />
              )}
          </div>
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-text">{cat.name}</h1>
              {cat.nickname && (
                <p className="text-primary font-bold text-sm mt-1">{cat.nickname}</p>
              )}
              {cat.location && (
                <p className="text-text-secondary text-sm mt-1">常出没：{cat.location}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={toggleFollow}
                disabled={followLoading}
                className={`rounded-full p-2 transition-colors ${following ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-50 hover:bg-gray-100'}`}
              >
                <Heart className={`w-5 h-5 ${following ? 'fill-primary text-primary' : 'text-gray-300'} ${followLoading ? 'animate-like-pop' : ''}`} />
              </button>
              {cat.color && (
                <span className="px-3 py-1 rounded-full bg-primary-light text-primary font-bold text-sm">
                  {cat.color}
                </span>
              )}
            </div>
          </div>

          {personalityTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {personalityTags.map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full border border-border text-sm text-text-secondary">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {(cat.gender || cat.age_estimate || cat.neutered) && (
            <div className="grid grid-cols-3 gap-2 pt-2">
              {cat.gender && (
                <div className="rounded-xl bg-primary-light p-2 text-center">
                  <p className="text-xs text-text-secondary">性别</p>
                  <p className="font-bold text-text text-sm">{cat.gender}</p>
                </div>
              )}
              {cat.age_estimate && (
                <div className="rounded-xl bg-primary-light p-2 text-center">
                  <p className="text-xs text-text-secondary">年龄</p>
                  <p className="font-bold text-text text-sm">{cat.age_estimate}</p>
                </div>
              )}
              {cat.neutered && (
                <div className="rounded-xl bg-primary-light p-2 text-center">
                  <p className="text-xs text-text-secondary">绝育</p>
                  <p className="font-bold text-text text-sm">{cat.neutered}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {cat.story && (
        <section className="card p-5 space-y-2">
          <h2 className="font-bold text-lg text-text">猫猫故事</h2>
          <p className="text-text-secondary leading-relaxed">{cat.story}</p>
        </section>
      )}

      {healthRecords.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold text-lg text-text">健康记录</h2>
          <div className="space-y-2">
            {healthRecords.map((r) => {
              const IconComp = RECORD_TYPE_ICON[r.record_type] || Stethoscope
              return (
              <div key={r.id} className="card flex items-start gap-3">
                <span className="shrink-0 mt-0.5 text-primary-light">
                  <IconComp className="w-5 h-5 text-primary/60" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-text">{r.title}</p>
                    <span className="text-xs text-text-secondary shrink-0">{formatDate(r.record_date)}</span>
                  </div>
                  {r.description && <p className="text-xs text-text-secondary mt-0.5">{r.description}</p>}
                  {r.location && <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{r.location}</p>}
                </div>
              </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-bold text-lg text-text">照片墙</h2>
        {cat.images?.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {cat.images.map((image) => (
              <div key={image.id} className="aspect-square card p-0 overflow-hidden">
                <img src={image.image_path} alt={cat.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-5 text-text-secondary text-sm text-center">
            暂时还没有参考照片
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold text-lg text-text">最近偶遇</h2>
        {sightings.length > 0 ? (
          <div className="space-y-3">
            {sightings.map((sighting) => (
              <article key={sighting.id} className="card flex gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary-light flex items-center justify-center shrink-0">
                  <PawPrint className="w-5 h-5 text-primary/40" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-text">{sighting.location || '校园某处'}</p>
                  <p className="text-sm text-text-secondary">{formatTime(sighting.created_at)}</p>
                  {sighting.note && (
                    <p className="text-sm text-text-secondary mt-1">“{sighting.note}”</p>
                  )}
                  {sighting.spotted_by && (
                    <p className="text-xs text-text-secondary mt-1">记录者：{sighting.spotted_by}</p>
                  )}
                  {sighting.confidence !== null && sighting.confidence !== undefined && (
                    <p className="text-xs text-text-secondary mt-1">
                      识别匹配度 {Math.round(sighting.confidence * 100)}%
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="card p-5 text-text-secondary text-sm text-center">
            还没有偶遇记录，去首页拍下它吧
          </div>
        )}
      </section>
      </div>
    </div>
  )
}
