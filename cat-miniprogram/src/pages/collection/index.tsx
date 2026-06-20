import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getCats, getFollowedCats } from '../../services/api'

export default function Collection() {
  const [cats, setCats] = useState<any[]>([])
  const [followedIds, setFollowedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    Promise.all([
      getCats(),
      getFollowedCats().catch(() => []),
    ]).then(([catsData, followedData]) => {
      const catList = Array.isArray(catsData) ? catsData : []
      const followed = Array.isArray(followedData) ? followedData : []
      setCats(catList)
      setFollowedIds(new Set(followed.map((f: any) => f.cat_id)))
    }).catch(console.error)
      .finally(() => setLoading(false))
  })

  if (loading) {
    return (
      <View style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Text style={{ fontSize: '28rpx', color: '#A8A29E' }}>加载中...</Text>
      </View>
    )
  }

  const met = cats.filter((c: any) => followedIds.has(c.id))
  const total = cats.length

  return (
    <View className='page' style={{ padding: '24rpx' }}>
      <View style={{ backgroundColor: '#059669', padding: '32rpx 24rpx', borderRadius: '24rpx', marginBottom: '24rpx' }}>
        <Text style={{ fontSize: '36rpx', fontWeight: 'bold', color: '#fff' }}>猫猫图鉴</Text>
        <Text style={{ fontSize: '24rpx', color: 'rgba(255,255,255,0.8)', marginTop: '4rpx', display: 'block' }}>已相遇 {met.length}/{total} 只校园猫猫</Text>
      </View>

      {cats.length > 0 ? (
        <View style={{ display: 'flex', flexWrap: 'wrap', gap: '16rpx' }}>
          {cats.map((cat: any) => {
            const isMet = followedIds.has(cat.id)
            return (
              <View key={cat.id} style={{ width: 'calc(50% - 8rpx)' }} onClick={() => Taro.navigateTo({ url: `/pages/cat-detail/index?id=${cat.id}` })}>
                <View className='card' style={{ padding: 0, overflow: 'hidden', opacity: isMet ? 1 : 0.6 }}>
                  <View style={{ width: '100%', height: '260rpx', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {cat.avatar ? <Image src={cat.avatar} mode='aspectFill' style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: '64rpx' }}>🐱</Text>}
                    {isMet && (
                      <View style={{ position: 'absolute', top: '8rpx', right: '8rpx', backgroundColor: '#059669', color: '#fff', fontSize: '20rpx', padding: '4rpx 12rpx', borderRadius: '999rpx' }}>
                        已相遇
                      </View>
                    )}
                    {!isMet && (
                      <View style={{ position: 'absolute', top: '8rpx', right: '8rpx', backgroundColor: '#78716C', color: '#fff', fontSize: '20rpx', padding: '4rpx 12rpx', borderRadius: '999rpx' }}>
                        未相遇
                      </View>
                    )}
                  </View>
                  <View style={{ padding: '16rpx 20rpx' }}>
                    <Text style={{ fontSize: '26rpx', fontWeight: '500', display: 'block' }}>{cat.name}</Text>
                    {cat.location && <Text style={{ fontSize: '22rpx', color: '#A8A29E', display: 'block' }}>📍 {cat.location}</Text>}
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      ) : (
        <View className='card' style={{ textAlign: 'center', padding: '80rpx 24rpx' }}>
          <Text style={{ fontSize: '56rpx', display: 'block' }}>📖</Text>
          <Text style={{ fontSize: '28rpx', color: '#78716C', marginTop: '16rpx', display: 'block' }}>还没有猫猫档案</Text>
        </View>
      )}
    </View>
  )
}
