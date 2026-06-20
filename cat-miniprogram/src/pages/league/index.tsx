import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { getLeaderboard } from '../../services/api'

const TIER_COLORS: Record<string, string> = {
  '大师': '#F97316',
  '专家': '#7C3AED',
  '观察员': '#059669',
  '新手': '#78716C',
}

const TIER_EMOJI: Record<string, string> = {
  '大师': '👑',
  '专家': '🌟',
  '观察员': '🔍',
  '新手': '🌱',
}

export default function League() {
  const [leaders, setLeaders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useDidShow(() => {
    setLoading(true)
    setError('')
    getLeaderboard()
      .then((data) => setLeaders(Array.isArray(data) ? data : []))
      .catch((e) => setError('加载失败，请稍后重试'))
      .finally(() => setLoading(false))
  })

  if (loading) {
    return (
      <View style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Text style={{ fontSize: '28rpx', color: '#A8A29E' }}>加载中...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '48rpx' }}>
        <Text style={{ fontSize: '56rpx', display: 'block' }}>😿</Text>
        <Text style={{ fontSize: '28rpx', color: '#78716C', marginTop: '16rpx' }}>{error}</Text>
      </View>
    )
  }

  return (
    <View className='page' style={{ padding: '24rpx' }}>
      <View style={{ backgroundColor: '#F97316', padding: '32rpx 24rpx', borderRadius: '24rpx', marginBottom: '24rpx' }}>
        <Text style={{ fontSize: '36rpx', fontWeight: 'bold', color: '#fff' }}>排行榜</Text>
        <Text style={{ fontSize: '24rpx', color: 'rgba(255,255,255,0.8)', marginTop: '4rpx', display: 'block' }}>校园猫猫爱好者段位排行</Text>
      </View>

      {leaders.length > 0 ? leaders.map((item: any, idx: number) => (
        <View key={item.user_id || idx} className='card' style={{ marginBottom: '16rpx', display: 'flex', alignItems: 'center', gap: '20rpx' }}>
          <View style={{
            width: '64rpx', height: '64rpx', borderRadius: '50%',
            backgroundColor: idx === 0 ? '#FEF3C7' : idx === 1 ? '#F5F5F4' : idx === 2 ? '#FFF7ED' : '#F5F5F4',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Text style={{ fontSize: '28rpx', fontWeight: 'bold', color: idx < 3 ? '#F97316' : '#78716C' }}>
              {idx + 1}
            </Text>
          </View>
          <View style={{ width: '80rpx', height: '80rpx', borderRadius: '50%', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {item.avatar ? <Image src={item.avatar} mode='aspectFill' style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : <Text style={{ fontSize: '36rpx' }}>🐱</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: '28rpx', fontWeight: '500', display: 'block' }}>{item.nickname || '铲屎官'}</Text>
            <Text style={{ fontSize: '22rpx', color: TIER_COLORS[item.tier] || '#78716C', display: 'block', marginTop: '4rpx' }}>{TIER_EMOJI[item.tier] || ''} {item.tier || '新手'}</Text>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text style={{ fontSize: '30rpx', fontWeight: 'bold', color: '#F97316', display: 'block' }}>{item.xp || 0}</Text>
            <Text style={{ fontSize: '20rpx', color: '#A8A29E' }}>XP</Text>
          </View>
        </View>
      )) : (
        <View className='card' style={{ textAlign: 'center', padding: '80rpx 24rpx' }}>
          <Text style={{ fontSize: '56rpx', display: 'block' }}>🏆</Text>
          <Text style={{ fontSize: '28rpx', color: '#78716C', marginTop: '16rpx', display: 'block' }}>暂无排行数据</Text>
        </View>
      )}
    </View>
  )
}
