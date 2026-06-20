import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cat, Star, Heart, PawPrint, Search, Filter, Trophy } from 'lucide-react'
import ImageWithShimmer from '../components/ImageWithShimmer'
import EmptyState from '../components/EmptyState'
import { getCats, getFollowedCats, getSightings } from '../api'

const RARE_CHARS = ['稀', '珍', '白', '黑', '三花', '玳瑁']

const MILESTONES = [
  { count: 5, label: '初遇', emoji: '🌱' },
  { count: 10, label: '熟识', emoji: '🌿' },
  { count: 20, label: '猫友', emoji: '🐾' },
  { count: 30, label: '猫达人', emoji: '🏅' },
  { count: 50, label: '猫博士', emoji: '🎓' },
]

function isRareCat(cat, metIds) {
  const sightingsForCat = cat.sightings_count
  if (sightingsForCat !== undefined && sightingsForCat < 3) return true
  if (metIds.has(cat.id) && (sightingsForCat === undefined || sightingsForCat < 5)) return true
  const name = cat.name || ''
  return RARE_CHARS.some((c) => name.includes(c))
}

function StatusPill({ status }) {
  if (status === 'followed') {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">已关注</span>
  }
  if (status === 'met') {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-mint-light text-mint font-medium">已相遇</span>
  }
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">未相遇</span>
}

export default function Collection() {
  const [cats, setCats] = useState([])
  const [followed, setFollowed] = useState([])
  const [sightings, setSightings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      getCats(),
      getFollowedCats().catch(() => []),
      getSightings({ limit: 200 }).catch(() => []),
    ])
      .then(([catsData, followedData, sightingsData]) => {
        setCats(Array.isArray(catsData) ? catsData : [])
        setFollowed(Array.isArray(followedData) ? followedData : [])
        setSightings(Array.isArray(sightingsData) ? sightingsData : [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-square rounded-2xl skeleton" />
        ))}
      </div>
    )
  }

  const followedIds = new Set(followed.map((f) => f.cat_id))
  const metIds = new Set(sightings.map((s) => s.cat_id).filter(Boolean))
  const metCount = cats.filter((c) => metIds.has(c.id)).length
  const total = cats.length
  const pct = total > 0 ? metCount / total : 0
  const R = 36
  const C = 2 * Math.PI * R

  const nextMilestone = MILESTONES.find((m) => m.count > metCount) || MILESTONES[MILESTONES.length - 1]
  const currentMilestone = [...MILESTONES].reverse().find((m) => m.count <= metCount)

  const filteredCats = useMemo(() => {
    let result = cats
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((c) => (c.name || '').toLowerCase().includes(q) || (c.location || '').toLowerCase().includes(q) || (c.color || '').toLowerCase().includes(q))
    }
    if (filter === 'met') result = result.filter((c) => metIds.has(c.id))
    else if (filter === 'unmet') result = result.filter((c) => !metIds.has(c.id))
    else if (filter === 'rare') result = result.filter((c) => isRareCat(c, metIds))
    else if (filter === 'followed') result = result.filter((c) => followedIds.has(c.id))
    return result
  }, [cats, search, filter, metIds, followedIds])

  if (total === 0) {
    return (
      <EmptyState
        icon={Cat}
        title="还没有校园猫猫"
        description="等猫协录入猫猫后就能在这里图鉴啦"
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress ring */}
      <div className="card p-4 flex items-center gap-4">
        <div className="relative w-24 h-24 shrink-0">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r={R} fill="none" stroke="#F5F5F4" strokeWidth="8" />
            <circle
              cx="48" cy="48" r={R} fill="none" stroke="#F97316" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct)}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-primary">{Math.round(pct * 100)}%</span>
          </div>
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-text">猫猫图鉴</h2>
          <p className="text-sm text-text-secondary mt-1">
            已遇见 <span className="font-bold text-primary">{metCount}</span> / {total} 只校园猫
          </p>
          <div className="flex items-center gap-1 mt-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] text-text-muted">
              {currentMilestone ? `${currentMilestone.emoji} ${currentMilestone.label}` : '开始探索吧'} · 下一: {nextMilestone.emoji} {nextMilestone.label} ({nextMilestone.count}只)
            </span>
          </div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索猫名、位置、颜色…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {[
            { key: 'all', label: '全部' },
            { key: 'met', label: '已相遇' },
            { key: 'unmet', label: '未相遇' },
            { key: 'rare', label: '稀有' },
            { key: 'followed', label: '已关注' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${filter === f.key ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary hover:bg-gray-200'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filteredCats.map((cat, idx) => {
          const followedCat = followedIds.has(cat.id)
          const metCat = metIds.has(cat.id)
          const status = followedCat ? 'followed' : metCat ? 'met' : 'unmet'
          const rare = isRareCat(cat, metIds)
          return (
            <button
              key={cat.id}
              onClick={() => navigate(`/cats/${cat.id}`)}
              className={`card p-0 overflow-hidden rounded-2xl text-left active:scale-95 transition-transform relative animate-pop-in stagger-${(idx % 6) + 1}`}
            >
              <div className="aspect-square relative bg-primary-light">
                {cat.avatar ? (
                  <ImageWithShimmer src={cat.avatar} alt={cat.name} loading="lazy" className="w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Cat className="w-8 h-8 text-primary/30" />
                  </div>
                )}
                {rare && (
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 text-[10px] font-bold">
                    <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                    稀有
                  </span>
                )}
                <div className="absolute bottom-1.5 right-1.5">
                  <StatusPill status={status} />
                </div>
              </div>
              <div className="p-2.5">
                <p className="text-sm font-bold text-text truncate">{cat.name}</p>
                {cat.location && (
                  <p className="text-[11px] text-text-secondary truncate">{cat.location}</p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {filteredCats.length === 0 && (
        <div className="text-center py-8 text-sm text-text-muted">没有找到匹配的猫猫</div>
      )}
    </div>
  )
}
