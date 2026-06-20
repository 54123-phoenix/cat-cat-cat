import { useRef, useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, PawPrint, Cat, Check, Sparkles, HelpCircle } from 'lucide-react'
import MascotCat from '../components/MascotCat'
import PawRain from '../components/PawRain'
import ConfidenceBar from '../components/ConfidenceBar'
import PageHeader from '../components/PageHeader'
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
  const [showPawRain, setShowPawRain] = useState(false)
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
    if (!data.cat_id) return
    const file = selectedFileRef.current
    await createSighting({
      catId: data.cat_id,
      location: getLocationName(),
      confidence: data.confidence,
      activity_type: activity || undefined,
      weather: weather || undefined,
      mood: mood || undefined,
      file,
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
        await saveConfirmedSighting(data)
        setShowPawRain(true)
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
    if (previewRef.current) { URL.revokeObjectURL(previewRef.current); previewRef.current = null }
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
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
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
              <Check className="w-5 h-5 text-green-500" />
              <span className="text-sm text-green-800">识别成功 · 置信度 {Math.round(result.confidence * 100)}%</span>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center">
                  <Cat className="w-7 h-7 text-primary/30" />
                </div>
                <div>
                  <div className="text-base font-medium">{result.cat_name || '校园猫猫'}</div>
                  <div className="text-xs text-green-500 mt-0.5">高置信度匹配</div>
                </div>
              </div>
              <ConfidenceBar value={result.confidence} />
            </div>
            <button onClick={() => navigate(`/cats/${result.cat_id}`)} className="w-full bg-primary text-white rounded-full py-3 font-medium text-sm">
              查看猫猫档案
            </button>
            <button onClick={reset} className="w-full border border-primary text-primary rounded-full py-3 font-medium text-sm">
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
    </div>
  )
}
