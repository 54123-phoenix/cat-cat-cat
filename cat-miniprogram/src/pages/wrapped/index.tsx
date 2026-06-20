import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getMyStats, getFollowedCats, getSightings } from '../../services/api'

const SLIDES = [
  { key: 'intro', title: '你的猫猫年度', subtitle: '回顾这一年与猫猫的故事' },
  { key: 'sightings', title: '偶遇次数', value: 'sightings', unit: '次', emoji: '🐾' },
  { key: 'cats', title: '相遇猫猫', value: 'unique_cats', unit: '只', emoji: '🐱' },
  { key: 'follows', title: '关注猫猫', value: 'follows', unit: '只', emoji: '❤️' },
  { key: 'streak', title: '最长连续打卡', value: 'streak', unit: '天', emoji: '🔥' },
  { key: 'personality', title: '你的猫猫人格', personalities: ['夜猫子', '猫咖常客', '校园探险家', '佛系喂猫人', '猫语者'] },
  { key: 'end', title: '感谢陪伴', subtitle: '明年继续和猫猫一起吧～' },
]

export default function Wrapped() {
  const [slide, setSlide] = useState(0)
  const [stats, setStats] = useState<any>({})
  const [followCount, setFollowCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useState(() => {
    Promise.all([
      getMyStats().catch(() => ({})),
      getFollowedCats().catch(() => []),
      getSightings({ limit: 200 }).catch(() => []),
    ]).then(([statsData, followsData, sightingsData]) => {
      setStats(statsData || {})
      setFollowCount(Array.isArray(followsData) ? followsData.length : 0)
    }).finally(() => setLoading(false))
  })

  const mergedStats = { ...stats, follows: followCount }
  const current = SLIDES[slide]
  const personalityIdx = (mergedStats.sightings || 0) % (current.personalities?.length || 1)

  function next() {
    if (slide < SLIDES.length - 1) setSlide(slide + 1)
  }
  function prev() {
    if (slide > 0) setSlide(slide - 1)
  }

  if (loading) {
    return (
      <View style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#1C1917' }}>
        <Text style={{ fontSize: '28rpx', color: '#F97316' }}>加载你的猫猫故事...</Text>
      </View>
    )
  }

  return (
    <View
      onClick={next}
      style={{ minHeight: '100vh', backgroundColor: '#1C1917', padding: '48rpx 32rpx', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative' }}
    >
      {slide > 0 && (
        <View
          onClick={(e) => { e.stopPropagation(); prev() }}
          style={{ position: 'absolute', top: '32rpx', left: '32rpx', padding: '16rpx' }}
        >
          <Text style={{ fontSize: '28rpx', color: '#F97316' }}>← 上一页</Text>
        </View>
      )}

      <Text style={{ fontSize: '80rpx', display: 'block', textAlign: 'center', marginBottom: '24rpx' }}>
        {current.emoji || '✨'}
      </Text>

      <Text style={{ fontSize: '40rpx', fontWeight: 'bold', color: '#fff', textAlign: 'center', display: 'block' }}>
        {current.title}
      </Text>

      {current.value && (
        <View style={{ marginTop: '32rpx', textAlign: 'center' }}>
          <Text style={{ fontSize: '96rpx', fontWeight: 'bold', color: '#F97316', display: 'block' }}>
            {mergedStats[current.value] || 0}
          </Text>
          <Text style={{ fontSize: '32rpx', color: 'rgba(255,255,255,0.6)', display: 'block', marginTop: '8rpx' }}>
            {current.unit}
          </Text>
        </View>
      )}

      {current.personalities && (
        <View style={{ marginTop: '32rpx', textAlign: 'center' }}>
          <Text style={{ fontSize: '48rpx', fontWeight: 'bold', color: '#F97316', display: 'block' }}>
            {current.personalities[personalityIdx]}
          </Text>
        </View>
      )}

      {current.subtitle && (
        <Text style={{ fontSize: '28rpx', color: 'rgba(255,255,255,0.6)', textAlign: 'center', display: 'block', marginTop: '16rpx' }}>
          {current.subtitle}
        </Text>
      )}

      <View style={{ marginTop: '64rpx', display: 'flex', gap: '12rpx' }}>
        {SLIDES.map((_, i) => (
          <View key={i} style={{
            width: i === slide ? '32rpx' : '12rpx',
            height: '8rpx',
            borderRadius: '4rpx',
            backgroundColor: i === slide ? '#F97316' : 'rgba(255,255,255,0.2)',
          }} />
        ))}
      </View>

      {slide < SLIDES.length - 1 && (
        <Text style={{ fontSize: '24rpx', color: 'rgba(255,255,255,0.4)', marginTop: '24rpx' }}>
          点击继续 →
        </Text>
      )}
    </View>
  )
}
