import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api'

const TYPE_ICONS = {
  post_like: '🧡',
  post_comment: '💬',
  discovery: '🐾',
  badge: '🏅',
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getNotifications({ limit: 50 })
      .then((data) => setNotifications(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleMarkRead(id) {
    try {
      await markNotificationRead(id)
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: 'yes' } : n))
    } catch (e) { console.error(e) }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 'yes' })))
    } catch (e) { console.error(e) }
  }

  const unreadCount = notifications.filter((n) => n.is_read === 'no').length

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="sticky top-0 z-40 bg-warm-50/80 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 rounded-lg hover:bg-primary-light">
            <ArrowLeft className="w-5 h-5 text-text" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-text">通知</h1>
            <p className="text-xs text-text-secondary">
              {unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="text-xs text-primary font-medium flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5" />
            全部标为已读
          </button>
        )}
      </header>

      <div className="p-4 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton" />)}
          </div>
        ) : notifications.length > 0 ? (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => n.is_read === 'no' && handleMarkRead(n.id)}
              className={`card flex items-start gap-3 cursor-pointer transition-opacity ${
                n.is_read === 'no' ? 'border-l-4 border-l-primary' : 'opacity-60'
              }`}
            >
              <span className="text-xl shrink-0 mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">{n.title}</p>
                {n.content && <p className="text-xs text-text-secondary mt-0.5">{n.content}</p>}
                <p className="text-[10px] text-text-muted mt-1">{n.createdAt || ''}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="card p-8 text-center space-y-2">
            <Bell className="w-8 h-8 text-text-muted mx-auto" />
            <p className="text-sm text-text-secondary">还没有通知</p>
            <p className="text-xs text-text-muted">当有人点赞或评论你的帖子时会通知你</p>
          </div>
        )}
      </div>
    </div>
  )
}
