import { useState } from 'react'
import { View, Text, Map, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { CONFIG } from '../../config'
import { getHeatmapData, getCats } from '../../services/api'
import './index.scss'

interface Marker {
  id: number
  latitude: number
  longitude: number
  iconPath?: string
  width?: number
  height?: number
  title?: string
  callout?: { content: string; fontSize: number; borderRadius: number; padding: number }
  _cat?: any
}

const FALLBACK_CATS: { name: string; latitude: number; longitude: number }[] = [
  { name: '皮球', latitude: 31.302, longitude: 121.504 },
  { name: '尔康', latitude: 31.299, longitude: 121.505 },
  { name: '可可', latitude: 31.303, longitude: 121.503 },
  { name: '橙子', latitude: 31.301, longitude: 121.501 },
  { name: '米线', latitude: 31.300, longitude: 121.500 },
  { name: '小小灰', latitude: 31.300, longitude: 121.506 },
]

export default function MapPage() {
  const [markers, setMarkers] = useState<Marker[]>([])
  const [latitude, setLatitude] = useState(CONFIG.mapCenter.latitude)
  const [longitude, setLongitude] = useState(CONFIG.mapCenter.longitude)
  const [loading, setLoading] = useState(true)
  const [selectedCat, setSelectedCat] = useState<any>(null)

  useDidShow(() => {
    Promise.all([
      getHeatmapData({ days: 0, limit: 100 }).catch(() => []),
      getCats().catch(() => []),
    ]).then(([heatmap, cats]) => {
      const heatArr = Array.isArray(heatmap) ? heatmap : (heatmap as any)?.points || []
      const heatMarkers: Marker[] = heatArr
        .filter((h: any) => h && (h.latitude || h.lat) && (h.longitude || h.lng))
        .map((h: any, i: number) => {
          const cat = h.cat || h.cat_info || null
          const name = cat?.name || h.name || h.location_name || '猫猫出没'
          return {
            id: 10000 + i,
            latitude: h.latitude || h.lat,
            longitude: h.longitude || h.lng,
            iconPath: '/assets/map/cat.png',
            width: 32,
            height: 32,
            title: name,
            callout: { content: name, fontSize: 12, borderRadius: 8, padding: 6 },
            _cat: cat,
          }
        })

      const catMarkers: Marker[] = (Array.isArray(cats) ? cats : [])
        .filter((c: any) => c.latitude && c.longitude)
        .map((c: any) => ({
          id: 20000 + c.id,
          latitude: c.latitude,
          longitude: c.longitude,
          iconPath: '/assets/map/cat.png',
          width: 32,
          height: 32,
          title: c.name,
          callout: { content: c.name || '猫猫', fontSize: 12, borderRadius: 8, padding: 6 },
          _cat: c,
        }))

      let combined = [...heatMarkers, ...catMarkers]
      if (combined.length === 0) {
        combined = FALLBACK_CATS.map((c, i) => ({
          id: 30000 + i,
          latitude: c.latitude,
          longitude: c.longitude,
          iconPath: '/assets/map/cat.png',
          width: 32,
          height: 32,
          title: c.name,
          callout: { content: c.name, fontSize: 12, borderRadius: 8, padding: 6 },
          _cat: { name: c.name, latitude: c.latitude, longitude: c.longitude, location: '复旦大学' },
        }))
      }
      setMarkers(combined)
    }).catch(console.error).finally(() => setLoading(false))

    Taro.getLocation({ type: 'gcj02' }).then((res) => {
      setLatitude(res.latitude)
      setLongitude(res.longitude)
    }).catch(() => {})
  })

  function onMarkerTap(e: any) {
    const marker = markers.find(m => m.id === e.detail.markerId)
    if (marker?._cat) {
      setSelectedCat(marker._cat)
    }
  }

  return (
    <View style={{ width: '100%', height: '100%' }}>
      {loading && (
        <View style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
          <Text style={{ fontSize: '28rpx', color: '#78716C' }}>加载地图中...</Text>
        </View>
      )}
      <Map
        style={{ width: '100%', height: '100%' }}
        latitude={latitude}
        longitude={longitude}
        scale={15}
        markers={markers as any}
        showLocation
        onMarkerTap={onMarkerTap}
        onError={() => {}}
      />

      {selectedCat && (
        <View className='map-popup-card'>
          <View className='popup-handle' onClick={() => setSelectedCat(null)} />
          <View className='popup-content'>
            <View className='popup-header'>
              <View className='popup-avatar'>
                {selectedCat.avatar ? <Image src={selectedCat.avatar} mode='aspectFill' /> : <Text>🐱</Text>}
              </View>
              <View className='popup-info'>
                <Text className='popup-name'>{selectedCat.name}</Text>
                {selectedCat.location && <Text className='popup-loc'>📍 {selectedCat.location}</Text>}
              </View>
              <Text className='popup-distance'>约 50m</Text>
            </View>
            <View className='popup-actions'>
              <View className='popup-btn primary' onClick={() => Taro.navigateTo({ url: `/pages/cat-detail/index?id=${selectedCat.id}` })}>
                <Text>查看档案</Text>
              </View>
              <View className='popup-btn' onClick={() => Taro.openLocation({ latitude: selectedCat.latitude, longitude: selectedCat.longitude, name: selectedCat.name, address: selectedCat.location })}>
                <Text>导航过去</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
