import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { getWeeklyReport } from '../../services/api'

export default function WeeklyReport() {
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    getWeeklyReport()
      .then(setReport)
      .catch(console.error)
      .finally(() => setLoading(false))
  })

  return (
    <View className='page' style={{ padding: '24rpx' }}>
      <Text style={{ fontSize: '36rpx', fontWeight: 'bold', display: 'block', marginBottom: '24rpx' }}>本周报告</Text>

      {loading ? (
        <View>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} className='skeleton' style={{ height: '120rpx', marginBottom: '16rpx' }} />
          ))}
        </View>
      ) : report ? (
        <View>
          <View style={{ backgroundColor: '#F97316', borderRadius: '24rpx', padding: '40rpx', marginBottom: '24rpx' }}>
            <Text style={{ fontSize: '24rpx', color: 'rgba(255,255,255,0.8)', display: 'block' }}>本周小结</Text>
            <Text style={{ fontSize: '36rpx', fontWeight: 'bold', color: '#fff', display: 'block', marginTop: '8rpx' }}>
              {report.week_start?.substring(0, 10)} ~ {report.week_end?.substring(0, 10)}
            </Text>
          </View>

          <View style={{ display: 'flex', flexWrap: 'wrap', gap: '16rpx', marginBottom: '24rpx' }}>
            <View className='card' style={{ width: 'calc(50% - 8rpx)', textAlign: 'center', padding: '32rpx' }}>
              <Text style={{ fontSize: '44rpx', fontWeight: 'bold', color: '#F97316', display: 'block' }}>{report.total_sightings || 0}</Text>
              <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginTop: '8rpx' }}>本周偶遇</Text>
            </View>
            <View className='card' style={{ width: 'calc(50% - 8rpx)', textAlign: 'center', padding: '32rpx' }}>
              <Text style={{ fontSize: '44rpx', fontWeight: 'bold', color: '#059669', display: 'block' }}>{report.unique_cats || 0}</Text>
              <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginTop: '8rpx' }}>遇到不同猫</Text>
            </View>
            <View className='card' style={{ width: 'calc(50% - 8rpx)', textAlign: 'center', padding: '32rpx' }}>
              <Text style={{ fontSize: '44rpx', fontWeight: 'bold', color: '#2563EB', display: 'block' }}>{report.streak_days || 0}</Text>
              <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginTop: '8rpx' }}>连续天数</Text>
            </View>
            <View className='card' style={{ width: 'calc(50% - 8rpx)', textAlign: 'center', padding: '32rpx' }}>
              <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8rpx' }}>
                <Text style={{ fontSize: '44rpx', fontWeight: 'bold', display: 'block' }}>{report.last_week_count || 0}</Text>
                <Text style={{ fontSize: '28rpx' }}>
                  {report.trend === 'up' ? '📈' : report.trend === 'down' ? '📉' : '➖'}
                </Text>
              </View>
              <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginTop: '8rpx' }}>上周对比</Text>
            </View>
          </View>

          {report.top_location && (
            <View className='card' style={{ marginBottom: '24rpx' }}>
              <Text style={{ fontSize: '24rpx', color: '#A8A29E', display: 'block' }}>最常出没地点</Text>
              <Text style={{ fontSize: '34rpx', fontWeight: 'bold', display: 'block', marginTop: '8rpx' }}>{report.top_location}</Text>
              <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginTop: '4rpx' }}>
                本周出现 {report.top_location_count} 次
              </Text>
            </View>
          )}

          <View className='card' style={{ marginBottom: '24rpx' }}>
            <Text style={{ fontSize: '24rpx', color: '#A8A29E', display: 'block' }}>数据说明</Text>
            <Text style={{ fontSize: '26rpx', color: '#78716C', lineHeight: '44rpx', display: 'block', marginTop: '12rpx' }}>
              本周你共记录了 {report.total_sightings ?? 0} 次偶遇，遇见了 {report.unique_cats ?? 0} 只不同的猫猫。
              {report.streak_days > 1 ? ` 连续 ${report.streak_days} 天都有记录，继续保持！` : ' 明天也要去校园转转哦'}
            </Text>
          </View>

          {report.top_cats?.length > 0 && (
            <View>
              <Text style={{ fontSize: '28rpx', fontWeight: 'bold', marginBottom: '16rpx', display: 'block' }}>本周最常遇到</Text>
              {report.top_cats.map((cat: any, i: number) => (
                <View key={i} className='card' style={{ marginBottom: '12rpx', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: '26rpx', fontWeight: '500' }}>🐱 {cat.name}</Text>
                  <Text style={{ fontSize: '24rpx', color: '#78716C' }}>{cat.count} 次</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View className='card' style={{ textAlign: 'center', padding: '80rpx 24rpx' }}>
          <Text style={{ fontSize: '56rpx', display: 'block' }}>📊</Text>
          <Text style={{ fontSize: '28rpx', color: '#78716C', display: 'block', marginTop: '16rpx' }}>暂无本周数据</Text>
        </View>
      )}
    </View>
  )
}
