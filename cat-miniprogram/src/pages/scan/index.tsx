import { useState } from 'react'
import { View, Text, Image, Input, Textarea, Picker } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { identifyCat, createSighting, createDiscovery } from '../../services/api'
import { campusLocations } from '../../services/campusLocations'
import ScanAnimation from '../../components/ScanAnimation'

type Phase = 'idle' | 'ready' | 'loading' | 'confirmed' | 'uncertain' | 'unknown' | 'error'

export default function Scan() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [preview, setPreview] = useState('')
  const [result, setResult] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [discoveryNote, setDiscoveryNote] = useState('')
  const [filePath, setFilePath] = useState('')

  const [sightingOpen, setSightingOpen] = useState(false)
  const [sightingLocation, setSightingLocation] = useState('')
  const [sightingNote, setSightingNote] = useState('')
  const [sightingSubmitting, setSightingSubmitting] = useState(false)
  const [locationPickerIdx, setLocationPickerIdx] = useState(0)

  useDidShow(() => {
    setPhase('idle')
    setResult(null)
    setDiscoveryNote('')
    setMessage('')
    closeSighting()
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
    if (!filePath) {
      setMessage('请先选择照片')
      return
    }
    setMessage('')
    try {
      await createDiscovery({
        file: filePath,
        locationName: sightingLocation || '未知',
        note: discoveryNote,
      })
      setMessage('线索已提交，等待猫协审核')
      setPhase('idle')
      setPreview('')
      setFilePath('')
      setDiscoveryNote('')
    } catch (err: any) {
      setMessage(err.message || '提交失败，请重试')
    }
  }

  function openSighting() {
    setSightingOpen(true)
    setSightingLocation('')
    setSightingNote('')
    setLocationPickerIdx(0)
  }

  function closeSighting() {
    setSightingOpen(false)
    setSightingLocation('')
    setSightingNote('')
    setSightingSubmitting(false)
  }

  async function submitSighting() {
    if (!result?.cat_id) return
    if (!sightingLocation) {
      Taro.showToast({ title: '请选择地点', icon: 'none' })
      return
    }
    setSightingSubmitting(true)
    try {
      await createSighting({
        catId: result.cat_id,
        location: sightingLocation,
        confidence: result.confidence,
        activity_type: sightingNote || undefined,
      })
      Taro.showToast({ title: '记录已提交', icon: 'success' })
      closeSighting()
    } catch (err: any) {
      Taro.showToast({ title: err.message || '提交失败', icon: 'none' })
    } finally {
      setSightingSubmitting(false)
    }
  }

  function reset() {
    setPhase('idle')
    setPreview('')
    setFilePath('')
    setResult(null)
    setDiscoveryNote('')
    setMessage('')
    closeSighting()
  }

  const confidencePct = Math.round((result?.confidence || 0) * 100)

  return (
    <View className='page' style={{ padding: '24rpx', paddingBottom: sightingOpen ? '600rpx' : '24rpx' }}>
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
        <View style={{ borderRadius: '24rpx', overflow: 'hidden', marginBottom: '24rpx', position: 'relative' }}>
          <Image src={preview} mode='aspectFill' style={{ width: '100%', height: '500rpx' }} />
          {phase === 'loading' && (
            <View className='eye-scan-overlay'>
              <View className='eye-scan-line' />
              <View className='eye-scan-dot' />
            </View>
          )}
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

      {phase === 'loading' && <ScanAnimation message={message || 'AI 正在识别中…'} />}

      {phase === 'confirmed' && result && (
        <View>
          <View style={{ backgroundColor: '#D1FAE5', borderRadius: '16rpx', padding: '20rpx', marginBottom: '20rpx' }}>
            <Text style={{ color: '#059669', fontSize: '26rpx' }}>✅ 识别成功 · 置信度 {confidencePct}%</Text>
          </View>

          <View className='card' style={{ marginBottom: '20rpx', overflow: 'hidden' }}>
            <View style={{ display: 'flex', gap: '20rpx', padding: '20rpx' }}>
              <Image src={preview} mode='aspectFill' style={{ width: '140rpx', height: '140rpx', borderRadius: '16rpx', flexShrink: 0 }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: '32rpx', fontWeight: '600', display: 'block', marginBottom: '8rpx' }}>{result.cat_name || '校园猫猫'}</Text>
                <Text style={{ fontSize: '22rpx', color: '#059669', display: 'block', marginBottom: '12rpx' }}>高置信度匹配</Text>
                <View style={{ display: 'flex', alignItems: 'center', gap: '12rpx' }}>
                  <View style={{ flex: 1, height: '12rpx', backgroundColor: '#E7E5E4', borderRadius: '6rpx', overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${confidencePct}%`, backgroundColor: '#10B981', borderRadius: '6rpx' }} />
                  </View>
                  <Text style={{ fontSize: '22rpx', color: '#059669', fontWeight: '500' }}>{confidencePct}%</Text>
                </View>
              </View>
            </View>
          </View>

          <View onClick={() => Taro.navigateTo({ url: `/pages/cat-detail/index?id=${result.cat_id}` })}
            style={{ backgroundColor: '#F97316', borderRadius: '999rpx', padding: '24rpx', textAlign: 'center', color: '#fff', fontSize: '28rpx', marginBottom: '16rpx' }}>
            查看猫猫档案
          </View>
          <View onClick={openSighting} style={{
            backgroundColor: '#fff', border: '1rpx solid #F97316', borderRadius: '999rpx',
            padding: '24rpx', textAlign: 'center', color: '#F97316', fontSize: '28rpx', marginBottom: '16rpx',
          }}>
            📍 快速打卡 · 记录一次目击
          </View>
          <View onClick={reset} style={{ textAlign: 'center', color: '#A8A29E', fontSize: '26rpx' }}>
            重新识别
          </View>
        </View>
      )}

      {phase === 'uncertain' && result && (
        <View>
          <View style={{ backgroundColor: '#FEF3C7', borderRadius: '16rpx', padding: '20rpx', marginBottom: '20rpx' }}>
            <Text style={{ color: '#D97706', fontSize: '26rpx' }}>⚠️ 找到几个相似的猫咪，请确认是哪一只</Text>
          </View>
          {(result.candidates || []).slice(0, 3).map((candidate: any, index: number) => {
            const cPct = Math.round((candidate.confidence || 0) * 100)
            return (
              <View key={candidate.cat_id || index} className='card' style={{ marginBottom: '16rpx' }}
                onClick={() => handleConfirmCandidate(candidate)}>
                <View style={{ display: 'flex', alignItems: 'center', gap: '20rpx' }}>
                  <View style={{ width: '80rpx', height: '80rpx', borderRadius: '20rpx', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Text style={{ fontSize: '40rpx' }}>🐱</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: '28rpx', fontWeight: '500', display: 'block', marginBottom: '8rpx' }}>{candidate.cat_name}</Text>
                    <View style={{ display: 'flex', alignItems: 'center', gap: '12rpx' }}>
                      <View style={{ flex: 1, height: '10rpx', backgroundColor: '#E7E5E4', borderRadius: '5rpx', overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${cPct}%`, backgroundColor: '#F97316', borderRadius: '5rpx' }} />
                      </View>
                      <Text style={{ fontSize: '22rpx', color: '#F97316' }}>{cPct}%</Text>
                    </View>
                  </View>
                </View>
              </View>
            )
          })}
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

          <View style={{ textAlign: 'left', marginTop: '24rpx' }}>
            <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginBottom: '12rpx' }}>补充备注（可选）</Text>
            <Textarea
              value={discoveryNote}
              onInput={e => setDiscoveryNote(e.detail.value)}
              placeholder='例如：橘白相间，左耳有缺口，常在光草出没'
              style={{
                width: '100%', minHeight: '120rpx', padding: '16rpx',
                border: '1rpx solid #E7E5E4', borderRadius: '16rpx', fontSize: '26rpx',
                boxSizing: 'border-box',
              }}
            />
          </View>

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

      {sightingOpen && (
        <View onClick={closeSighting} style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, top: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'flex-end',
        }}>
          <View onClick={e => e.stopPropagation()} style={{
            width: '100%', backgroundColor: '#fff', borderRadius: '32rpx 32rpx 0 0',
            padding: '32rpx 24rpx calc(32rpx + env(safe-area-inset-bottom))',
            maxHeight: '80vh', overflowY: 'auto',
          }}>
            <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24rpx' }}>
              <Text style={{ fontSize: '32rpx', fontWeight: '600' }}>📍 快速目击打卡</Text>
              <Text onClick={closeSighting} style={{ fontSize: '36rpx', color: '#A8A29E', padding: '0 12rpx' }}>×</Text>
            </View>

            <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginBottom: '12rpx' }}>目击地点</Text>
            <Picker
              mode='selector'
              range={campusLocations}
              value={locationPickerIdx}
              onChange={e => {
                const idx = Number(e.detail.value)
                setLocationPickerIdx(idx)
                setSightingLocation(campusLocations[idx])
              }}
            >
              <View style={{
                padding: '20rpx', border: '1rpx solid #E7E5E4', borderRadius: '16rpx',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20rpx',
              }}>
                <Text style={{ fontSize: '26rpx', color: sightingLocation ? '#1C1917' : '#A8A29E' }}>
                  {sightingLocation || '请选择校园地点'}
                </Text>
                <Text style={{ fontSize: '22rpx', color: '#A8A29E' }}>▾</Text>
              </View>
            </Picker>

            <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginBottom: '12rpx' }}>手动输入地点（可选）</Text>
            <Input
              value={sightingLocation}
              onInput={e => setSightingLocation(e.detail.value)}
              placeholder='或手动输入地点'
              style={{
                padding: '20rpx', border: '1rpx solid #E7E5E4', borderRadius: '16rpx',
                fontSize: '26rpx', marginBottom: '20rpx', width: '100%', boxSizing: 'border-box',
              }}
            />

            <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginBottom: '12rpx' }}>备注（可选）</Text>
            <Textarea
              value={sightingNote}
              onInput={e => setSightingNote(e.detail.value)}
              placeholder='例如：正在睡觉、吃猫粮、晒太阳…'
              style={{
                width: '100%', minHeight: '120rpx', padding: '16rpx',
                border: '1rpx solid #E7E5E4', borderRadius: '16rpx', fontSize: '26rpx',
                boxSizing: 'border-box', marginBottom: '24rpx',
              }}
            />

            <View onClick={submitSighting} style={{
              backgroundColor: sightingSubmitting ? '#FDBA74' : '#F97316',
              borderRadius: '999rpx', padding: '26rpx', textAlign: 'center',
              color: '#fff', fontSize: '30rpx', fontWeight: '500',
            }}>
              {sightingSubmitting ? '提交中…' : '提交目击记录'}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
