import { useEffect, useState } from 'react'
import { CheckCheck, Heart, MessageCircle, Eye, PawPrint, Award } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api'

const TYPE_ICONS = {
  post_like: Heart,
  post_comment: MessageCircle,
  discovery: PawPrint,
  badge: Award,
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

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
      <PageHeader
        title="通知"
        subtitle={unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读'}
        action={unreadCount > 0 ? (
          <button onClick={handleMarkAllRead} className="text-xs text-primary font-medium flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5" />
            全部已读
          </button>
        ) : null}
      />

      <div className="p-4 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton" />)}
          </div>
        ) : notifications.length > 0 ? (
          notifications.map((n) => {
            const IconComp = TYPE_ICONS[n.type] || Heart
            return (
            <div
              key={n.id}
              onClick={() => n.is_read === 'no' && handleMarkRead(n.id)}
              className={`card flex items-start gap-3 cursor-pointer transition-opacity ${
                n.is_read === 'no' ? 'bg-primary-light/50 border-primary-light' : 'opacity-60'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-primary-light/60 flex items-center justify-center shrink-0 mt-0.5">
                <IconComp className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">{n.title}</p>
                {n.content && <p className="text-xs text-text-secondary mt-0.5">{n.content}</p>}
                <p className="text-xs text-text-muted mt-1">{n.createdAt || ''}</p>
              </div>
            </div>
          )
          })
        ) : (
          <div className="card p-8 text-center space-y-2">
            <MessageCircle className="w-10 h-10 text-text-muted mx-auto" />
            <p className="text-sm text-text-secondary">还没有通知</p>
            <p className="text-xs text-text-muted">当有人点赞或评论你的帖子时会通知你</p>
          </div>
        )}
      </div>
    </div>
  )
}
