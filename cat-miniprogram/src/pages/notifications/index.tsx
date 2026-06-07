import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../services/api'

const TYPE_ICONS: Record<string, string> = {
  post_like: '❤️',
  post_comment: '💬',
  discovery: '🐾',
  badge: '🏅',
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    getNotifications({ limit: 50 })
      .then((data) => setNotifications(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  })

  async function handleMarkRead(id: number) {
    try {
      await markNotificationRead(id)
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: 'yes' } : n))
    } catch (e) {
      console.error(e)
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 'yes' })))
    } catch (e) {
      console.error(e)
    }
  }

  const unreadCount = notifications.filter((n) => n.is_read === 'no').length

  return (
    <View className='page' style={{ padding: '24rpx' }}>
      <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24rpx' }}>
        <View>
          <Text style={{ fontSize: '36rpx', fontWeight: 'bold', display: 'block' }}>通知</Text>
          <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginTop: '4rpx' }}>
            {unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读'}
          </Text>
        </View>
        {unreadCount > 0 && (
          <View onClick={handleMarkAllRead}
            style={{ backgroundColor: '#FFF7ED', padding: '12rpx 24rpx', borderRadius: '999rpx' }}>
            <Text style={{ fontSize: '24rpx', color: '#F97316', fontWeight: '500' }}>✅ 全部已读</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} className='skeleton' style={{ height: '120rpx', marginBottom: '12rpx' }} />
          ))}
        </View>
      ) : notifications.length > 0 ? (
        notifications.map((n: any) => {
          const icon = TYPE_ICONS[n.type] || '📢'
          const isUnread = n.is_read === 'no'
          return (
            <View key={n.id}
              onClick={() => isUnread && handleMarkRead(n.id)}
              className='card'
              style={{ marginBottom: '12rpx', opacity: isUnread ? 1 : 0.55, backgroundColor: isUnread ? '#FFF7ED' : '#FFFFFF' }}>
              <View style={{ display: 'flex', alignItems: 'flex-start', gap: '16rpx' }}>
                <View style={{ width: '64rpx', height: '64rpx', borderRadius: '50%', backgroundColor: isUnread ? '#FED7AA' : '#F5F5F4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '28rpx' }}>
                  <Text>{icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: '26rpx', fontWeight: isUnread ? '500' : 'normal', display: 'block' }}>{n.title}</Text>
                  {n.content && <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginTop: '4rpx' }}>{n.content}</Text>}
                  <Text style={{ fontSize: '22rpx', color: '#A8A29E', display: 'block', marginTop: '8rpx' }}>{n.createdAt || ''}</Text>
                </View>
              </View>
            </View>
          )
        })
      ) : (
        <View className='card' style={{ textAlign: 'center', padding: '80rpx 24rpx' }}>
          <Text style={{ fontSize: '56rpx', display: 'block' }}>💬</Text>
          <Text style={{ fontSize: '28rpx', color: '#78716C', display: 'block', marginTop: '16rpx' }}>还没有通知</Text>
          <Text style={{ fontSize: '22rpx', color: '#A8A29E', display: 'block', marginTop: '8rpx' }}>当有人点赞或评论你的帖子时会通知你</Text>
        </View>
      )}
    </View>
  )
}
