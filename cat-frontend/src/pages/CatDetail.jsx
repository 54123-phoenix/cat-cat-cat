import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCat, getSightings, getHealthRecords } from '../api'

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

const RECORD_TYPE_LABEL = {
  vaccine: '💉 疫苗',
  deworm: '🪱 驱虫',
  sterilization: '✂️ 绝育',
  injury: '🩹 伤病',
  illness: '🤒 疾病',
  checkup: '🏥 体检',
}

export default function CatDetail() {
  const { catId } = useParams()
  const [cat, setCat] = useState(null)
  const [sightings, setSightings] = useState([])
  const [healthRecords, setHealthRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      getCat(catId),
      getSightings({ catId, limit: 10 }),
      getHealthRecords(catId),
    ])
      .then(([catData, sightingsData, healthData]) => {
        setCat(catData)
        setSightings(sightingsData)
        setHealthRecords(Array.isArray(healthData) ? healthData : [])
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
      <div className="card p-6 text-center space-y-4">
        <p className="text-text-secondary">{error || '没有找到这只猫'}</p>
        <Link to="/profile" className="btn btn-primary inline-block">
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

      <section className="card overflow-hidden p-0">
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
              <h1 className="text-3xl font-bold text-text">{cat.name}</h1>
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
                <span key={tag} className="px-3 py-1 rounded-full border border-border text-sm text-text-secondary">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {(cat.gender || cat.age_estimate || cat.neutered) && (
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
            {healthRecords.map((r) => (
              <div key={r.id} className="card flex items-start gap-3">
                <span className="text-lg shrink-0 mt-0.5">
                  {RECORD_TYPE_LABEL[r.record_type]?.split(' ')[0] || '🏥'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-text">{r.title}</p>
                    <span className="text-[10px] text-text-secondary shrink-0">{formatDate(r.record_date)}</span>
                  </div>
                  {r.description && <p className="text-xs text-text-secondary mt-0.5">{r.description}</p>}
                  {r.location && <p className="text-[10px] text-text-muted mt-0.5">📍 {r.location}</p>}
                </div>
              </div>
            ))}
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
          <div className="card p-5 text-text-secondary text-sm text-center">
            还没有偶遇记录，去首页拍下它吧
          </div>
        )}
      </section>
    </div>
  )
}
