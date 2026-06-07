import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, MapPin, MessageSquare, Camera, PawPrint, Cat } from 'lucide-react'
import { getCats, getPosts, getSightings, getUserProfile, recognize, createSighting } from '../api'
import ScanView from '../components/ScanView'
import CatSpinner from '../components/CatSpinner'

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return '夜深了，猫猫们都睡了'
  if (h < 9) return '早安！今天猫咪们刚醒'
  if (h < 12) return '上午好，去校园找猫吧'
  if (h < 14) return '中午了，猫猫在午睡'
  if (h < 17) return '下午适合去喂猫'
  if (h < 19) return '傍晚是猫猫活跃时间'
  if (h < 22) return '晚上好，猫猫还在散步'
  return '夜深了，猫猫们该休息了'
}

export default function Home() {
  const [cats, setCats] = useState([])
  const [featured, setFeatured] = useState(null)
  const [sightings, setSightings] = useState([])
  const [postCount, setPostCount] = useState(0)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showScan, setShowScan] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      getCats(),
      getSightings({ limit: 5 }),
      getPosts(),
      getUserProfile().catch(() => null),
    ]).then(([catsData, sightingsData, postsData, userData]) => {
      const arr = Array.isArray(catsData) ? catsData : []
      setCats(arr)
      if (arr.length > 0) setFeatured(arr[Math.floor(Math.random() * arr.length)])
      setSightings(Array.isArray(sightingsData) ? sightingsData : [])
      setPostCount(Array.isArray(postsData) ? postsData.length : 0)
      setProfile(userData)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  async function handleCapture(file) {
    const res = await recognize(file)
    try { await createSighting({ catId: res.cat_id, confidence: res.confidence, file }) } catch (e) {}
    return res
  }

  return (
    <div className="space-y-5">
      {/* Greeting + stats */}
      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-text-secondary">{greeting()}</p>
            <h1 className="text-xl font-bold text-text mt-0.5">
              {profile?.nickname || '猫猫爱好者'}
            </h1>
          </div>
          {loading ? (
            <CatSpinner size={28} />
          ) : (
            <PawPrint className="w-7 h-7 text-primary/40" />
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 pt-1">
          <div className="bg-primary-light rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-primary">{cats.length}</p>
            <p className="text-xs text-text-secondary">认识猫猫</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-green-600">{sightings.length}</p>
            <p className="text-xs text-text-secondary">最新偶遇</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-blue-600">{postCount}</p>
            <p className="text-xs text-text-secondary">社区帖子</p>
          </div>
        </div>
      </div>

      {/* Featured cat hero */}
      {featured && (
        <div
          onClick={() => navigate(`/cats/${featured.id}`)}
          className="card overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
        >
          <div className="flex gap-4 items-center">
            <div className="w-20 h-20 rounded-2xl bg-primary-light flex items-center justify-center shrink-0 overflow-hidden">
              {featured.avatar ? (
                <img src={featured.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <Cat className="w-8 h-8 text-primary/30" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-primary font-medium bg-primary-light px-2 py-0.5 rounded-full">今日推荐</span>
              </div>
              <p className="text-lg font-bold text-text mt-1">{featured.name}</p>
              {featured.location && (
                <p className="text-xs text-text-secondary flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {featured.location}
                </p>
              )}
              {featured.personality && (
                <p className="text-xs text-text-secondary mt-1 line-clamp-1">{featured.personality}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setShowScan(true)}
          className="card p-4 flex flex-col items-center gap-2 hover:shadow-card-hover transition-shadow active:scale-95"
        >
          <Camera className="w-6 h-6 text-primary" />
          <span className="text-xs font-medium text-text">拍照识猫</span>
        </button>
        <button
          onClick={() => navigate('/community')}
          className="card p-4 flex flex-col items-center gap-2 hover:shadow-card-hover transition-shadow active:scale-95"
        >
          <MessageSquare className="w-6 h-6 text-blue-500" />
          <span className="text-xs font-medium text-text">进社区</span>
        </button>
        <button
          onClick={() => navigate('/map')}
          className="card p-4 flex flex-col items-center gap-2 hover:shadow-card-hover transition-shadow active:scale-95"
        >
          <MapPin className="w-6 h-6 text-green-500" />
          <span className="text-xs font-medium text-text">看地图</span>
        </button>
      </div>

      {/* Recent cats horizontal scroll */}
      {cats.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-text">认识的所有猫猫</h2>
            <span className="text-xs text-text-secondary">{cats.length} 只</span>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 pb-2">
            {cats.map((cat) => (
              <button
                key={cat.id}
                onClick={() => navigate(`/cats/${cat.id}`)}
                className="flex-shrink-0 w-20 text-center space-y-1.5"
              >
                <div className="w-20 h-20 rounded-2xl bg-primary-light flex items-center justify-center overflow-hidden mx-auto">
                  {cat.avatar ? (
                    <img src={cat.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Cat className="w-6 h-6 text-primary/30" />
                  )}
                </div>
                <p className="text-xs font-medium text-text truncate">{cat.name}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Recent sightings feed */}
      {sightings.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text">最近偶遇</h2>
            <button onClick={() => navigate('/feed')} className="text-xs text-primary font-medium">
              查看全部 →
            </button>
          </div>
          <div className="space-y-2">
            {sightings.slice(0, 3).map((s) => (
              <div key={s.id} className="card p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-sm shrink-0">
                  <Cat className="w-4 h-4 text-primary/40" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text">
                    {s.cat?.name || '校园猫猫'} 
                    <span className="text-text-secondary font-normal"> · {s.location_name || s.location || '校园某处'}</span>
                  </p>
                  {s.note && <p className="text-xs text-text-secondary mt-0.5 truncate">{s.note}</p>}
                </div>
                <span className="text-xs text-text-secondary shrink-0">{s.createdAt || ''}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Scan view (overlay) */}
      {showScan && (
        <div className="fixed inset-0 z-50 bg-warm-50">
          <div className="flex flex-col items-center pt-12 px-4">
            <ScanView
              onCapture={handleCapture}
              onResultClose={() => setShowScan(false)}
            />
            <button
              onClick={() => setShowScan(false)}
              className="mt-6 text-sm text-text-secondary underline underline-offset-4"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
