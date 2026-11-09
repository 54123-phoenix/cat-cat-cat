import { useEffect, useRef, useState } from 'react'
import { ImageOff, RotateCw } from 'lucide-react'
import { imageSources, type ImageWidth } from '../utils/imageSources'

interface ImageProps {
  src?: string
  alt?: string
  className?: string
  loading?: 'lazy' | 'eager'
  compact?: boolean
  width?: ImageWidth
  sizes?: string
  thumbnail?: boolean
  fit?: 'cover' | 'contain'
  // Opt in only in a non-interactive parent; many cards are themselves buttons.
  retryable?: boolean
}

function ImageRequest({ src, alt = '', className = '', loading = 'lazy', compact = false,
  width = 640, sizes = '(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw',
  thumbnail = true, fit = 'cover', retryable = false }: ImageProps) {
  const ref = useRef<HTMLImageElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>(src ? 'loading' : 'failed')
  const [slow, setSlow] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [original, setOriginal] = useState(false)
  const sources = thumbnail && !original ? imageSources(src, width, attempt) : { src }

  useEffect(() => {
    if (state !== 'loading') return undefined
    const image = ref.current
    if (!image) return undefined
    if (image.complete && image.naturalWidth > 0) { setState('loaded'); return undefined }
    let timeout: ReturnType<typeof setTimeout> | undefined
    const begin = () => { timeout ??= setTimeout(() => setSlow(true), 8000) }
    // Off-screen lazy images should not claim that the connection is slow.
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { begin(); observer?.disconnect() }
    }) : null
    if (loading === 'eager' || !observer) begin()
    else observer.observe(image)
    return () => { clearTimeout(timeout); observer?.disconnect() }
  }, [state, attempt, original, loading])

  const retry = () => {
    // The retry control disappears while loading; keep keyboard focus nearby.
    container.current?.focus({ preventScroll: true })
    setSlow(false); setState('loading'); setOriginal(false); setAttempt(value => value + 1)
  }
  const failed = state === 'failed'
  return <div ref={container} tabIndex={retryable ? -1 : undefined} role={retryable ? 'group' : undefined} aria-label={retryable ? alt || '图片' : undefined} className={`relative overflow-hidden bg-surface-2 ${className}`}>
    {state === 'loading' && <div aria-hidden="true" className={`absolute inset-0 ${slow ? 'bg-surface-2' : 'skeleton'}`} />}
    {!failed && <img key={`${attempt}-${original}`} ref={ref} {...sources} alt={alt} loading={loading} decoding="async"
      sizes={sources.srcSet ? sizes : undefined}
      onLoad={() => setState('loaded')}
      onError={() => {
        // Older servers and unsupported originals still work without variants.
        if (sources.srcSet) { setOriginal(true); setSlow(false) }
        else setState('failed')
      }}
      className={`h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} transition-opacity duration-200 ${state === 'loaded' ? 'opacity-100' : 'opacity-0'}`} />}
    {(failed || slow && state === 'loading') && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center text-text-secondary">
      {failed && <ImageOff aria-hidden="true" className={compact ? 'h-5 w-5' : 'h-7 w-7'} />}
      {failed && <span role="img" aria-label={`${alt || '图片'}：${src ? '暂时无法显示' : '尚未添加'}`} className="sr-only" />}
      {!compact && <span className="text-sm leading-5">{failed ? src ? '图片暂时无法显示' : '还没有照片' : '图片加载较慢，仍在尝试…'}</span>}
      {retryable && src && <button type="button" onClick={retry} className="btn btn-ghost gap-2" aria-label="重新加载图片"><RotateCw size={16} aria-hidden="true" />重新加载</button>}
    </div>}
  </div>
}

export default function ImageWithShimmer(props: ImageProps) {
  // Unmount old requests so their late events cannot change a newer image.
  return <ImageRequest key={props.src || 'missing'} {...props} />
}
