import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'

export default function ImageWithShimmer({
  src,
  alt,
  className = '',
  loading,
  compact = false,
}: {
  src?: string
  alt?: string
  className?: string
  loading?: 'lazy' | 'eager'
  compact?: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(!src)

  useEffect(() => {
    setLoaded(false)
    setFailed(!src)
  }, [src])

  if (failed) {
    return (
      <div className={`relative overflow-hidden bg-surface-2 ${className}`}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <div className={`${compact ? 'w-6 h-6' : 'w-10 h-10'} rounded-full bg-white ring-1 ring-border flex items-center justify-center`}>
            <ImageOff className={`${compact ? 'w-3 h-3' : 'w-5 h-5'} text-text-muted`} />
          </div>
          {!compact && <span className="text-xs font-medium text-text-secondary">图片暂时无法显示</span>}
        </div>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && <div className="absolute inset-0 skeleton" />}
      <img
        src={src}
        alt={alt}
        loading={loading}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}
