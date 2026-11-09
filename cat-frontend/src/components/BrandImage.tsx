import { useState, type CSSProperties } from 'react'
import { PawPrint } from 'lucide-react'

interface BrandImageProps {
  variant: 'full' | 'head'
  size: number
  height?: number
  label: string
  className?: string
  style?: CSSProperties
}

/** Shared, locally served artwork with reserved space and a bounded fallback. */
export default function BrandImage({ variant, size, height = size, label, className = '', style }: BrandImageProps) {
  const [failed, setFailed] = useState(0)
  const head = variant === 'head'
  const stem = head ? 'mascot-head' : 'mascot'
  const widths = head ? [96, 192] : [192, 384, 768]
  const fallbackWidth = head ? 192 : 384

  return (
    <span role="img" aria-label={label} className={`brand-image ${className}`.trim()} style={{ width: size, height, ...style }}>
      {failed < 2 ? (
        <img
          src={`/brand/${stem}-${fallbackWidth}.${failed ? 'png' : 'webp'}`}
          srcSet={failed ? undefined : widths.map(width => `/brand/${stem}-${width}.webp ${width}w`).join(', ')}
          sizes={`${size}px`}
          width={fallbackWidth}
          height={fallbackWidth}
          alt=""
          aria-hidden="true"
          draggable={false}
          decoding="async"
          onError={() => setFailed(previous => Math.min(previous + 1, 2))}
        />
      ) : <PawPrint className="brand-image-fallback" aria-hidden="true" />}
    </span>
  )
}
