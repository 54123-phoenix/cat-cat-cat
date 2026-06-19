import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, MessageSquare, Camera, PawPrint, Cat } from 'lucide-react'
import { getCats, getPosts, getSightings, getUserProfile, getWeeklyReport } from '../api'
import ImageWithShimmer from '../components/ImageWithShimmer'

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

function greetingGradient() {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return { grad: 'from-[#FFF7ED] to-[#FED7AA]', dark: false }
  if (h >= 12 && h < 17) return { grad: 'from-[#FEF3C7] to-[#FFF7ED]', dark: false }
  if (h >= 17 && h < 20) return { grad: 'from-[#FFEDD5] to-[#FED7AA]', dark: false }
  return { grad: 'from-[#292524] to-[#1C1917]', dark: true }
}

export default function Home() {
  const [cats, setCats] = useState([])
  const [sightings, setSightings] = useState([])
  const [postCount, setPostCount] = useState(0)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [weeklyReport, setWeeklyReport] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      getCats(),
      getSightings({ limit: 5 }),
      getPosts(),
      getUserProfile().catch(() => null),
      getWeeklyReport().catch(() => null),
    ]).then(([catsData, sightingsData, postsData, userData, reportData]) => {
      const arr = Array.isArray(catsData) ? catsData : []
      setCats(arr)
      setSightings(Array.isArray(sightingsData) ? sightingsData : [])
      setPostCount(Array.isArray(postsData) ? postsData.length : 0)
      setProfile(userData)
      setWeeklyReport(reportData)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const { grad: greetingGrad, dark: greetingDark } = greetingGradient()
  const greetingText = greetingDark ? 'text-white' : 'text-text'
  const greetingSubText = greetingDark ? 'text-white/70' : 'text-text-secondary'

  return (
    <div className="space-y-5">
      {/* Layer 1: Banner + stats */}
      <div className="space-y-3">
        <div className={`rounded-2xl p-5 bg-gradient-to-br ${greetingGrad}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-sm ${greetingSubText}`}>{greeting()}</p>
              <h1 className={`text-xl font-bold ${greetingText} mt-0.5`}>
                {profile?.nickname || '猫猫爱好者'}
              </h1>
            </div>
            <PawPrint className={`w-7 h-7 animate-breathe ${greetingDark ? 'text-white/60' : 'text-primary/40'}`} />
          </div>
          {weeklyReport && (
            <button
              onClick={() => navigate('/weekly-report')}
              className={`mt-3 flex items-center gap-1 text-xs ${greetingSubText} hover:underline`}
            >
              本周 {weeklyReport.total_sightings || 0} 次偶遇 · {weeklyReport.unique_cats || 0} 只猫猫 →
            </button>
          )}
        </div>
        <div className="card p-4">
          <div className="grid grid-cols-3 gap-3">
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
      </div>

      {/* Layer 2: Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => navigate('/scan')}
          className="col-span-2 bg-gradient-to-br from-primary to-[#EA580C] rounded-2xl p-4 flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform"
        >
          <Camera className="w-6 h-6 text-white" />
          <span className="text-white font-bold text-base">拍照识猫</span>
        </button>
        <div className="space-y-2">
          <button
            onClick={() => navigate('/community')}
            className="card p-3 flex flex-col items-center gap-1 w-full active:scale-95 transition-transform"
          >
            <MessageSquare className="w-5 h-5 text-blue-500" />
            <span className="text-xs font-medium text-text">社区</span>
          </button>
          <button
            onClick={() => navigate('/map')}
            className="card p-3 flex flex-col items-center gap-1 w-full active:scale-95 transition-transform"
          >
            <MapPin className="w-5 h-5 text-green-500" />
            <span className="text-xs font-medium text-text">地图</span>
          </button>
        </div>
      </div>

      {/* Layer 3: Cat horizontal scroll */}
      {cats.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-text">校园猫猫</h2>
            <span className="text-xs text-text-secondary">{cats.length} 只</span>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-none -mx-4 px-4 pb-2">
            {cats.map((cat) => (
              <button
                key={cat.id}
                onClick={() => navigate(`/cats/${cat.id}`)}
                className="flex-shrink-0 w-24 text-center space-y-1.5"
              >
                <div className="w-24 h-24 rounded-2xl bg-primary-light overflow-hidden mx-auto shadow-sm">
                  <ImageWithShimmer
                    src={cat.avatar}
                    alt={cat.name}
                    className="w-full h-full"
                  />
                </div>
                <p className="text-xs font-medium text-text truncate">{cat.name}</p>
                {cat.location && (
                  <p className="text-[10px] text-text-secondary truncate">{cat.location}</p>
                )}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
