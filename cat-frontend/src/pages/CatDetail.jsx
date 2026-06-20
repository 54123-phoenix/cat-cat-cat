import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import PhotoViewer from '../components/PhotoViewer'
import ImageWithShimmer from '../components/ImageWithShimmer'
import { Cat, Heart, PawPrint, Syringe, Scissors, Bandage, Stethoscope, MapPin, ImageOff } from 'lucide-react'
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

const RADAR_DIMS = ['亲人', '活跃', '胆小', '贪吃', '独立']
const RELATION_LABEL = { '朋友': '朋友', '敌对': '敌对', '情侣': '情侣', '亲子': '亲子' }

function PersonalityRadar({ values }) {
  const size = 160
  const cx = size / 2
  const cy = size / 2
  const maxR = 60
  const n = 5
  const points = values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    const r = (Math.max(0, Math.min(5, v)) / 5) * maxR
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
  })
  const axisPoints = RADAR_DIMS.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return [cx + maxR * Math.cos(angle), cy + maxR * Math.sin(angle)]
  })
  const labelPoints = RADAR_DIMS.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return [cx + (maxR + 14) * Math.cos(angle), cy + (maxR + 14) * Math.sin(angle)]
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {[1, 2, 3, 4, 5].map((lvl) => {
        const r = (lvl / 5) * maxR
        const pts = RADAR_DIMS.map((_, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2
          return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
        }).join(' ')
        return <polygon key={lvl} points={pts} fill="none" stroke="#f0d9b5" strokeWidth="0.5" />
      })}
      {axisPoints.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="#f0d9b5" strokeWidth="0.5" />
      ))}
      <polygon
        points={points.map((p) => `${p[0]},${p[1]}`).join(' ')}
        fill="rgba(251,146,60,0.25)"
        stroke="#fb923c"
        strokeWidth="1.5"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="#fb923c" />
      ))}
      {RADAR_DIMS.map((dim, i) => (
        <text key={dim} x={labelPoints[i][0]} y={labelPoints[i][1]} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#78716c">{dim}</text>
      ))}
    </svg>
  )
}

function HourlyHeatmap({ sightings }) {
  const hours = new Array(24).fill(0)
  sightings.forEach((s) => {
    const d = new Date(s.created_at)
    if (!isNaN(d)) hours[d.getHours()]++
  })
  const max = Math.max(1, ...hours)
  return (
    <div className="flex items-end gap-[2px] h-16">
      {hours.map((count, h) => (
        <div key={h} className="flex-1 flex flex-col items-center justify-end" title={`${h}时: ${count}次`}>
          <div
            className="w-full rounded-sm transition-all"
            style={{
              height: `${Math.max(2, (count / max) * 100)}%`,
              background: count > 0 ? `rgba(251,146,60,${0.3 + 0.7 * (count / max)})` : '#f5f5f4',
            }}
          />
        </div>
      ))}
    </div>
  )
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
  const navigate = useNavigate()
  const [cat, setCat] = useState(null)
  const [sightings, setSightings] = useState([])
  const [healthRecords, setHealthRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      getCat(catId),
      getSightings({ catId, limit: 100 }),
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
              <ImageWithShimmer src={cat.avatar} alt={cat.name} className="w-full h-full" />
            ) : (
              <Cat className="w-12 h-12 text-primary/30" />
            )}
          </div>
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-display-lg text-text">{cat.name}</h1>
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

          {cat.aliases_list?.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center pt-1">
              <span className="text-xs text-text-secondary">别名：</span>
              {cat.aliases_list.map((alias) => (
                <span key={alias} className="px-2.5 py-0.5 rounded-full bg-gray-50 text-text-secondary text-xs">{alias}</span>
              ))}
            </div>
          )}

          {cat.quote && (
            <blockquote className="border-l-4 border-primary/40 bg-primary-light/50 rounded-r-lg pl-3 pr-2 py-2 text-text-secondary text-sm italic">
              “{cat.quote}”
            </blockquote>
          )}
        </div>
      </section>

      {cat.personality_radar?.length > 0 && (
        <section className="card p-5 space-y-2">
          <h2 className="font-bold text-lg text-text">性格雷达</h2>
          <PersonalityRadar values={cat.personality_radar} />
        </section>
      )}

      {cat.relationships_list?.length > 0 && (
        <section className="card p-5 space-y-2">
          <h2 className="font-bold text-lg text-text">关系链</h2>
          <div className="space-y-2">
            {cat.relationships_list.map((rel, i) => (
              <button
                key={i}
                onClick={() => rel.cat_id && navigate(`/cats/${rel.cat_id}`)}
                className="w-full flex items-center justify-between bg-primary-light rounded-lg px-3 py-2 active:bg-orange-100 text-left"
              >
                <span className="text-sm text-primary font-medium">#{rel.cat_id} 号猫猫</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white text-text-secondary">{RELATION_LABEL[rel.relation] || rel.relation}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {sightings.length > 0 && (
        <section className="card p-5 space-y-2">
          <h2 className="font-bold text-lg text-text">24h 出没热力</h2>
          <HourlyHeatmap sightings={sightings} />
          <div className="flex justify-between text-xs text-text-muted px-1">
            <span>0时</span><span>6时</span><span>12时</span><span>18时</span><span>23时</span>
          </div>
        </section>
      )}

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
            {cat.images.map((image, i) => (
              <button
                key={image.id}
                onClick={() => setViewerIndex(i)}
                className="aspect-square card p-0 overflow-hidden active:scale-95 transition-transform"
              >
                <ImageWithShimmer src={image.image_path} alt={cat.name} className="w-full h-full" />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ImageOff}
            title="暂时还没有参考照片"
            description="去校园里拍下这只猫，上传给猫协吧"
          />
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
          <EmptyState
            icon={PawPrint}
            title="还没有偶遇记录"
            description="去首页拍下它吧"
          />
        )}
      </section>
      </div>

      {viewerIndex !== null && cat?.images?.length > 0 && (
        <PhotoViewer
          images={cat.images.map((img) => ({ url: img.image_path, alt: cat.name }))}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  )
}
