import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface ToastItem {
  id: number
  message: string
  emoji: string
  avatar?: string
  duration: number
}

interface ToastOpts {
  emoji?: string
  type?: string
  avatar?: string
  duration?: number
}

let pushFn: ((message: string, opts: ToastOpts) => void) | null = null
let nextId = 0
const MAX_TOASTS = 3

export function toast(message: string, opts: ToastOpts = {}) {
  if (pushFn) pushFn(message, opts)
}

const TYPE_EMOJI: Record<string, string> = {
  post_new: '📝',
  comment_new: '💬',
  like_new: '❤️',
  badge_unlock: '🏅',
  sighting_confirmed: '✅',
  discovery_reviewed: '🔍',
}

function ToastMessage({ item, onDismiss, onHold }: {
  item: ToastItem
  onDismiss: (id: number) => void
  onHold: (id: number, held: boolean) => void
}) {
  const remaining = useRef(item.duration)
  const pauses = useRef(new Set<string>())
  const [paused, setPaused] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const setPause = useCallback((reason: string, value: boolean) => {
    if (value) pauses.current.add(reason)
    else pauses.current.delete(reason)
    setPaused(pauses.current.size > 0)
    onHold(item.id, pauses.current.has('hover') || pauses.current.has('focus'))
  }, [item.id, onHold])

  useEffect(() => {
    const onVisibility = () => setPause('hidden', document.visibilityState === 'hidden')
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      onHold(item.id, false)
    }
  }, [item.id, onHold, setPause])

  useEffect(() => {
    if (paused || item.duration === 0) return undefined
    const started = performance.now()
    const timer = setTimeout(() => onDismiss(item.id), remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current = Math.max(0, remaining.current - (performance.now() - started))
    }
  }, [item.id, item.duration, onDismiss, paused])

  return (
    <div
      role="group"
      aria-labelledby={`toast-message-${item.id}`}
      className="pointer-events-auto flex items-start gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2 shadow-e2"
      onPointerEnter={(event) => { if (event.pointerType !== 'touch') setPause('hover', true) }}
      onPointerLeave={() => setPause('hover', false)}
      onFocusCapture={() => setPause('focus', true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPause('focus', false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onDismiss(item.id)
        }
      }}
    >
      <span className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center text-lg" aria-hidden="true">
        {item.avatar && !avatarFailed
          ? <img src={item.avatar} alt="" onError={() => setAvatarFailed(true)} className="h-7 w-7 rounded-full object-cover" />
          : item.emoji}
      </span>
      <p id={`toast-message-${item.id}`} className="min-w-0 flex-1 whitespace-pre-wrap py-2 text-sm leading-6 text-text [overflow-wrap:anywhere]">
        {item.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="关闭通知"
        className="focus-ring -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-3 hover:text-text active:bg-surface-3"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export default function Toast() {
  const [items, setItems] = useState<ToastItem[]>([])
  const [announcement, setAnnouncement] = useState<{ id: number; message: string } | null>(null)
  const held = useRef(new Set<number>())
  const dismiss = useCallback((id: number) => {
    held.current.delete(id)
    setItems((previous) => previous.filter((item) => item.id !== id))
    setAnnouncement((previous) => previous?.id === id ? null : previous)
  }, [])
  const hold = useCallback((id: number, value: boolean) => {
    if (value) held.current.add(id)
    else held.current.delete(id)
  }, [])

  useEffect(() => {
    const push = (message: string, opts: ToastOpts = {}) => {
      if (!message.trim()) return
      const id = ++nextId
      const duration = Number.isFinite(opts.duration) && opts.duration! >= 0
        ? opts.duration! : Math.max(6000, Math.min(15000, message.length * 75))
      const item = { id, message, duration, avatar: opts.avatar,
        emoji: opts.emoji || TYPE_EMOJI[opts.type || ''] || '🔔' }
      setItems((previous) => {
        if (previous.length < MAX_TOASTS) return [...previous, item]
        const oldest = previous.find((entry) => !held.current.has(entry.id))
        return oldest ? [...previous.filter((entry) => entry.id !== oldest.id), item] : previous
      })
      setAnnouncement({ id, message })
    }
    pushFn = push
    return () => { if (pushFn === push) pushFn = null }
  }, [])

  return (
    <>
      {/* Keep the live region mounted before its first announcement. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement && <span key={announcement.id}>{announcement.message}</span>}
      </div>
      {items.length > 0 && (
        <div
          className="pointer-events-none fixed left-1/2 flex w-[calc(100%-32px)] max-w-[448px] -translate-x-1/2 flex-col gap-2 overflow-y-auto"
          style={{
            zIndex: 'var(--z-toast, 80)',
            bottom: 'calc(var(--bottom-nav-height, 88px) + env(safe-area-inset-bottom, 0px) + 12px)',
            maxHeight: 'calc(100dvh - var(--bottom-nav-height, 88px) - env(safe-area-inset-bottom, 0px) - 100px)',
          }}
        >
          {items.map((item) => <ToastMessage key={item.id} item={item} onDismiss={dismiss} onHold={hold} />)}
        </div>
      )}
    </>
  )
}
