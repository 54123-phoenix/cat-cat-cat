import { useState } from 'react'
import { View, Text, Image, ScrollView, Textarea } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { getPosts, likePost, reportPost, getUserProfile, createPost } from '../../services/api'
import { TOPICS } from '../../config'

const TOPIC_COLORS: Record<string, { bg: string; text: string }> = {
  find: { bg: '#FFF7ED', text: '#EA580C' },
  daily: { bg: '#D1FAE5', text: '#059669' },
  health: { bg: '#E0E7FF', text: '#4F46E5' },
  suggest: { bg: '#F3E8FF', text: '#7C3AED' },
}

export default function Community() {
  const [activeTab, setActiveTab] = useState('all')
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [_user, setUser] = useState<any>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [composeTopic, setComposeTopic] = useState('daily')
  const [composeText, setComposeText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function fetchPosts() {
    const params: any = { limit: 30 }
    if (activeTab !== 'all') params.topic = activeTab
    getPosts(params)
      .then((data) => setPosts(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
    getUserProfile().then(setUser).catch(() => {})
  }

  useDidShow(() => {
    setLoading(true)
    fetchPosts()
  })

  usePullDownRefresh(() => {
    setLoading(true)
    setPosts([])
    fetchPosts()
    setTimeout(() => Taro.stopPullDownRefresh(), 1000)
  })

  useReachBottom(() => {
    if (posts.length >= 30) {
      Taro.showToast({ title: '已加载全部帖子', icon: 'none', duration: 1000 })
    }
  })

  async function handleLike(post: any) {
    const nextLiked = !post.liked
    const nextLikes = Math.max(0, (post.likes || 0) + (nextLiked ? 1 : -1))
    setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, liked: nextLiked, likes: nextLikes } : p))
    try {
      await likePost(post.id)
    } catch {
      setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, liked: !nextLiked, likes: Math.max(0, nextLikes + (nextLiked ? -1 : 1)) } : p))
    }
  }

  async function handleReport(post: any) {
    const res = await Taro.showModal({ title: '举报帖子', editable: true, placeholderText: '请说明举报原因' } as any)
    if (res.confirm && (res as any).content) {
      try {
        await reportPost(post.id, { reason: (res as any).content })
        Taro.showToast({ title: '举报已提交', icon: 'success' })
      } catch (err: any) {
        Taro.showToast({ title: err.message || '举报失败', icon: 'none' })
      }
    }
  }

  const topicLabel = (topic: string) => TOPICS.find(t => t.id === topic)?.label || '铲屎日常'

  return (
    <View className='page'>
      <View style={{ backgroundColor: '#F97316', padding: '32rpx 24rpx 24rpx', borderBottomLeftRadius: '24rpx', borderBottomRightRadius: '24rpx' }}>
        <Text style={{ fontSize: '36rpx', fontWeight: 'bold', color: '#fff' }}>社区</Text>
        <Text style={{ fontSize: '24rpx', color: 'rgba(255,255,255,0.8)', marginTop: '4rpx', display: 'block' }}>和其他铲屎官一起聊聊</Text>
      </View>

      <ScrollView scrollX style={{ whiteSpace: 'nowrap', padding: '16rpx 16rpx', backgroundColor: '#fff', borderBottom: '1rpx solid #E7E5E4' }}>
        {[{ id: 'all', label: '广场' }, ...TOPICS].map((tab) => (
          <Text key={tab.id}
            onClick={() => { setActiveTab(tab.id); setLoading(true); setPosts([]); fetchPosts() }}
            style={{
              display: 'inline-block', padding: '12rpx 24rpx', fontSize: '26rpx', fontWeight: '500',
              color: activeTab === tab.id ? '#F97316' : '#78716C',
              borderBottom: activeTab === tab.id ? '4rpx solid #F97316' : '4rpx solid transparent',
              marginRight: '4rpx',
            }}>
            {tab.label}
          </Text>
        ))}
      </ScrollView>

      <View style={{ padding: '24rpx' }}>
        {loading ? (
          <View style={{ textAlign: 'center', padding: '80rpx 0' }}>
            <Text style={{ fontSize: '28rpx', color: '#A8A29E' }}>加载中...</Text>
          </View>
        ) : posts.length > 0 ? (
          posts.map((post: any) => {
            const colors = TOPIC_COLORS[post.topic] || { bg: '#F5F5F4', text: '#78716C' }
            return (
              <View key={post.id} className='card' style={{ marginBottom: '20rpx' }}
                onClick={() => Taro.navigateTo({ url: `/pages/post-detail/index?id=${post.id}` })}>
                <View style={{ display: 'flex', alignItems: 'flex-start', gap: '16rpx' }}>
                  <View style={{ width: '72rpx', height: '72rpx', borderRadius: '50%', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Text style={{ fontSize: '32rpx' }}>🐱</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: '26rpx', fontWeight: '500' }}>{post.user?.nickname || `铲屎官 #${post.userId}`}</Text>
                      <Text style={{ fontSize: '20rpx', padding: '4rpx 12rpx', borderRadius: '999rpx', backgroundColor: colors.bg, color: colors.text }}>
                        {topicLabel(post.topic)}
                      </Text>
                    </View>
                    <Text style={{ fontSize: '28rpx', marginTop: '12rpx', display: 'block', lineHeight: '44rpx' }}>{post.content}</Text>
                    {post.images?.length > 0 && (
                      <View style={{ display: 'flex', gap: '8rpx', marginTop: '16rpx', flexWrap: 'wrap' }}>
                        {post.images.slice(0, 3).map((img: string, i: number) => (
                          <Image key={i} src={img} mode='aspectFill' style={{ width: '200rpx', height: '200rpx', borderRadius: '16rpx' }} />
                        ))}
                      </View>
                    )}
                    {post.tags?.length > 0 && (
                      <View style={{ display: 'flex', gap: '8rpx', marginTop: '12rpx', flexWrap: 'wrap' }}>
                        {post.tags.map((tag: string) => (
                          <Text key={tag} style={{ fontSize: '22rpx', color: '#F97316', backgroundColor: '#FFF7ED', padding: '4rpx 16rpx', borderRadius: '999rpx' }}>{tag}</Text>
                        ))}
                      </View>
                    )}
                    <View style={{ display: 'flex', alignItems: 'center', gap: '32rpx', marginTop: '20rpx', paddingTop: '16rpx', borderTop: '1rpx solid #F5F5F4' }}>
                      <View onClick={(e) => { e.stopPropagation(); handleLike(post) }} style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
                        <Text style={{ fontSize: '28rpx' }}>{post.liked ? '❤️' : '🤍'}</Text>
                        <Text style={{ fontSize: '24rpx', color: '#78716C' }}>{post.likes || 0} 赞</Text>
                      </View>
                      <View style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
                        <Text style={{ fontSize: '24rpx' }}>💬</Text>
                        <Text style={{ fontSize: '24rpx', color: '#78716C' }}>{post.comments || 0} 评论</Text>
                      </View>
                      <View onClick={(e) => { e.stopPropagation(); handleReport(post) }} style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
                        <Text style={{ fontSize: '24rpx', color: '#A8A29E' }}>🚩 举报</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            )
          })
        ) : (
          <View style={{ textAlign: 'center', padding: '80rpx 0' }}>
            <Text style={{ fontSize: '56rpx', display: 'block' }}>💬</Text>
            <Text style={{ fontSize: '28rpx', color: '#78716C', marginTop: '16rpx', display: 'block' }}>还没有帖子</Text>
            <Text style={{ fontSize: '24rpx', color: '#A8A29E', marginTop: '8rpx', display: 'block' }}>快来发布第一条吧</Text>
          </View>
        )}
      </View>

      <View onClick={() => setShowCompose(true)}
        style={{
          position: 'fixed', bottom: '48rpx', right: '48rpx',
          width: '104rpx', height: '104rpx', borderRadius: '50%',
          backgroundColor: '#F97316', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '48rpx', fontWeight: 'bold',
          boxShadow: '0 8rpx 24rpx rgba(249,115,22,0.35)',
          zIndex: 100,
        }}>
        +
      </View>

      {showCompose && (
        <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowCompose(false)}>
          <View style={{ width: '100%', backgroundColor: '#fff', borderRadius: '32rpx 32rpx 0 0', padding: '32rpx 24rpx', maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}>
            <Text style={{ fontSize: '32rpx', fontWeight: 'bold', display: 'block', marginBottom: '24rpx' }}>发帖</Text>
            <Text style={{ fontSize: '24rpx', color: '#78716C', marginBottom: '12rpx', display: 'block' }}>选择话题</Text>
            <View style={{ display: 'flex', flexWrap: 'wrap', gap: '12rpx', marginBottom: '24rpx' }}>
              {TOPICS.map((t) => (
                <Text key={t.id}
                  onClick={() => setComposeTopic(t.id)}
                  style={{
                    fontSize: '24rpx', padding: '12rpx 24rpx', borderRadius: '999rpx',
                    backgroundColor: composeTopic === t.id ? '#FFF7ED' : '#F5F5F4',
                    color: composeTopic === t.id ? '#F97316' : '#78716C',
                    fontWeight: composeTopic === t.id ? '500' : 'normal',
                  }}>
                  {t.label}
                </Text>
              ))}
            </View>
            <Textarea
              value={composeText}
              onInput={(e) => setComposeText(e.detail.value)}
              placeholder='分享你和猫猫的故事...'
              style={{ width: '100%', height: '240rpx', borderRadius: '16rpx', backgroundColor: '#F5F5F4', padding: '20rpx', fontSize: '28rpx', marginBottom: '24rpx' }}
              maxlength={500}
            />
            <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: '22rpx', color: '#A8A29E' }}>{composeText.length}/500</Text>
              <View onClick={async () => {
                if (!composeText.trim() || submitting) return
                setSubmitting(true)
                try {
                  const form = new FormData()
                  form.append('topic', composeTopic)
                  form.append('content', composeText.trim())
                  await createPost(form)
                  setShowCompose(false)
                  setComposeText('')
                  setComposeTopic('daily')
                  Taro.showToast({ title: '发布成功', icon: 'success' })
                  setLoading(true)
                  fetchPosts()
                } catch (err: any) {
                  Taro.showToast({ title: err.message || '发布失败', icon: 'none' })
                } finally {
                  setSubmitting(false)
                }
              }}
                style={{
                  backgroundColor: (composeText.trim() && !submitting) ? '#F97316' : '#E7E5E4',
                  color: '#fff', borderRadius: '999rpx', padding: '20rpx 48rpx', fontSize: '28rpx', fontWeight: '500',
                }}>
                {submitting ? '发布中...' : '发布'}
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
