import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCat, getSightings } from '../api'

function formatTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CatDetail() {
  const { catId } = useParams()
  const [cat, setCat] = useState(null)
  const [sightings, setSightings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      getCat(catId),
      getSightings({ catId, limit: 10 }),
    ])
      .then(([catData, sightingsData]) => {
        setCat(catData)
        setSightings(sightingsData)
      })
      .catch((err) => setError(err.message || '猫猫档案加载失败'))
      .finally(() => setLoading(false))
  }, [catId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !cat) {
    return (
      <div className="clay-card p-6 text-center space-y-4">
        <p className="text-text-secondary">{error || '没有找到这只猫'}</p>
        <Link to="/profile" className="clay-btn inline-block">
          返回档案
        </Link>
      </div>
    )
  }

  const personalityTags = cat.personality
    ? cat.personality.split(/[，,、]/).map((tag) => tag.trim()).filter(Boolean)
    : []

  return (
    <div className="space-y-5">
      <Link to="/profile" className="text-sm font-semibold text-text-secondary">
        ← 返回我的猫档案
      </Link>

      <section className="clay-card overflow-hidden">
        <div className="aspect-[4/3] bg-primary-light flex items-center justify-center overflow-hidden">
          {cat.avatar ? (
            <img src={cat.avatar} alt={cat.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-7xl">🐱</span>
          )}
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-display font-bold text-text">{cat.name}</h1>
              {cat.nickname && (
                <p className="text-primary font-bold text-sm mt-1">{cat.nickname}</p>
              )}
              {cat.location && (
                <p className="text-text-secondary text-sm mt-1">常出没：{cat.location}</p>
              )}
            </div>
            {cat.color && (
              <span className="px-3 py-1 rounded-full bg-primary-light text-primary font-bold text-sm shrink-0">
                {cat.color}
              </span>
            )}
          </div>

          {personalityTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {personalityTags.map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full bg-card border-2 border-border text-sm text-text-secondary">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 pt-2">
            {cat.gender && (
              <div className="rounded-2xl bg-primary-light p-2 text-center">
                <p className="text-[11px] text-text-secondary">性别</p>
                <p className="font-bold text-text text-sm">{cat.gender}</p>
              </div>
            )}
            {cat.age_estimate && (
              <div className="rounded-2xl bg-primary-light p-2 text-center">
                <p className="text-[11px] text-text-secondary">年龄</p>
                <p className="font-bold text-text text-sm">{cat.age_estimate}</p>
              </div>
            )}
            {cat.neutered && (
              <div className="rounded-2xl bg-primary-light p-2 text-center">
                <p className="text-[11px] text-text-secondary">绝育</p>
                <p className="font-bold text-text text-sm">{cat.neutered}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {cat.story && (
        <section className="clay-card p-5 space-y-2">
          <h2 className="font-display font-bold text-lg text-text">猫猫故事</h2>
          <p className="text-text-secondary leading-relaxed">{cat.story}</p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display font-bold text-lg text-text">照片墙</h2>
        {cat.images?.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {cat.images.map((image) => (
              <div key={image.id} className="aspect-square clay-card overflow-hidden">
                <img src={image.image_path} alt={cat.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="clay-card p-5 text-text-secondary text-sm text-center">
            暂时还没有参考照片
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-bold text-lg text-text">最近偶遇</h2>
        {sightings.length > 0 ? (
          <div className="space-y-3">
            {sightings.map((sighting) => (
              <article key={sighting.id} className="clay-card p-4 flex gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary-light flex items-center justify-center shrink-0">
                  🐾
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
          <div className="clay-card p-5 text-text-secondary text-sm text-center">
            还没有偶遇记录，去首页拍下它吧
          </div>
        )}
      </section>
    </div>
  )
}
