import { useState } from 'react'
import { View, Text, Image, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getCats, getFollowedCats, getSightings } from '../../services/api'

const RARE_CHARS = ['稀', '珍', '白', '黑', '三花', '玳瑁']

const MILESTONES = [
  { count: 5, label: '初遇', emoji: '🌱' },
  { count: 10, label: '熟识', emoji: '🌿' },
  { count: 20, label: '猫友', emoji: '🐾' },
  { count: 30, label: '猫达人', emoji: '🏅' },
  { count: 50, label: '猫博士', emoji: '🎓' },
]

function isRareCat(cat: any, metIds: Set<number>) {
  if (cat.sightings_count !== undefined && cat.sightings_count < 3) return true
  if (metIds.has(cat.id) && (cat.sightings_count === undefined || cat.sightings_count < 5)) return true
  const name = cat.name || ''
  return RARE_CHARS.some((c) => name.includes(c))
}

export default function Collection() {
  const [cats, setCats] = useState<any[]>([])
  const [followedIds, setFollowedIds] = useState<Set<number>>(new Set())
  const [metIds, setMetIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useDidShow(() => {
    Promise.all([
      getCats(),
      getFollowedCats().catch(() => []),
      getSightings({ limit: 200 }).catch(() => []),
    ]).then(([catsData, followedData, sightingsData]) => {
      const catList = Array.isArray(catsData) ? catsData : []
      const followed = Array.isArray(followedData) ? followedData : []
      const sightings = Array.isArray(sightingsData) ? sightingsData : []
      setCats(catList)
      setFollowedIds(new Set(followed.map((f: any) => f.cat_id)))
      setMetIds(new Set(sightings.map((s: any) => s.cat_id).filter(Boolean)))
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

  const metCount = cats.filter((c: any) => metIds.has(c.id)).length
  const total = cats.length
  const pct = total > 0 ? Math.round((metCount / total) * 100) : 0
  const nextMilestone = MILESTONES.find((m) => m.count > metCount) || MILESTONES[MILESTONES.length - 1]
  const currentMilestone = [...MILESTONES].reverse().find((m) => m.count <= metCount)

  let filteredCats = cats
  if (search) {
    const q = search.toLowerCase()
    filteredCats = filteredCats.filter((c: any) =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.location || '').toLowerCase().includes(q) ||
      (c.color || '').toLowerCase().includes(q)
    )
  }
  if (filter === 'met') filteredCats = filteredCats.filter((c: any) => metIds.has(c.id))
  else if (filter === 'unmet') filteredCats = filteredCats.filter((c: any) => !metIds.has(c.id))
  else if (filter === 'rare') filteredCats = filteredCats.filter((c: any) => isRareCat(c, metIds))
  else if (filter === 'followed') filteredCats = filteredCats.filter((c: any) => followedIds.has(c.id))

  const FILTERS = [
    { key: 'all', label: '全部' },
    { key: 'met', label: '已相遇' },
    { key: 'unmet', label: '未相遇' },
    { key: 'rare', label: '稀有' },
    { key: 'followed', label: '已关注' },
  ]

  return (
    <View className='page' style={{ padding: '24rpx' }}>
      <View style={{ backgroundColor: '#059669', padding: '32rpx 24rpx', borderRadius: '24rpx', marginBottom: '24rpx' }}>
        <Text style={{ fontSize: '36rpx', fontWeight: 'bold', color: '#fff' }}>猫猫图鉴</Text>
        <Text style={{ fontSize: '24rpx', color: 'rgba(255,255,255,0.8)', marginTop: '4rpx', display: 'block' }}>
          已相遇 {metCount}/{total} 只 · {pct}%
        </Text>
        <Text style={{ fontSize: '22rpx', color: 'rgba(255,255,255,0.6)', marginTop: '4rpx', display: 'block' }}>
          {currentMilestone ? `${currentMilestone.emoji} ${currentMilestone.label}` : '开始探索吧'} → 下一: {nextMilestone.emoji} {nextMilestone.label} ({nextMilestone.count}只)
        </Text>
      </View>

      <View style={{ marginBottom: '16rpx' }}>
        <Input
          value={search}
          onInput={(e) => setSearch(e.detail.value)}
          placeholder='搜索猫名、位置、颜色…'
          style={{ backgroundColor: '#fff', borderRadius: '16rpx', padding: '16rpx 24rpx', fontSize: '26rpx', border: '1rpx solid #E7E5E4', width: '100%', boxSizing: 'border-box' }}
        />
      </View>

      <View style={{ display: 'flex', gap: '12rpx', marginBottom: '24rpx', overflowX: 'scroll', whiteSpace: 'nowrap' as any }}>
        {FILTERS.map((f) => (
          <View
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '8rpx 24rpx', borderRadius: '999rpx', fontSize: '24rpx', flexShrink: 0,
              backgroundColor: filter === f.key ? '#F97316' : '#F5F5F4',
              color: filter === f.key ? '#fff' : '#78716C',
            }}
          >
            <Text>{f.label}</Text>
          </View>
        ))}
      </View>

      {filteredCats.length > 0 ? (
        <View style={{ display: 'flex', flexWrap: 'wrap', gap: '16rpx' }}>
          {filteredCats.map((cat: any) => {
            const isMet = metIds.has(cat.id)
            const isFollowed = followedIds.has(cat.id)
            const rare = isRareCat(cat, metIds)
            return (
              <View key={cat.id} style={{ width: 'calc(50% - 8rpx)' }} onClick={() => Taro.navigateTo({ url: `/pages/cat-detail/index?id=${cat.id}` })}>
                <View className='card' style={{ padding: 0, overflow: 'hidden', opacity: isMet ? 1 : 0.6 }}>
                  <View style={{ width: '100%', height: '260rpx', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {cat.avatar ? <Image src={cat.avatar} mode='aspectFill' style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: '64rpx' }}>🐱</Text>}
                    {rare && (
                      <View style={{ position: 'absolute', top: '8rpx', left: '8rpx', backgroundColor: '#FEF3C7', color: '#D97706', fontSize: '20rpx', padding: '4rpx 12rpx', borderRadius: '999rpx', fontWeight: 'bold' }}>
                        ★ 稀有
                      </View>
                    )}
                    <View style={{ position: 'absolute', top: '8rpx', right: '8rpx', backgroundColor: isFollowed ? '#F97316' : isMet ? '#059669' : '#78716C', color: '#fff', fontSize: '20rpx', padding: '4rpx 12rpx', borderRadius: '999rpx' }}>
                      {isFollowed ? '已关注' : isMet ? '已相遇' : '未相遇'}
                    </View>
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
          <Text style={{ fontSize: '28rpx', color: '#78716C', marginTop: '16rpx', display: 'block' }}>
            {search || filter !== 'all' ? '没有找到匹配的猫猫' : '还没有猫猫档案'}
          </Text>
        </View>
      )}
    </View>
  )
}
