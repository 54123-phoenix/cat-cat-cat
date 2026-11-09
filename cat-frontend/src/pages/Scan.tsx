import { useRef, useState, useEffect, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, Cat, Check, Sparkles, HelpCircle, Share2, MapPin, ChevronDown } from 'lucide-react'
import ShareArtifact from '../components/ShareArtifact'
import PawRain from '../components/PawRain'
import ConfidenceBar from '../components/ConfidenceBar'
import PageHeader from '../components/PageHeader'
import CatIdentityCard from '../components/CatIdentityCard'
import { createDiscovery, createSighting, identifyCat } from '../api'
import type { RecognizeCandidate, RecognizeResult, Sighting } from '../types'
import { campusLocations, resolveSightingLocation } from '../campusLocations'
import { ACTIVITY_OPTIONS, WEATHER_OPTIONS, MOOD_OPTIONS } from '../constants/activities'

function requestId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export default function Scan() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [phase, setPhase] = useState<RecognizeResult['status'] | 'idle' | 'ready' | 'loading' | 'error'>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<RecognizeResult | null>(null)
  const [message, setMessage] = useState('')
  const [discoveryNote, setDiscoveryNote] = useState('')
  const [discovery, setDiscovery] = useState<{ ai_summary?: string } | null>(null)
  const [savedSighting, setSavedSighting] = useState<Sighting | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [fileError, setFileError] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [showPawRain, setShowPawRain] = useState(false)
  const [showIdentityCard, setShowIdentityCard] = useState(false)
  const [customLocation, setCustomLocation] = useState('')
  const [activity, setActivity] = useState('')
  const [weather, setWeather] = useState('')
  const [mood, setMood] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const uploadButtonRef = useRef<HTMLButtonElement | null>(null)
  const identifyButtonRef = useRef<HTMLButtonElement | null>(null)
  const resultHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const receiptRef = useRef<HTMLDivElement | null>(null)
  const saveErrorRef = useRef<HTMLDivElement | null>(null)
  const focusUploadRef = useRef(false)
  const selectedFileRef = useRef<File | null>(null)
  const previewRef = useRef<string | null>(null)
  const identifyingRef = useRef(false)
  const savingRef = useRef(false)
  const savedRef = useRef(false)
  const requestRef = useRef<{ signature: string; file: File; id: string } | null>(null)
  const draftLocked = saving || Boolean(savedSighting) || Boolean(discovery)

  useEffect(() => {
    const point = searchParams.get('point')
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    if (point) {
      setCustomLocation(point)
      const matched = campusLocations.find((l) => l.name === point)
      if (!matched && lat && lng) {
        setMessage(`已预选地点：${point}（${lat}, ${lng}）`)
      }
    }
  }, [searchParams])

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
      previewRef.current = null
    }
  }, [])

  useEffect(() => {
    if (savedSighting || discovery) receiptRef.current?.focus()
    else if (phase === 'ready') identifyButtonRef.current?.focus()
    else if (!['idle', 'loading'].includes(phase)) resultHeadingRef.current?.focus()
    else if (phase === 'idle' && focusUploadRef.current) {
      uploadButtonRef.current?.focus()
      focusUploadRef.current = false
    }
  }, [phase, savedSighting, discovery])

  useEffect(() => {
    if (saveError) saveErrorRef.current?.focus()
  }, [saveError])

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setFileError('请选择 10 MB 以内的 JPG、PNG 或 WebP 照片。')
      return
    }
    setFileError('')
    selectedFileRef.current = file
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    const url = URL.createObjectURL(file)
    setPreview(url)
    previewRef.current = url
    setPhase('ready')
    setResult(null)
    setMessage('')
    setSaveError('')
    requestRef.current = null
  }

  function getLocationName() {
    return customLocation.trim()
  }

  async function saveConfirmedSighting(data: RecognizeResult | RecognizeCandidate) {
    if (savingRef.current || savedRef.current) return
    if (!data.cat_id) return setSaveError('无法确认猫咪身份，请重新识别')
    const file = selectedFileRef.current
    if (!file) return setSaveError('照片已失效，请重新选择照片')
    const point = resolveSightingLocation(getLocationName(), searchParams)
    const fields = {
      catId: data.cat_id,
      location: getLocationName(),
      confidence: data.confidence,
      activity_type: activity || undefined,
      weather: weather || undefined,
      mood: mood || undefined,
      latitude: point?.latitude,
      longitude: point?.longitude,
    }
    const signature = JSON.stringify(fields)
    if (requestRef.current?.signature !== signature || requestRef.current.file !== file) {
      requestRef.current = { signature, file, id: requestId() }
    }
    savingRef.current = true
    setSaving(true)
    setSaveError('')
    try {
      const created = await createSighting({ ...fields, file, client_request_id: requestRef.current.id })
      savedRef.current = true
      setSavedSighting(created)
      setResult({ ...data, status: 'confirmed' })
      setPhase('confirmed')
      setShowPawRain(true)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '偶遇提交失败，请重试')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  async function handleIdentify() {
    if (identifyingRef.current || savingRef.current || savedRef.current || discovery) return
    const file = selectedFileRef.current
    if (!file) {
      setMessage('请先选择一张照片')
      return
    }
    identifyingRef.current = true
    setPhase('loading')
    setSaveError('')
    setMessage('正在识别中，请稍候...')
    const timer = window.setTimeout(() => setMessage('网络较慢，AI 还在努力识别...'), 8000)
    try {
      const data = await identifyCat(file)
      if (!['confirmed', 'uncertain', 'unknown', 'unavailable'].includes(data.status)) {
        throw new Error('识别结果格式异常，请重试')
      }
      setResult(data)
      setPhase(data.status)
      setMessage('')
      if (data.status === 'unavailable') setMessage('识别服务暂时不可用，可以稍后重试，或先提交线索给猫协。')
    } catch (error) {
      console.error('[Scan] identify failed:', error)
      setMessage(error instanceof Error ? error.message : '识别服务暂时不可用，请稍后重试')
      setPhase('error')
    } finally {
      window.clearTimeout(timer)
      identifyingRef.current = false
    }
  }

  async function submitDiscovery() {
    if (savingRef.current || discovery) return
    const file = selectedFileRef.current
    const point = resolveSightingLocation(getLocationName(), searchParams)
    savingRef.current = true
    setSaving(true)
    setSaveError('')
    try {
      const created = await createDiscovery({
        locationName: getLocationName(), latitude: point?.latitude, longitude: point?.longitude,
        note: discoveryNote || (phase === 'unavailable' ? '识别暂不可用，等待猫协复核' : '识别为未知猫，等待猫协复核'),
        file,
      })
      setDiscovery(created)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '提交失败，请重试')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  function reset() {
    if (savingRef.current || identifyingRef.current) return
    focusUploadRef.current = true
    setPhase('idle')
    setResult(null)
    setDiscovery(null)
    setDiscoveryNote('')
    setMessage('')
    setSaveError('')
    setFileError('')
    setDetailsOpen(false)
    setActivity('')
    setWeather('')
    setMood('')
    selectedFileRef.current = null
    setSavedSighting(null)
    savedRef.current = false
    requestRef.current = null
    setShowIdentityCard(false)
    setShowPawRain(false)
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = null
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function confidencePercent(value?: number) {
    return Math.max(0, Math.min(100, Math.round((value || 0) * 100)))
  }

  function optionLabel(options: { value: string; label: string }[], value: string) {
    return options.find(option => option.value === value)?.label
  }

  function confirmedCatName() {
    return result?.cat_name || result?.name || '校园猫猫'
  }

  function confirmedZone() {
    return result?.campus_zone || getLocationName() || '复旦校园'
  }

  function sharePath() {
    return result?.cat_id ? `/cats/public/${result.cat_id}` : '/scan'
  }

  function memoryProof() {
    return [
      `匹配相似度 ${confidencePercent(result?.confidence)}%（非正确概率）`, getLocationName(),
      optionLabel(ACTIVITY_OPTIONS, activity), optionLabel(WEATHER_OPTIONS, weather), optionLabel(MOOD_OPTIONS, mood),
    ].filter(Boolean).join(' · ')
  }

  const hasResult = !['idle', 'ready', 'loading'].includes(phase)
  const hasReceipt = Boolean(savedSighting || discovery)
  const location = resolveSightingLocation(getLocationName(), searchParams)
  const currentStep = phase === 'idle' ? 0 : ['ready', 'loading', 'error'].includes(phase) ? 1 : 2
  const selectedDetails = [optionLabel(ACTIVITY_OPTIONS, activity), optionLabel(WEATHER_OPTIONS, weather), optionLabel(MOOD_OPTIONS, mood)].filter(Boolean)
  const resultTitles = {
    confirmed: '请核对猫咪身份', uncertain: '选择你遇到的猫咪', unknown: '暂未匹配到猫咪',
    unavailable: '识别服务暂时不可用', error: '这次识别没有完成',
  }
  const announcement = saving ? '正在提交，请稍候。'
    : phase === 'loading' ? message
    : phase === 'ready' ? '照片已选择，可以开始识别。'
    : savedSighting ? '偶遇已提交，等待猫协审核。'
    : discovery ? '线索已提交，等待猫协审核。'
    : phase === 'confirmed' ? `识别完成，建议匹配${confirmedCatName()}。请核对后提交。`
    : phase === 'uncertain' ? '识别完成，请从候选猫咪中核对身份。'
    : phase === 'unknown' ? '暂未匹配到猫咪，可以提交线索给猫协复核。'
    : phase === 'unavailable' ? '识别暂不可用，可以重试或提交线索。' : ''

  return (
    <div className="pb-6 text-text">
      {showPawRain && <PawRain onDone={() => setShowPawRain(false)} />}
      <PageHeader title="拍照识别" subtitle="先认识它，再留下一次偶遇" />
      <p aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</p>

      <div className="mx-auto max-w-2xl space-y-5 px-4 py-5">
        <ol aria-label="识猫步骤" className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-5 text-sm text-text-secondary">
          {['选照片', '识别', '核对并提交'].map((label, index) => (
            <li key={label} aria-current={currentStep === index ? 'step' : undefined} className={`inline-flex items-center gap-2 ${currentStep === index ? 'font-semibold text-primary' : ''}`}>
              <span aria-hidden="true" className={`flex h-6 w-6 items-center justify-center rounded-full ${currentStep === index ? 'bg-primary-light' : 'bg-surface-3'}`}>
                {hasReceipt || currentStep > index ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>

        <section aria-label="猫咪照片" className="space-y-3">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="拍照或上传图片" className="hidden" onChange={onFileChange} />
          {phase === 'idle' ? (
            <button ref={uploadButtonRef} type="button" onClick={() => fileRef.current?.click()} className="flex min-h-52 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary bg-primary-light px-5 py-8 text-center text-text transition-colors hover:bg-surface-2">
              <Camera aria-hidden="true" className="h-9 w-9 text-primary" />
              <span className="text-base font-semibold">拍照或上传图片</span>
              <span className="text-sm text-text-secondary">选一张能看清猫咪面部和花纹的照片</span>
              <span className="text-sm text-text-secondary">JPG、PNG、WebP，最大 10 MB</span>
            </button>
          ) : preview ? (
            <figure className="overflow-hidden rounded-2xl border border-border bg-surface-2">
              <img src={preview} alt="预览" className={`w-full object-contain ${hasResult ? 'h-52 sm:h-64' : 'h-64 sm:h-80'}`} />
              <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-1 px-3 py-2">
                <span className="text-sm text-text-secondary">{hasReceipt ? '本次提交的照片' : '用于识别和提交偶遇的照片'}</span>
                <button type="button" onClick={reset} disabled={saving || phase === 'loading'} className="btn btn-ghost min-h-11 px-4 text-sm">
                  {hasReceipt ? '记录下一次偶遇' : '重新选择照片'}
                </button>
              </figcaption>
            </figure>
          ) : null}
          {fileError && <p role="alert" className="rounded-xl border border-danger bg-surface-1 px-4 py-3 text-sm text-danger">{fileError}</p>}
          {phase === 'idle' && (
            <div className="space-y-2 text-sm leading-6 text-text-secondary">
              <p>尽量靠近、光线充足，一张照片中只保留一只猫。</p>
              <p>识别不会自动保存；核对结果后，再由你决定是否提交。</p>
              {customLocation && <p className="flex items-start gap-2 break-words"><MapPin aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />已带入地点：{customLocation}</p>}
            </div>
          )}
        </section>

        {phase === 'ready' && (
          <div className="space-y-2">
            <button ref={identifyButtonRef} type="button" onClick={handleIdentify} className="btn btn-primary min-h-11 w-full gap-2">
              <Sparkles aria-hidden="true" className="h-4 w-4" />开始识别
            </button>
            <p className="text-center text-sm leading-5 text-text-secondary">识别完成后，可核对身份并补充偶遇信息。</p>
          </div>
        )}

        {phase === 'loading' && (
          <div aria-busy="true" className="flex items-start gap-3 rounded-xl border border-border bg-surface-1 p-4">
            <span aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none" />
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">AI 正在识别中…</p>
              <p className="text-sm leading-6 text-text-secondary">{message}</p>
            </div>
          </div>
        )}

        {hasResult && (
          <section aria-labelledby="scan-result-heading" className="space-y-3">
            <h2 id="scan-result-heading" ref={resultHeadingRef} tabIndex={-1} className="scroll-mt-24 rounded-md text-lg font-semibold leading-7">{resultTitles[phase]}</h2>
            {phase === 'confirmed' && result && (
              <div className="space-y-3 rounded-2xl border border-border bg-surface-1 p-4">
                <p className="text-sm font-medium text-text-secondary">{savedSighting ? '已提交，待审核' : '识别结果，尚未提交'}</p>
                <div className="flex min-w-0 flex-col items-start gap-3 min-[480px]:flex-row min-[480px]:justify-between">
                  <p className="min-w-0 break-words text-2xl font-bold leading-8">{confirmedCatName()}</p>
                  <button type="button" disabled={saving} onClick={() => navigate(`/cats/${result.cat_id}`)} className="btn btn-ghost min-h-11 shrink-0 px-3 text-sm">打开完整档案</button>
                </div>
                <ConfidenceBar value={result.confidence} />
                <p className="text-sm leading-6 text-text-secondary">请对照照片与档案，确认是同一只猫后再提交。</p>
              </div>
            )}
            {phase === 'uncertain' && (
              <p className="text-sm leading-6 text-text-secondary">有几只猫与照片相似。请先查看档案再选择；匹配相似度不代表识别正确的概率。</p>
            )}
            {phase === 'unknown' && (
              <p className="text-sm leading-6 text-text-secondary">它可能尚未入库，也可能是照片角度或光线影响了识别。可以补充线索，由猫协复核。</p>
            )}
            {phase === 'unavailable' && (
              <p className="text-sm leading-6 text-text-secondary">{message || '你可以重试识别，或保留照片与地点，先提交线索给猫协。'}</p>
            )}
            {phase === 'error' && (
              <div className="space-y-3">
                <p role="alert" className="break-words rounded-xl border border-danger bg-surface-1 px-4 py-3 text-sm leading-6 text-danger">{message || '识别失败，请重试'}</p>
                <button type="button" onClick={handleIdentify} className="btn btn-primary min-h-11 w-full">重试识别</button>
              </div>
            )}
          </section>
        )}

        {preview && phase !== 'loading' && (
          <fieldset disabled={draftLocked} className="space-y-4">
            <legend className="sr-only">偶遇信息</legend>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="sighting-location" className="text-sm font-semibold">偶遇地点</label>
                <span className="text-sm text-text-secondary">选填</span>
              </div>
              <input id="sighting-location" type="text" list="location-options" value={customLocation} maxLength={100} onChange={event => setCustomLocation(event.target.value)} placeholder="搜索点位，或填写你看到它的地方" aria-describedby="sighting-location-help sighting-location-count" className="ui-input" />
              <datalist id="location-options">{campusLocations.map(point => <option key={point.name} value={point.name} />)}</datalist>
              <div className="flex items-start justify-between gap-3 text-sm leading-5 text-text-secondary">
                <p id="sighting-location-help">{location ? '已关联点位坐标，审核通过后可在地图显示。' : '可以只保存文字地点；没有坐标的记录暂不显示在地图上。'}</p>
                <span id="sighting-location-count" className="shrink-0 tabular-nums">{customLocation.length}/100</span>
              </div>
            </div>

            {['ready', 'confirmed', 'uncertain'].includes(phase) && (
              <div className="rounded-xl border border-border bg-surface-1">
                <button type="button" aria-expanded={detailsOpen} aria-controls="sighting-extra-fields" onClick={() => setDetailsOpen(open => !open)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left disabled:cursor-not-allowed">
                  <span className="min-w-0 space-y-1">
                    <span className="block text-sm font-semibold">补充偶遇信息（选填）</span>
                    <span className="block break-words text-sm leading-5 text-text-secondary">{selectedDetails.length ? selectedDetails.join(' · ') : '活动状态、天气和心情'}</span>
                  </span>
                  <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-text-secondary transition-transform motion-reduce:transition-none ${detailsOpen ? 'rotate-180' : ''}`} />
                </button>
                <div id="sighting-extra-fields" hidden={!detailsOpen} className="space-y-4 border-t border-border p-4">
                  {[
                    { label: '活动状态', options: ACTIVITY_OPTIONS, value: activity, setValue: setActivity },
                    { label: '天气', options: WEATHER_OPTIONS, value: weather, setValue: setWeather },
                    { label: '心情', options: MOOD_OPTIONS, value: mood, setValue: setMood },
                  ].map(group => (
                    <fieldset key={group.label} className="space-y-2">
                      <legend className="mb-2 text-sm font-semibold text-text-secondary">{group.label}</legend>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {group.options.map(option => (
                          <button key={option.value} type="button" aria-pressed={group.value === option.value} onClick={() => group.setValue(group.value === option.value ? '' : option.value)} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm disabled:cursor-not-allowed ${group.value === option.value ? 'border-primary bg-primary-light font-semibold text-primary' : 'border-border bg-surface-1 text-text-secondary hover:bg-surface-2'}`}>
                            <span aria-hidden="true">{option.emoji}</span>{option.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </div>
            )}
            {hasReceipt && <p className="text-sm leading-5 text-text-secondary">以上是本次已提交的信息，不能重复提交；继续记录请另选一张照片。</p>}
          </fieldset>
        )}

        {saveError && (
          <div ref={saveErrorRef} tabIndex={-1} role="alert" className="scroll-mt-24 space-y-1 break-words rounded-xl border border-danger bg-surface-1 px-4 py-3 text-sm leading-6 text-danger">
            <p className="font-semibold">提交失败：{saveError}</p>
            <p>照片和填写内容已保留，请重试提交。</p>
          </div>
        )}

        {phase === 'confirmed' && result && (
          <div className="space-y-3">
            {savedSighting ? (
              <>
                <div ref={receiptRef} tabIndex={-1} role="status" className="scroll-mt-24 space-y-2 rounded-xl border border-success bg-surface-1 p-4">
                  <p className="flex items-start gap-2 text-sm font-semibold"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />偶遇已提交，等待猫协审核</p>
                  <p className="text-sm leading-6 text-text-secondary">审核通过后才会公开并进入地图。这次偶遇无需重复提交。</p>
                </div>
                <ShareArtifact title={`我在复旦遇见了 ${confirmedCatName()}`} subtitle={confirmedZone()} image={preview || undefined} proof={memoryProof()} sharePath={sharePath()} linkLabel="扫码查看猫咪档案" badge="📸" slogan="偶遇待审核 · 链接为猫咪档案">
                  <button type="button" className="btn btn-primary min-h-11 w-full gap-2"><Share2 aria-hidden="true" className="h-4 w-4" />生成个人纪念卡</button>
                </ShareArtifact>
              </>
            ) : (
              <div className="space-y-2">
                <button type="button" onClick={() => saveConfirmedSighting(result)} disabled={saving} className="btn btn-primary min-h-11 w-full">{saving ? '正在提交偶遇…' : '确认并提交偶遇'}</button>
                <p className="text-center text-sm leading-5 text-text-secondary">提交后进入猫协审核，不会立即公开。</p>
              </div>
            )}
            <button type="button" disabled={saving} onClick={() => setShowIdentityCard(true)} className="btn btn-ghost min-h-11 w-full">查看猫猫身份证</button>
          </div>
        )}

        {phase === 'uncertain' && result && (
          <div className="space-y-3">
            {result.candidates?.map(candidate => (
              <section key={candidate.cat_id} aria-label={`${candidate.cat_name} 候选`} className="space-y-4 rounded-xl border border-border bg-surface-1 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2">
                    {candidate.cat_avatar ? <img src={candidate.cat_avatar} alt={`${candidate.cat_name} 的参考照片`} className="h-full w-full object-cover" /> : <Cat aria-hidden="true" className="h-7 w-7 text-text-secondary" />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <h3 className="break-words text-base font-semibold leading-6">{candidate.cat_name}</h3>
                    <ConfidenceBar value={candidate.confidence} showExplanation={false} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                  <button type="button" disabled={saving} onClick={() => navigate(`/cats/${candidate.cat_id}`)} className="btn btn-ghost min-h-11 min-w-0 whitespace-normal break-words px-3 text-sm">查看{candidate.cat_name}档案</button>
                  <button type="button" disabled={saving} onClick={() => saveConfirmedSighting(candidate)} aria-label={`确认是${candidate.cat_name}并提交偶遇`} className="btn btn-primary min-h-11 px-3 text-sm">{saving ? '正在提交偶遇…' : '确认并提交偶遇'}</button>
                </div>
              </section>
            ))}
            <p className="text-center text-sm leading-5 text-text-secondary">都不相符时，请用上方的“重新选择照片”再试一次。</p>
          </div>
        )}

        {(phase === 'unknown' || phase === 'unavailable') && (
          <div className="space-y-3">
            {discovery ? (
              <div ref={receiptRef} tabIndex={-1} role="status" className="scroll-mt-24 space-y-2 rounded-xl border border-success bg-surface-1 p-4">
                <p className="text-sm font-semibold">线索已提交，等待猫协审核</p>
                <p className="break-words text-sm leading-6 text-text-secondary">{discovery.ai_summary || '猫协会根据照片和描述核对身份，提交不代表已建立新档案。'}</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label htmlFor="discovery-note" className="block text-sm font-semibold">补充线索（选填）</label>
                  <textarea id="discovery-note" disabled={saving} value={discoveryNote} maxLength={500} onChange={event => setDiscoveryNote(event.target.value)} placeholder="例如：左耳缺角，正在图书馆草坪休息" aria-describedby="discovery-note-help discovery-note-count" className="ui-input min-h-28 resize-y" />
                  <div className="flex items-start justify-between gap-3 text-sm leading-5 text-text-secondary">
                    <p id="discovery-note-help">描述毛色、明显特征或当时状态，帮助猫协复核。</p>
                    <span id="discovery-note-count" className="shrink-0 tabular-nums">{discoveryNote.length}/500</span>
                  </div>
                </div>
                <button type="button" disabled={saving} onClick={submitDiscovery} className="btn btn-primary min-h-11 w-full">{saving ? '正在提交线索…' : phase === 'unavailable' ? '先提交线索' : '提交给 AI 与猫协审核 →'}</button>
                {phase === 'unavailable' && <button type="button" disabled={saving} onClick={handleIdentify} className="btn btn-ghost min-h-11 w-full">重试识别</button>}
                <p className="flex items-start gap-2 text-sm leading-5 text-text-secondary"><HelpCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />提交线索后由猫协复核，暂不公开。</p>
              </>
            )}
          </div>
        )}
      </div>

      {showIdentityCard && phase === 'confirmed' && result?.cat_id && (
        <CatIdentityCard
          cat={{ id: result.cat_id, name: result.cat_name || '校园猫猫', personality: result.personality_tags?.join('、'), location: result.campus_zone, avatar: result.cat_avatar, images: [], health_records: [], created_at: '' }}
          personalityTags={result.personality_tags} campusZone={result.campus_zone} collectorStatus={result.collector_status}
          onClose={() => setShowIdentityCard(false)}
        />
      )}
    </div>
  )
}
