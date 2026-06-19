import { useEffect, useState, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Full-screen photo viewer with swipe / tap navigation.
 * Props:
 *   - images: array of { url, alt } or array of URL strings
 *   - initialIndex: starting index
 *   - onClose: () => void
 */
function normalize(images) {
  if (!Array.isArray(images)) return []
  return images
    .map((img) => {
      if (typeof img === 'string') return { url: img, alt: '' }
      if (img && typeof img === 'object') {
        return {
          url: img.url || img.image_path || img.src || img.avatar,
          alt: img.alt || img.name || '',
        }
      }
      return null
    })
    .filter((i) => i && i.url)
}

export default function PhotoViewer({ images, initialIndex = 0, onClose }) {
  const list = normalize(images)
  const [index, setIndex] = useState(
    Math.min(Math.max(initialIndex, 0), Math.max(list.length - 1, 0))
  )
  const [touchStartX, setTouchStartX] = useState(null)

  const go = useCallback(
    (next) => {
      setIndex((cur) => {
        const n = list.length
        if (n === 0) return cur
        return (next + n) % n
      })
    },
    [list.length]
  )

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
      else if (e.key === 'ArrowLeft') go(index - 1)
      else if (e.key === 'ArrowRight') go(index + 1)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [index, go, onClose])

  if (list.length === 0) return null

  const current = list[index]
  const hasMultiple = list.length > 1

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center animate-fade-in"
      onClick={onClose}
      onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX === null) return
        const dx = e.changedTouches[0].clientX - touchStartX
        if (Math.abs(dx) > 40) {
          if (dx > 0) go(index - 1)
          else go(index + 1)
        }
        setTouchStartX(null)
      }}
    >
      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose?.()
        }}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        aria-label="关闭"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Counter */}
      {hasMultiple && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-white/80 text-sm font-medium bg-white/10 rounded-full px-3 py-1">
          {index + 1} / {list.length}
        </div>
      )}

      {/* Prev */}
      {hasMultiple && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            go(index - 1)
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          aria-label="上一张"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Image */}
      <img
        src={current.url}
        alt={current.alt}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[92vw] max-h-[88vh] object-contain animate-scale-in"
      />

      {/* Next */}
      {hasMultiple && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            go(index + 1)
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          aria-label="下一张"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  )
}
