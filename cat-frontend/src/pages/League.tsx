import { useEffect, useState } from 'react'
import { Trophy, Crown, Sparkles, Camera, Compass, MapPin, CheckCircle2, ShieldCheck } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { getLeaderboard, getStoredUser } from '../api'

const TIER_GRADIENTS = [
  'from-amber-700 to-amber-500',
  'from-slate-400 to-slate-300',
  'from-yellow-500 to-yellow-400',
  'from-sky-500 to-sky-400',
  'from-rose-500 to-rose-400',
  'from-emerald-500 to-emerald-400',
  'from-purple-500 to-purple-400',
  'from-pink-100 to-pink-50',
  'from-stone-700 to-stone-600',
  'from-cyan-300 to-cyan-200',
]

const CATEGORIES = [
  { key: 'overall', label: '总榜', Icon: Trophy },
  { key: 'photography', label: '摄影', Icon: Camera },
  { key: 'discovery', label: '发现', Icon: Compass },
  { key: 'map', label: '地图', Icon: MapPin },
  { key: 'confirmation', label: '确认', Icon: CheckCircle2 },
  { key: 'guardian', label: '守护', Icon: ShieldCheck },
]

export default function League() {
  const [data, setData] = useState(null)
  const [category, setCategory] = useState('overall')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const myId = getStoredUser()?.id

  useEffect(() => {
    setLoading(true)
    setError('')
    getLeaderboard(category)
      .then(setData)
      .catch((err) => setError(err.message || '排行榜加载失败'))
      .finally(() => setLoading(false))
  }, [category])

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="card h-32 skeleton" />
        <div className="card h-12 skeleton" />
        <div className="card h-12 skeleton" />
      </div>
    )
  }

  if (error) {
    return <EmptyState icon={Trophy} title="排行榜加载失败" description={error} onRetry={() => window.location.reload()} />
  }

  if (!data) return null

  const {
    tier_name, tier_name_en, tier_index, my_rank, my_xp, my_level,
    total_players, next_tier_xp, next_tier_name, top = [],
  } = data

  const grad = TIER_GRADIENTS[tier_index] || TIER_GRADIENTS[0]
  const diff = next_tier_xp != null ? Math.max(0, next_tier_xp - my_xp) : null
  const activeCategory = CATEGORIES.find((item) => item.key === category) || CATEGORIES[0]

  return (
    <div className="space-y-4">
      {/* Tier card */}
      <div className={`rounded-2xl p-5 bg-gradient-to-br ${grad} text-white shadow-lg`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/70">当前段位</p>
            <h2 className="text-2xl font-extrabold mt-0.5 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              {tier_name}
            </h2>
            <p className="text-xs text-white/70 mt-0.5">{tier_name_en} · Lv.{my_level}</p>
          </div>
          <Trophy className="w-10 h-10 text-white/80" />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/20">
          <div>
            <p className="text-2xl font-bold">#{my_rank}</p>
            <p className="text-xs text-white/70">我的排名 / {total_players}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{my_xp}</p>
            <p className="text-xs text-white/70">总 XP</p>
          </div>
        </div>
        {diff != null ? (
          <p className="mt-3 text-xs text-white/80">
            距 <span className="font-bold">{next_tier_name}</span> 还差 {diff} XP
          </p>
        ) : (
          <p className="mt-3 text-xs text-white/80 font-bold">已达成最高段位 🎉</p>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
        {CATEGORIES.map(({ key, label, Icon }) => {
          const active = key === category
          return (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border transition-colors ${
                active
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-text-secondary border-border'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          )
        })}
      </div>

      {/* Ranking list */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-text px-1">{activeCategory.label} Top {top.length}</h3>
        <div className="card p-0 overflow-hidden">
          {top.map((u, idx) => {
            const isMe = u.id === myId
            const rank = idx + 1
            const displayScore = category === 'overall' ? `${u.xp} XP` : `${u.category_score || 0} 分`
            return (
              <div
                key={u.id}
                className={`flex items-center gap-3 px-3 py-2.5 animate-fade-up stagger-${(idx % 6) + 1} ${isMe ? 'bg-primary-light' : ''} ${idx > 0 ? 'border-t border-border' : ''}`}
              >
                <div className="w-7 text-center shrink-0">
                  {rank === 1 ? (
                    <Crown className="w-5 h-5 text-amber-500 mx-auto" />
                  ) : (
                    <span className={`font-bold ${rank <= 3 ? 'text-primary' : 'text-text-secondary'}`}>{rank}</span>
                  )}
                </div>
                <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center overflow-hidden shrink-0">
                  {u.avatar ? (
                    <img src={u.avatar} alt={u.nickname || '用户'} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-primary">{u.nickname?.[0] || '?'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isMe ? 'text-primary font-bold' : 'text-text'}`}>
                    {u.nickname}{isMe ? '（我）' : ''}
                  </p>
                  <p className="text-[11px] text-text-secondary">Lv.{u.level}</p>
                </div>
                <span className="text-sm font-bold text-text-secondary shrink-0">{displayScore}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
