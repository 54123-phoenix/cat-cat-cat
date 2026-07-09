import { cloneElement, isValidElement, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react'
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
  const initials = title.trim().slice(0, 2) || '猫猫'

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

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleShare()
    }
  }

  const shareUrl = `${window.location.origin}${sharePath}`
  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<React.HTMLAttributes<HTMLElement>>, {
        onClick: (e: MouseEvent<HTMLElement>) => {
          children.props.onClick?.(e)
          if (!e.defaultPrevented) handleShare()
        },
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
          children.props.onKeyDown?.(e)
          if (!e.defaultPrevented) handleKeyDown(e)
        },
        'aria-label': children.props['aria-label'] ?? '分享',
      })
    : (
      <button type="button" onClick={handleShare} onKeyDown={handleKeyDown} className="contents" aria-label="分享">
        {children}
      </button>
    )

  return (
    <>
      {trigger}

      <div
        ref={posterRef}
        className={`fixed -left-[9999px] top-0 flex h-[640px] w-[360px] flex-col overflow-hidden bg-gradient-to-br ${accent} text-text`}
        aria-hidden="true"
      >
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-primary/10" />
        <div className="absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-amber-200/25" />
        <div className="absolute left-6 top-24 h-2 w-2 rounded-full bg-primary/30" />
        <div className="absolute right-9 top-40 h-3 w-3 rounded-full bg-amber-300/60" />

        <div className="relative flex items-center justify-between px-6 pt-6">
          <div className="flex items-center gap-2">
            <Logo size={30} />
            <div>
              <div className="text-sm font-extrabold tracking-tight text-text">猫猫社区</div>
              <div className="text-[10px] font-medium text-text-secondary">Fudan Cat Journal</div>
            </div>
          </div>
          <div className="rounded-full border border-primary/15 bg-white/70 px-3 py-1 text-[11px] font-semibold text-primary">
            {slogan}
          </div>
        </div>

        <div className="relative flex flex-1 flex-col px-6 pb-6 pt-5">
          <div className="relative overflow-hidden rounded-[28px] bg-white shadow-e4 ring-1 ring-stone-900/5">
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary-light to-transparent" />
            <div className="relative px-5 pt-5 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-3xl text-white shadow-primary-glow">
                {badge || emoji}
              </div>

              <div className="relative mx-auto h-44 w-44 overflow-hidden rounded-[30px] bg-primary-light ring-8 ring-white shadow-e3">
                {image && !imgError ? (
                  <img
                    src={image}
                    alt=""
                    crossOrigin="anonymous"
                    onError={() => setImgError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-primary-light to-amber-100 text-primary">
                    <div className="text-6xl">{emoji}</div>
                    <div className="mt-2 rounded-full bg-white/70 px-3 py-1 text-xs font-bold">{initials}</div>
                  </div>
                )}
              </div>

              <h2 className="mx-auto mt-5 max-w-[260px] text-3xl font-extrabold leading-tight tracking-tight text-text">
                {title}
              </h2>
              {subtitle && (
                <p className="mx-auto mt-2 max-w-[250px] text-sm font-semibold leading-5 text-primary">
                  {subtitle}
                </p>
              )}
              {proof && (
                <div className="mx-auto mt-4 max-w-[260px] rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
                  {proof}
                </div>
              )}
            </div>

            <div className="mt-5 border-t border-dashed border-border px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 text-left">
                  <div className="text-[11px] font-semibold text-text-muted">扫码打开同款记录</div>
                  <div className="mt-1 truncate text-xs font-bold text-text-secondary">{sharePath}</div>
                </div>
                <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-border">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="二维码" className="h-16 w-16" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-surface-3" />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="relative mt-4 flex items-center justify-center gap-2 text-[11px] font-medium text-text-secondary">
            <span className="h-px w-8 bg-border" />
            <span>校园猫猫的今日证明</span>
            <span className="h-px w-8 bg-border" />
          </div>
        </div>
      </div>

      {showSheet && <ShareSheet posterRef={posterRef} onClose={() => setShowSheet(false)} shareUrl={shareUrl} />}
    </>
  )
}
