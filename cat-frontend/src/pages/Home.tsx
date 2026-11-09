import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Camera, Cat, ChevronRight, RefreshCw, Route as RouteIcon } from 'lucide-react'
import { getCats, getPostsPage, getSightings, getUserProfile, getWeeklyReport, getMyStats } from '../api'
import ImageWithShimmer from '../components/ImageWithShimmer'
import DailyQuestCard from '../components/DailyQuestCard'
import CatGachaCard from '../components/CatGachaCard'
import StreakBadge from '../components/StreakBadge'
import Avatar from '../components/Avatar'
import MascotCat from '../components/MascotCat'
import { getPrefs } from '../components/Onboarding'
import { useLiveData } from '../hooks/useLiveData'

type Section = 'cats' | 'sightings' | 'posts' | 'profile' | 'weekly' | 'stats'
const SECTIONS: Section[] = ['cats', 'sightings', 'posts', 'profile', 'weekly', 'stats']
const LABELS: Record<Section, string> = { cats: '猫猫档案', sightings: '最近偶遇', posts: '社区动态', profile: '个人资料', weekly: '本周记录', stats: '连续打卡' }

function greeting() {
  const hour = new Date().getHours()
  return hour < 6 ? '夜深了' : hour < 12 ? '上午好' : hour < 18 ? '下午好' : '晚上好'
}

function list(value: unknown): any[] {
  if (!Array.isArray(value)) throw new Error('列表暂时无法读取')
  return value
}

