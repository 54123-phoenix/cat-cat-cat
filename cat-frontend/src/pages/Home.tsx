import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, MessageSquare, Camera, PawPrint, Cat, ChevronRight, Zap, Navigation } from 'lucide-react'
import { getCats, getPosts, getSightings, getUserProfile, getWeeklyReport, getMyStats, getToken } from '../api'
import ImageWithShimmer from '../components/ImageWithShimmer'
import DailyQuestCard from '../components/DailyQuestCard'
import StreakBadge from '../components/StreakBadge'
import Avatar from '../components/Avatar'
import { getPrefs } from '../components/Onboarding'

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
  const [latestPosts, setLatestPosts] = useState([])
  const [profile, setProfile] = useState(null)
  const [, setLoading] = useState(true)
  const [weeklyReport, setWeeklyReport] = useState(null)
  const [myStats, setMyStats] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      getCats(),
      getSightings({ limit: 5 }),
      getPosts({ limit: 3 }),
      getUserProfile().catch(() => null),
      getWeeklyReport().catch(() => null),
      getMyStats().catch(() => null),
    ]).then(([catsData, sightingsData, postsData, userData, reportData, statsData]) => {
      const arr = Array.isArray(catsData) ? catsData : []
      setCats(arr)
      setSightings(Array.isArray(sightingsData) ? sightingsData : [])
      const postsArr = Array.isArray(postsData) ? postsData : (postsData?.items || [])
      setPostCount(postsArr.length)
      setLatestPosts(postsArr.slice(0, 3))
      setProfile(userData)
      setWeeklyReport(reportData)
      setMyStats(statsData)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const [liveSighting, setLiveSighting] = useState(null)
  const esRef = useRef(null)

  useEffect(() => {
    const token = getToken()
    if (!token) return undefined
    try {
      const es = new EventSource(`${import.meta.env.VITE_API_URL || ''}/api/events/sightings?token=${token}`)
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          setLiveSighting(data)
          setTimeout(() => setLiveSighting(null), 4000)
        } catch {}
      }
      es.onerror = () => es.close()
      esRef.current = es
    } catch {}
    return () => { esRef.current?.close() }
  }, [])

  const streakDays = myStats?.streak || 0
  const streakWeek = Array.from({ length: 7 }, (_, i) => i < Math.min(streakDays, 7))
  const dayLabels = ['一', '二', '三', '四', '五', '六', '日']

  const { grad: greetingGrad, dark: greetingDark } = greetingGradient()
  const greetingText = greetingDark ? 'text-white' : 'text-text'
  const greetingSubText = greetingDark ? 'text-white/70' : 'text-text-secondary'

  const prefs = getPrefs()
  const prefColors = prefs?.colors || []
  const prefLocations = prefs?.locations || []
  const recommendedCats = prefColors.length || prefLocations.length
    ? cats.filter((c) => {
        const text = (c.name || '') + (c.color || '') + (c.description || '') + (c.location || '')
        const colorMatch = prefColors.length === 0 || prefColors.some((col) => text.includes(col))
        const locMatch = prefLocations.length === 0 || prefLocations.some((loc) => text.includes(loc) || (c.location || '').includes(loc))
        return colorMatch && locMatch
      })
    : cats
  const displayCats = recommendedCats.length > 0 ? recommendedCats : cats

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
              {myStats && (
                <div className="mt-1">
                  <StreakBadge streak={myStats.streak || 0} />
                </div>
              )}
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

      {liveSighting && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 animate-pop-in">
          <Zap className="w-4 h-4 text-green-500 shrink-0" />
          <span className="text-xs text-green-700 truncate">
            刚刚有人偶遇了 <strong>{liveSighting.cat_name || '一只猫猫'}</strong>
            {liveSighting.location ? ` @ ${liveSighting.location}` : ''}
          </span>
        </div>
      )}

      {streakDays > 0 && (
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text">连续打卡</span>
            <span className="text-xs text-primary font-bold">{streakDays} 天</span>
          </div>
          <div className="flex gap-1.5">
            {streakWeek.map((active, i) => (
              <div key={i} className="flex-1 text-center">
                <div className={`w-full h-2 rounded-full ${active ? 'bg-primary' : 'bg-gray-100'}`} />
                <span className="text-[9px] text-text-muted mt-1 block">{dayLabels[i]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

        <div className="card p-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-primary-light rounded-xl p-3 text-center">
              <p className="text-display-xl text-primary">{cats.length}</p>
              <p className="text-caption text-text-muted">认识猫猫</p>
            </div>
            <div className="bg-mint-light rounded-xl p-3 text-center">
              <p className="text-display-xl text-mint">{sightings.length}</p>
              <p className="text-caption text-text-muted">最新偶遇</p>
            </div>
            <div className="bg-info/10 rounded-xl p-3 text-center">
              <p className="text-display-xl text-info">{postCount}</p>
              <p className="text-caption text-text-muted">社区帖子</p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily quest */}
      <DailyQuestCard />

      {/* Layer 2: Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => navigate('/scan')}
          className="col-span-2 bg-gradient-to-br from-primary to-[#EA580C] rounded-2xl p-4 flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform btn-sweep"
        >
          <Camera className="w-6 h-6 text-white" />
          <span className="text-white font-bold text-base">拍照识猫</span>
        </button>
        <div className="space-y-2">
          <button
            onClick={() => navigate('/community')}
            className="card p-3 flex flex-col items-center gap-1 w-full active:scale-95 transition-transform"
          >
            <MessageSquare className="w-5 h-5 text-info" />
            <span className="text-xs font-medium text-text">社区</span>
          </button>
          <button
            onClick={() => navigate('/map')}
            className="card p-3 flex flex-col items-center gap-1 w-full active:scale-95 transition-transform"
          >
            <MapPin className="w-5 h-5 text-mint" />
            <span className="text-xs font-medium text-text">地图</span>
          </button>
        </div>
      </div>

      {/* Layer 3: Cat horizontal scroll */}
      {displayCats.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-text">{prefColors.length || prefLocations.length ? '为你推荐' : '校园猫猫'}</h2>
            <span className="text-xs text-text-secondary">{displayCats.length} 只</span>
          </div>
          <div className="flex gap-4 overflow-x-auto scrollbar-none -mx-4 px-4 pb-2">
            {displayCats.map((cat, idx) => (
              <button
                key={cat.id}
                onClick={() => navigate(`/cats/${cat.id}`)}
                className={`flex-shrink-0 w-24 text-center space-y-2 animate-pop-in stagger-${(idx % 6) + 1}`}
              >
                <div className="w-24 h-24 rounded-2xl bg-primary-light overflow-hidden mx-auto shadow-sm">
                  <ImageWithShimmer
                    src={cat.avatar}
                    alt={cat.name}
                    loading="lazy"
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

      {/* Map preview */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-text">猫猫地图</h2>
          <button onClick={() => navigate('/map')} className="text-xs text-primary flex items-center gap-0.5" aria-label="查看完整地图">
            查看地图<ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={() => navigate('/map')}
          className="w-full rounded-2xl overflow-hidden card p-0 relative h-32 bg-primary-light"
          aria-label="打开猫猫地图"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-primary/30" />
            <span className="text-sm text-text-secondary ml-2">点击查看校园猫咪分布</span>
          </div>
        </button>
      </section>

      {/* Nearby cats */}
      {sightings.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-text flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-mint" /> 附近猫猫
            </h2>
            <button onClick={() => navigate('/map')} className="text-xs text-primary flex items-center gap-0.5">
              地图<ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {sightings.slice(0, 3).map((s) => (
              <button
                key={s.id}
                onClick={() => s.cat_id && navigate(`/cats/${s.cat_id}`)}
                className="w-full card p-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
              >
                <div className="w-10 h-10 rounded-xl bg-mint-light flex items-center justify-center shrink-0">
                  <Cat className="w-5 h-5 text-mint/50" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text truncate">{s.cat_name || '未知猫猫'}</p>
                  {s.location && <p className="text-xs text-text-secondary truncate">{s.location}</p>}
                </div>
                <span className="text-[10px] text-text-muted shrink-0">{s.created_at?.substring(5, 10) || ''}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Latest community posts */}
      {latestPosts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-text">最新动态</h2>
            <button onClick={() => navigate('/community')} className="text-xs text-primary flex items-center gap-0.5" aria-label="查看更多动态">
              更多<ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {latestPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => navigate(`/posts/${post.id}`)}
                className="w-full card p-3 flex items-start gap-3 text-left active:scale-[0.98] transition-transform"
              >
                <Avatar user={post.user} size="xs" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text truncate">{post.user?.nickname || '猫友'}</p>
                  <p className="text-xs text-text-secondary truncate mt-0.5">{post.content}</p>
                </div>
                <span className="text-[10px] text-text-muted shrink-0 mt-0.5">
                  {post.created_at?.substring(5, 10) || ''}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
