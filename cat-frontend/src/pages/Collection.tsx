import { useEffect, useState, useMemo, useRef } from 'react'
import { useLiveData } from '../hooks/useLiveData'
import { useNavigate } from 'react-router-dom'
import { Cat, Star, Search, Trophy, X, RefreshCw } from 'lucide-react'
import ImageWithShimmer from '../components/ImageWithShimmer'
import { getCats, getFollowedCats, getEncounteredCatIds } from '../api'

type Filter = 'all' | 'met' | 'unmet' | 'rare' | 'followed'
type Resource = 'cats' | 'followed' | 'encounters'
const RESOURCES: Resource[] = ['cats', 'followed', 'encounters']
const RESOURCE_LABELS: Record<Resource, string> = { cats: '猫猫档案', followed: '关注状态', encounters: '相遇记录' }
const RARE_CHARS = ['稀', '珍', '白', '黑', '三花', '玳瑁']
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' }, { key: 'met', label: '已相遇' },
  { key: 'unmet', label: '未相遇' }, { key: 'rare', label: '趣味稀有' }, { key: 'followed', label: '已关注' },
]
const MILESTONES = [
  { count: 5, label: '初遇', emoji: '🌱' }, { count: 10, label: '熟识', emoji: '🌿' },
  { count: 20, label: '猫友', emoji: '🐾' }, { count: 30, label: '猫达人', emoji: '🏅' },
  { count: 50, label: '猫博士', emoji: '🎓' },
]

function isRareCat(cat, metIds) {
  const sightingsForCat = cat.sightings_count
  if (sightingsForCat !== undefined && sightingsForCat < 3) return true
  if (metIds.has(cat.id) && (sightingsForCat === undefined || sightingsForCat < 5)) return true
  const name = cat.name || ''
  return RARE_CHARS.some(character => name.includes(character))
}

function StatusPill({ status }: { status: 'followed' | 'met' | 'unmet' | 'unknown' }) {
  const labels = { followed: '已关注', met: '已相遇', unmet: '未相遇', unknown: '相遇待确认' }
  return <span className={`rounded-full px-2 py-1 text-sm font-medium ${status === 'followed' || status === 'met' ? 'bg-primary-light text-primary' : 'bg-surface-1 text-text-secondary'}`}>{labels[status]}</span>
}

function asList(value: unknown): any[] {
  if (!Array.isArray(value)) throw new Error('列表暂时无法读取')
  return value
}

