import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Award, MapPin, Cat, PawPrint, Heart, Sparkles } from 'lucide-react'
import CatCard from '../components/CatCard'
import BadgeCard from '../components/BadgeCard'
import EmptyState from '../components/EmptyState'
import ThemeSwitcher from '../components/ThemeSwitcher'
import { getUserProfile, getCats, getFollowedCats, getStoredUser, getMyStats } from '../api'
import { BADGE_DISPLAY } from '../constants/badges'
import StreakBadge from '../components/StreakBadge'

export default function Profile() {
  const [user, setUser] = useState(null)
  const [cats, setCats] = useState([])
  const [followedCats, setFollowedCats] = useState([])
  const [badges, setBadges] = useState([])
  const [myStats, setMyStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const storedUser = getStoredUser()
    if (!storedUser) {
      setAuthError(true)
      setLoading(false)
      return
    }
    Promise.all([
      getUserProfile(),
      getCats(),
      getFollowedCats().catch(() => []),
      getMyStats().catch(() => null),
    ])
      .then(([userData, catsData, followedData, statsData]) => {
        setUser(userData)
        setCats(Array.isArray(catsData) ? catsData : [])
        setFollowedCats(Array.isArray(followedData) ? followedData : [])
        setBadges(userData.badges || [])
        setMyStats(statsData)
      })
      .catch((err) => {
        if (err.message?.includes('401') || err.message?.includes('Not authenticated')) {
          setAuthError(true)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  if (authError) {
    return (
      <div className="space-y-5 p-4">
        <div className="card p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary-light flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-text">请先登录</h2>
          <p className="text-sm text-text-secondary">登录后查看个人资料、勋章和猫档案</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 rounded-full bg-primary text-white font-medium"
          >
            去登录
          </button>
        </div>
      </div>
    )
  }

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
    if (count === totalBadges) return '全部收集完成！'
    return `已获得 ${count}/${totalBadges}`
  }

  return (
    <div className="space-y-5">
      {/* User Info */}
      <div className="card p-0 overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-primary to-[#EA580C] rounded-b-3xl" />
        <div className="px-5 pb-5">
          <div className="flex items-end gap-4 -mt-10">
            <div className="w-20 h-20 rounded-full bg-primary-light flex items-center justify-center shrink-0 overflow-hidden ring-4 ring-white shadow-md">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-primary" />
              )}
            </div>
            <div className="min-w-0 pb-1">
              <h2 className="text-2xl font-extrabold text-text truncate">
                {user?.nickname || '猫猫爱好者'}
              </h2>
              <p className="text-text-secondary text-sm">
                {cats.length > 0
                  ? `已经认识了 ${cats.length} 只校园猫猫`
                  : '还没有认识的猫猫'}
              </p>
              {myStats && (
                <div className="mt-1.5">
                  <StreakBadge streak={myStats.streak || 0} />
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
            <div className="text-center">
              <div className="flex justify-center mb-1">
                <Award className="w-4 h-4 text-primary" />
              </div>
              <p className="font-bold text-text text-display-lg">{badgeStats.sightings || 0}</p>
              <p className="text-caption text-text-muted">偶遇次数</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-1">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <p className="font-bold text-text text-display-lg">{badgeStats.locations_count || 0}</p>
              <p className="text-caption text-text-muted">出没地点</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-1">
                <Award className="w-4 h-4 text-primary" />
              </div>
              <p className="font-bold text-text text-display-lg">{badgeStats.badges_count || 0}</p>
              <p className="text-caption text-text-muted">勋章</p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings: theme */}
      <div className="card p-4">
        <ThemeSwitcher />
      </div>

      <button
        onClick={() => navigate('/wrapped')}
        className="w-full card p-4 flex items-center gap-3 active:scale-95 transition-transform"
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-[#EA580C] flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 text-left">
          <p className="font-bold text-text">年度猫猫报告</p>
          <p className="text-xs text-text-secondary">查看你的年度寻猫总结</p>
        </div>
        <span className="text-primary">›</span>
      </button>

      {/* Badge Wall */}
      <div className="space-y-3">
        <button
          onClick={() => navigate('/badges')}
          className="w-full flex items-center justify-between"
        >
          <h3 className="text-lg font-bold text-text flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            勋章墙
          </h3>
          <span className="text-sm text-primary font-medium">
            {badgeSummary()} ›
          </span>
        </button>

        {earnedBadges.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {earnedBadges.slice(0, 8).map((b) => {
              const def = BADGE_DISPLAY[b.badge_key] || { name: b.badge_key }
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
          <EmptyState
            icon={PawPrint}
            title="还没有获得勋章"
            description="去社区发帖或记录偶遇来获取吧"
          />
        )}

        {/* Unearned preview */}
        {earnedBadges.length > 0 && earnedBadges.length < totalBadges && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {badges.filter((b) => !b.earned).slice(0, 4).map((b) => {
              const def = BADGE_DISPLAY[b.badge_key] || { name: b.badge_key }
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
          <EmptyState
            icon={Cat}
            title="还没有解锁猫猫"
            description="去首页拍照，发现校园里的猫吧！"
          />
        )}
      </div>

      {/* Followed Cats */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-text">
            关注的猫猫
          </h3>
          <span className="text-sm text-text-secondary font-medium">
            {followedCats.length}
          </span>
        </div>

        {followedCats.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 pb-2">
            {followedCats.map((cat) => (
              <button
                key={cat.id}
                onClick={() => navigate(`/cats/${cat.cat_id}`)}
                className="flex-shrink-0 w-20 text-center space-y-2"
              >
                <div className="w-20 h-20 rounded-2xl bg-primary-light flex items-center justify-center overflow-hidden mx-auto">
                  {cat.cat_avatar ? (
                    <img src={cat.cat_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Cat className="w-6 h-6 text-primary/30" />
                  )}
                </div>
                <p className="text-xs font-medium text-text truncate">{cat.cat_name}</p>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Heart}
            title="还没有关注的猫猫"
            description="去猫猫档案页关注你喜欢的猫吧"
          />
        )}
      </div>
    </div>
  )
}
