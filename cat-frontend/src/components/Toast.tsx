import { useEffect, useState } from 'react'

interface ToastItem {
  id: number
  message: string
  emoji: string
  avatar?: string
}

interface ToastOpts {
  emoji?: string
  type?: string
  avatar?: string
  duration?: number
}

let pushFn: ((message: string, opts: ToastOpts) => void) | null = null

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

export default function Toast() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    pushFn = (message, opts = {}) => {
      const id = Date.now() + Math.random()
      const emoji = opts.emoji || TYPE_EMOJI[opts.type || ''] || '🔔'
      setItems((prev) => [...prev, { id, message, emoji, avatar: opts.avatar }])
      setTimeout(() => {
        setItems((prev) => prev.filter((it) => it.id !== id))
      }, opts.duration || 4000)
    }
    return () => { pushFn = null }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[90%] max-w-sm">
      {items.map((it) => (
        <div
          key={it.id}
          className="flex items-center gap-2 bg-surface-0 shadow-lg rounded-2xl px-3 py-2 border border-primary-light animate-slide-in"
        >
          {it.avatar ? (
            <img src={it.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <span className="text-lg">{it.emoji}</span>
          )}
          <span className="text-sm text-text flex-1">{it.message}</span>
        </div>
      ))}
    </div>
  )
}