export default function Collection() {
  const { revision } = useLiveData()
  const [cats, setCats] = useState<any[] | null>(null)
  const [followed, setFollowed] = useState<any[] | null>(null)
  const [encounters, setEncounters] = useState<number[] | null>(null)
  const [loading, setLoading] = useState(new Set<Resource>(RESOURCES))
  const [failed, setFailed] = useState<Resource[]>([])
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const searchInput = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    setLoading(new Set(RESOURCES))
    setFailed([])
    const requests: [Resource, () => Promise<any[]>, (value: any[]) => void][] = [
      ['cats', () => getCats().then(asList), setCats],
      ['followed', () => getFollowedCats().then(asList), setFollowed],
      ['encounters', () => getEncounteredCatIds().then(asList), setEncounters],
    ]
    requests.forEach(([resource, request, save]) => {
      Promise.resolve().then(request)
        .then(value => { if (!cancelled) save(value) })
        .catch(() => { if (!cancelled) setFailed(previous => [...previous, resource]) })
        .finally(() => {
          if (!cancelled) setLoading(previous => { const next = new Set(previous); next.delete(resource); return next })
        })
    })
    return () => { cancelled = true }
  }, [revision, attempt])

  const followedIds = useMemo(() => new Set((followed || []).map(item => item.cat_id)), [followed])
  const metIds = useMemo(() => new Set(encounters || []), [encounters])
  const metCount = cats !== null && encounters !== null ? cats.filter(cat => metIds.has(cat.id)).length : null
  const total = cats?.length ?? null
  const nextMilestone = metCount !== null ? MILESTONES.find(item => item.count > metCount) : null
  const currentMilestone = metCount !== null ? [...MILESTONES].reverse().find(item => item.count <= metCount) : null
  const filteredCats = useMemo(() => {
    let result = cats || []
    const query = search.trim().toLowerCase()
    if (query) result = result.filter(cat => [cat.name, cat.location, cat.color].some(value => (value || '').toLowerCase().includes(query)))
    if (filter === 'met') result = result.filter(cat => metIds.has(cat.id))
    else if (filter === 'unmet') result = result.filter(cat => !metIds.has(cat.id))
    else if (filter === 'rare') result = result.filter(cat => isRareCat(cat, metIds))
    else if (filter === 'followed') result = result.filter(cat => followedIds.has(cat.id))
    return result
  }, [cats, search, filter, metIds, followedIds])

  function resetFilters() {
    setSearch('')
    setFilter('all')
    searchInput.current?.focus()
  }

  const filtered = search.length > 0 || filter !== 'all'
  const known = { cats: cats !== null, followed: followed !== null, encounters: encounters !== null }
  const unavailablePersonal = encounters === null || followed === null
  const filterUnavailable = (key: Filter) => key === 'followed' ? followed === null : ['met', 'unmet', 'rare'].includes(key) && encounters === null

  return (
    <div className="min-w-0 space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="ui-title">猫猫图鉴</h1>
            <p className="mt-1 text-sm text-text-secondary">认一认校园里的老朋友，也发现新面孔。</p>
          </div>
          {currentMilestone && <span className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary"><Trophy className="h-4 w-4" aria-hidden="true" />{currentMilestone.emoji} {currentMilestone.label}</span>}
        </div>
        {metCount !== null && total !== null ? <div className="space-y-2">
          <p className="text-sm text-text-secondary">当前图鉴已相遇 <strong className="text-text">{metCount}</strong> / {total} 只{nextMilestone && <span className="ml-2">· 再相遇 {nextMilestone.count - metCount} 只，点亮「{nextMilestone.label}」</span>}</p>
          {total > 0 && <div role="progressbar" aria-label="当前图鉴相遇进度" aria-valuemin={0} aria-valuemax={total} aria-valuenow={metCount} className="h-2 max-w-md overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-primary" style={{ width: `${metCount / total * 100}%` }} /></div>}
        </div> : <p className="text-sm text-text-secondary">{loading.has('encounters') || loading.has('cats') ? '正在读取相遇进度…' : '相遇进度暂时无法读取。'}</p>}
      </header>

      {failed.length > 0 && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 p-3 text-sm text-text-secondary">
        <div className="space-y-1">{failed.map(resource => <p key={resource}>{RESOURCE_LABELS[resource]}暂时无法{known[resource] ? '更新，保留上次读取的内容。' : '加载。'}</p>)}</div>
        <button type="button" className="btn btn-ghost min-h-11 shrink-0 gap-1.5" onClick={() => setAttempt(value => value + 1)} aria-label="重试加载图鉴数据"><RefreshCw className="h-4 w-4" aria-hidden="true" />重试加载</button>
      </div>}

      <div className="space-y-3">
        <div className="relative">
          <label htmlFor="collection-search" className="sr-only">搜索猫名、位置或颜色</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" />
          <input id="collection-search" ref={searchInput} type="text" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索猫名、位置、颜色…" autoComplete="off" className="ui-input pl-10 pr-12" />
          {search && <button type="button" onClick={() => { setSearch(''); searchInput.current?.focus() }} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-xl text-text-secondary" aria-label="清除搜索"><X className="h-4 w-4" aria-hidden="true" /></button>}
        </div>
        <div role="group" aria-label="图鉴筛选" className="flex flex-wrap gap-2">
          {FILTERS.map(item => <button key={item.key} type="button" aria-pressed={filter === item.key} disabled={filterUnavailable(item.key)} aria-describedby={filterUnavailable(item.key) ? 'collection-personal-status' : undefined} onClick={() => setFilter(item.key)} className={`min-h-11 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${filter === item.key ? 'bg-primary text-on-primary' : 'bg-surface-2 text-text-secondary hover:bg-surface-3'}`}>{item.label}</button>)}
        </div>
        {unavailablePersonal && <p id="collection-personal-status" className="text-sm leading-5 text-text-secondary">相遇或关注状态尚未读取，对应筛选暂不可用；仍可浏览猫猫档案。</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" aria-live="polite" className="text-sm text-text-secondary">{cats === null ? loading.has('cats') ? '正在加载猫猫档案…' : '猫猫档案尚未加载' : `显示 ${filteredCats.length} / ${total} 只${loading.has('cats') ? ' · 正在更新' : ''}`}</p>
          {filtered && <button type="button" onClick={resetFilters} className="min-h-11 px-2 text-sm font-medium text-primary">重置筛选</button>}
        </div>
      </div>

      {cats === null && loading.has('cats') && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(item => <div key={item} className="aspect-[3/4] rounded-xl bg-surface-2 skeleton" />)}</div>}
      {cats !== null && cats.length === 0 && <div className="rounded-xl bg-surface-2 px-5 py-8 text-center">
        <Cat className="mx-auto mb-3 h-8 w-8 text-text-secondary" aria-hidden="true" />
        <h2 className="font-semibold text-text">还没有校园猫猫</h2><p className="mt-2 text-sm text-text-secondary">等猫协录入档案后，就能在这里认识它们。</p>
      </div>}
      {filteredCats.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {filteredCats.map(cat => {
          const status = followedIds.has(cat.id) ? 'followed' : encounters === null ? 'unknown' : metIds.has(cat.id) ? 'met' : 'unmet'
          const rare = encounters !== null && isRareCat(cat, metIds)
          return <button key={cat.id} type="button" onClick={() => navigate(`/cats/${cat.id}`)} aria-label={`查看${cat.name}的档案`} className="min-w-0 overflow-hidden rounded-xl bg-surface-1 text-left ring-1 ring-border transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary">
            <div className="relative aspect-square bg-surface-2">
              <ImageWithShimmer src={cat.avatar} alt={cat.name} loading="lazy" sizes="(min-width: 1024px) 260px, (min-width: 640px) 230px, 50vw" className="h-full w-full" compact />
              {rare && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-surface-1 px-2 py-1 text-sm font-medium text-text"><Star className="h-3 w-3 text-primary" aria-hidden="true" />趣味稀有</span>}
              <div className="absolute bottom-2 right-2"><StatusPill status={status} /></div>
            </div>
            <div className="p-3"><p className="truncate text-base font-semibold text-text">{cat.name}</p><p className="mt-1 truncate text-sm text-text-secondary">{cat.location || '地点待补充'}</p></div>
          </button>
        })}
      </div>}
      {cats !== null && cats.length > 0 && filteredCats.length === 0 && <div className="rounded-xl bg-surface-2 px-5 py-8 text-center">
        <h2 className="font-semibold text-text">没有找到匹配的猫猫</h2>
        <p className="mt-2 text-sm text-text-secondary">试试其他名字、位置或颜色，或清除筛选看看全部档案。</p>
        <button type="button" onClick={resetFilters} className="btn btn-primary mt-4 min-h-11">查看全部猫猫</button>
      </div>}
      <details className="text-sm text-text-secondary">
        <summary className="ui-disclosure">“趣味稀有”如何标记</summary>
        <p className="pb-3 text-sm leading-6">沿用图鉴的趣味规则，按偶遇数量、是否已相遇和名字关键词（稀、珍、白、黑、三花、玳瑁）标记。这不是对真实数量、保护等级或识别难度的判断。</p>
      </details>
    </div>
  )
}
