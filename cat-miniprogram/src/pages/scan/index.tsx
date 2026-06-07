import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { identifyCat, createSighting } from '../../services/api'
import { ACTIVITY_TYPES } from '../../config'

type Phase = 'idle' | 'ready' | 'loading' | 'confirmed' | 'uncertain' | 'unknown' | 'error'

export default function Scan() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [preview, setPreview] = useState('')
  const [result, setResult] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [discoveryNote, setDiscoveryNote] = useState('')
  const [filePath, setFilePath] = useState('')

  useDidShow(() => {
    setPhase('idle')
    setResult(null)
    setDiscoveryNote('')
    setMessage('')
  })

  async function handleChooseMedia() {
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
      })
      const path = res.tempFiles[0].tempFilePath
      setFilePath(path)
      setPreview(path)
      setPhase('ready')
      setResult(null)
      setMessage('')
    } catch (e) {
      if ((e as any).errMsg?.includes('cancel')) return
      setMessage('选择图片失败')
    }
  }

  async function handleIdentify() {
    if (!filePath) {
      setMessage('请先选择一张照片')
      return
    }
    setPhase('loading')
    setMessage('正在识别中，请稍候...')
    try {
      const data = await identifyCat(filePath)
      setResult(data)
      const status = data.status || 'confirmed'
      setPhase(status as Phase)
      if (status === 'confirmed' && data.cat_id) {
        await createSighting({ catId: data.cat_id, confidence: data.confidence }).catch(() => {})
      }
    } catch (err: any) {
      setMessage(err.message || '识别服务暂时不可用，请稍后重试')
      setPhase('error')
    }
  }

  async function handleConfirmCandidate(candidate: any) {
    const catId = candidate.cat_id || candidate.catId
    if (!catId) {
      setMessage('无法确认猫咪身份')
      return
    }
    await createSighting({ catId, confidence: candidate.confidence }).catch(() => {})
    Taro.navigateTo({ url: `/pages/cat-detail/index?id=${catId}` })
  }

  async function handleSubmitDiscovery() {
    setMessage('')
    try {
      await createSighting({ catId: 0, location: '未知' })
      setMessage('线索已提交，等待猫协审核')
    } catch (err: any) {
      setMessage(err.message || '提交失败，请重试')
    }
  }

  function reset() {
    setPhase('idle')
    setPreview('')
    setFilePath('')
    setResult(null)
    setDiscoveryNote('')
    setMessage('')
  }

  return (
    <View className='page' style={{ padding: '24rpx' }}>
      <Text style={{ fontSize: '36rpx', fontWeight: 'bold', display: 'block', marginBottom: '24rpx' }}>拍照识猫</Text>

      {phase === 'idle' && (
        <View onClick={handleChooseMedia} style={{
          border: '2rpx dashed #F97316', borderRadius: '24rpx', padding: '80rpx 24rpx',
          textAlign: 'center', backgroundColor: '#FFF7ED',
        }}>
          <Text style={{ fontSize: '56rpx', display: 'block', marginBottom: '16rpx' }}>📷</Text>
          <Text style={{ fontSize: '28rpx', color: '#F97316', fontWeight: '500' }}>拍照或上传图片</Text>
          <Text style={{ fontSize: '22rpx', color: '#A8A29E', marginTop: '8rpx', display: 'block' }}>支持 JPG、PNG 格式</Text>
        </View>
      )}

      {preview && (phase === 'ready' || phase === 'loading' || phase === 'confirmed' || phase === 'uncertain' || phase === 'unknown' || phase === 'error') && (
        <View style={{ borderRadius: '24rpx', overflow: 'hidden', marginBottom: '24rpx' }}>
          <Image src={preview} mode='aspectFill' style={{ width: '100%', height: '500rpx' }} />
        </View>
      )}

      {phase === 'ready' && (
        <View onClick={handleIdentify} style={{
          backgroundColor: '#F97316', borderRadius: '999rpx', padding: '28rpx',
          textAlign: 'center', color: '#fff', fontSize: '30rpx', fontWeight: '500',
        }}>
          ✨ 开始识别
        </View>
      )}

      {phase === 'loading' && (
        <View style={{ textAlign: 'center', padding: '40rpx' }}>
          <Text style={{ fontSize: '48rpx', display: 'block' }}>🔍</Text>
          <Text style={{ fontSize: '26rpx', color: '#78716C', marginTop: '16rpx', display: 'block' }}>AI 正在识别中…</Text>
          {message && <Text style={{ fontSize: '22rpx', color: '#A8A29E', marginTop: '8rpx', display: 'block' }}>{message}</Text>}
        </View>
      )}

      {phase === 'confirmed' && result && (
        <View>
          <View style={{ backgroundColor: '#D1FAE5', borderRadius: '16rpx', padding: '20rpx', marginBottom: '20rpx' }}>
            <Text style={{ color: '#059669', fontSize: '26rpx' }}>✅ 识别成功 · 置信度 {Math.round((result.confidence || 0) * 100)}%</Text>
          </View>
          <View className='card' style={{ marginBottom: '20rpx' }}>
            <View style={{ display: 'flex', alignItems: 'center', gap: '20rpx' }}>
              <View style={{ width: '100rpx', height: '100rpx', borderRadius: '24rpx', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ fontSize: '48rpx' }}>🐱</Text>
              </View>
              <View>
                <Text style={{ fontSize: '30rpx', fontWeight: '500', display: 'block' }}>{result.cat_name || '校园猫猫'}</Text>
                <Text style={{ fontSize: '22rpx', color: '#059669', display: 'block' }}>高置信度匹配</Text>
              </View>
            </View>
          </View>
          <View onClick={() => Taro.navigateTo({ url: `/pages/cat-detail/index?id=${result.cat_id}` })}
            style={{ backgroundColor: '#F97316', borderRadius: '999rpx', padding: '24rpx', textAlign: 'center', color: '#fff', fontSize: '28rpx', marginBottom: '16rpx' }}>
            查看猫猫档案
          </View>
          <View onClick={reset} style={{ border: '1rpx solid #F97316', borderRadius: '999rpx', padding: '24rpx', textAlign: 'center', color: '#F97316', fontSize: '28rpx' }}>
            重新识别
          </View>
        </View>
      )}

      {phase === 'uncertain' && result && (
        <View>
          <View style={{ backgroundColor: '#FEF3C7', borderRadius: '16rpx', padding: '20rpx', marginBottom: '20rpx' }}>
            <Text style={{ color: '#D97706', fontSize: '26rpx' }}>⚠️ 找到几个相似的猫咪，请确认是哪一只</Text>
          </View>
          {(result.candidates || []).map((candidate: any, index: number) => (
            <View key={candidate.cat_id || index} className='card' style={{ marginBottom: '16rpx' }}
              onClick={() => handleConfirmCandidate(candidate)}>
              <View style={{ display: 'flex', alignItems: 'center', gap: '20rpx' }}>
                <View style={{ width: '80rpx', height: '80rpx', borderRadius: '20rpx', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Text style={{ fontSize: '40rpx' }}>🐱</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: '28rpx', fontWeight: '500', display: 'block' }}>{candidate.cat_name}</Text>
                  <View style={{ height: '8rpx', backgroundColor: '#E7E5E4', borderRadius: '4rpx', marginTop: '8rpx' }}>
                    <View style={{ height: '100%', width: `${Math.round((candidate.confidence || 0) * 100)}%`, backgroundColor: '#F97316', borderRadius: '4rpx' }} />
                  </View>
                </View>
              </View>
            </View>
          ))}
          <View onClick={reset} style={{ border: '1rpx solid #E7E5E4', borderRadius: '999rpx', padding: '24rpx', textAlign: 'center', color: '#78716C', fontSize: '28rpx' }}>
            都不对，重新拍
          </View>
        </View>
      )}

      {phase === 'unknown' && (
        <View className='card' style={{ textAlign: 'center' }}>
          <Text style={{ fontSize: '48rpx', display: 'block' }}>🐾</Text>
          <Text style={{ fontSize: '28rpx', fontWeight: '500', display: 'block', marginTop: '16rpx' }}>发现新朋友！</Text>
          <Text style={{ fontSize: '22rpx', color: '#A8A29E', display: 'block', marginTop: '8rpx' }}>AI 初步判断它可能还没入库，提交后将由猫协复核</Text>
          <View onClick={handleSubmitDiscovery} style={{ backgroundColor: '#F97316', borderRadius: '999rpx', padding: '24rpx', color: '#fff', fontSize: '28rpx', marginTop: '24rpx' }}>
            提交给 AI 与猫协审核 →
          </View>
          <View onClick={reset} style={{ marginTop: '16rpx', fontSize: '24rpx', color: '#A8A29E' }}>取消</View>
        </View>
      )}

      {phase === 'error' && (
        <View>
          <View style={{ backgroundColor: '#FEE2E2', borderRadius: '16rpx', padding: '24rpx', marginBottom: '20rpx' }}>
            <Text style={{ color: '#DC2626', fontSize: '26rpx', textAlign: 'center', display: 'block' }}>{message || '识别失败，请重试'}</Text>
          </View>
          <View onClick={reset} style={{ border: '1rpx solid #E7E5E4', borderRadius: '999rpx', padding: '24rpx', textAlign: 'center', color: '#78716C', fontSize: '28rpx' }}>
            重新选择图片
          </View>
        </View>
      )}

      {phase === 'idle' && (
        <View style={{ marginTop: '32rpx', padding: '24rpx', backgroundColor: '#fff', borderRadius: '16rpx', border: '1rpx solid #E7E5E4' }}>
          <Text style={{ fontSize: '24rpx', color: '#A8A29E', lineHeight: '44rpx', display: 'block' }}>
            · 尽量拍清晰的正面或侧面照片{'\n'}· 光线充足识别效果更佳{'\n'}· 识别不确定时会展示多个候选
          </Text>
        </View>
      )}
    </View>
  )
}
