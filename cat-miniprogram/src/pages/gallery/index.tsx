import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getGalleryImages } from '../../services/api'

export default function Gallery() {
  const [images, setImages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useDidShow(() => {
    setLoading(true)
    setError('')
    getGalleryImages({ limit: 80 })
      .then((data) => setImages(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || '照片墙加载失败'))
      .finally(() => setLoading(false))
  })

  return (
    <View className='page' style={{ padding: '24rpx' }}>
      <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24rpx' }}>
        <View>
          <Text style={{ fontSize: '36rpx', fontWeight: 'bold', display: 'block' }}>猫猫照片墙</Text>
          <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginTop: '4rpx' }}>猫协上传的参考照片会汇聚在这里</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ textAlign: 'center', padding: '80rpx 0' }}>
          <Text style={{ fontSize: '48rpx', display: 'block' }}>🐾</Text>
          <Text style={{ fontSize: '28rpx', color: '#A8A29E', display: 'block', marginTop: '16rpx' }}>加载照片中…</Text>
        </View>
      ) : error ? (
        <View style={{ backgroundColor: '#FEE2E2', borderRadius: '16rpx', padding: '24rpx', textAlign: 'center' }}>
          <Text style={{ fontSize: '26rpx', color: '#DC2626' }}>{error}</Text>
        </View>
      ) : images.length > 0 ? (
        <View style={{ display: 'flex', flexWrap: 'wrap', gap: '16rpx' }}>
          {images.map((img: any) => (
            <View key={img.id} style={{ width: 'calc(50% - 8rpx)' }}
              onClick={() => img.cat_id && Taro.navigateTo({ url: `/pages/cat-detail/index?id=${img.cat_id}` })}>
              <View className='card' style={{ padding: 0, overflow: 'hidden' }}>
                <View style={{ width: '100%', height: '300rpx', backgroundColor: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <Image
                    src={img.image_path}
                    mode='aspectFill'
                    style={{ width: '100%', height: '100%' }}
                  />
                  <View style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7ED' }}>
                    <Text style={{ fontSize: '48rpx' }}>🐱</Text>
                  </View>
                </View>
                <View style={{ padding: '16rpx 20rpx' }}>
                  <Text style={{ fontSize: '26rpx', fontWeight: '500', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {img.cat?.name || '校园猫猫'}
                  </Text>
                  <Text style={{ fontSize: '22rpx', color: '#A8A29E', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {img.cat?.location || '参考照片'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className='card' style={{ textAlign: 'center', padding: '80rpx 24rpx' }}>
          <Text style={{ fontSize: '56rpx', display: 'block' }}>📷</Text>
          <Text style={{ fontSize: '28rpx', fontWeight: '500', color: '#78716C', display: 'block', marginTop: '16rpx' }}>还没有参考照片</Text>
          <View onClick={() => Taro.navigateTo({ url: '/pages/admin/index' })}
            style={{ backgroundColor: '#F97316', color: '#fff', borderRadius: '999rpx', padding: '20rpx 48rpx', display: 'inline-block', marginTop: '24rpx', fontSize: '28rpx' }}>
            去上传照片
          </View>
        </View>
      )}
    </View>
  )
}
