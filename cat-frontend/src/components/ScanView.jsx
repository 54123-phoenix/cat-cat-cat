import { useState, useRef, useEffect } from 'react'
import { Camera } from 'lucide-react'
import CatSpinner from './CatSpinner'

export default function ScanView({ onCapture, onResultClose }) {
  const [phase, setPhase] = useState('idle') // idle | focusing | result
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  function handleFileSelected(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setPhase('focusing')
  }

  useEffect(() => {
    if (phase !== 'focusing') return
    const focusTimer = setTimeout(async () => {
      try {
        const res = await onCapture(file)
        setResult(res)
        setPhase('result')
      } catch (err) {
        setError(err.message || '识别失败')
        setPhase('idle')
      }
    }, 800)
    return () => { clearTimeout(focusTimer); URL.revokeObjectURL(previewUrl) }
  }, [phase, file])

  function handleRetake() {
    setPhase('idle')
    setResult(null)
    setError(null)
    setFile(null)
    setPreviewUrl(null)
  }

  return (
    <div className="flex flex-col items-center space-y-6">
      {phase === 'idle' && (
        <>
          {/* Cat eye viewfinder */}
          <div
            onClick={() => fileRef.current?.click()}
            className="relative w-[220px] h-[280px] cursor-pointer group"
          >
            {/* Outer blur area */}
            <div className="absolute inset-0 rounded-[110px/140px] bg-primary-light/30 backdrop-blur-[2px]" />
            {/* Eye shape mask */}
            <div
              className="absolute inset-0 rounded-[110px/140px] overflow-hidden border-2 border-primary/40 group-hover:border-primary/60 transition-colors"
              style={{ clipPath: 'ellipse(45% 48% at 50% 50%)' }}
            >
              <div className="w-full h-full bg-gradient-to-b from-primary/5 to-primary/10 flex items-center justify-center">
                <Camera className="w-12 h-12 text-primary/60 group-hover:text-primary/80 transition-colors" />
              </div>
            </div>
            {/* Pupil */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-10">
              <div className="w-full h-full rounded-full bg-primary/20 animate-breathe flex items-center justify-center">
                <div className="w-3 h-5 rounded-full bg-primary/40 animate-pupil-scan" />
              </div>
            </div>
            {/* Scan rings */}
            <svg className="absolute inset-0 w-full h-full animate-scan-ring" viewBox="0 0 220 280">
              <ellipse cx="110" cy="140" rx="90" ry="115" fill="none" stroke="#F9731666" strokeWidth="1" strokeDasharray="4 4" />
            </svg>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelected} />
          </div>
          <p className="text-text-secondary text-sm text-center">点击取景框拍照识别校园猫咪</p>
        </>
      )}

      {phase === 'focusing' && (
        <div className="flex flex-col items-center space-y-5">
          {/* Eye shape with scanning effect */}
          <div className="relative w-[220px] h-[280px]">
            <div
              className="absolute inset-0 rounded-[110px/140px] overflow-hidden"
              style={{ clipPath: 'ellipse(45% 48% at 50% 50%)' }}
            >
              {previewUrl && (
                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
              )}
              {/* Scanning overlay */}
              <div className="absolute inset-0 bg-black/10">
                <div className="absolute left-0 right-0 h-1 bg-primary/60 animate-pulse" style={{ top: '50%' }} />
                <div className="absolute left-0 right-0 h-0.5 bg-primary/30" style={{ top: '30%' }} />
                <div className="absolute left-0 right-0 h-0.5 bg-primary/30" style={{ top: '70%' }} />
              </div>
            </div>
            {/* Pupil animation */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-12 transition-all duration-700">
              <div className="w-full h-full rounded-full bg-primary/30 flex items-center justify-center">
                <div className="w-2 h-8 rounded-full bg-primary/60 animate-pupil-scan" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CatSpinner size={24} />
            <span className="text-text-secondary text-sm font-medium">猫猫正在识别中…</span>
          </div>
        </div>
      )}

      {phase === 'result' && result && (
        <ResultView result={result} onRetake={handleRetake} onClose={onResultClose} />
      )}

      {error && (
        <div className="text-center space-y-3">
          <p className="text-red-500 text-sm">{error}</p>
          <button onClick={handleRetake} className="btn btn-ghost">重新拍照</button>
        </div>
      )}
    </div>
  )
}

function ResultView({ result, onRetake, onClose }) {
  const status = result.status || 'unknown'
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShowDetails(true), 400)
    return () => clearTimeout(t)
  }, [])

  if (status === 'confirmed') {
    return (
      <div className="flex flex-col items-center space-y-4 animate-scale-in">
        <div className="relative w-48 h-48 rounded-full overflow-hidden bg-primary-light shadow-lg shadow-primary/20">
          {result.cat_name ? (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-6xl">🐱</span>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-6xl">🐱</span>
            </div>
          )}
        </div>
        <div className="text-center">
          <h3 className="text-2xl font-bold text-text animate-fade-up">
            {result.cat_name || result.name || '校园猫猫'}
          </h3>
          {showDetails && (
            <div className="mt-2 flex items-center justify-center gap-2 animate-fade-up">
              <div className="relative w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-1000"
                  style={{ width: `${Math.round((result.confidence || 0) * 100)}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-primary">
                {Math.round((result.confidence || 0) * 100)}%
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn btn-primary">知道了</button>
          <button onClick={onRetake} className="btn btn-ghost">再拍一张</button>
        </div>
      </div>
    )
  }

  if (status === 'uncertain') {
    return (
      <div className="flex flex-col items-center space-y-4 animate-scale-in">
        <div className="relative" style={{ transform: 'rotate(3deg)' }}>
          <div className="w-48 h-48 rounded-2xl bg-primary-light/50 flex items-center justify-center">
            <span className="text-5xl">🤔</span>
          </div>
        </div>
        <p className="text-text-secondary text-sm text-center">
          不太确定是哪只猫<br />
          可能是以下几只
        </p>
        {showDetails && result.candidates?.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2 animate-fade-up">
            {result.candidates.map((c, i) => (
              <div key={i} className="flex-shrink-0 w-20 text-center p-2 rounded-xl bg-white border border-gray-100">
                <span className="text-2xl">🐱</span>
                <p className="text-xs font-medium text-text mt-1 truncate">{c.cat_name}</p>
                <p className="text-[10px] text-primary">{Math.round(c.confidence * 100)}%</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn btn-primary">返回</button>
          <button onClick={onRetake} className="btn btn-ghost">重新拍</button>
        </div>
      </div>
    )
  }

  // unknown
  return (
    <div className="flex flex-col items-center space-y-4 animate-scale-in">
      <div className="relative w-48 h-48 rounded-full overflow-hidden bg-gray-100">
        <div className="w-full h-full flex items-center justify-center opacity-40">
          <span className="text-6xl">?</span>
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-lg font-bold text-text">是新朋友！</p>
        <p className="text-sm text-text-secondary">还没有收录这只猫猫</p>
      </div>
      {showDetails && (
        <div className="animate-fade-up">
          <button className="btn btn-primary">提交线索</button>
        </div>
      )}
      <button onClick={onRetake} className="btn btn-ghost">重新拍</button>
    </div>
  )
}
