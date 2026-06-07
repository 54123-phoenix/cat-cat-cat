import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { getPost, likePost, deletePost, getPostComments, createComment } from '../../services/api'
import { getStoredUser } from '../../utils/storage'
import { TOPICS } from '../../config'

const TOPIC_COLORS: Record<string, { bg: string; text: string }> = {
  find: { bg: '#FFF7ED', text: '#EA580C' },
  daily: { bg: '#D1FAE5', text: '#059669' },
  health: { bg: '#E0E7FF', text: '#4F46E5' },
  suggest: { bg: '#F3E8FF', text: '#7C3AED' },
}

export default function PostDetail() {
  const [post, setPost] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(0)
  const [liking, setLiking] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [commentText, setCommentText] = useState('')
  const [postId, setPostId] = useState<number>(0)

  useLoad((options) => {
    const id = Number(options.id)
    if (!id) {
      setError('缺少帖子ID')
      setLoading(false)
      return
    }
    setPostId(id)
    setLoading(true)
    Promise.all([
      getPost(id),
      getPostComments(id).catch(() => []),
    ]).then(([postData, commentsData]) => {
      setPost(postData)
      setLiked(Boolean(postData.liked))
      setLikes(postData.likes || 0)
      setComments(Array.isArray(commentsData) ? commentsData : [])
    }).catch((err) => setError(err.message || '帖子加载失败'))
      .finally(() => setLoading(false))
  })

  async function handleLike() {
    if (liking) return
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikes((v) => Math.max(0, v + (nextLiked ? 1 : -1)))
    setLiking(true)
    try {
      await likePost(postId)
    } catch {
      setLiked(!nextLiked)
      setLikes((v) => Math.max(0, v + (nextLiked ? -1 : 1)))
    } finally {
      setTimeout(() => setLiking(false), 300)
    }
  }

  async function handleDelete() {
    const res = await Taro.showModal({ title: '确认删除', content: '确定要删除这条帖子吗？删除后无法恢复' })
    if (!res.confirm) return
    try {
      await deletePost(postId)
      Taro.showToast({ title: '已删除', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 500)
    } catch (err: any) {
      Taro.showToast({ title: err.message || '删除失败', icon: 'none' })
    }
  }

  async function handleSubmitComment() {
    if (!commentText.trim()) return
    try {
      const newComment = await createComment(postId, { content: commentText.trim() })
      setComments((prev) => [...prev, newComment])
      setCommentText('')
    } catch (err: any) {
      Taro.showToast({ title: err.message || '评论失败', icon: 'none' })
    }
  }

  if (loading) {
    return (
      <View style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Text style={{ fontSize: '28rpx', color: '#A8A29E' }}>加载中...</Text>
      </View>
    )
  }

  if (error || !post) {
    return (
      <View className='page' style={{ padding: '24rpx' }}>
        <View className='card' style={{ textAlign: 'center', padding: '80rpx 24rpx' }}>
          <Text style={{ fontSize: '28rpx', color: '#78716C' }}>{error || '帖子不存在'}</Text>
        </View>
      </View>
    )
  }

  const currentUser = getStoredUser()
  const canDelete = currentUser && (currentUser.id === post.userId || currentUser.role === 'admin')
  const colors = TOPIC_COLORS[post.topic] || { bg: '#F5F5F4', text: '#78716C' }
  const topicLabel = TOPICS.find(t => t.id === post.topic)?.label || '铲屎日常'

  return (
    <View className='page' style={{ padding: '24rpx', paddingBottom: '120rpx' }}>
      <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24rpx' }}>
        <View style={{ display: 'flex', alignItems: 'center', gap: '16rpx' }}>
          <View style={{ width: '72rpx', height: '72rpx', borderRadius: '50%', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: '32rpx' }}>🐱</Text>
          </View>
          <View>
            <Text style={{ fontSize: '28rpx', fontWeight: '500', display: 'block' }}>{post.user?.nickname || `铲屎官 #${post.userId}`}</Text>
            <Text style={{ fontSize: '22rpx', color: '#A8A29E', display: 'block' }}>{post.createdAt}</Text>
          </View>
        </View>
        <View style={{ display: 'flex', alignItems: 'center', gap: '12rpx' }}>
          <Text style={{ fontSize: '22rpx', padding: '6rpx 16rpx', borderRadius: '999rpx', backgroundColor: colors.bg, color: colors.text }}>{topicLabel}</Text>
          {canDelete && <Text onClick={handleDelete} style={{ fontSize: '22rpx', color: '#EF4444' }}>删除</Text>}
        </View>
      </View>

      {post.relatedCat && (
        <View className='card' style={{ marginBottom: '20rpx', display: 'flex', alignItems: 'center', gap: '12rpx' }}
          onClick={() => Taro.navigateTo({ url: `/pages/cat-detail/index?id=${post.relatedCat.id}` })}>
          <Text style={{ fontSize: '24rpx' }}>🐱</Text>
          <Text style={{ fontSize: '26rpx', color: '#F97316', fontWeight: '500' }}>{post.relatedCat.name}</Text>
        </View>
      )}

      <Text style={{ fontSize: '30rpx', lineHeight: '50rpx', display: 'block', marginBottom: '24rpx' }}>{post.content}</Text>

      {post.images?.length > 0 && (
        <View style={{ display: 'flex', flexWrap: 'wrap', gap: '8rpx', marginBottom: '24rpx' }}>
          {post.images.map((img: string, i: number) => (
            <Image key={i} src={img} mode='aspectFill' style={{
              width: post.images.length === 1 ? '100%' : 'calc(50% - 4rpx)',
              height: post.images.length === 1 ? '400rpx' : '300rpx',
              borderRadius: '16rpx',
            }} />
          ))}
        </View>
      )}

      {post.tags?.length > 0 && (
        <View style={{ display: 'flex', flexWrap: 'wrap', gap: '8rpx', marginBottom: '24rpx' }}>
          {post.tags.map((tag: string) => (
            <Text key={tag} style={{ fontSize: '22rpx', color: '#F97316', backgroundColor: '#FFF7ED', padding: '6rpx 16rpx', borderRadius: '999rpx' }}>{tag}</Text>
          ))}
        </View>
      )}

      <View style={{ display: 'flex', alignItems: 'center', gap: '48rpx', padding: '24rpx 0', borderTop: '1rpx solid #E7E5E4', borderBottom: '1rpx solid #E7E5E4', marginBottom: '32rpx' }}>
        <View onClick={handleLike} style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
          <Text style={{ fontSize: '32rpx' }}>{liked ? '❤️' : '🤍'}</Text>
          <Text style={{ fontSize: '26rpx', color: liked ? '#F97316' : '#78716C' }}>{likes} 赞</Text>
        </View>
        <View style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
          <Text style={{ fontSize: '28rpx' }}>💬</Text>
          <Text style={{ fontSize: '26rpx', color: '#78716C' }}>{comments.length} 条评论</Text>
        </View>
      </View>

      <View>
        <Text style={{ fontSize: '28rpx', fontWeight: 'bold', marginBottom: '20rpx', display: 'block' }}>评论</Text>
        {comments.length > 0 ? (
          comments.map((c: any, i: number) => (
            <View key={c.id || i} style={{ display: 'flex', gap: '16rpx', marginBottom: '20rpx', paddingBottom: '20rpx', borderBottom: '1rpx solid #F5F5F4' }}>
              <View style={{ width: '64rpx', height: '64rpx', borderRadius: '50%', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ fontSize: '28rpx' }}>🐱</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: '24rpx', fontWeight: '500', display: 'block' }}>{c.user?.nickname || '铲屎官'}</Text>
                <Text style={{ fontSize: '26rpx', display: 'block', marginTop: '4rpx' }}>{c.content}</Text>
                <Text style={{ fontSize: '20rpx', color: '#A8A29E', display: 'block', marginTop: '4rpx' }}>{c.createdAt || ''}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={{ textAlign: 'center', padding: '40rpx 0' }}>
            <Text style={{ fontSize: '24rpx', color: '#A8A29E' }}>还没有评论，来说两句吧</Text>
          </View>
        )}
      </View>

      <View style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16rpx 24rpx', backgroundColor: '#fff', borderTop: '1rpx solid #E7E5E4', display: 'flex', alignItems: 'center', gap: '16rpx', zIndex: 10 }}>
        <input value={commentText} onInput={(e) => setCommentText(e.detail.value)}
          placeholder='写下你的评论...'
          style={{ flex: 1, height: '72rpx', borderRadius: '36rpx', backgroundColor: '#F5F5F4', padding: '0 24rpx', fontSize: '26rpx' }}
          confirmType='send'
          onConfirm={handleSubmitComment} />
        <View onClick={handleSubmitComment}
          style={{ backgroundColor: commentText.trim() ? '#F97316' : '#E7E5E4', color: '#fff', borderRadius: '36rpx', padding: '16rpx 32rpx', fontSize: '26rpx', fontWeight: '500' }}>
          发送
        </View>
      </View>
    </View>
  )
}
