import { useRef, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, PawPrint, Cat, Check, Sparkles, HelpCircle, Share2, MapPin, BadgeCheck } from 'lucide-react'
import ShareArtifact from '../components/ShareArtifact'
import MascotCat from '../components/MascotCat'
import PawRain from '../components/PawRain'
import ConfidenceBar from '../components/ConfidenceBar'
import PageHeader from '../components/PageHeader'
import CatIdentityCard from '../components/CatIdentityCard'
import { createDiscovery, createSighting, identifyCat } from '../api'
import { campusLocations, findCampusLocation } from '../campusLocations'
import { ACTIVITY_OPTIONS, WEATHER_OPTIONS, MOOD_OPTIONS } from '../constants/activities'

export default function Scan() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [phase, setPhase] = useState('idle')
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  const [discoveryNote, setDiscoveryNote] = useState('')
  const [discovery, setDiscovery] = useState(null)
  const [savedSighting, setSavedSighting] = useState(null)
  const [showPawRain, setShowPawRain] = useState(false)
  const [showIdentityCard, setShowIdentityCard] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState(campusLocations[0].name)
  const [customLocation, setCustomLocation] = useState('')
  const [activity, setActivity] = useState('')
  const [weather, setWeather] = useState('')
  const [mood, setMood] = useState('')
  const fileRef = useRef(null)
  const selectedFileRef = useRef(null)
  const previewRef = useRef(null)

  useEffect(() => {
    const point = searchParams.get('point')
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    if (point) {
      setCustomLocation(point)
      setSelectedLocation(point)
      const matched = campusLocations.find((l) => l.name === point)
      if (!matched && lat && lng) {
        setMessage(`已预选地点：${point}（${lat}, ${lng}）`)
      }
    }
  }, [searchParams])

  useEffect(() => {
    return () => { if (previewRef.current) { URL.revokeObjectURL(previewRef.current); previewRef.current = null } }
  }, [])

  function onFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    selectedFileRef.current = file
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    const url = URL.createObjectURL(file)
    setPreview(url)
    previewRef.current = url
    setPhase('ready')
    setResult(null)
    setMessage('')
  }

  function getLocationName() {
    return customLocation.trim() || selectedLocation
  }

  async function saveConfirmedSighting(data) {
    if (!data.cat_id) return null
    const file = selectedFileRef.current
    return createSighting({
      catId: data.cat_id,
      location: getLocationName(),
      confidence: data.confidence,
      activity_type: activity || undefined,
      weather: weather || undefined,
      mood: mood || undefined,
      file,
      latitude: undefined,
      longitude: undefined,
    })
  }

  async function handleIdentify() {
    const file = selectedFileRef.current
    if (!file) {
      setMessage('请先选择一张照片')
      return
    }
    setPhase('loading')
    setMessage('正在识别中，请稍候...')
    const timer = window.setTimeout(() => setMessage('网络较慢，AI 还在努力识别...'), 8000)
    try {
      const data = await identifyCat(file)
      window.clearTimeout(timer)
      setResult(data)
      setPhase(data.status || 'confirmed')
      if (data.status === 'confirmed') {
        const created = await saveConfirmedSighting(data)
        setSavedSighting(created)
        setShowPawRain(true)
      } else if (data.status === 'unavailable') {
        setMessage('识别服务暂时不可用，可以稍后重试，或先提交线索给猫协。')
      }
    } catch (error) {
      window.clearTimeout(timer)
      console.error('[Scan] identify failed:', error)
      setMessage(error.message || '识别服务暂时不可用，请稍后重试')
      setPhase('error')
    }
  }

  async function confirmCandidate(candidate) {
    const catId = candidate.cat_id || candidate.catId
    if (!catId) return setMessage('无法确认猫咪身份')
    await saveConfirmedSighting({ ...candidate, cat_id: catId, confidence: candidate.confidence })
    navigate(`/cats/${catId}`)
  }

  async function submitDiscovery() {
    const file = selectedFileRef.current
    const location = findCampusLocation(selectedLocation)
    setMessage('')
    try {
      const created = await createDiscovery({
        locationName: getLocationName(),
        latitude: location?.latitude,
        longitude: location?.longitude,
        note: discoveryNote || '识别为未知猫，等待猫协复核',
        file,
      })
      setDiscovery(created)
    } catch (err) {
      setMessage(err.message || '提交失败，请重试')
    }
  }

  function reset() {
    setPhase('idle')
    setResult(null)
    setDiscovery(null)
    setDiscoveryNote('')
    setMessage('')
    setActivity('')
    setWeather('')
    setMood('')
    selectedFileRef.current = null
    setSavedSighting(null)
    if (previewRef.current) { URL.revokeObjectURL(previewRef.current); previewRef.current = null }
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function confidencePercent(value) {
    return Math.max(0, Math.min(100, Math.round((value || 0) * 100)))
  }

  function optionLabel(options, value) {
    return options.find((option) => option.value === value)?.label
  }

  function confirmedCatName() {
    return result?.cat_name || result?.name || '校园猫猫'
  }

  function confirmedZone() {
    return result?.campus_zone || getLocationName() || '复旦校园'
  }

  function sharePath() {
    if (savedSighting?.id) return `/sightings/share/${savedSighting.id}`
    if (result?.cat_id) return `/cats/public/${result.cat_id}`
    return '/scan'
  }

  function memoryProof() {
    const details = [
      `置信度 ${confidencePercent(result?.confidence)}%`,
      getLocationName(),
      optionLabel(ACTIVITY_OPTIONS, activity),
      optionLabel(WEATHER_OPTIONS, weather),
      optionLabel(MOOD_OPTIONS, mood),
    ].filter(Boolean)
    return details.join(' · ')
  }

  return (
    <div className="pb-6">
      {showPawRain && <PawRain onDone={() => setShowPawRain(false)} />}
      <PageHeader title="拍照识别" subtitle="拍一张照片，认识这只猫" />

      <div className="p-3 space-y-3">
        <label className="block bg-white rounded-xl border border-gray-100 p-3">
          <span className="text-xs font-medium text-gray-500">偶遇地点</span>
          <div className="relative mt-1">
            <input
              type="text"
              list="location-options"
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              onBlur={(e) => {
                if (!e.target.value.trim()) setSelectedLocation(campusLocations[0].name)
                else setSelectedLocation(e.target.value)
              }}
              placeholder="搜索或输入地点..."
              className="w-full bg-primary-light rounded-full px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-primary/30"
            />
            <datalist id="location-options">
              {campusLocations.map((loc) => (
                <option key={loc.name} value={loc.name} />
              ))}
            </datalist>
          </div>
        </label>

        <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-3">
          <div>
            <span className="text-xs font-medium text-gray-500">活动状态</span>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {ACTIVITY_OPTIONS.map((a) => (
                <button
                  key={a.value}
                  onClick={() => setActivity(activity === a.value ? '' : a.value)}
                  className={`flex flex-col items-center py-2 rounded-lg border text-xs transition-colors ${
                    activity === a.value ? 'border-primary bg-primary-light text-primary' : 'border-gray-100 text-gray-500'
                  }`}
                >
                  <span className="text-lg">{a.emoji}</span>
                  <span className="mt-0.5">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-medium text-gray-500">天气</span>
              <div className="flex gap-1.5 mt-2">
                {WEATHER_OPTIONS.map((w) => (
                  <button
                    key={w.value}
                    onClick={() => setWeather(weather === w.value ? '' : w.value)}
                    className={`flex-1 flex flex-col items-center py-1.5 rounded-lg border text-xs transition-colors ${
                      weather === w.value ? 'border-primary bg-primary-light text-primary' : 'border-gray-100 text-gray-500'
                    }`}
                  >
                    <span className="text-base">{w.emoji}</span>
                    <span className="mt-0.5">{w.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-gray-500">心情</span>
              <div className="flex gap-1.5 mt-2">
                {MOOD_OPTIONS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMood(mood === m.value ? '' : m.value)}
                    className={`flex-1 flex flex-col items-center py-1.5 rounded-lg border text-xs transition-colors ${
                      mood === m.value ? 'border-primary bg-primary-light text-primary' : 'border-gray-100 text-gray-500'
                    }`}
                  >
                    <span className="text-base">{m.emoji}</span>
                    <span className="mt-0.5">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {phase === 'idle' ? (
          <label className="block border-2 border-dashed border-primary rounded-xl p-8 text-center cursor-pointer bg-primary-light active:bg-orange-100">
            <Camera className="w-10 h-10 text-primary mx-auto mb-2" />
            <div className="text-primary font-medium">拍照或上传图片</div>
            <div className="text-xs text-gray-400 mt-1">支持 JPG、PNG 格式</div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
        </label>
        ) : preview ? (
          <div className="relative rounded-xl overflow-hidden aspect-square bg-gray-100">
            <img src={preview} alt="预览" className="w-full h-full object-cover" />
            {phase === 'ready' && (
              <button onClick={reset} className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">
                ×
              </button>
            )}
          </div>
        ) : null}

        {phase === 'ready' && (
          <button onClick={handleIdentify} className="w-full bg-primary text-white rounded-full py-3.5 font-medium text-base active:opacity-90 flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors">
            <Sparkles className="w-4 h-4" />开始识别
          </button>
        )}

        {phase === 'loading' && (
          <>
            <div className="w-full bg-primary/80 text-white rounded-full py-3.5 font-medium text-base flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              AI 正在识别中…
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <PawPrint className="w-6 h-6 text-primary mx-auto animate-paw mb-2" />
              <div className="text-xs text-gray-500">{message || '通常不超过 10 秒'}</div>
            </div>
          </>
        )}

        {phase === 'confirmed' && result && (
          <div className="space-y-3">
            <section className="overflow-hidden rounded-2xl bg-white shadow-e3">
              <div className="relative min-h-[180px] bg-gradient-to-br from-orange-50 via-white to-amber-50">
                {preview ? (
                  <img src={preview} alt={`${confirmedCatName()} 的识别照片`} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary-light">
                    <Cat className="h-16 w-16 text-primary/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/72 via-stone-950/18 to-transparent" />
                <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-green-700 shadow-e1">
                    <Check className="h-3.5 w-3.5" />
                    已记入偶遇
                  </span>
                  <span className="rounded-full bg-stone-950/55 px-3 py-1.5 text-xs font-semibold text-white">
                    {confidencePercent(result.confidence)}%
                  </span>
                </div>
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <p className="text-xs font-medium text-white/78">这次遇见的是</p>
                  <h2 className="mt-1 text-3xl font-bold leading-tight">{confirmedCatName()}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/88">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/18 px-2.5 py-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {confirmedZone()}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/18 px-2.5 py-1">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {result.collector_status || '校园观察员'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-text-secondary">识别可信度</span>
                    <span className="font-semibold text-primary">高置信度匹配</span>
                  </div>
                  <ConfidenceBar value={result.confidence} />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-surface-2 px-3 py-2">
                    <p className="text-[11px] text-text-muted">地点</p>
                    <p className="mt-1 truncate text-xs font-semibold text-text">{getLocationName()}</p>
                  </div>
                  <div className="rounded-xl bg-surface-2 px-3 py-2">
                    <p className="text-[11px] text-text-muted">状态</p>
                    <p className="mt-1 truncate text-xs font-semibold text-text">{optionLabel(ACTIVITY_OPTIONS, activity) || '已记录'}</p>
                  </div>
                  <div className="rounded-xl bg-surface-2 px-3 py-2">
                    <p className="text-[11px] text-text-muted">下一步</p>
                    <p className="mt-1 truncate text-xs font-semibold text-text">分享记忆卡</p>
                  </div>
                </div>

                {(result.personality_tags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {result.personality_tags?.slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded-full bg-primary-light px-2.5 py-1 text-xs font-medium text-primary">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <ShareArtifact
                  title={`我在复旦遇见了 ${confirmedCatName()}`}
                  subtitle={confirmedZone()}
                  image={preview || undefined}
                  proof={memoryProof()}
                  sharePath={sharePath()}
                  badge="📸"
                  slogan="这次偶遇已存入猫猫档案"
                >
                  <button className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-primary-glow transition-colors hover:bg-primary-hover active:scale-[0.98]">
                    <Share2 className="h-4 w-4" />
                    生成偶遇纪念卡
                  </button>
                </ShareArtifact>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShowIdentityCard(true)} className="rounded-full border border-primary/40 bg-white px-4 py-3 text-sm font-semibold text-primary">
                    查看猫猫身份证
                  </button>
                  <button onClick={() => navigate(`/cats/${result.cat_id}`)} className="rounded-full border border-border bg-white px-4 py-3 text-sm font-semibold text-text-secondary">
                    打开完整档案
                  </button>
                </div>
                {savedSighting?.id && (
                  <button onClick={() => navigate(`/sightings/share/${savedSighting.id}`)} className="w-full rounded-full border border-border bg-surface-2 px-4 py-3 text-sm font-semibold text-text-secondary">
                    查看公开偶遇页
                  </button>
                )}
              </div>
            </section>

            <button onClick={reset} className="w-full rounded-full border border-primary text-primary py-3 font-medium text-sm">
              重新识别
            </button>
          </div>
        )}

        {phase === 'uncertain' && result && (
          <div className="space-y-2">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-yellow-600" />
              <div className="text-sm text-yellow-800">找到几个相似的猫咪，请确认是哪一只</div>
            </div>
            {result.candidates?.map((candidate) => (
              <button key={candidate.cat_id} onClick={() => confirmCandidate(candidate)} className="w-full bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 active:bg-gray-50 cursor-pointer text-left">
                <div className="w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center">
                  <Cat className="w-6 h-6 text-primary/30" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{candidate.cat_name}</div>
                  <ConfidenceBar value={candidate.confidence} />
                </div>
              </button>
            ))}
            <button onClick={reset} className="w-full border border-gray-200 text-gray-500 rounded-full py-3 text-sm">
              都不对，重新拍
            </button>
          </div>
        )}

        {phase === 'unknown' && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary-light flex items-center justify-center">
              <PawPrint className="w-6 h-6 text-primary/40" />
            </div>
            <div className="font-medium text-gray-800">发现新朋友！</div>
            <div className="text-xs text-gray-400 mt-1 mb-4">AI 初步判断它可能还没入库，提交后将由猫协复核</div>
            {discovery ? (
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-left mb-3">
                <p className="text-sm font-medium text-green-700">线索已提交，等待猫协审核</p>
                <p className="text-xs text-green-600 mt-1">{discovery.ai_summary}</p>
              </div>
            ) : (
              <>
                <textarea
                  value={discoveryNote}
                  onChange={(event) => setDiscoveryNote(event.target.value)}
                  placeholder="补充描述：毛色、状态、你在哪里看到它..."
                  className="w-full h-24 text-sm text-gray-700 border border-gray-100 rounded-xl p-3 outline-none resize-none mb-3"
                />
                <button onClick={submitDiscovery} className="w-full bg-primary text-white rounded-full py-3 text-sm font-medium">
                  提交给 AI 与猫协审核 →
                </button>
              </>
            )}
            <button onClick={reset} className="w-full mt-2 text-sm text-gray-400">取消</button>
          </div>
        )}

        {phase === 'unavailable' && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-yellow-50 flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-yellow-500" />
            </div>
            <div className="font-medium text-gray-800">识别服务暂时不可用</div>
            <div className="text-xs text-gray-400 mt-1 mb-4">
              {message || 'AI 现在没有返回可靠结果，你可以稍后重试，或先把这次偶遇提交给猫协。'}
            </div>
            {discovery ? (
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-left mb-3">
                <p className="text-sm font-medium text-green-700">线索已提交，等待猫协审核</p>
                <p className="text-xs text-green-600 mt-1">谢谢你先把这次偶遇留住。</p>
              </div>
            ) : (
              <>
                <textarea
                  value={discoveryNote}
                  onChange={(event) => setDiscoveryNote(event.target.value)}
                  placeholder="补充描述：毛色、状态、你在哪里看到它..."
                  className="w-full h-24 text-sm text-gray-700 border border-gray-100 rounded-xl p-3 outline-none resize-none mb-3"
                />
                <button onClick={submitDiscovery} className="w-full bg-primary text-white rounded-full py-3 text-sm font-medium">
                  先提交线索
                </button>
              </>
            )}
            <button onClick={reset} className="w-full mt-2 border border-gray-200 text-gray-500 rounded-full py-3 text-sm">
              重新选择照片
            </button>
          </div>
        )}

        {phase === 'error' && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center text-sm text-red-500">
            {message || '识别失败，请重试'}
          </div>
        )}

        {phase === 'idle' && (
          <>
            {message && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center text-sm text-yellow-700">
                {message}
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-xs text-gray-400 leading-7">
              <div className="flex items-center gap-3 mb-3">
                <MascotCat mood="curious" size={56} className="shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-500">来认识新的猫咪朋友吧</p>
                  <p className="text-xs text-gray-400 mt-0.5">拍一张照片，AI 帮你识别</p>
                </div>
              </div>
            <div>· 尽量拍清晰的正面或侧面照片</div>
            <div>· 光线充足识别效果更佳</div>
            <div>· 识别不确定时会展示多个候选</div>
          </div>
          </>
        )}
      </div>

      {showIdentityCard && phase === 'confirmed' && result?.cat_id && (
        <CatIdentityCard
          cat={{
            id: result.cat_id,
            name: result.cat_name || '校园猫猫',
            personality: result.personality_tags?.join('、'),
            location: result.campus_zone,
            avatar: undefined,
            images: [],
            health_records: [],
            created_at: '',
          }}
          personalityTags={result.personality_tags}
          campusZone={result.campus_zone}
          collectorStatus={result.collector_status}
          onClose={() => setShowIdentityCard(false)}
        />
      )}
    </div>
  )
}
