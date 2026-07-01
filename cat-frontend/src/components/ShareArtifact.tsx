import { useRef, useState } from 'react'
import QRCode from 'qrcode'
import Logo from './illustrations/Logo'
import ShareSheet from './ShareSheet'

export interface ShareArtifactProps {
  title: string
  subtitle?: string
  image?: string
  emoji?: string
  proof?: string
  badge?: string
  sharePath: string
  accent?: string
  slogan?: string
  children: React.ReactNode
}

export default function ShareArtifact({
  title,
  subtitle,
  image,
  emoji = '🐱',
  proof,
  badge,
  sharePath,
  accent = 'from-primary/10 via-surface-0 to-primary/5',
  slogan = '来复旦找猫',
  children,
}: ShareArtifactProps) {
  const posterRef = useRef<HTMLDivElement>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [imgError, setImgError] = useState(false)

  async function generateQR() {
    try {
      const url = `${window.location.origin}${sharePath}`
      const qr = await QRCode.toDataURL(url, { width: 80, margin: 1, color: { dark: '#1a1a1a', light: '#ffffff00' } })
      setQrDataUrl(qr)
    } catch {
      setQrDataUrl('')
    }
  }

  function handleShare() {
    setImgError(false)
    generateQR()
    setShowSheet(true)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleShare()
    }
  }

  const shareUrl = `${window.location.origin}${sharePath}`

  return (
    <>
      <div onClick={handleShare} onKeyDown={handleKeyDown} className="cursor-pointer" role="button" tabIndex={0} aria-label="分享">
        {children}
      </div>

      <div
        ref={posterRef}
        className={`fixed -left-[9999px] top-0 w-[360px] h-[640px] bg-gradient-to-br ${accent} p-6 flex flex-col`}
        aria-hidden="true"
      >
        <div className="flex items-center gap-2 mb-4">
          <Logo size={28} />
          <span className="text-sm font-bold text-primary">猫猫社区</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          {badge && <span className="text-5xl mb-3">{badge}</span>}
          {image && !imgError ? (
            <img
              src={image}
              alt=""
              crossOrigin="anonymous"
              onError={() => setImgError(true)}
              className="w-28 h-28 rounded-2xl object-cover mb-3 border-3 border-primary/20"
            />
          ) : (
            <div className="w-28 h-28 rounded-2xl bg-primary/10 flex items-center justify-center text-5xl mb-3 border-3 border-primary/20">
              {emoji}
            </div>
          )}
          <h2 className="text-2xl font-bold text-text mb-1">{title}</h2>
          {subtitle && <p className="text-sm text-text-secondary mb-2">{subtitle}</p>}
          {proof && (
            <div className="mt-2 px-4 py-2 rounded-xl bg-white/60 text-sm text-text font-medium">
              {proof}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-text-secondary">{slogan}</span>
          {qrDataUrl && <img src={qrDataUrl} alt="二维码" className="w-16 h-16" />}
        </div>
      </div>

      {showSheet && <ShareSheet posterRef={posterRef} onClose={() => setShowSheet(false)} shareUrl={shareUrl} />}
    </>
  )
}
