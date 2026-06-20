import { useRef, useState } from 'react'
import QRCode from 'qrcode'
import Logo from './illustrations/Logo'
import ShareSheet from './ShareSheet'

interface SharePosterProps {
  type: 'cat' | 'badge' | 'sighting' | 'wrapped'
  data: Record<string, unknown>
  children?: React.ReactNode
}

export default function SharePoster({ type, data, children }: SharePosterProps) {
  const posterRef = useRef<HTMLDivElement>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')

  async function generateQR() {
    try {
      const url = `${window.location.origin}${window.location.pathname}?utm_source=share&utm_campaign=${type}`
      const qr = await QRCode.toDataURL(url, { width: 80, margin: 1, color: { dark: '#1a1a1a', light: '#ffffff00' } })
      setQrDataUrl(qr)
    } catch {
      setQrDataUrl('')
    }
  }

  function handleShare() {
    generateQR()
    setShowSheet(true)
  }

  const slogans: Record<string, string> = {
    cat: '来复旦找猫',
    badge: '猫猫社区成就',
    sighting: '我偶遇了一只猫',
    wrapped: '我的猫猫年度总结',
  }

  return (
    <>
      <div onClick={handleShare} className="cursor-pointer" role="button" tabIndex={0} aria-label="分享">
        {children}
      </div>

      <div ref={posterRef} className="fixed -left-[9999px] top-0 w-[360px] h-[640px] bg-gradient-to-br from-primary/10 via-surface-0 to-primary/5 p-6 flex flex-col" aria-hidden="true">
        <div className="flex items-center gap-2 mb-4">
          <Logo size={28} />
          <span className="text-sm font-bold text-primary">猫猫社区</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          {type === 'cat' && (
            <>
              {data.avatar && <img src={data.avatar as string} alt="" className="w-24 h-24 rounded-full object-cover mb-3 border-3 border-primary/20" />}
              <h2 className="text-2xl font-bold text-text mb-1">{data.name as string}</h2>
              {data.personality && <p className="text-sm text-text-secondary mb-2">{data.personality as string}</p>}
            </>
          )}
          {type === 'badge' && (
            <>
              <span className="text-5xl mb-3">{data.emoji as string}</span>
              <h2 className="text-xl font-bold text-text mb-1">{data.name as string}</h2>
              <p className="text-sm text-text-secondary">{data.description as string}</p>
            </>
          )}
          {type === 'sighting' && (
            <>
              {data.image && <img src={data.image as string} alt="" className="w-40 h-40 rounded-2xl object-cover mb-3" />}
              <h2 className="text-lg font-bold text-text mb-1">偶遇 {data.cat_name as string}</h2>
              {data.location && <p className="text-sm text-text-secondary">{data.location as string}</p>}
            </>
          )}
          {type === 'wrapped' && (
            <>
              <span className="text-4xl mb-2">🐱</span>
              <h2 className="text-xl font-bold text-text mb-1">我的猫猫年度总结</h2>
              <p className="text-sm text-text-secondary">遇见 {data.cats_count as number} 只猫 · {data.sightings_count as number} 次偶遇</p>
            </>
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-text-secondary">{slogans[type]}</span>
          {qrDataUrl && <img src={qrDataUrl} alt="二维码" className="w-16 h-16" />}
        </div>
      </div>

      {showSheet && <ShareSheet posterRef={posterRef} onClose={() => setShowSheet(false)} />}
    </>
  )
}
