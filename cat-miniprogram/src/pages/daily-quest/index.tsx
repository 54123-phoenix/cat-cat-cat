import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { getDailyQuest } from '../../services/api'

export default function DailyQuest() {
  const [quests, setQuests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    getDailyQuest()
      .then((data: any) => setQuests(data?.quests || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  })

  if (loading) {
    return (
      <View style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Text style={{ fontSize: '28rpx', color: '#A8A29E' }}>加载中...</Text>
      </View>
    )
  }

  return (
    <View className='page' style={{ padding: '24rpx' }}>
      <View style={{ backgroundColor: '#7C3AED', padding: '32rpx 24rpx', borderRadius: '24rpx', marginBottom: '24rpx' }}>
        <Text style={{ fontSize: '36rpx', fontWeight: 'bold', color: '#fff' }}>每日任务</Text>
        <Text style={{ fontSize: '24rpx', color: 'rgba(255,255,255,0.8)', marginTop: '4rpx', display: 'block' }}>完成任务获取经验值</Text>
      </View>

      {quests.length > 0 ? quests.map((q: any) => {
        const pct = Math.min(100, Math.round(((q.progress || 0) / (q.target || 1)) * 100))
        const done = pct >= 100
        return (
          <View key={q.id} className='card' style={{ marginBottom: '16rpx' }}>
            <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12rpx' }}>
              <Text style={{ fontSize: '28rpx', fontWeight: '500' }}>{q.title}</Text>
              <Text style={{ fontSize: '22rpx', color: done ? '#059669' : '#F97316', fontWeight: '500' }}>
                {done ? '已完成' : `+${q.reward} XP`}
              </Text>
            </View>
            <View style={{ width: '100%', height: '16rpx', borderRadius: '8rpx', backgroundColor: '#F5F5F4', overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: '100%', borderRadius: '8rpx', backgroundColor: done ? '#059669' : '#F97316' }} />
            </View>
            <Text style={{ fontSize: '22rpx', color: '#A8A29E', marginTop: '8rpx', display: 'block' }}>
              {q.progress || 0}/{q.target || 1}
            </Text>
          </View>
        )
      }) : (
        <View className='card' style={{ textAlign: 'center', padding: '80rpx 24rpx' }}>
          <Text style={{ fontSize: '56rpx', display: 'block' }}>📋</Text>
          <Text style={{ fontSize: '28rpx', color: '#78716C', marginTop: '16rpx', display: 'block' }}>暂无每日任务</Text>
        </View>
      )}
    </View>
  )
}
