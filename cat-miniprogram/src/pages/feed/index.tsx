import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getSightings } from '../../services/api'
import { ACTIVITY_TYPES } from '../../config'

function formatTime(value: string) {
  if (!value) return ''
  const d = new Date(value)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function Feed() {
  const [sightings, setSightings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    setLoading(true)
    getSightings({ limit: 30 })
      .then((data) => setSightings(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  })

  function getActivityBadge(activityType: string) {
    const found = ACTIVITY_TYPES.find(t => t.value === activityType)
    return found ? `activity-badge-${activityType}` : ''
  }

  return (
    <View className='page' style={{ padding: '24rpx' }}>
      <Text style={{ fontSize: '36rpx', fontWeight: 'bold', display: 'block', marginBottom: '8rpx' }}>偶遇动态</Text>
      <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginBottom: '24rpx' }}>校园猫咪时间线</Text>

      {loading ? (
        <View style={{ textAlign: 'center', padding: '80rpx 0' }}>
          <Text style={{ fontSize: '48rpx', display: 'block' }}>🐾</Text>
          <Text style={{ fontSize: '28rpx', color: '#A8A29E', display: 'block', marginTop: '16rpx' }}>加载动态中…</Text>
        </View>
      ) : sightings.length > 0 ? (
        sightings.map((s: any) => {
          const activity = ACTIVITY_TYPES.find(t => t.value === s.activity_type)
          return (
            <View key={s.id} className='card' style={{ marginBottom: '16rpx' }}>
              <View style={{ display: 'flex', gap: '16rpx' }}>
                <View style={{ width: '80rpx', height: '80rpx', borderRadius: '20rpx', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '36rpx' }}>
                  {s.cat?.avatar ? <Image src={s.cat.avatar} mode='aspectFill' style={{ width: '100%', height: '100%', borderRadius: '20rpx' }} /> : '🐱'}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: '28rpx', fontWeight: '500', display: 'block' }}
                      onClick={() => s.cat?.id && Taro.navigateTo({ url: `/pages/cat-detail/index?id=${s.cat.id}` })}>
                      {s.cat?.name || '校园猫猫'}
                    </Text>
                    <Text style={{ fontSize: '22rpx', color: '#A8A29E' }}>{formatTime(s.created_at)}</Text>
                  </View>
                  <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginTop: '4rpx' }}>
                    📍 {s.location_name || s.location || '校园某处'}
                  </Text>
                  {activity && (
                    <Text className={`activity-badge ${getActivityBadge(activity.value)}`} style={{ marginTop: '8rpx' }}>
                      {activity.emoji} {activity.label}
                    </Text>
                  )}
                  {s.note && <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginTop: '8rpx' }}>"{s.note}"</Text>}
                  {s.spotted_by && (
                    <Text style={{ fontSize: '22rpx', color: '#A8A29E', display: 'block', marginTop: '4rpx' }}>记录者：{s.spotted_by}</Text>
                  )}
                </View>
              </View>
            </View>
          )
        })
      ) : (
        <View className='card' style={{ textAlign: 'center', padding: '80rpx 24rpx' }}>
          <Text style={{ fontSize: '56rpx', display: 'block' }}>🐱</Text>
          <Text style={{ fontSize: '28rpx', fontWeight: '500', color: '#78716C', display: 'block', marginTop: '16rpx' }}>还没有偶遇记录</Text>
          <View onClick={() => Taro.switchTab({ url: '/pages/scan/index' })}
            style={{ backgroundColor: '#F97316', color: '#fff', borderRadius: '999rpx', padding: '20rpx 48rpx', display: 'inline-block', marginTop: '24rpx', fontSize: '28rpx' }}>
            去拍第一张
          </View>
        </View>
      )}
    </View>
  )
}
