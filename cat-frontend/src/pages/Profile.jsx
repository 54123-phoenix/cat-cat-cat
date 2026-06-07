import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Award, MapPin } from 'lucide-react'
import CatCard from '../components/CatCard'
import BadgeCard from '../components/BadgeCard'
import { getUserProfile, getCats } from '../api'

export default function Profile() {
  const [user, setUser] = useState(null)
  const [cats, setCats] = useState([])
  const [badges, setBadges] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      getUserProfile(),
      getCats(),
    ])
      .then(([userData, catsData]) => {
        setUser(userData)
        setCats(catsData)
        setBadges(userData.badges || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full skeleton" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-32 skeleton" />
              <div className="h-4 w-24 skeleton" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 skeleton" />
            ))}
          </div>
        </div>
        <div className="h-24 skeleton" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 skeleton" />
          ))}
        </div>
      </div>
    )
  }

  const earnedBadges = badges.filter((b) => b.earned)
  const badgeStats = user?.stats || {}
  const totalBadges = badgeStats.total_badges || 12

  function badgeSummary() {
    const count = earnedBadges.length
    if (count === 0) return '快去完成任务获得勋章吧'
    if (count === totalBadges) return '全部收集完成！🎉'
    return `已获得 ${count}/${totalBadges}`
  }

  return (
    <div className="space-y-5">
      {/* User Info */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center shrink-0 overflow-hidden">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-text truncate">
              {user?.nickname || '猫猫爱好者'}
            </h2>
            <p className="text-text-secondary text-sm">
              {cats.length > 0
                ? `已经认识了 ${cats.length} 只校园猫猫`
                : '还没有认识的猫猫'}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-border">
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <Award className="w-5 h-5 text-primary" />
            </div>
            <p className="font-bold text-text text-lg">{badgeStats.sightings || 0}</p>
            <p className="text-xs text-text-secondary">偶遇次数</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <p className="font-bold text-text text-lg">{badgeStats.locations_count || 0}</p>
            <p className="text-xs text-text-secondary">出没地点</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <Award className="w-5 h-5 text-primary" />
            </div>
            <p className="font-bold text-text text-lg">{badgeStats.badges_count || 0}</p>
            <p className="text-xs text-text-secondary">勋章</p>
          </div>
        </div>
      </div>

      {/* Badge Wall */}
      <div className="space-y-3">
        <button
          onClick={() => navigate('/badges')}
          className="w-full flex items-center justify-between"
        >
          <h3 className="text-lg font-bold text-text">🏅 勋章墙</h3>
          <span className="text-sm text-primary font-medium">
            {badgeSummary()} ›
          </span>
        </button>

        {earnedBadges.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {earnedBadges.slice(0, 8).map((b) => {
              const def = BADGE_DISPLAY[b.badge_key] || { emoji: '🎖️', name: b.badge_key }
              return (
                <BadgeCard
                  key={b.badge_key}
                  badge={def}
                  earned={true}
                  size="sm"
                />
              )
            })}
            {earnedBadges.length > 8 && (
              <button
                onClick={() => navigate('/badges')}
                className="flex-shrink-0 w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-xs text-gray-400 font-medium"
              >
                +{earnedBadges.length - 8}
              </button>
            )}
          </div>
        ) : (
          <div className="card p-6 text-center space-y-2">
            <span className="text-3xl">🐾</span>
            <p className="text-sm text-text-secondary">
              还没有获得勋章
            </p>
            <p className="text-xs text-text-secondary">
              去社区发帖或记录偶遇来获取吧
            </p>
          </div>
        )}

        {/* Unearned preview */}
        {earnedBadges.length > 0 && earnedBadges.length < totalBadges && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {badges.filter((b) => !b.earned).slice(0, 4).map((b) => {
              const def = BADGE_DISPLAY[b.badge_key] || { emoji: '🔒', name: b.badge_key }
              return (
                <BadgeCard
                  key={b.badge_key}
                  badge={def}
                  earned={false}
                  size="sm"
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Cat Collection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-text">
            我的猫档案
          </h3>
          <span className="text-sm text-text-secondary font-medium">
            {cats.length}
          </span>
        </div>

        {cats.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {cats.map((cat) => (
              <CatCard key={cat.id} cat={cat} />
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center space-y-2">
            <span className="text-3xl">🐱</span>
            <p className="text-text-secondary text-sm">
              还没有解锁猫猫
            </p>
            <p className="text-text-secondary text-xs">
              去首页拍照，发现校园里的猫吧！
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

const BADGE_DISPLAY = {
  first_sighting: { emoji: '👀', name: '初次偶遇' },
  cat_observer: { emoji: '🔭', name: '观察员' },
  cat_expert: { emoji: '🎯', name: '专家' },
  first_post: { emoji: '📝', name: '首帖' },
  community_helper: { emoji: '💬', name: '热心人' },
  community_star: { emoji: '⭐', name: '社区之星' },
  cat_collector: { emoji: '🏆', name: '收藏家' },
  cat_master: { emoji: '👑', name: '大师' },
  new_cat_finder: { emoji: '🐾', name: '发现者' },
  photography_first: { emoji: '📸', name: '摄影' },
  map_explorer: { emoji: '🗺️', name: '探索者' },
  collection_complete: { emoji: '✨', name: '全收集' },
}
