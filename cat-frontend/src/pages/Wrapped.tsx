import { useEffect, useState, useRef } from 'react'
import { Download, Sparkles, ChevronLeft, ChevronRight, Share2 } from 'lucide-react'
import QRCode from 'qrcode'
import MascotCat from '../components/MascotCat'
import SharePoster from '../components/SharePoster'
import { getWrapped, getStoredUser } from '../api'

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function buildShareCanvas(data, user) {
  const W = 750, H = 1334
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#FB923C')
  grad.addColorStop(0.5, '#F97316')
  grad.addColorStop(1, '#EA580C')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = 'bold 64px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${data.year} 猫猫年度报告`, W / 2, 110)

  ctx.font = '28px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(user?.nickname || '猫猫爱好者', W / 2, 160)

  ctx.fillStyle = 'rgba(255,255,255,0.98)'
  ctx.font = 'bold 120px sans-serif'
  ctx.fillText(`${data.total_sightings}`, W / 2, 340)
  ctx.font = '32px sans-serif'
  ctx.fillText('次偶遇校园猫猫', W / 2, 390)

  ctx.font = 'bold 56px sans-serif'
  ctx.fillText(`${data.distinct_cats} 只不同猫猫`, W / 2, 480)

  if (data.benming_cat) {
    ctx.font = '32px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillText(`你的本命猫是 ${data.benming_cat.name}`, W / 2, 560)
    if (data.benming_cat.avatar) {
      try {
        const avatar = await loadImage(data.benming_cat.avatar)
        const size = 280
        const x = (W - size) / 2
        const y = 600
        ctx.save()
        ctx.beginPath()
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()
        ctx.drawImage(avatar, x, y, size, size)
        ctx.restore()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 8
        ctx.beginPath()
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
        ctx.stroke()
      } catch {}
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = 'bold 48px sans-serif'
  ctx.fillText(`解锁 ${data.badges_earned?.length || 0} 个勋章`, W / 2, 960)
  ctx.font = '36px sans-serif'
  ctx.fillText(`收集 ${data.collection_count}/${data.collection_total} · 等级 ${data.level}`, W / 2, 1010)

  if (data.cat_personality) {
    ctx.font = '32px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillText(`猫猫人格: ${data.cat_personality}`, W / 2, 1060)
  }

  const shareUrl = `${window.location.origin}/#/wrapped?user=${user?.id || ''}`
  try {
    const qrDataUrl = await QRCode.toDataURL(shareUrl, { width: 180, margin: 1 })
    const qr = await loadImage(qrDataUrl)
    ctx.drawImage(qr, W / 2 - 90, 1100, 180, 180)
  } catch {}
  ctx.font = '22px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillText('扫码查看我的年度报告', W / 2, 1290)

  return canvas
}

function getPersonalityLabel(data) {
  const hourly = data.hourly_distribution || []
  if (!hourly.length) return null
  const nightCount = hourly.slice(22, 24).reduce((a, b) => a + b, 0) + hourly.slice(0, 6).reduce((a, b) => a + b, 0)
  const total = hourly.reduce((a, b) => a + b, 0) || 1
  if (nightCount / total > 0.4) return { label: '夜巡侠', emoji: '🌙', desc: '月光下的猫猫猎人' }
  if ((data.distinct_cats || 0) >= 10) return { label: '猫语者', emoji: '🐱', desc: '和每只猫都说过话' }
  if ((data.total_sightings || 0) >= 20) return { label: '猫猫雷达', emoji: '📡', desc: '哪里有猫都知道' }
  return { label: '忠实访客', emoji: '🐾', desc: '风雨无阻来看猫' }
}

export default function Wrapped() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    getWrapped()
      .then(setData)
      .catch((e) => setError(e.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!data) return
    const timer = setInterval(() => {
      setCurrentSlide(prev => prev < slides.length - 1 ? prev + 1 : prev)
    }, 5000)
    return () => clearInterval(timer)
  }, [data])

  async function handleShare() {
    if (!data) return
    setGenerating(true)
    try {
      const user = getStoredUser()
      const canvas = await buildShareCanvas(data, user)
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `cat-wrapped-${data.year}.png`
      a.click()
    } catch (e) {
      setError('生成分享图失败')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary to-[#EA580C] flex items-center justify-center">
        <MascotCat mood="curious" size={80} />
        <p className="text-white/80 ml-4">加载年度回忆…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center p-4">
        <div className="text-center">
          <MascotCat mood="sad" size={64} />
          <p className="text-text-secondary mt-4">{error}</p>
        </div>
      </div>
    )
  }

  const personality = getPersonalityLabel(data)

  const slides = [
    {
      key: 'intro',
      content: (
        <div className="flex flex-col items-center justify-center text-center animate-fade-up">
          <MascotCat mood="happy" size={80} breathe />
          <p className="text-sm opacity-80 mt-6 mb-2">{data.year}</p>
          <h2 className="text-3xl font-bold mb-2">你和猫猫的故事</h2>
          <p className="text-base opacity-70">{getStoredUser()?.nickname || '猫猫爱好者'}</p>
        </div>
      ),
    },
    {
      key: 'sightings',
      content: (
        <div className="flex flex-col items-center justify-center text-center animate-scale-in">
          <p className="text-sm opacity-80 mb-4">你遇到了</p>
          <p className="text-7xl font-bold mb-2">{data.total_sightings}</p>
          <p className="text-xl mb-6">只猫猫</p>
          <p className="text-base opacity-70">遇见了 {data.distinct_cats} 只不同的猫</p>
        </div>
      ),
    },
    {
      key: 'benming',
      content: (
        <div className="flex flex-col items-center justify-center text-center animate-scale-in">
          <p className="text-sm opacity-80 mb-4">你的本命猫是</p>
          {data.benming_cat ? (
            <>
              <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-white/60 bg-white/20 mb-4 animate-pop-in">
                {data.benming_cat.avatar ? (
                  <img src={data.benming_cat.avatar} alt={data.benming_cat.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">🐱</div>
                )}
              </div>
              <p className="text-4xl font-bold mb-2">{data.benming_cat.name}</p>
              <p className="text-base opacity-70">今年偶遇 {data.benming_cat.count} 次</p>
            </>
          ) : (
            <p className="text-lg opacity-70">今年还没有本命猫</p>
          )}
        </div>
      ),
    },
    ...(personality ? [{
      key: 'personality',
      content: (
        <div className="flex flex-col items-center justify-center text-center animate-scale-in">
          <p className="text-6xl mb-4">{personality.emoji}</p>
          <p className="text-sm opacity-80 mb-2">你的猫猫人格</p>
          <p className="text-4xl font-bold mb-2">{personality.label}</p>
          <p className="text-base opacity-70">{personality.desc}</p>
        </div>
      ),
    }] : []),
    {
      key: 'locations',
      content: (
        <div className="flex flex-col items-center justify-center text-center animate-fade-up">
          <p className="text-sm opacity-80 mb-4">最常去的地方</p>
          {(data.top_locations || []).slice(0, 3).map((loc, i) => (
            <div key={loc.name} className="mb-3 stagger-{i+1}">
              <p className="text-2xl font-bold">{i + 1}. {loc.name}</p>
              <p className="text-sm opacity-70">偶遇 {loc.count} 次</p>
            </div>
          ))}
          {(!data.top_locations || data.top_locations.length === 0) && (
            <p className="text-lg opacity-70">今年还没有记录哦</p>
          )}
        </div>
      ),
    },
    {
      key: 'badges',
      content: (
        <div className="flex flex-col items-center justify-center text-center animate-scale-in">
          <p className="text-sm opacity-80 mb-3">解锁了</p>
          <p className="text-6xl font-bold mb-2">{data.badges_earned?.length || 0}</p>
          <p className="text-xl mb-4">个勋章</p>
          <p className="text-base opacity-70">连续偶遇 {data.streak} 天，最长 {data.longest_streak} 天</p>
        </div>
      ),
    },
    {
      key: 'collection',
      content: (
        <div className="flex flex-col items-center justify-center text-center animate-fade-up">
          <p className="text-sm opacity-80 mb-3">猫猫图鉴</p>
          <p className="text-5xl font-bold mb-2">{data.collection_count}/{data.collection_total}</p>
          <p className="text-xl mb-4">已收集</p>
          <p className="text-base opacity-70">总经验 {data.total_xp} · 等级 {data.level}</p>
        </div>
      ),
    },
    {
      key: 'share',
      content: (
        <div className="flex flex-col items-center justify-center text-center animate-fade-up">
          <Sparkles className="w-12 h-12 mb-4 opacity-80" />
          <h2 className="text-2xl font-bold mb-4">分享你的年度报告</h2>
          <p className="text-sm opacity-70 mb-6">长按保存图片，分享给猫友</p>
          <button
            onClick={handleShare}
            disabled={generating}
            className="bg-white/20 backdrop-blur-sm text-white rounded-full px-8 py-3 font-medium flex items-center gap-2 disabled:opacity-60 active:scale-95 transition-transform"
          >
            {generating ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />生成中…</>
            ) : (
              <><Download className="w-5 h-5" />保存分享图</>
            )}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-primary to-[#EA580C] text-white overflow-hidden">
      <div className="absolute inset-x-0 top-0 flex justify-between items-center p-4 z-10">
        <button
          onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          className={`p-2 rounded-full bg-white/10 ${currentSlide === 0 ? 'opacity-30' : 'opacity-80'}`}
          disabled={currentSlide === 0}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === currentSlide ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
            />
          ))}
        </div>
        <button
          onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
          className={`p-2 rounded-full bg-white/10 ${currentSlide === slides.length - 1 ? 'opacity-30' : 'opacity-80'}`}
          disabled={currentSlide === slides.length - 1}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div
        className="h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateY(-${currentSlide * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <div key={slide.key} className="h-full flex items-center justify-center p-8">
            {slide.content}
          </div>
        ))}
      </div>
    </div>
  )
}
