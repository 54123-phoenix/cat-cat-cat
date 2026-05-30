import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CatCard from '../components/CatCard'
import { fetchCats, fetchStats } from '../api'

export default function Home() {
  const [cats, setCats] = useState([])
  const [stats, setStats] = useState({ total: 0, today: 0, users: 0 })
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchCats(), fetchStats()])
      .then(([catData, statData]) => {
        setCats(catData)
        setStats(statData)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filteredCats = useMemo(() => {
    const value = keyword.trim().toLowerCase()
    if (!value) return cats
    return cats.filter((cat) => [cat.name, cat.nickname, cat.color, cat.location]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(value)))
  }, [cats, keyword])

  return (
    <div className="pb-6">
      <div className="bg-cat-orange px-4 pt-4 pb-4 text-white rounded-b-[28px] shadow-lg shadow-orange-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-medium">🐾 猫猫驿站</h1>
            <p className="text-xs opacity-80 mt-0.5">复旦大学 · 今日 {stats.today} 只猫咪有记录</p>
          </div>
          <Link to="/scan" className="bg-white/20 rounded-full px-3 py-1.5 text-xs font-medium active:bg-white/30">
            去识别
          </Link>
        </div>

        <div className="mt-3 bg-white/20 rounded-full px-4 py-2 flex items-center gap-2">
          <span className="text-sm opacity-70">🔍</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="bg-transparent text-sm text-white placeholder-white/70 outline-none flex-1"
            placeholder="搜索猫猫名字…"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-3 py-3">
        {[
          { num: stats.total, label: '在册猫咪' },
          { num: stats.today, label: '今日偶遇' },
          { num: stats.users, label: '铲屎官' },
        ].map(({ num, label }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <div className="text-xl font-medium text-cat-orange">{num}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="px-3 pb-3">
        <div className="grid grid-cols-2 gap-2">
          <Link to="/map" className="block bg-white rounded-2xl border border-orange-100 p-4 active:bg-orange-50">
            <p className="text-xs font-medium text-cat-orange">猫猫地图</p>
            <h2 className="text-sm font-medium text-gray-800 mt-0.5">今日出没热力图</h2>
            <p className="text-2xl mt-2">🗺️</p>
          </Link>
          <Link to="/gallery" className="block bg-white rounded-2xl border border-orange-100 p-4 active:bg-orange-50">
            <p className="text-xs font-medium text-cat-orange">照片墙</p>
            <h2 className="text-sm font-medium text-gray-800 mt-0.5">查看参考照片</h2>
            <p className="text-2xl mt-2">🖼️</p>
          </Link>
        </div>
      </div>

      <div className="px-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] font-medium text-gray-400 uppercase tracking-widest">今日活跃</h2>
          <Link to="/feed" className="text-[11px] font-medium text-cat-orange">看动态</Link>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
            <div className="text-3xl animate-paw mb-2">🐾</div>
            加载猫猫中…
          </div>
        ) : filteredCats.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredCats.map((cat) => <CatCard key={cat.id} cat={cat} />)}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
            没找到这只猫猫
          </div>
        )}
      </div>
    </div>
  )
}
