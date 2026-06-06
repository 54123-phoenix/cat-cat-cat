import { useEffect, useState } from 'react'
import { User, MapPin, Calendar, Award } from 'lucide-react'
import CatCard from '../components/CatCard'
import { getUserProfile, getCats } from '../api'

export default function Profile() {
  const [user, setUser] = useState(null)
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getUserProfile(),
      getCats(),
    ])
      .then(([userData, catsData]) => {
        setUser(userData)
        setCats(catsData)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* User Info */}
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center shrink-0 overflow-hidden">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.nickname}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-primary" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-text">
              {user?.nickname || '猫猫爱好者'}
            </h2>
            <p className="text-text-secondary text-sm">
              已解锁 {cats.length} 只猫
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <Award className="w-5 h-5 text-primary" />
            </div>
            <p className="font-bold text-text">{cats.length}</p>
            <p className="text-xs text-text-secondary">已发现</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <p className="font-bold text-text">{new Set(cats.map(c => c.location)).size}</p>
            <p className="text-xs text-text-secondary">出没地点</p>
          </div>
          <div className="text-center">
            <div className="flex justify-center mb-1">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <p className="font-bold text-text">7</p>
            <p className="text-xs text-text-secondary">活跃天数</p>
          </div>
        </div>
      </div>

      {/* Cat Collection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-text">
            我的猫档案
          </h3>
          <span className="text-sm text-text-secondary font-medium">
            {cats.length} / 15
          </span>
        </div>

        {cats.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {cats.map((cat) => (
              <CatCard key={cat.id} cat={cat} />
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <p className="text-text-secondary text-lg mb-2">还没有解锁猫猫</p>
            <p className="text-text-secondary text-sm">
              去首页拍照，发现校园里的猫吧！
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
