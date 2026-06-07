import { useState } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getGalleryImages } from '../../services/api'
import './index.scss'

export default function Gallery() {
  const [images, setImages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    getGalleryImages({ limit: 80 })
      .then((data: any) => setImages(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  })

  const handlePreview = (current: string, all: string[]) => {
    Taro.previewImage({ current, urls: all })
  }

  if (loading) return <View className='loading'>加载中…</View>
  if (!images.length) return <View className='empty'>还没有参考照片 🐱</View>

  return (
    <ScrollView scrollY className='gallery-waterfall'>
      {images.map((img: any) => (
        <View key={img.id} className='gallery-item'>
          <Image
            src={img.image_path}
            mode='widthFix'
            onClick={() => handlePreview(img.image_path, images.map((i: any) => i.image_path))}
          />
          <View className='gallery-item-info'>
            <Text
              className='gallery-item-name'
              onClick={() => { if (img.cat_id) Taro.navigateTo({ url: `/pages/cat-detail/index?id=${img.cat_id}` }) }}
            >
              {img.cat?.name || '校园猫猫'}
            </Text>
            {img.cat?.location && <Text className='gallery-item-loc'>📍 {img.cat.location}</Text>}
          </View>
        </View>
      ))}
    </ScrollView>
  )
}
