import { useEffect, useState } from 'react'
import { Trophy, Crown, Sparkles } from 'lucide-react'
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

export default function League() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const myId = getStoredUser()?.id

  useEffect(() => {
    getLeaderboard()
      .then(setData)
      .catch((err) => setError(err.message || '排行榜加载失败'))
      .finally(() => setLoading(false))
  }, [])

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

      {/* Ranking list */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-text px-1">排行榜 Top {top.length}</h3>
        <div className="card p-0 overflow-hidden">
          {top.map((u, idx) => {
            const isMe = u.id === myId
            const rank = idx + 1
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
                <span className="text-sm font-bold text-text-secondary shrink-0">{u.xp} XP</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
