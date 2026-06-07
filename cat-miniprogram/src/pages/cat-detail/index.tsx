import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { getCat, getSightings, getHealthRecords, followCat, unfollowCat, checkFollow } from '../../services/api'
import SharePoster from '../../components/SharePoster'

const RECORD_TYPE_LABELS: Record<string, string> = {
  vaccine: '疫苗', deworm: '驱虫', sterilization: '绝育',
  injury: '伤病', illness: '疾病', checkup: '体检',
}

function formatTime(value: string) {
  if (!value) return ''
  const d = new Date(value)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function CatDetail() {
  const [cat, setCat] = useState<any>(null)
  const [sightings, setSightings] = useState<any[]>([])
  const [healthRecords, setHealthRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [catId, setCatId] = useState<number>(0)
  const [showShare, setShowShare] = useState(false)

  useLoad((options) => {
    const id = Number(options.id)
    if (!id) {
      setError('缺少猫猫ID')
      setLoading(false)
      return
    }
    setCatId(id)
    setLoading(true)
    Promise.all([
      getCat(id),
      getSightings({ catId: id, limit: 10 }),
      getHealthRecords(id).catch(() => []),
      checkFollow(id).then(r => setFollowing(r.following)).catch(() => {}),
    ]).then(([catData, sightingsData, healthData]) => {
      setCat(catData)
      setSightings(Array.isArray(sightingsData) ? sightingsData : [])
      setHealthRecords(Array.isArray(healthData) ? healthData : [])
    }).catch((err) => setError(err.message || '猫猫档案加载失败'))
      .finally(() => setLoading(false))
  })

  async function toggleFollow() {
    if (followLoading) return
    setFollowLoading(true)
    const next = !following
    setFollowing(next)
    try {
      if (next) await followCat(catId)
      else await unfollowCat(catId)
    } catch {
      setFollowing(!next)
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Text style={{ fontSize: '28rpx', color: '#A8A29E' }}>加载中...</Text>
      </View>
    )
  }

  if (error || !cat) {
    return (
      <View className='page' style={{ padding: '24rpx' }}>
        <View className='card' style={{ textAlign: 'center', padding: '80rpx 24rpx' }}>
          <Text style={{ fontSize: '48rpx', display: 'block' }}>🐱</Text>
          <Text style={{ fontSize: '28rpx', color: '#78716C', marginTop: '16rpx', display: 'block' }}>{error || '没有找到这只猫'}</Text>
        </View>
      </View>
    )
  }

  const personalityTags = cat.personality
    ? cat.personality.split(/[，,、]/).map((tag: string) => tag.trim()).filter(Boolean)
    : []

  return (
    <View className='page' style={{ padding: '24rpx', paddingBottom: '48rpx' }}>
      <View className='card' style={{ padding: 0, overflow: 'hidden', marginBottom: '24rpx' }}>
        <View style={{ width: '100%', height: '500rpx', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {cat.avatar ? <Image src={cat.avatar} mode='aspectFill' style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: '80rpx' }}>🐱</Text>}
        </View>
        <View style={{ padding: '32rpx' }}>
          <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: '44rpx', fontWeight: 'bold', display: 'block' }}>{cat.name}</Text>
              {cat.nickname && <Text style={{ fontSize: '28rpx', color: '#F97316', fontWeight: '500', marginTop: '4rpx', display: 'block' }}>{cat.nickname}</Text>}
              {cat.location && <Text style={{ fontSize: '24rpx', color: '#78716C', marginTop: '8rpx', display: 'block' }}>常出没：{cat.location}</Text>}
            </View>
            <View style={{ display: 'flex', alignItems: 'center', gap: '12rpx', flexShrink: 0 }}>
              <View onClick={toggleFollow}
                style={{ width: '72rpx', height: '72rpx', borderRadius: '50%', backgroundColor: following ? '#FEE2E2' : '#F5F5F4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32rpx' }}>
                {following ? '❤️' : '🤍'}
              </View>
              <View className='share-btn' onClick={() => setShowShare(true)}
                style={{ width: '72rpx', height: '72rpx', borderRadius: '50%', backgroundColor: '#F5F5F4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32rpx' }}>
                📤
              </View>
              {cat.color && (
                <Text style={{ fontSize: '24rpx', padding: '8rpx 20rpx', borderRadius: '999rpx', backgroundColor: '#FFF7ED', color: '#F97316', fontWeight: '500' }}>{cat.color}</Text>
              )}
            </View>
          </View>

          {personalityTags.length > 0 && (
            <View style={{ display: 'flex', flexWrap: 'wrap', gap: '12rpx', marginTop: '20rpx' }}>
              {personalityTags.map((tag: string) => (
                <Text key={tag} style={{ fontSize: '24rpx', padding: '8rpx 20rpx', borderRadius: '999rpx', border: '1rpx solid #E7E5E4', color: '#78716C' }}>{tag}</Text>
              ))}
            </View>
          )}

          {(cat.gender || cat.age_estimate || cat.neutered) && (
            <View style={{ display: 'flex', gap: '12rpx', marginTop: '24rpx', paddingTop: '24rpx', borderTop: '1rpx solid #E7E5E4' }}>
              {cat.gender && (
                <View style={{ flex: 1, textAlign: 'center', backgroundColor: '#FFF7ED', borderRadius: '16rpx', padding: '16rpx' }}>
                  <Text style={{ fontSize: '22rpx', color: '#78716C', display: 'block' }}>性别</Text>
                  <Text style={{ fontSize: '28rpx', fontWeight: '500', display: 'block' }}>{cat.gender}</Text>
                </View>
              )}
              {cat.age_estimate && (
                <View style={{ flex: 1, textAlign: 'center', backgroundColor: '#FFF7ED', borderRadius: '16rpx', padding: '16rpx' }}>
                  <Text style={{ fontSize: '22rpx', color: '#78716C', display: 'block' }}>年龄</Text>
                  <Text style={{ fontSize: '28rpx', fontWeight: '500', display: 'block' }}>{cat.age_estimate}</Text>
                </View>
              )}
              {cat.neutered && (
                <View style={{ flex: 1, textAlign: 'center', backgroundColor: '#FFF7ED', borderRadius: '16rpx', padding: '16rpx' }}>
                  <Text style={{ fontSize: '22rpx', color: '#78716C', display: 'block' }}>绝育</Text>
                  <Text style={{ fontSize: '28rpx', fontWeight: '500', display: 'block' }}>{cat.neutered}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {cat.story && (
        <View className='card' style={{ marginBottom: '24rpx' }}>
          <Text style={{ fontSize: '30rpx', fontWeight: 'bold', marginBottom: '12rpx', display: 'block' }}>猫猫故事</Text>
          <Text style={{ fontSize: '26rpx', color: '#78716C', lineHeight: '44rpx' }}>{cat.story}</Text>
        </View>
      )}

      {healthRecords.length > 0 && (
        <View style={{ marginBottom: '24rpx' }}>
          <Text style={{ fontSize: '30rpx', fontWeight: 'bold', marginBottom: '16rpx', display: 'block' }}>健康记录</Text>
          {healthRecords.map((r: any) => (
            <View key={r.id} className='card' style={{ marginBottom: '12rpx', display: 'flex', alignItems: 'flex-start', gap: '16rpx' }}>
              <Text style={{ fontSize: '32rpx', flexShrink: 0 }}>💊</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: '26rpx', fontWeight: '500', display: 'block' }}>
                  {RECORD_TYPE_LABELS[r.record_type] || r.record_type} · {r.title}
                </Text>
                {r.description && <Text style={{ fontSize: '22rpx', color: '#78716C', display: 'block', marginTop: '4rpx' }}>{r.description}</Text>}
                <Text style={{ fontSize: '22rpx', color: '#A8A29E', display: 'block', marginTop: '4rpx' }}>
                  {formatTime(r.record_date)}{r.location ? ` · ${r.location}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ marginBottom: '24rpx' }}>
        <Text style={{ fontSize: '30rpx', fontWeight: 'bold', marginBottom: '16rpx', display: 'block' }}>照片墙</Text>
        {cat.images?.length > 0 ? (
          <View style={{ display: 'flex', flexWrap: 'wrap', gap: '12rpx' }}>
            {cat.images.map((img: any) => (
              <View key={img.id} style={{ width: 'calc(33.33% - 8rpx)', borderRadius: '16rpx', overflow: 'hidden', aspectRatio: '1' }}>
                <Image src={img.image_path} mode='aspectFill' style={{ width: '100%', height: '100%' }} />
              </View>
            ))}
          </View>
        ) : (
          <View className='card' style={{ textAlign: 'center', padding: '40rpx' }}>
            <Text style={{ fontSize: '26rpx', color: '#78716C' }}>暂时还没有参考照片</Text>
          </View>
        )}
      </View>

      <View>
        <Text style={{ fontSize: '30rpx', fontWeight: 'bold', marginBottom: '16rpx', display: 'block' }}>最近偶遇</Text>
        {sightings.length > 0 ? (
          sightings.map((s: any) => (
            <View key={s.id} className='card' style={{ marginBottom: '12rpx' }}>
              <View style={{ display: 'flex', gap: '16rpx' }}>
                <View style={{ width: '80rpx', height: '80rpx', borderRadius: '20rpx', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Text style={{ fontSize: '36rpx' }}>🐾</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: '26rpx', fontWeight: '500', display: 'block' }}>{s.location || '校园某处'}</Text>
                  <Text style={{ fontSize: '22rpx', color: '#78716C', display: 'block' }}>{formatTime(s.created_at)}</Text>
                  {s.note && <Text style={{ fontSize: '22rpx', color: '#78716C', display: 'block', marginTop: '4rpx' }}>"{s.note}"</Text>}
                  {s.confidence !== null && s.confidence !== undefined && (
                    <Text style={{ fontSize: '22rpx', color: '#A8A29E', display: 'block', marginTop: '4rpx' }}>
                      识别匹配度 {Math.round(s.confidence * 100)}%
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ))
        ) : (
          <View className='card' style={{ textAlign: 'center', padding: '40rpx' }}>
            <Text style={{ fontSize: '26rpx', color: '#78716C' }}>还没有偶遇记录，去首页拍下它吧</Text>
          </View>
        )}
      </View>
      <SharePoster cat={cat} visible={showShare} onClose={() => setShowShare(false)} />
    </View>
  )
}
