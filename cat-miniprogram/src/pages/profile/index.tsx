import { useState } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getUserProfile, getCats, getFollowedCats, getStoredUser } from '../../services/api'

const BADGE_NAMES: Record<string, string> = {
  first_sighting: '初次偶遇', cat_observer: '观察员', cat_expert: '专家',
  first_post: '首帖', community_helper: '热心人', community_star: '社区之星',
  cat_collector: '收藏家', cat_master: '大师', new_cat_finder: '发现者',
  photography_first: '摄影', map_explorer: '探索者', collection_complete: '全收集',
}

export default function Profile() {
  const [user, setUser] = useState<any>(null)
  const [cats, setCats] = useState<any[]>([])
  const [followedCats, setFollowedCats] = useState<any[]>([])
  const [badges, setBadges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)

  useDidShow(() => {
    const storedUser = getStoredUser()
    if (!storedUser) {
      setAuthError(true)
      setLoading(false)
      return
    }
    setAuthError(false)
    Promise.all([
      getUserProfile(),
      getCats(),
      getFollowedCats().catch(() => []),
    ]).then(([userData, catsData, followedData]) => {
      setUser(userData)
      setCats(Array.isArray(catsData) ? catsData : [])
      setFollowedCats(Array.isArray(followedData) ? followedData : [])
      setBadges(userData?.badges || [])
    }).catch((err) => {
      if (err.message?.includes('401') || err.message?.includes('Not authenticated')) {
        setAuthError(true)
      }
    }).finally(() => setLoading(false))
  })

  if (authError) {
    return (
      <View className='page' style={{ padding: '24rpx' }}>
        <View className='card' style={{ textAlign: 'center', padding: '80rpx 24rpx' }}>
          <Text style={{ fontSize: '56rpx', display: 'block' }}>🐱</Text>
          <Text style={{ fontSize: '32rpx', fontWeight: 'bold', marginTop: '24rpx', display: 'block' }}>请先登录</Text>
          <Text style={{ fontSize: '26rpx', color: '#78716C', marginTop: '12rpx', display: 'block' }}>登录后查看个人资料、勋章和猫档案</Text>
          <View onClick={() => Taro.navigateTo({ url: '/pages/admin/index' })}
            style={{ backgroundColor: '#F97316', color: '#fff', borderRadius: '999rpx', padding: '24rpx 48rpx', display: 'inline-block', marginTop: '32rpx', fontSize: '28rpx' }}>
            去登录
          </View>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View className='page' style={{ padding: '24rpx' }}>
        <View className='card' style={{ marginBottom: '24rpx' }}>
          <View style={{ display: 'flex', alignItems: 'center', gap: '24rpx' }}>
            <View className='skeleton' style={{ width: '128rpx', height: '128rpx', borderRadius: '50%' }} />
            <View style={{ flex: 1 }}>
              <View className='skeleton' style={{ height: '40rpx', width: '60%', marginBottom: '12rpx' }} />
              <View className='skeleton' style={{ height: '28rpx', width: '40%' }} />
            </View>
          </View>
        </View>
        <View className='skeleton' style={{ height: '200rpx', marginBottom: '24rpx' }} />
        <View style={{ display: 'flex', gap: '16rpx' }}>
          <View className='skeleton' style={{ flex: 1, height: '300rpx' }} />
          <View className='skeleton' style={{ flex: 1, height: '300rpx' }} />
        </View>
      </View>
    )
  }

  const earnedBadges = badges.filter((b: any) => b.earned)
  const badgeStats = user?.stats || {}
  const totalBadges = badgeStats.total_badges || 12

  function badgeSummary() {
    const count = earnedBadges.length
    if (count === 0) return '快去完成任务获得勋章吧'
    if (count === totalBadges) return '全部收集完成！'
    return `已获得 ${count}/${totalBadges}`
  }

  return (
    <View className='page' style={{ padding: '24rpx', paddingBottom: '48rpx' }}>
      <View className='card' style={{ marginBottom: '24rpx' }}>
        <View style={{ display: 'flex', alignItems: 'center', gap: '24rpx' }}>
          <View style={{ width: '128rpx', height: '128rpx', borderRadius: '50%', backgroundColor: '#FFF7ED', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {user?.avatar ? <Image src={user.avatar} mode='aspectFill' style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: '56rpx' }}>🐱</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: '36rpx', fontWeight: 'bold', display: 'block' }}>{user?.nickname || '猫猫爱好者'}</Text>
            <Text style={{ fontSize: '26rpx', color: '#78716C', display: 'block', marginTop: '4rpx' }}>
              {cats.length > 0 ? `已经认识了 ${cats.length} 只校园猫猫` : '还没有认识的猫猫'}
            </Text>
          </View>
        </View>
        <View style={{ display: 'flex', justifyContent: 'space-around', marginTop: '32rpx', paddingTop: '24rpx', borderTop: '1rpx solid #E7E5E4' }}>
          <View style={{ textAlign: 'center' }}>
            <Text style={{ fontSize: '34rpx', fontWeight: 'bold', color: '#F97316', display: 'block' }}>{badgeStats.sightings || 0}</Text>
            <Text style={{ fontSize: '22rpx', color: '#78716C' }}>偶遇次数</Text>
          </View>
          <View style={{ textAlign: 'center' }}>
            <Text style={{ fontSize: '34rpx', fontWeight: 'bold', color: '#F97316', display: 'block' }}>{badgeStats.locations_count || 0}</Text>
            <Text style={{ fontSize: '22rpx', color: '#78716C' }}>出没地点</Text>
          </View>
          <View style={{ textAlign: 'center' }}>
            <Text style={{ fontSize: '34rpx', fontWeight: 'bold', color: '#F97316', display: 'block' }}>{badgeStats.badges_count || 0}</Text>
            <Text style={{ fontSize: '22rpx', color: '#78716C' }}>勋章</Text>
          </View>
        </View>
      </View>

      <View style={{ marginBottom: '24rpx' }} onClick={() => Taro.navigateTo({ url: '/pages/badges/index' })}>
        <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16rpx' }}>
          <Text style={{ fontSize: '32rpx', fontWeight: 'bold' }}>🏆 勋章墙</Text>
          <Text style={{ fontSize: '24rpx', color: '#F97316' }}>{badgeSummary()} ›</Text>
        </View>
        {earnedBadges.length > 0 ? (
          <ScrollView scrollX style={{ whiteSpace: 'nowrap', paddingBottom: '8rpx' }}>
            {earnedBadges.slice(0, 8).map((b: any) => (
              <View key={b.badge_key} style={{ display: 'inline-block', width: '112rpx', height: '112rpx', borderRadius: '24rpx', backgroundColor: '#FFF7ED', marginRight: '12rpx', textAlign: 'center', padding: '16rpx 0' }}>
                <Text style={{ fontSize: '36rpx', display: 'block' }}>🏅</Text>
                <Text style={{ fontSize: '18rpx', color: '#78716C', display: 'block', marginTop: '4rpx' }}>{BADGE_NAMES[b.badge_key] || b.badge_key}</Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View className='card' style={{ textAlign: 'center', padding: '40rpx' }}>
            <Text style={{ fontSize: '40rpx', display: 'block' }}>🐾</Text>
            <Text style={{ fontSize: '24rpx', color: '#78716C', marginTop: '12rpx', display: 'block' }}>还没有获得勋章，去社区发帖或记录偶遇来获取吧</Text>
          </View>
        )}
      </View>

      <View style={{ marginBottom: '24rpx' }}>
        <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16rpx' }}>
          <Text style={{ fontSize: '32rpx', fontWeight: 'bold' }}>我的猫档案</Text>
          <Text style={{ fontSize: '24rpx', color: '#78716C' }}>{cats.length} 只</Text>
        </View>
        {cats.length > 0 ? (
          <View style={{ display: 'flex', flexWrap: 'wrap', gap: '16rpx' }}>
            {cats.map((cat: any) => (
              <View key={cat.id} style={{ width: 'calc(50% - 8rpx)' }} onClick={() => Taro.navigateTo({ url: `/pages/cat-detail/index?id=${cat.id}` })}>
                <View className='card' style={{ padding: 0, overflow: 'hidden' }}>
                  <View style={{ width: '100%', height: '260rpx', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {cat.avatar ? <Image src={cat.avatar} mode='aspectFill' style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: '64rpx' }}>🐱</Text>}
                  </View>
                  <View style={{ padding: '16rpx 20rpx' }}>
                    <Text style={{ fontSize: '26rpx', fontWeight: '500', display: 'block' }}>{cat.name}</Text>
                    {cat.location && <Text style={{ fontSize: '22rpx', color: '#A8A29E', display: 'block' }}>📍 {cat.location}</Text>}
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className='card' style={{ textAlign: 'center', padding: '48rpx' }}>
            <Text style={{ fontSize: '48rpx', display: 'block' }}>🐱</Text>
            <Text style={{ fontSize: '26rpx', color: '#78716C', marginTop: '12rpx', display: 'block' }}>还没有解锁猫猫</Text>
            <Text style={{ fontSize: '22rpx', color: '#A8A29E', marginTop: '8rpx', display: 'block' }}>去首页拍照，发现校园里的猫吧！</Text>
          </View>
        )}
      </View>

      <View>
        <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16rpx' }}>
          <Text style={{ fontSize: '32rpx', fontWeight: 'bold' }}>关注的猫猫</Text>
          <Text style={{ fontSize: '24rpx', color: '#78716C' }}>{followedCats.length} 只</Text>
        </View>
        {followedCats.length > 0 ? (
          <ScrollView scrollX style={{ whiteSpace: 'nowrap', paddingBottom: '8rpx' }}>
            {followedCats.map((cat: any) => (
              <View key={cat.id} style={{ display: 'inline-block', width: '160rpx', textAlign: 'center', marginRight: '16rpx' }}
                onClick={() => Taro.navigateTo({ url: `/pages/cat-detail/index?id=${cat.cat_id}` })}>
                <View style={{ width: '160rpx', height: '160rpx', borderRadius: '24rpx', backgroundColor: '#FFF7ED', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {cat.cat_avatar ? <Image src={cat.cat_avatar} mode='aspectFill' style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: '48rpx' }}>🐱</Text>}
                </View>
                <Text style={{ fontSize: '24rpx', fontWeight: '500', marginTop: '8rpx', display: 'block' }}>{cat.cat_name}</Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View className='card' style={{ textAlign: 'center', padding: '40rpx' }}>
            <Text style={{ fontSize: '40rpx', display: 'block' }}>🐱</Text>
            <Text style={{ fontSize: '24rpx', color: '#78716C', marginTop: '12rpx', display: 'block' }}>去猫猫档案页关注你喜欢的猫吧</Text>
          </View>
        )}
      </View>
    </View>
  )
}
