import { useState } from 'react'
import { View, Text, Map } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { CONFIG } from '../../config'
import { getFeedingPoints, getSightings } from '../../services/api'

interface Marker {
  id: number
  latitude: number
  longitude: number
  iconPath?: string
  width?: number
  height?: number
  title?: string
  callout?: { content: string; fontSize: number; borderRadius: number; padding: number }
}

export default function MapPage() {
  const [markers, setMarkers] = useState<Marker[]>([])
  const [latitude, setLatitude] = useState(CONFIG.mapCenter.latitude)
  const [longitude, setLongitude] = useState(CONFIG.mapCenter.longitude)
  const [loading, setLoading] = useState(true)

  useDidShow(() => {
    Promise.all([
      getFeedingPoints().catch(() => []),
      getSightings({ limit: 20 }).catch(() => []),
    ]).then(([points, sightings]) => {
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
      const sights: Marker[] = (Array.isArray(sightings) ? sightings : []).map((s: any, i: number) => ({
        id: 10000 + i,
        latitude: s.latitude || CONFIG.mapCenter.latitude + (Math.random() - 0.5) * 0.005,
        longitude: s.longitude || CONFIG.mapCenter.longitude + (Math.random() - 0.5) * 0.005,
        iconPath: '/assets/map/cat.png',
        width: 32,
        height: 32,
        title: s.cat?.name || '猫猫',
        callout: { content: s.cat?.name || '猫猫出没', fontSize: 12, borderRadius: 8, padding: 6 },
      }))
      setMarkers([...pts, ...sights])
    }).catch(console.error).finally(() => setLoading(false))

    Taro.getLocation({ type: 'gcj02' }).then((res) => {
      setLatitude(res.latitude)
      setLongitude(res.longitude)
    }).catch(() => {})
  })

  function onMarkerTap(e: any) {
    const marker = markers.find(m => m.id === e.detail.markerId)
    if (marker && marker.title) {
      Taro.showToast({ title: marker.title, icon: 'none', duration: 1500 })
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
    </View>
  )
}
