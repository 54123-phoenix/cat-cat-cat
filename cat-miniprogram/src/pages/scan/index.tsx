import { useEffect, useRef, useState } from 'react'
import { View, Text, Image, Input, Textarea, Picker, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { identifyCat, createSighting, createDiscovery } from '../../services/api'
import { campusLocations } from '../../services/campusLocations'
import ScanAnimation from '../../components/ScanAnimation'
import { createSightingSubmission, SightingReceipt, validCoordinates } from '../../services/sightingSubmission'

type Phase = 'idle' | 'ready' | 'loading' | 'confirmed' | 'uncertain' | 'unknown' | 'unavailable' | 'error'

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
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [sightingError, setSightingError] = useState('')
  const [savedSighting, setSavedSighting] = useState<SightingReceipt | null>(null)
  const submission = useRef(createSightingSubmission(createSighting))
  const busy = useRef(false)
  const identifyBusy = useRef(false)
  const discoveryBusy = useRef(false)
  const [discoverySubmitting, setDiscoverySubmitting] = useState(false)
  const generation = useRef(0)
  const locationRequest = useRef(0)

  useEffect(() => () => { generation.current += 1; locationRequest.current += 1 }, [])

  function clearDraft() {
    generation.current += 1
    locationRequest.current += 1
    identifyBusy.current = false
    submission.current = createSightingSubmission(createSighting)
    setSavedSighting(null)
    setSightingOpen(false)
    setSightingLocation('')
    setSightingNote('')
    setCoordinates(null)
    setSightingError('')
    setLocating(false)
    setLocationPickerIdx(0)
  }

  async function handleChooseMedia() {
    if (busy.current || discoveryBusy.current) return
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
      })
      const path = res.tempFiles[0].tempFilePath
      clearDraft()
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
    if (identifyBusy.current || busy.current || savedSighting) return
    if (!filePath) {
      setMessage('请先选择一张照片')
      return
    }
    setPhase('loading')
    setMessage('正在识别中，请稍候...')
    identifyBusy.current = true
    const request = ++generation.current
    try {
      const data = await identifyCat(filePath)
      if (request !== generation.current) return
      const status = data.status
      if (!['confirmed', 'uncertain', 'unknown', 'unavailable'].includes(status)) {
        throw new Error('识别服务返回了无法识别的结果，请重试')
      }
      if (status === 'confirmed' && (!Number.isInteger(data.cat_id) || data.cat_id <= 0)) {
        throw new Error('匹配结果缺少有效的猫咪档案，请重试')
      }
      setResult(data)
      setPhase(status as Phase)
      setMessage('')
      if (status === 'unavailable') setMessage('识别服务暂时不可用，请稍后重试')
    } catch (err: any) {
      if (request !== generation.current) return
      setMessage(err.message || '识别服务暂时不可用，请稍后重试')
      setPhase('error')
    } finally {
      if (request === generation.current) identifyBusy.current = false
    }
  }

  function handleConfirmCandidate(candidate: any) {
    if (busy.current || savedSighting) return
    const catId = candidate.cat_id || candidate.catId
    if (!catId) {
      setMessage('无法确认猫咪身份')
      return
    }
    setResult({ ...candidate, cat_id: catId })
    setPhase('confirmed')
    setSightingOpen(true)
    setSightingError('')
  }

  function openCatPhotos(e: any, catId: number) {
    e?.stopPropagation?.()
    if (!catId) return
    Taro.navigateTo({ url: `/pages/cat-detail/index?id=${catId}` })
  }

  async function handleSubmitDiscovery() {
    if (discoveryBusy.current) return
    if (!filePath) {
      setMessage('请先选择照片')
      return
    }
    discoveryBusy.current = true
    setDiscoverySubmitting(true)
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
    } finally {
      discoveryBusy.current = false
      setDiscoverySubmitting(false)
    }
  }

  function openSighting() {
    if (savedSighting) return
    setSightingOpen(true)
  }

  function closeSighting() {
    if (busy.current) return
    setSightingOpen(false)
  }

  function editLocation(name: string) {
    if (busy.current) return
    locationRequest.current += 1
    setLocating(false)
    setSightingLocation(name)
    setCoordinates(null)
  }

  async function selectCoordinates(fromMap: boolean) {
    if (busy.current) return
    const request = ++locationRequest.current
    setLocating(true)
    setSightingError('')
    try {
      const point = fromMap ? await Taro.chooseLocation({}) : await Taro.getLocation({ type: 'gcj02' })
      if (request !== locationRequest.current) return
      if (!validCoordinates(point)) throw new Error('定位未返回有效坐标，请重新选择')
      setCoordinates({ latitude: point.latitude, longitude: point.longitude })
      const name = 'name' in point && typeof point.name === 'string' ? point.name : ''
      setSightingLocation(current => name || current || '当前位置')
    } catch (error: any) {
      if (request === locationRequest.current && !error.errMsg?.includes('cancel')) setSightingError('未能取得位置。请检查定位授权，或在地图上选择目击位置。')
    } finally {
      if (request === locationRequest.current) setLocating(false)
    }
  }

  async function submitSighting() {
    if (busy.current || savedSighting || !result?.cat_id || locating) return
    busy.current = true
    setSightingSubmitting(true)
    setSightingError('')
    const request = generation.current
    try {
      const receipt = await submission.current.submit({
        catId: result.cat_id,
        file: filePath,
        location: sightingLocation,
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
        confidence: result.confidence,
        note: sightingNote || undefined,
      })
      if (request !== generation.current) return
      setSavedSighting(receipt)
      setSightingOpen(false)
    } catch (err: any) {
      if (request === generation.current) setSightingError(err.message || '尚未确认提交结果。输入已保留，请重试确认。')
    } finally {
      busy.current = false
      if (request === generation.current) setSightingSubmitting(false)
    }
  }

  function reset() {
    if (busy.current || discoveryBusy.current) return
    clearDraft()
    setPhase('idle')
    setPreview('')
    setFilePath('')
    setResult(null)
    setDiscoveryNote('')
    setMessage('')
  }

  const confidencePct = Math.round(Math.max(0, Math.min(1, result?.confidence || 0)) * 100)

  return (
    <View className='page' style={{ padding: '24rpx', paddingBottom: sightingOpen ? '600rpx' : '24rpx' }}>
      <Text style={{ fontSize: '36rpx', fontWeight: 'bold', display: 'block', marginBottom: '24rpx' }}>拍照识猫</Text>
      {message && phase !== 'loading' && phase !== 'error' && phase !== 'unavailable' && <Text style={{ display: 'block', marginBottom: '20rpx', fontSize: '26rpx', color: '#57534E' }}>{message}</Text>}

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

      {preview && (phase === 'ready' || phase === 'loading' || phase === 'confirmed' || phase === 'uncertain' || phase === 'unknown' || phase === 'unavailable' || phase === 'error') && (
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
            <Text style={{ color: '#047857', fontSize: '26rpx', display: 'block' }}>匹配相似度 {confidencePct}% · 请核对猫咪身份</Text>
            <Text style={{ color: '#065F46', fontSize: '24rpx', display: 'block', marginTop: '8rpx' }}>相似度不代表正确概率。确认后再提交偶遇。</Text>
          </View>

          <View className='card' style={{ marginBottom: '20rpx', overflow: 'hidden' }}>
            <View style={{ display: 'flex', gap: '20rpx', padding: '20rpx' }}>
              <Image
                src={result.cat_avatar || preview}
                mode='aspectFill'
                onClick={(e) => openCatPhotos(e, result.cat_id)}
                style={{ width: '140rpx', height: '140rpx', borderRadius: '16rpx', flexShrink: 0 }}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: '32rpx', fontWeight: '600', display: 'block', marginBottom: '8rpx' }}>{result.cat_name || '校园猫猫'}</Text>
                <Text style={{ fontSize: '24rpx', color: '#047857', display: 'block', marginBottom: '12rpx' }}>匹配相似度</Text>
                <View style={{ display: 'flex', alignItems: 'center', gap: '12rpx' }}>
                  <View style={{ flex: 1, height: '12rpx', backgroundColor: '#E7E5E4', borderRadius: '6rpx', overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${confidencePct}%`, backgroundColor: '#10B981', borderRadius: '6rpx' }} />
                  </View>
                  <Text style={{ fontSize: '22rpx', color: '#059669', fontWeight: '500' }}>{confidencePct}%</Text>
                </View>
                <Text onClick={(e) => openCatPhotos(e, result.cat_id)} style={{ fontSize: '22rpx', color: '#F97316', display: 'block', marginTop: '12rpx' }}>
                  查看照片墙{result.photo_count ? ` · ${result.photo_count} 张` : ''}
                </Text>
              </View>
            </View>
          </View>

          <View onClick={() => Taro.navigateTo({ url: `/pages/cat-detail/index?id=${result.cat_id}` })}
            style={{ backgroundColor: '#F97316', borderRadius: '999rpx', padding: '24rpx', textAlign: 'center', color: '#fff', fontSize: '28rpx', marginBottom: '16rpx' }}>
            查看猫猫档案
          </View>
          {savedSighting ? <View style={{ backgroundColor: '#D1FAE5', padding: '24rpx', borderRadius: '16rpx', marginBottom: '20rpx' }}>
            <Text style={{ display: 'block', fontSize: '28rpx', color: '#065F46', fontWeight: '600' }}>偶遇记录 #{savedSighting.id} 已提交</Text>
            <Text style={{ display: 'block', fontSize: '24rpx', color: '#065F46', marginTop: '8rpx' }}>{savedSighting.status === 'approved' ? '审核已通过。' : '等待猫协审核，通过后可在地图显示。'}本次照片已保存。</Text>
          </View> : <View onClick={openSighting} style={{
            backgroundColor: '#fff', border: '1rpx solid #F97316', borderRadius: '999rpx',
            padding: '24rpx', textAlign: 'center', color: '#F97316', fontSize: '28rpx', marginBottom: '16rpx',
          }}>
            📍 确认身份并记录偶遇
          </View>}
          <View onClick={reset} style={{ textAlign: 'center', color: '#A8A29E', fontSize: '26rpx' }}>
            {savedSighting ? '拍摄下一次偶遇' : '重新选择图片'}
          </View>
        </View>
      )}

      {phase === 'uncertain' && result && (
        <View>
          <View style={{ backgroundColor: '#FEF3C7', borderRadius: '16rpx', padding: '20rpx', marginBottom: '20rpx' }}>
            <Text style={{ color: '#D97706', fontSize: '26rpx' }}>⚠️ 找到几个相似的猫咪，请确认是哪一只</Text>
            <Text style={{ color: '#92400E', fontSize: '24rpx', display: 'block', marginTop: '8rpx' }}>匹配相似度不代表正确概率。选择后可补充地点并提交。</Text>
          </View>
          {(result.candidates || []).slice(0, 3).map((candidate: any, index: number) => {
            const cPct = Math.round(Math.max(0, Math.min(1, candidate.confidence || 0)) * 100)
            return (
              <View key={candidate.cat_id || index} className='card' style={{ marginBottom: '16rpx' }}
                onClick={() => handleConfirmCandidate(candidate)}>
                <View style={{ display: 'flex', alignItems: 'center', gap: '20rpx' }}>
                  <View style={{ width: '80rpx', height: '80rpx', borderRadius: '20rpx', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {candidate.cat_avatar ? (
                      <Image
                        src={candidate.cat_avatar}
                        mode='aspectFill'
                        onClick={(e) => openCatPhotos(e, candidate.cat_id)}
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <Text style={{ fontSize: '40rpx' }}>🐱</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: '28rpx', fontWeight: '500', display: 'block', marginBottom: '8rpx' }}>{candidate.cat_name}</Text>
                    <View style={{ display: 'flex', alignItems: 'center', gap: '12rpx' }}>
                      <View style={{ flex: 1, height: '10rpx', backgroundColor: '#E7E5E4', borderRadius: '5rpx', overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${cPct}%`, backgroundColor: '#F97316', borderRadius: '5rpx' }} />
                      </View>
                      <Text style={{ fontSize: '24rpx', color: '#9A3412' }}>匹配相似度 {cPct}%</Text>
                    </View>
                  </View>
                  <View onClick={(e) => openCatPhotos(e, candidate.cat_id)} style={{ padding: '12rpx 0 12rpx 16rpx', flexShrink: 0 }}>
                    <Text style={{ fontSize: '22rpx', color: '#F97316', display: 'block', textAlign: 'right' }}>看照片</Text>
                    <Text style={{ fontSize: '18rpx', color: '#A8A29E', display: 'block', marginTop: '4rpx' }}>
                      {candidate.photo_count ? `${candidate.photo_count} 张` : '档案'}
                    </Text>
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

          <Button disabled={discoverySubmitting} onClick={handleSubmitDiscovery} style={{ backgroundColor: '#F97316', borderRadius: '999rpx', color: '#fff', fontSize: '28rpx', marginTop: '24rpx' }}>
            {discoverySubmitting ? '正在提交线索…' : '提交给猫协审核'}
          </Button>
          <View onClick={reset} style={{ marginTop: '16rpx', fontSize: '24rpx', color: '#A8A29E' }}>取消</View>
        </View>
      )}

      {(phase === 'error' || phase === 'unavailable') && (
        <View>
          <View style={{ backgroundColor: '#FEE2E2', borderRadius: '16rpx', padding: '24rpx', marginBottom: '20rpx' }}>
            <Text style={{ color: '#DC2626', fontSize: '26rpx', textAlign: 'center', display: 'block' }}>{message || '识别失败，请重试'}</Text>
          </View>
          <Button onClick={handleIdentify} style={{ backgroundColor: '#F97316', color: '#fff', borderRadius: '999rpx', marginBottom: '16rpx' }}>使用这张照片重试</Button>
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
              <Text style={{ fontSize: '32rpx', fontWeight: '600' }}>记录与 {result?.cat_name || '猫咪'} 的偶遇</Text>
              <Text onClick={closeSighting} style={{ fontSize: '36rpx', color: '#A8A29E', padding: '0 12rpx' }}>×</Text>
            </View>
            <Text style={{ display: 'block', fontSize: '26rpx', color: '#57534E', marginBottom: '20rpx' }}>将附上这张照片，提交后等待猫协审核。</Text>

            <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginBottom: '12rpx' }}>目击地点</Text>
            <Picker
              mode='selector'
              disabled={sightingSubmitting}
              range={campusLocations}
              value={locationPickerIdx}
              onChange={e => {
                const idx = Number(e.detail.value)
                setLocationPickerIdx(idx)
                editLocation(campusLocations[idx])
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
              disabled={sightingSubmitting}
              maxlength={120}
              onInput={e => editLocation(e.detail.value)}
              placeholder='或手动输入地点'
              style={{
                padding: '20rpx', border: '1rpx solid #E7E5E4', borderRadius: '16rpx',
                fontSize: '26rpx', marginBottom: '20rpx', width: '100%', boxSizing: 'border-box',
              }}
            />

            <View style={{ display: 'flex', gap: '16rpx', marginBottom: '16rpx' }}>
              <Button size='mini' disabled={sightingSubmitting || locating} onClick={() => selectCoordinates(false)}>使用当前位置</Button>
              <Button size='mini' disabled={sightingSubmitting || locating} onClick={() => selectCoordinates(true)}>在地图上选择</Button>
            </View>
            <Text style={{ display: 'block', fontSize: '24rpx', color: '#57534E', marginBottom: '20rpx' }}>
              {locating ? '正在获取位置…' : coordinates ? `已选择坐标 ${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}。请确认是本次目击地点。` : '请选择实际目击位置。校园地点名称不自动对应坐标。'}
            </Text>

            <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginBottom: '12rpx' }}>备注（可选）</Text>
            <Textarea
              value={sightingNote}
              disabled={sightingSubmitting}
              maxlength={500}
              onInput={e => setSightingNote(e.detail.value)}
              placeholder='例如：正在睡觉、吃猫粮、晒太阳…'
              style={{
                width: '100%', minHeight: '120rpx', padding: '16rpx',
                border: '1rpx solid #E7E5E4', borderRadius: '16rpx', fontSize: '26rpx',
                boxSizing: 'border-box', marginBottom: '24rpx',
              }}
            />

            {sightingError && <Text style={{ display: 'block', color: '#B91C1C', fontSize: '26rpx', marginBottom: '16rpx' }}>{sightingError}</Text>}
            <Button disabled={sightingSubmitting || locating} onClick={submitSighting} style={{
              backgroundColor: sightingSubmitting ? '#FDBA74' : '#F97316',
              borderRadius: '999rpx', padding: '26rpx', textAlign: 'center',
              color: '#fff', fontSize: '30rpx', fontWeight: '500',
            }}>
              {sightingSubmitting ? '正在提交偶遇…' : sightingError ? '重试提交偶遇' : '提交这次偶遇'}
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}