export default function Home() {
  const { revision, event } = useLiveData()
  const [data, setData] = useState<Record<Section, any>>({ cats: null, sightings: null, posts: null, profile: null, weekly: null, stats: null })
  const [loading, setLoading] = useState(new Set<Section>(SECTIONS))
  const [failed, setFailed] = useState<Section[]>([])
  const [attempt, setAttempt] = useState(0)
  const [extrasOpen, setExtrasOpen] = useState(false)
  const [liveSighting, setLiveSighting] = useState<any>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    setLoading(new Set(SECTIONS))
    setFailed([])
    const requests: [Section, () => Promise<any>][] = [
      ['cats', () => getCats().then(list)],
      ['sightings', () => getSightings({ limit: 5 }).then(list)],
      ['posts', () => getPostsPage({ limit: 3 }).then(page => list(page.items))],
      ['profile', getUserProfile], ['weekly', getWeeklyReport], ['stats', getMyStats],
    ]
    requests.forEach(([section, request]) => {
      Promise.resolve().then(request)
        .then(value => { if (!cancelled) setData(previous => ({ ...previous, [section]: value })) })
        .catch(() => { if (!cancelled) setFailed(previous => [...previous, section]) })
        .finally(() => {
          if (!cancelled) setLoading(previous => { const next = new Set(previous); next.delete(section); return next })
        })
    })
    return () => { cancelled = true }
  }, [revision, attempt])

  useEffect(() => {
    if (event?.type !== 'sighting_confirmed') {
      setLiveSighting(null)
      return undefined
    }
    setLiveSighting(event.data)
    const timer = setTimeout(() => setLiveSighting(null), 4000)
    return () => clearTimeout(timer)
  }, [event])

  function feedback(section: Section) {
    if (failed.includes(section)) return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-3 text-sm text-text-secondary">
        <span>{LABELS[section]}暂时无法{data[section] === null ? '加载' : '更新'}。{data[section] !== null && '下方保留上次读取的内容。'}</span>
        <button type="button" onClick={() => setAttempt(value => value + 1)} className="btn btn-ghost min-h-11 shrink-0 gap-1.5" aria-label={`重试加载${LABELS[section]}`}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />重试
        </button>
      </div>
    )
    if (loading.has(section)) return <p role="status" className="text-sm text-text-secondary">{data[section] === null ? '正在加载' : '正在更新'}{LABELS[section]}…</p>
    return null
  }

  const cats: any[] = data.cats || []
  const prefs = getPrefs()
  const prefColors = prefs?.colors || []
  const prefLocations = prefs?.locations || []
  const hasPreferences = prefColors.length > 0 || prefLocations.length > 0
  const recommended = hasPreferences ? cats.filter(cat => {
    const text = [cat.name, cat.color, cat.description, cat.location].filter(Boolean).join(' ')
    return (!prefColors.length || prefColors.some(color => text.includes(color)))
      && (!prefLocations.length || prefLocations.some(location => text.includes(location)))
  }) : cats
  const displayCats = (recommended.length ? recommended : cats).slice(0, 6)
  const personalized = hasPreferences && recommended.length > 0
  const sightings: any[] = data.sightings || []
  const posts: any[] = data.posts || []
  const knownStreak = Number.isFinite(data.stats?.streak)
  const knownWeekly = Number.isFinite(data.weekly?.total_sightings) && Number.isFinite(data.weekly?.unique_cats)

  return (
    <div className="min-w-0 space-y-7">
      <header className="home-welcome rounded-2xl bg-primary-light p-4 sm:p-5">
        <div className="home-welcome-copy min-w-0">
          <p className="text-sm text-text-secondary">{greeting()}{data.profile?.nickname ? `，${data.profile.nickname}` : ''}</p>
          <h1 className="ui-title mt-2">在校园，遇见猫猫</h1>
          <p className="mt-1 text-sm leading-6 text-text-secondary">拍照认一认，或先看看它们的故事。</p>
        </div>
        <div className="home-welcome-mascot" aria-hidden="true"><MascotCat size={128} /></div>
        <button type="button" onClick={() => navigate('/scan')} className="home-welcome-action btn btn-primary min-h-11 shrink-0 gap-2 justify-self-start">
          <Camera className="h-5 w-5" aria-hidden="true" />拍照识猫
        </button>
      </header>
      {failed.includes('profile') && feedback('profile')}
      {liveSighting && <p role="status" className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-text-secondary">
        新的偶遇已确认：{liveSighting.cat_name || '校园猫猫'}{liveSighting.location ? ` · ${liveSighting.location}` : ''}
      </p>}

      <section aria-labelledby="home-cats-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="home-cats-title" className="ui-section-title">{personalized ? '你可能想认识' : '校园猫猫'}</h2>
          <button type="button" onClick={() => navigate('/collection')} className="btn btn-ghost min-h-11 gap-1" aria-label="打开完整猫猫图鉴">打开图鉴<ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
        </div>
        {feedback('cats')}
        {data.cats === null && loading.has('cats') && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map(item => <div key={item} className="aspect-[4/3] rounded-xl bg-surface-2 skeleton" />)}
        </div>}
        {data.cats !== null && cats.length === 0 && <p className="rounded-xl bg-surface-2 p-5 text-sm leading-6 text-text-secondary">还没有校园猫猫档案，等猫协录入后就能在这里认识它们。</p>}
        {displayCats.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {displayCats.map((cat, index) => <button key={cat.id} type="button" onClick={() => navigate(`/cats/${cat.id}`)} aria-label={`查看${cat.name}的档案`} className="group min-w-0 overflow-hidden rounded-xl bg-surface-1 text-left ring-1 ring-border transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary">
            <div className="aspect-[4/3] overflow-hidden bg-surface-2">
              <ImageWithShimmer src={cat.avatar} alt={cat.name} loading={index < 3 ? 'eager' : 'lazy'} sizes="(min-width: 1024px) 260px, (min-width: 640px) 230px, 50vw" className="h-full w-full" compact />
            </div>
            <div className="px-3 py-3">
              <p className="truncate text-base font-semibold text-text">{cat.name}</p>
              <p className="mt-1 truncate text-sm text-text-secondary">{cat.location || '地点待补充'}</p>
            </div>
          </button>)}
        </div>}
      </section>

      <nav aria-label="校园探索" className="flex flex-wrap gap-2">
        <button type="button" onClick={() => navigate('/map')} className="btn btn-ghost min-h-11 gap-2"><MapPin className="h-4 w-4" aria-hidden="true" />查看猫猫地图</button>
        <button type="button" onClick={() => navigate('/routes')} className="btn btn-ghost min-h-11 gap-2"><RouteIcon className="h-4 w-4" aria-hidden="true" />寻猫路线</button>
      </nav>

      <div className="grid gap-7 md:grid-cols-2">
        <section aria-labelledby="home-sightings-title" className="min-w-0 space-y-3">
          <h2 id="home-sightings-title" className="ui-section-title">最近的校园偶遇</h2>
          {feedback('sightings')}
          {data.sightings !== null && sightings.length === 0 && <p className="text-sm leading-6 text-text-secondary">还没有公开的偶遇记录，新的记录通过审核后会出现在这里。</p>}
          <div className="divide-y divide-border">
            {sightings.slice(0, 3).map(sighting => <button key={sighting.id} type="button" disabled={!sighting.cat_id} onClick={() => navigate(`/cats/${sighting.cat_id}`)} className="flex min-h-16 w-full items-center gap-3 py-3 text-left">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                {sighting.image_path || sighting.cat?.avatar || sighting.cat_avatar ? <ImageWithShimmer src={sighting.image_path || sighting.cat?.avatar || sighting.cat_avatar} alt={sighting.cat_name || sighting.cat?.name || '偶遇照片'} width={160} sizes="48px" className="h-full w-full" compact /> : <Cat className="m-3 h-6 w-6 text-text-secondary" aria-hidden="true" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">{sighting.cat_name || sighting.cat?.name || '校园猫猫'}</p>
                <p className="mt-1 truncate text-sm text-text-secondary">{sighting.location_name || sighting.location || '地点待补充'}</p>
              </div>
              {sighting.created_at && <time dateTime={sighting.created_at} className="shrink-0 text-sm text-text-secondary">{sighting.created_at.substring(5, 10)}</time>}
            </button>)}
          </div>
        </section>
        <section aria-labelledby="home-posts-title" className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="home-posts-title" className="ui-section-title">社区新动态</h2>
            <button type="button" onClick={() => navigate('/community')} className="min-h-11 px-2 text-sm font-medium text-primary">去社区<ChevronRight className="ml-1 inline h-4 w-4" aria-hidden="true" /></button>
          </div>
          {feedback('posts')}
          {data.posts !== null && posts.length === 0 && <p className="text-sm leading-6 text-text-secondary">这里还没有动态，去社区分享一张猫照吧。</p>}
          <div className="divide-y divide-border">
            {posts.slice(0, 3).map(post => <button key={post.id} type="button" onClick={() => navigate(`/posts/${post.id}`)} className="flex min-h-16 w-full items-start gap-3 py-3 text-left">
              <Avatar user={post.user} size="xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">{post.user?.nickname || '猫友'}</p>
                <p className="mt-1 line-clamp-2 break-words text-sm leading-5 text-text-secondary">{post.content}</p>
              </div>
            </button>)}
          </div>
        </section>
      </div>

      <details className="rounded-xl border border-border bg-surface-1" onToggle={event => setExtrasOpen(event.currentTarget.open)}>
        <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-text">今日任务与猫缘签<span className="ml-2 font-normal text-text-secondary">闲暇时来看看</span></summary>
        {extrasOpen && <div className="space-y-4 border-t border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-secondary">
            {knownStreak && <div className="flex items-center gap-2">连续打卡<StreakBadge streak={data.stats.streak} /></div>}
            <button type="button" onClick={() => navigate('/weekly-report')} className="min-h-11 text-left font-medium text-primary">{knownWeekly ? `本周 ${data.weekly.total_sightings} 次偶遇 · ${data.weekly.unique_cats} 只猫` : '查看本周记录'}<ChevronRight className="ml-1 inline h-4 w-4" aria-hidden="true" /></button>
          </div>
          {feedback('stats')}{feedback('weekly')}
          <DailyQuestCard />
          <CatGachaCard onViewCat={catId => navigate(`/cats/${catId}`)} />
        </div>}
      </details>
    </div>
  )
}
