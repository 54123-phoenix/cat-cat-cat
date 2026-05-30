import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BadgeCard from '../components/BadgeCard'
import FeedItem from '../components/FeedItem'
import { fetchProfile } from '../api'

const ALL_BADGES = [
  { id: 'first', emoji: '🌟', name: '初次相遇', desc: '第一次上传偶遇记录' },
  { id: 'champion', emoji: '🏆', name: '最佳铲屎官', desc: '某只猫本月偶遇最多' },
  { id: 'night', emoji: '🌙', name: '深夜偶遇', desc: '22:00 后记录一次偶遇' },
  { id: 'rain', emoji: '☔', name: '雨天同行', desc: '雨天仍然去偶遇猫咪' },
  { id: 'collect', emoji: '🗺️', name: '集齐全员', desc: '偶遇所有在册猫咪' },
  { id: 'hundred', emoji: '📸', name: '百次记录', desc: '累计上传 100 条偶遇' },
  { id: 'seasons', emoji: '🌸', name: '四季偶遇', desc: '春夏秋冬各偶遇一次' },
  { id: 'honor', emoji: '👑', name: '猫协荣誉', desc: '由猫协志愿者授予' },
  { id: 'new_cat_finder', emoji: '🧭', name: '新猫发现者', desc: '提交的新猫线索被猫协审核通过' },
]

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfile()
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400">
        <div className="text-3xl animate-paw mb-2">🐾</div>
        加载中…
      </div>
    )
  }

  const earnedIds = new Set(profile?.badges || [])

  return (
    <div className="pb-8">
      <div className="bg-cat-orange px-4 pt-6 pb-14 text-white text-center rounded-b-[28px] shadow-lg shadow-orange-100">
        <div className="text-5xl mb-2">🧑‍💻</div>
        <div className="text-lg font-medium">{profile?.nickname || '铲屎官'} #{profile?.userId || 'FDU-001'}</div>
        <div className="text-xs opacity-80 mt-1">加入 {profile?.daysJoined || 1} 天 · 复旦大学</div>
      </div>

      <div className="mx-3 -mt-8 bg-white rounded-2xl border border-gray-100 p-4">
        <div className="grid grid-cols-3 text-center divide-x divide-gray-100">
          {[
            { num: profile?.sightings || 0, label: '偶遇记录' },
            { num: profile?.catsKnown || 0, label: '认识的猫' },
            { num: profile?.badges?.length || 0, label: '获得勋章' },
          ].map(({ num, label }) => (
            <div key={label} className="px-2">
              <div className="text-xl font-medium text-cat-orange">{num}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-3 mt-4">
        <Link to="/admin" className="block bg-white rounded-xl border border-orange-100 px-4 py-3 active:bg-orange-50">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-cat-orange">猫协志愿者模式</div>
              <div className="text-sm text-gray-700 mt-0.5">维护猫档案、上传参考照片、查看偶遇记录</div>
            </div>
            <span className="text-gray-300 text-lg">›</span>
          </div>
        </Link>
      </div>

      <div className="px-3 mt-4">
        <h2 className="text-[11px] font-medium text-gray-400 uppercase tracking-widest mb-2">我的勋章</h2>
        <div className="grid grid-cols-4 gap-2">
          {ALL_BADGES.map((badge) => (
            <BadgeCard key={badge.id} badge={badge} earned={earnedIds.has(badge.id)} />
          ))}
        </div>
      </div>

      <div className="px-3 mt-4">
        <h2 className="text-[11px] font-medium text-gray-400 uppercase tracking-widest mb-2">最近偶遇</h2>
        <div className="space-y-2">
          {profile?.recentSightings?.length ? (
            profile.recentSightings.map((sighting) => <FeedItem key={sighting.id} sighting={sighting} />)
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-sm text-gray-400">
              还没有偶遇记录
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
