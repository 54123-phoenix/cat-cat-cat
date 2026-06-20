import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Sparkles } from 'lucide-react'
import QRCode from 'qrcode'
import MascotCat from '../components/MascotCat'
import PageHeader from '../components/PageHeader'
import { getWrapped, getStoredUser } from '../api'

function loadImage(src: string): Promise<HTMLImageElement> {
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

  const shareUrl = `${window.location.origin}/#/wrapped?user=${user?.id || ''}`
  try {
    const qrDataUrl = await QRCode.toDataURL(shareUrl, { width: 180, margin: 1 })
    const qr = await loadImage(qrDataUrl)
    ctx.drawImage(qr, W / 2 - 90, 1080, 180, 180)
  } catch {}
  ctx.font = '22px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillText('扫码查看我的年度报告', W / 2, 1290)

  return canvas
}

export default function Wrapped() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [searchParams] = useSearchParams()
  const shareRef = useRef(null)

  useEffect(() => {
    getWrapped()
      .then(setData)
      .catch((e) => setError(e.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [])

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
      setError('生成分享图失败：' + (e.message || ''))
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary to-[#EA580C] flex items-center justify-center">
        <MascotCat mood="curious" size={80} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-warm-50">
        <PageHeader title="年度报告" />
        <div className="p-4 text-center text-text-secondary">{error}</div>
      </div>
    )
  }

  const cards = [
    {
      key: 'sightings',
      content: (
        <>
          <p className="text-sm opacity-80 mb-2">{data.year} 年</p>
          <p className="text-6xl font-bold mb-3">{data.total_sightings}</p>
          <p className="text-xl">次和猫猫相遇</p>
          <p className="text-base opacity-80 mt-4">遇见了 {data.distinct_cats} 只不同的猫猫</p>
        </>
      ),
    },
    {
      key: 'locations',
      content: (
        <>
          <p className="text-sm opacity-80 mb-3">最常去的地方</p>
          {(data.top_locations || []).slice(0, 3).map((loc, i) => (
            <div key={loc.name} className="mb-3">
              <p className="text-3xl font-bold">{i + 1}. {loc.name}</p>
              <p className="text-base opacity-80">偶遇 {loc.count} 次</p>
            </div>
          ))}
          {(!data.top_locations || data.top_locations.length === 0) && (
            <p className="text-lg opacity-80">今年还没有记录哦</p>
          )}
        </>
      ),
    },
    {
      key: 'benming',
      content: (
        <>
          <p className="text-sm opacity-80 mb-3">你的本命猫是</p>
          {data.benming_cat ? (
            <>
              <div className="w-40 h-40 rounded-full overflow-hidden mx-auto mb-4 ring-4 ring-white/60 bg-white/20">
                {data.benming_cat.avatar ? (
                  <img src={data.benming_cat.avatar} alt={data.benming_cat.name || '猫猫'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl">🐱</div>
                )}
              </div>
              <p className="text-4xl font-bold mb-2">{data.benming_cat.name}</p>
              <p className="text-base opacity-80">今年偶遇 {data.benming_cat.count} 次</p>
            </>
          ) : (
            <p className="text-lg opacity-80">今年还没有本命猫</p>
          )}
        </>
      ),
    },
    {
      key: 'badges',
      content: (
        <>
          <p className="text-sm opacity-80 mb-3">解锁了</p>
          <p className="text-6xl font-bold mb-2">{data.badges_earned?.length || 0}</p>
          <p className="text-xl mb-4">个勋章</p>
          <p className="text-base opacity-80">连续偶遇 {data.streak} 天，最长 {data.longest_streak} 天</p>
        </>
      ),
    },
    {
      key: 'collection',
      content: (
        <>
          <p className="text-sm opacity-80 mb-3">猫猫图鉴</p>
          <p className="text-5xl font-bold mb-2">{data.collection_count}/{data.collection_total}</p>
          <p className="text-xl mb-4">已收集</p>
          <p className="text-base opacity-80">总经验 {data.total_xp} · 等级 {data.level}</p>
        </>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-warm-50">
      <PageHeader title="年度猫猫报告" />
      <div className="space-y-4 p-4">
        {cards.map((card) => (
          <div
            key={card.key}
            className="rounded-3xl p-8 text-center text-white bg-gradient-to-br from-primary to-[#EA580C] shadow-lg"
          >
            {card.content}
          </div>
        ))}

        <button
          onClick={handleShare}
          disabled={generating}
          className="w-full bg-primary text-white rounded-full py-4 font-medium flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {generating ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />生成中…</>
          ) : (
            <><Download className="w-5 h-5" />生成分享图</>
          )}
        </button>
        <p className="text-center text-xs text-text-muted">
          长按或点击保存图片，分享你的年度猫猫报告
          {searchParams.get('user') && ' · 来自好友的分享'}
        </p>
      </div>
    </div>
  )
}
