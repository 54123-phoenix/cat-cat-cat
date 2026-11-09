import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveData } from '../hooks/useLiveData'
import { useParams, useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import PhotoViewer from '../components/PhotoViewer'
import ImageWithShimmer from '../components/ImageWithShimmer'
import { Cat, Heart, PawPrint, Syringe, Scissors, Bandage, Stethoscope, MapPin, Camera, Share2, RefreshCw } from 'lucide-react'
import SharePoster from '../components/SharePoster'
import CatIdentityCard from '../components/CatIdentityCard'
import CatDeskToken from '../components/CatDeskToken'
import ContributionTitles from '../components/ContributionTitles'
import { getCat, getSightings, getHealthRecords, followCat, unfollowCat, checkFollow } from '../api'
import type { Cat as CatRecord, HealthRecord, Sighting } from '../types'

type DetailRecord = Omit<CatRecord, 'relationships_list'> & {
  relationships_list?: { cat_id?: number; cat_name?: string; relation?: string; type?: string }[]
}

function dateValue(value?: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatTime(value?: string) {
  return dateValue(value)?.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || '时间待补充'
}

function formatDate(value?: string) {
  return dateValue(value)?.toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' }) || '日期待补充'
}

function asList<T>(value: unknown): T[] {
  if (!Array.isArray(value)) throw new Error('列表暂时无法读取')
  return value
}

async function loadCat(id: string): Promise<DetailRecord> {
  const value = await getCat(id)
  if (!value || typeof value.name !== 'string') throw new Error('档案暂时无法读取')
  return value
}
const loadSightings = (id: string) => getSightings({ cat_id: id, limit: 100 }).then(asList<Sighting>)
const loadHealth = (id: string) => getHealthRecords(id).then(asList<HealthRecord>)
async function loadFollow(id: string): Promise<boolean> {
  const value = await checkFollow(id)
  if (typeof value?.following !== 'boolean') throw new Error('关注状态暂时无法读取')
  return value.following
}

function useDetailResource<T>(catId: string, revision: number, load: (id: string) => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const sequence = useRef(0)

  useEffect(() => {
    let active = true
    const request = ++sequence.current
    setLoading(true)
    setFailed(false)
    Promise.resolve().then(() => load(catId))
      .then(value => { if (active && request === sequence.current) setData(value) })
      .catch(() => { if (active && request === sequence.current) setFailed(true) })
      .finally(() => { if (active && request === sequence.current) setLoading(false) })
    return () => { active = false }
  }, [catId, revision, attempt, load])

  const replace = useCallback((value: T) => {
    sequence.current++
    setData(value)
    setFailed(false)
    setLoading(false)
  }, [])

  return { data, loading, failed, retry: () => setAttempt(value => value + 1), replace }
}

function ResourceFeedback({ label, resource }: {
  label: string
  resource: { data: unknown; loading: boolean; failed: boolean; retry: () => void }
}) {
  if (resource.failed) return <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-3 ui-meta text-text-secondary">
    <p className="min-w-0 [overflow-wrap:anywhere]">{label}暂时无法{resource.data === null ? '加载。' : '更新，保留上次读取的内容。'}</p>
    <button type="button" onClick={resource.retry} className="btn btn-ghost min-h-11 shrink-0 gap-1.5" aria-label={`重试加载${label}`}><RefreshCw className="h-4 w-4" aria-hidden="true" />重试</button>
  </div>
  if (resource.loading) return <p role="status" className="ui-meta text-text-secondary">正在{resource.data === null ? '加载' : '更新'}{label}…</p>
  return null
}

const RADAR_DIMS = ['亲人', '活跃', '胆小', '贪吃', '独立']
function PersonalityRadar({ values }: { values: number[] }) {
  if (values.length !== 5 || !values.every(Number.isFinite)) return <p className="ui-meta text-text-secondary">性格雷达资料待完善。</p>
  const point = (index: number, radius: number) => {
    const angle = Math.PI * 2 * index / 5 - Math.PI / 2
    return [120 + radius * Math.cos(angle), 120 + radius * Math.sin(angle)]
  }
  const scores = values.map(value => Math.max(0, Math.min(5, value)))
  return <svg viewBox="0 0 240 240" className="mx-auto h-60 w-60 max-w-full" role="img" aria-label={`性格雷达（满分 5）：${RADAR_DIMS.map((name, index) => `${name} ${scores[index]}`).join('，')}`}>
    {[1, 2, 3, 4, 5].map(level => <polygon key={level} points={RADAR_DIMS.map((_, index) => point(index, level * 15).join(',')).join(' ')} fill="none" stroke="var(--color-border)" />)}
    {RADAR_DIMS.map((_, index) => { const [x, y] = point(index, 75); return <line key={index} x1={120} y1={120} x2={x} y2={y} stroke="var(--color-border)" /> })}
    <polygon points={scores.map((value, index) => point(index, value * 15).join(',')).join(' ')} fill="var(--color-primary-light)" stroke="var(--color-primary)" strokeWidth={2} />
    {RADAR_DIMS.map((name, index) => { const [x, y] = point(index, 100); return <text key={name} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={14} fill="var(--color-text-secondary)">{name}</text> })}
  </svg>
}

function HourlyDistribution({ sightings }: { sightings: Sighting[] }) {
  const hours: number[] = Array(24).fill(0)
  sightings.forEach(sighting => { const date = dateValue(sighting.created_at); if (date) hours[date.getHours()]++ })
  const counted = hours.reduce((sum, count) => sum + count, 0)
  const max = Math.max(1, ...hours)
  if (!counted) return <p className="ui-meta text-text-secondary">这些记录暂无可用时间，暂时无法统计时段分布。</p>
  return <figure className="space-y-3">
    <figcaption className="ui-meta text-text-secondary">按页面显示时间统计已加载的 {counted} 条公开偶遇，归入 0–23 时。{counted < sightings.length && `另有 ${sightings.length - counted} 条因时间缺失未计入。`}这不是最近 24 小时的记录，也不代表未来出现概率。</figcaption>
    <div role="img" aria-label={`已加载偶遇的时段分布，共 ${counted} 条；各小时数量见下方明细。`} className="flex h-24 items-end gap-0.5">
      {hours.map((count, hour) => <div key={hour} className="flex h-full min-w-0 flex-1 items-end border-b border-border" title={`${hour}时：${count}次`}>
        <div className="w-full rounded-t-sm bg-primary" style={{ height: `${count / max * 96}px` }} />
      </div>)}
    </div>
    <div className="flex justify-between ui-meta text-text-secondary" aria-hidden="true"><span>0时</span><span>6时</span><span>12时</span><span>18时</span><span>23时</span></div>
    <details>
      <summary className="ui-disclosure">查看各小时数量</summary>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-2 ui-meta text-text-secondary sm:grid-cols-4">{hours.map((count, hour) => <div key={hour} className="flex flex-wrap gap-x-2"><dt>{hour}时</dt><dd>{count} 次</dd></div>)}</dl>
    </details>
  </figure>
}

const RECORD_TYPE_ICON = { vaccine: Syringe, deworm: Stethoscope, sterilization: Scissors, injury: Bandage, illness: Stethoscope, checkup: Stethoscope }

function SightingList({ sightings }: { sightings: Sighting[] }) {
  return <div className="divide-y divide-border">{sightings.map(sighting => <article key={sighting.id} className="flex gap-3 py-4">
    <PawPrint className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
    <div className="min-w-0 flex-1 space-y-1 ui-meta text-text-secondary [overflow-wrap:anywhere]">
      <p className="font-semibold text-text">{sighting.location_name || sighting.location || '地点待补充'}</p>
      <p>{formatTime(sighting.created_at)}</p>
      {sighting.note && <p className="whitespace-pre-wrap">{sighting.note}</p>}
      {sighting.spotted_by && <p>记录者：{sighting.spotted_by}</p>}
      {Number.isFinite(sighting.confidence) && <p>匹配相似度 {Math.round(sighting.confidence * 100)}%（非正确概率）</p>}
    </div>
  </article>)}</div>
}

function CatDetailContent({ catId }: { catId: string }) {
  const { revision } = useLiveData()
  const navigate = useNavigate()
  const profile = useDetailResource(catId, revision, loadCat)
  const sightings = useDetailResource(catId, revision, loadSightings)
  const health = useDetailResource(catId, revision, loadHealth)
  const follow = useDetailResource(catId, revision, loadFollow)
  const [followLoading, setFollowLoading] = useState(false)
  const [followError, setFollowError] = useState('')
  const [followMessage, setFollowMessage] = useState('')
  const followBusy = useRef(false)
  const followIntent = useRef<boolean | null>(null)
  const mounted = useRef(true)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [showIdentityCard, setShowIdentityCard] = useState(false)
  const [extrasOpen, setExtrasOpen] = useState(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  async function saveFollow(next: boolean, confirmFirst = false) {
    if (followBusy.current) return
    followBusy.current = true
    followIntent.current = next
    setFollowLoading(true)
    setFollowError('')
    setFollowMessage('')
    try {
      let confirmed = false
      if (confirmFirst) {
        const current = await loadFollow(catId)
        if (!mounted.current) return
        follow.replace(current)
        confirmed = current === next
      }
      if (!confirmed) {
        if (next) await followCat(catId)
        else await unfollowCat(catId)
      }
      if (mounted.current) {
        follow.replace(next)
        followIntent.current = null
        setFollowMessage(next ? '已关注这只猫猫。' : '已取消关注。')
      }
    } catch {
      if (mounted.current) setFollowError('无法确认关注结果，请先确认状态再重试。')
    } finally {
      followBusy.current = false
      if (mounted.current) setFollowLoading(false)
    }
  }

  function toggleFollow() {
    if (follow.data !== null && followIntent.current === null) void saveFollow(!follow.data)
  }

  function retryFollow() {
    if (followIntent.current !== null) void saveFollow(followIntent.current, true)
  }

  const cat = profile.data
  if (!cat) return <div className="min-w-0 space-y-4 pb-6">
    <PageHeader title="猫猫档案" />
    {profile.loading ? <>
      <p role="status" className="ui-meta text-text-secondary">正在加载猫猫档案…</p>
      <div className="aspect-[4/3] max-h-80 rounded-xl bg-surface-2 skeleton" aria-hidden="true" />
      <div className="h-6 w-40 rounded bg-surface-2 skeleton" aria-hidden="true" />
    </> : <EmptyState icon={Cat} title="猫猫档案暂时无法加载" description="可以重试，或返回图鉴确认这只猫的档案。" onRetry={profile.retry} />}
  </div>

  const personalityTags = cat.personality?.split(/[，,、]/).map(tag => tag.trim()).filter(Boolean) || []
  const images = Array.isArray(cat.images) ? cat.images : []
  const relationships = Array.isArray(cat.relationships_list) ? cat.relationships_list : []
  const showMemorial = ['去世', '离开', '纪念', '想念', '走了', '不在了'].some(word => cat.story?.includes(word))
    || ['想念', '怀念', '纪念', '永远', '再也', '回不'].some(word => cat.quote?.includes(word))

  return <div className="min-w-0 space-y-6 pb-6">
    <PageHeader title="猫猫档案" compact />
    <ResourceFeedback label="猫猫档案" resource={profile} />
    <section aria-labelledby="cat-detail-name" className="grid gap-5 md:grid-cols-2 md:items-start">
      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
        <ImageWithShimmer src={cat.avatar} alt={`${cat.name}的档案照片`} className="h-full w-full" loading="eager" retryable sizes="(min-width: 768px) 400px, 100vw" />
      </div>
      <div className="min-w-0 space-y-4">
        <div className="space-y-1 [overflow-wrap:anywhere]">
          <h1 id="cat-detail-name" className="ui-title text-text">{cat.name}</h1>
          {cat.nickname && <p className="ui-meta font-medium text-primary">{cat.nickname}</p>}
          <p className="ui-meta text-text-secondary">常出没：{cat.location || '地点待补充'}</p>
        </div>
        {(cat.gender || cat.age_estimate || cat.neutered || cat.color) && <dl className="flex flex-wrap gap-x-6 gap-y-3 ui-meta">
          {[['毛色', cat.color], ['性别', cat.gender], ['年龄', cat.age_estimate], ['绝育', cat.neutered]].filter(([, value]) => value).map(([label, value]) => <div key={label} className="min-w-0 [overflow-wrap:anywhere]"><dt className="text-text-secondary">{label}</dt><dd className="font-medium text-text">{value}</dd></div>)}
        </dl>}
        {personalityTags.length > 0 && <ul className="flex flex-wrap gap-2">{personalityTags.map((tag, index) => <li key={`${tag}-${index}`} className="max-w-full rounded-full bg-surface-2 px-3 py-1 ui-meta text-text-secondary [overflow-wrap:anywhere]">{tag}</li>)}</ul>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => navigate('/scan')} className="btn btn-primary min-h-11 gap-2"><Camera className="h-4 w-4" aria-hidden="true" />记录这次偶遇</button>
          <button type="button" onClick={toggleFollow} disabled={followLoading || follow.data === null || !!followError} aria-pressed={followError ? undefined : follow.data ?? undefined} aria-describedby={followError ? 'cat-follow-error' : undefined} className="btn btn-ghost min-h-11 gap-2 disabled:opacity-60">
            <Heart className={`h-4 w-4 ${follow.data && !followError ? 'fill-primary text-primary' : ''}`} aria-hidden="true" />{followLoading ? '正在保存…' : followError ? '关注结果待确认' : follow.data === null ? '关注状态待确认' : follow.data ? '取消关注' : '关注猫猫'}
          </button>
          <SharePoster type="cat" data={{ name: cat.name, avatar: cat.avatar, personality: cat.personality }}><button type="button" className="btn btn-ghost min-h-11 gap-2"><Share2 className="h-4 w-4" aria-hidden="true" />分享猫卡</button></SharePoster>
        </div>
        <p className="ui-meta text-text-secondary">拍照识别后，补充实际地点并确认提交。</p>
        <ResourceFeedback label="关注状态" resource={follow} />
        {followError && <div id="cat-follow-error" role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-3 ui-meta text-text-secondary"><p>{followError}</p><button type="button" onClick={retryFollow} disabled={followLoading} className="btn btn-ghost min-h-11">确认状态并重试</button></div>}
        <p role="status" aria-live="polite" className={followMessage ? 'ui-meta text-text-secondary' : 'sr-only'}>{followMessage}</p>
      </div>
    </section>

    {(cat.story || cat.quote || cat.aliases_list?.length > 0) && <section aria-labelledby="cat-story-title" className="space-y-3 border-t border-border pt-5">
      <h2 id="cat-story-title" className="ui-section-title text-text">猫猫故事</h2>
      {cat.aliases_list?.length > 0 && <p className="ui-meta text-text-secondary [overflow-wrap:anywhere]">大家也叫它：{cat.aliases_list.join('、')}</p>}
      {cat.story && <p className="ui-body max-w-prose whitespace-pre-wrap text-text-secondary [overflow-wrap:anywhere]">{cat.story}</p>}
      {cat.quote && <blockquote className="ui-body max-w-prose rounded-xl bg-primary-light p-4 text-text-secondary [overflow-wrap:anywhere]">“{cat.quote}”</blockquote>}
    </section>}

    <section aria-labelledby="cat-photos-title" className="space-y-3">
      <h2 id="cat-photos-title" className="ui-section-title text-text">照片墙</h2>
      {images.length > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{images.map((image, index) => <button key={image.id} type="button" onClick={() => setViewerIndex(index)} aria-label={`放大查看${cat.name}的第 ${index + 1} 张照片`} className="aspect-square min-w-0 overflow-hidden rounded-xl bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary">
        <ImageWithShimmer src={image.image_path} alt={`${cat.name}的照片 ${index + 1}`} loading="lazy" compact sizes="(min-width: 1024px) 260px, (min-width: 640px) 230px, 50vw" className="h-full w-full" />
      </button>)}</div> : <p className="rounded-xl bg-surface-2 p-4 ui-meta text-text-secondary">还没有参考照片。遇见它时，可以通过“记录这次偶遇”拍照并提交。</p>}
    </section>

    <section aria-labelledby="cat-sightings-title" className="space-y-3 border-t border-border pt-5">
      <h2 id="cat-sightings-title" className="ui-section-title text-text">最近偶遇</h2>
      <ResourceFeedback label="偶遇记录" resource={sightings} />
      {sightings.data !== null && (sightings.data.length === 0 ? <p className="ui-meta text-text-secondary">还没有公开偶遇记录。新的记录通过审核后会出现在这里。</p> : <>
        <p className="ui-meta text-text-secondary">已加载最近 {sightings.data.length} 条公开记录，最多显示 100 条。</p>
        <SightingList sightings={sightings.data.slice(0, 5)} />
        {sightings.data.length > 5 && <details><summary className="ui-disclosure">查看其余 {sightings.data.length - 5} 条偶遇</summary><SightingList sightings={sightings.data.slice(5)} /></details>}
        <details className="border-t border-border"><summary className="ui-disclosure">已加载偶遇的时段分布</summary><HourlyDistribution sightings={sightings.data} /></details>
      </>)}
    </section>

    <section aria-labelledby="cat-health-title" className="space-y-3 border-t border-border pt-5">
      <h2 id="cat-health-title" className="ui-section-title text-text">健康记录</h2>
      <ResourceFeedback label="健康记录" resource={health} />
      {health.data !== null && (health.data.length === 0 ? <p className="ui-meta text-text-secondary">暂未录入公开健康记录，具体情况可向猫协了解。</p> : <details>
        <summary className="ui-disclosure">查看 {health.data.length} 条健康记录</summary>
        <div className="divide-y divide-border">{health.data.map(record => { const Icon = RECORD_TYPE_ICON[record.record_type] || Stethoscope; return <article key={record.id} className="flex gap-3 py-4">
          <Icon className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 space-y-1 ui-meta text-text-secondary [overflow-wrap:anywhere]"><p className="font-semibold text-text">{record.title}</p><p>{formatDate(record.record_date)}</p>{record.description && <p className="whitespace-pre-wrap">{record.description}</p>}{record.location && <p className="flex items-start gap-1"><MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />{record.location}</p>}</div>
        </article> })}</div>
      </details>)}
    </section>

    {(cat.personality_radar?.length > 0 || relationships.length > 0) && <details className="border-t border-border pt-2">
      <summary className="ui-disclosure">性格与猫猫关系</summary>
      {cat.personality_radar?.length > 0 && <div className="py-3"><h2 className="ui-section-title text-text">性格雷达</h2><PersonalityRadar values={cat.personality_radar} /></div>}
      {relationships.length > 0 && <div className="space-y-2 py-3"><h2 className="ui-section-title text-text">猫猫关系</h2>{relationships.map((relation, index) => <button key={index} type="button" disabled={!relation.cat_id} aria-label={relation.cat_id ? `查看${relation.cat_name || `#${relation.cat_id} 号猫猫`}的档案（${relation.relation || relation.type || '关系待补充'}）` : undefined} onClick={() => navigate(`/cats/${relation.cat_id}`)} className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-3 text-left text-sm leading-6 hover:bg-surface-3 disabled:cursor-default">
        <span className="min-w-0 font-medium text-text [overflow-wrap:anywhere]">{relation.cat_name || (relation.cat_id ? `#${relation.cat_id} 号猫猫` : '关联猫猫待补充')}</span><span className="text-text-secondary [overflow-wrap:anywhere]">{relation.relation || relation.type || '关系待补充'}</span>
      </button>)}</div>}
    </details>}

    <details className="rounded-xl border border-border bg-surface-1" onToggle={event => setExtrasOpen(event.currentTarget.open)}>
      <summary className="ui-disclosure px-4">身份卡与猫猫纪念</summary>
      {extrasOpen && <div className="space-y-4 border-t border-border p-4">
        <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => setShowIdentityCard(true)} className="btn btn-ghost min-h-11">打开猫猫身份卡</button><ContributionTitles variant="badge" className="!text-sm" /></div>
        <div className="flex justify-center"><CatDeskToken name={cat.name} avatar={cat.avatar} color={cat.color || '#FED7AA'} size={100} mood="sit" /></div>
        {showMemorial && <p className="text-center ui-meta text-text-secondary"><span aria-hidden="true">🕯️ </span>纪念与它在校园的相遇</p>}
      </div>}
    </details>

    {viewerIndex !== null && images.length > 0 && <PhotoViewer images={images.map(image => ({ url: image.image_path, alt: cat.name }))} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />}
    {showIdentityCard && <CatIdentityCard cat={cat as CatRecord} personalityTags={personalityTags} sightingCount={sightings.data?.length} sightingCountLabel="已加载偶遇记录" onClose={() => setShowIdentityCard(false)} />}
  </div>
}

export default function CatDetail() {
  const { catId } = useParams()
  return <CatDetailContent key={catId} catId={catId} />
}
