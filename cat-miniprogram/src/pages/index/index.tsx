import { useState } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getCats, getSightings, getPosts, getUserProfile } from '../../services/api'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深了，猫猫们都睡了'
  if (h < 9) return '早安！今天猫咪们刚醒'
  if (h < 12) return '上午好，去校园找猫吧'
  if (h < 14) return '中午了，猫猫在午睡'
  if (h < 17) return '下午适合去喂猫'
  if (h < 19) return '傍晚是猫猫活跃时间'
  if (h < 22) return '晚上好，猫猫还在散步'
  return '夜深了，猫猫们该休息了'
}

export default function Index() {
  const [cats, setCats] = useState<any[]>([])
  const [featured, setFeatured] = useState<any>(null)
  const [sightings, setSightings] = useState<any[]>([])
  const [postCount, setPostCount] = useState(0)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    Promise.all([
      getCats(),
      getSightings({ limit: 5 }),
      getPosts(),
      getUserProfile().catch(() => null),
    ]).then(([catsData, sightingsData, postsData, userData]) => {
      const arr = Array.isArray(catsData) ? catsData : []
      setCats(arr)
      if (arr.length > 0) setFeatured(arr[Math.floor(Math.random() * arr.length)])
      setSightings(Array.isArray(sightingsData) ? sightingsData : [])
      setPostCount(Array.isArray(postsData) ? postsData.length : 0)
      setProfile(userData)
    }).catch(console.error).finally(() => setLoading(false))
  })

  return (
    <View className='page' style={{ padding: '24rpx' }}>
      <View className='card' style={{ marginBottom: '20rpx' }}>
        <Text style={{ fontSize: '28rpx', color: '#78716C' }}>{greeting()}</Text>
        <Text style={{ fontSize: '40rpx', fontWeight: 'bold', marginTop: '8rpx', display: 'block' }}>
          {profile?.nickname || '猫猫爱好者'}
        </Text>
        <View style={{ display: 'flex', justifyContent: 'space-around', marginTop: '24rpx', paddingTop: '16rpx', borderTop: '1rpx solid #E7E5E4' }}>
          <View style={{ textAlign: 'center' }}>
            <Text style={{ fontSize: '36rpx', fontWeight: 'bold', color: '#F97316', display: 'block' }}>{cats.length}</Text>
            <Text style={{ fontSize: '22rpx', color: '#78716C' }}>认识猫猫</Text>
          </View>
          <View style={{ textAlign: 'center' }}>
            <Text style={{ fontSize: '36rpx', fontWeight: 'bold', color: '#059669', display: 'block' }}>{sightings.length}</Text>
            <Text style={{ fontSize: '22rpx', color: '#78716C' }}>最新偶遇</Text>
          </View>
          <View style={{ textAlign: 'center' }}>
            <Text style={{ fontSize: '36rpx', fontWeight: 'bold', color: '#2563EB', display: 'block' }}>{postCount}</Text>
            <Text style={{ fontSize: '22rpx', color: '#78716C' }}>社区帖子</Text>
          </View>
        </View>
      </View>

      {featured && (
        <View className='card' style={{ marginBottom: '20rpx', display: 'flex', alignItems: 'center', gap: '24rpx' }}
          onClick={() => Taro.navigateTo({ url: `/pages/cat-detail/index?id=${featured.id}` })}>
          <View style={{ width: '128rpx', height: '128rpx', borderRadius: '24rpx', backgroundColor: '#FFF7ED', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {featured.avatar ? <Image src={featured.avatar} mode='aspectFill' style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: '48rpx' }}>🐱</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: '22rpx', color: '#F97316', backgroundColor: '#FFF7ED', padding: '4rpx 16rpx', borderRadius: '999rpx' }}>今日推荐</Text>
            <Text style={{ fontSize: '34rpx', fontWeight: 'bold', marginTop: '8rpx', display: 'block' }}>{featured.name}</Text>
            {featured.location && <Text style={{ fontSize: '24rpx', color: '#78716C', marginTop: '4rpx', display: 'block' }}>📍 {featured.location}</Text>}
          </View>
        </View>
      )}

      <View style={{ display: 'flex', justifyContent: 'space-between', gap: '16rpx', marginBottom: '28rpx' }}>
        <View className='card' style={{ flex: 1, textAlign: 'center', padding: '24rpx' }} onClick={() => Taro.switchTab({ url: '/pages/scan/index' })}>
          <Text style={{ fontSize: '40rpx', display: 'block' }}>📷</Text>
          <Text style={{ fontSize: '24rpx', fontWeight: '500', marginTop: '8rpx' }}>拍照识猫</Text>
        </View>
        <View className='card' style={{ flex: 1, textAlign: 'center', padding: '24rpx' }} onClick={() => Taro.switchTab({ url: '/pages/community/index' })}>
          <Text style={{ fontSize: '40rpx', display: 'block' }}>💬</Text>
          <Text style={{ fontSize: '24rpx', fontWeight: '500', marginTop: '8rpx' }}>进社区</Text>
        </View>
        <View className='card' style={{ flex: 1, textAlign: 'center', padding: '24rpx' }} onClick={() => Taro.switchTab({ url: '/pages/map/index' })}>
          <Text style={{ fontSize: '40rpx', display: 'block' }}>🗺️</Text>
          <Text style={{ fontSize: '24rpx', fontWeight: '500', marginTop: '8rpx' }}>看地图</Text>
        </View>
      </View>

      {cats.length > 0 && (
        <View style={{ marginBottom: '28rpx' }}>
          <Text style={{ fontSize: '32rpx', fontWeight: 'bold', marginBottom: '16rpx', display: 'block' }}>认识的所有猫猫 ({cats.length})</Text>
          <ScrollView scrollX style={{ whiteSpace: 'nowrap', paddingBottom: '8rpx' }}>
            {cats.map((cat: any) => (
              <View key={cat.id} style={{ display: 'inline-block', width: '160rpx', textAlign: 'center', marginRight: '16rpx' }}
                onClick={() => Taro.navigateTo({ url: `/pages/cat-detail/index?id=${cat.id}` })}>
                <View style={{ width: '160rpx', height: '160rpx', borderRadius: '24rpx', backgroundColor: '#FFF7ED', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {cat.avatar ? <Image src={cat.avatar} mode='aspectFill' style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: '48rpx' }}>🐱</Text>}
                </View>
                <Text style={{ fontSize: '24rpx', fontWeight: '500', marginTop: '8rpx', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {sightings.length > 0 && (
        <View style={{ marginBottom: '28rpx' }}>
          <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16rpx' }}>
            <Text style={{ fontSize: '32rpx', fontWeight: 'bold' }}>最近偶遇</Text>
            <Text style={{ fontSize: '24rpx', color: '#F97316' }} onClick={() => Taro.navigateTo({ url: '/pages/feed/index' })}>查看全部 →</Text>
          </View>
          {sightings.slice(0, 3).map((s: any) => (
            <View key={s.id} className='card' style={{ marginBottom: '12rpx', padding: '24rpx' }}>
              <Text style={{ fontSize: '26rpx', fontWeight: '500' }}>{s.cat?.name || '校园猫猫'}</Text>
              <Text style={{ fontSize: '24rpx', color: '#78716C' }}> · {s.location_name || s.location || '校园某处'}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
