import { useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import ImageWithShimmer from './ImageWithShimmer'

type Photo = string | { url?: string; image_path?: string; src?: string; avatar?: string; alt?: string; name?: string }

function normalize(images: Photo[]) {
  return (Array.isArray(images) ? images : []).map(photo => typeof photo === 'string'
    ? { url: photo, alt: '' }
    : { url: photo?.url || photo?.image_path || photo?.src || photo?.avatar, alt: photo?.alt || photo?.name || '' })
}

export default function PhotoViewer({ images, initialIndex = 0, onClose }: { images: Photo[]; initialIndex?: number; onClose: () => void }) {
  const list = normalize(images)
  const [index, setIndex] = useState(initialIndex)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const imageStage = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const safeIndex = Math.min(Math.max(index, 0), Math.max(list.length - 1, 0))
  const hasPhotos = list.length > 0
  const go = (step: number) => {
    // A failed image's retry button is removed with the old image request.
    if (imageStage.current?.contains(document.activeElement)) closeButton.current?.focus()
    setIndex((safeIndex + step + list.length) % list.length)
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !hasPhotos) return undefined
    const previousOverflow = document.body.style.overflow
    const opener = document.activeElement as HTMLElement | null
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; if (opener?.isConnected) opener.focus() }
  }, [hasPhotos])

  if (!hasPhotos) return null
  const current = list[safeIndex]
  return <dialog ref={dialogRef} className="photo-dialog" aria-labelledby="photo-viewer-title"
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}
    onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); go(event.key === 'ArrowLeft' ? -1 : 1) }
      if (event.key !== 'Tab') return
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])')].filter(node => node.getClientRects().length > 0)
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
    <div className="photo-viewer-panel">
      <header className="flex items-center justify-between gap-3 px-4 py-2">
        <h2 id="photo-viewer-title" className="text-base font-semibold">查看照片</h2>
        <span role="status" className="text-sm">{safeIndex + 1} / {list.length}</span>
        <button ref={closeButton} type="button" onClick={onClose} className="icon-button" aria-label="关闭照片"><X size={22} /></button>
      </header>
      <div ref={imageStage} className="min-h-0 flex-1 px-2 sm:px-4"
        onTouchStart={event => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY } }}
        onTouchEnd={event => {
          const start = touchStart.current
          touchStart.current = null
          if (!start || list.length < 2) return
          const dx = event.changedTouches[0].clientX - start.x, dy = event.changedTouches[0].clientY - start.y
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx > 0 ? -1 : 1)
        }}>
        <ImageWithShimmer src={current.url} alt={current.alt || `照片 ${safeIndex + 1}`} thumbnail={false} loading="eager" fit="contain" retryable className="h-full w-full rounded-lg" />
      </div>
      <footer className="flex min-h-16 items-center justify-between gap-3 px-4 py-2">
        {list.length > 1 && <button type="button" onClick={() => go(-1)} className="btn btn-ghost shrink-0" aria-label="上一张照片"><ChevronLeft size={20} /><span className="hidden sm:inline">上一张</span></button>}
        <p className="min-w-0 flex-1 break-words text-center text-sm text-text-secondary">{current.alt || '原始照片'}</p>
        {list.length > 1 && <button type="button" onClick={() => go(1)} className="btn btn-ghost shrink-0" aria-label="下一张照片"><span className="hidden sm:inline">下一张</span><ChevronRight size={20} /></button>}
      </footer>
    </div>
  </dialog>
}
