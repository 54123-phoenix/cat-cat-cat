import { useState } from 'react'
import { View, Text, Map, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { CONFIG } from '../../config'
import { getFeedingPoints, getSightings, getCats } from '../../services/api'
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

export default function MapPage() {
  const [markers, setMarkers] = useState<Marker[]>([])
  const [latitude, setLatitude] = useState(CONFIG.mapCenter.latitude)
  const [longitude, setLongitude] = useState(CONFIG.mapCenter.longitude)
  const [loading, setLoading] = useState(true)
  const [selectedCat, setSelectedCat] = useState<any>(null)

  useDidShow(() => {
    Promise.all([
      getFeedingPoints().catch(() => []),
      getSightings({ limit: 20 }).catch(() => []),
      getCats().catch(() => []),
    ]).then(([points, sightings, cats]) => {
      const pts: Marker[] = (Array.isArray(points) ? points : []).map((p: any) => ({
        id: p.id,
        latitude: p.latitude,
        longitude: p.longitude,
        iconPath: '/assets/map/food.png',
        width: 28,
        height: 28,
        title: p.name,
        callout: { content: p.name || '喂食点', fontSize: 12, borderRadius: 8, padding: 6 },
      }))
      const sights: Marker[] = (Array.isArray(sightings) ? sightings : []).map((s: any, i: number) => {
        const cat = s.cat
        return {
          id: 10000 + i,
          latitude: s.latitude || CONFIG.mapCenter.latitude + (Math.random() - 0.5) * 0.005,
          longitude: s.longitude || CONFIG.mapCenter.longitude + (Math.random() - 0.5) * 0.005,
          iconPath: '/assets/map/cat.png',
          width: 32,
          height: 32,
          title: cat?.name || '猫猫',
          callout: { content: cat?.name || '猫猫出没', fontSize: 12, borderRadius: 8, padding: 6 },
          _cat: cat || null,
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
      setMarkers([...pts, ...sights, ...catMarkers])
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
        markers={markers}
        showLocation
        onMarkerTap={onMarkerTap}
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
