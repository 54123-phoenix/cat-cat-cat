import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { getBadges } from '../../services/api'

const SERIES_LABELS: Record<string, string> = {
  sighting: '偶遇系列',
  community: '社区系列',
  collect: '收集系列',
  special: '特殊成就',
}

export default function BadgeGallery() {
  const [badges, setBadges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    getBadges()
      .then((data) => {
        if (Array.isArray(data)) setBadges(data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  })

  const earned = badges.filter((b: any) => b.earned).length
  const total = badges.length

  const grouped: Record<string, any[]> = {}
  badges.forEach((b: any) => {
    const series = b.series || 'special'
    if (!grouped[series]) grouped[series] = []
    grouped[series].push(b)
  })

  return (
    <View className='page' style={{ padding: '24rpx' }}>
      <Text style={{ fontSize: '36rpx', fontWeight: 'bold', display: 'block', marginBottom: '8rpx' }}>勋章库</Text>
      <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginBottom: '24rpx' }}>
        {loading ? '加载中…' : `已获得 ${earned}/${total}`}
      </Text>

      {loading ? (
        <View>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={{ marginBottom: '32rpx' }}>
              <View className='skeleton' style={{ height: '40rpx', width: '160rpx', marginBottom: '16rpx' }} />
              {[1, 2, 3].map((j) => (
                <View key={j} className='skeleton' style={{ height: '120rpx', marginBottom: '12rpx' }} />
              ))}
            </View>
          ))}
        </View>
      ) : badges.length > 0 ? (
        Object.entries(grouped).map(([seriesKey, items]) => (
          <View key={seriesKey} style={{ marginBottom: '40rpx' }}>
            <Text style={{ fontSize: '28rpx', fontWeight: 'bold', marginBottom: '16rpx', display: 'block' }}>
              🏆 {SERIES_LABELS[seriesKey] || seriesKey}
            </Text>
            {items.map((badge: any) => {
              const isEarned = badge.earned
              const pct = badge.progress_total > 0
                ? Math.round((badge.progress_current / badge.progress_total) * 100)
                : 0
              return (
                <View key={badge.badge_key} className='card' style={{ marginBottom: '12rpx', opacity: isEarned ? 1 : 0.55 }}>
                  <View style={{ display: 'flex', alignItems: 'center', gap: '20rpx' }}>
                    <View style={{
                      width: '88rpx', height: '88rpx', borderRadius: '20rpx',
                      backgroundColor: isEarned ? '#FFF7ED' : '#F5F5F4',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '36rpx', flexShrink: 0,
                    }}>
                      <Text>{isEarned ? '🏅' : '🔒'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: '28rpx', fontWeight: '500', display: 'block' }}>{badge.name}</Text>
                        {isEarned && <Text style={{ fontSize: '22rpx', color: '#059669', fontWeight: '500' }}>已获得</Text>}
                      </View>
                      <Text style={{ fontSize: '22rpx', color: '#78716C', display: 'block', marginTop: '4rpx' }}>{badge.condition_text}</Text>
                      {!isEarned && badge.progress_total > 1 && (
                        <View style={{ display: 'flex', alignItems: 'center', gap: '12rpx', marginTop: '12rpx' }}>
                          <View style={{ flex: 1, height: '10rpx', backgroundColor: '#F5F5F4', borderRadius: '5rpx', overflow: 'hidden' }}>
                            <View style={{ height: '100%', width: `${pct}%`, backgroundColor: '#F97316', borderRadius: '5rpx' }} />
                          </View>
                          <Text style={{ fontSize: '22rpx', color: '#A8A29E' }}>{badge.progress_current}/{badge.progress_total}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        ))
      ) : (
        <View className='card' style={{ textAlign: 'center', padding: '80rpx 24rpx' }}>
          <Text style={{ fontSize: '56rpx', display: 'block' }}>🏅</Text>
          <Text style={{ fontSize: '28rpx', color: '#78716C', display: 'block', marginTop: '16rpx' }}>暂无勋章数据</Text>
        </View>
      )}
    </View>
  )
}
