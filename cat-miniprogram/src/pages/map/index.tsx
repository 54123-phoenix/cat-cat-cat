import { useEffect, useRef, useState } from 'react'
import { View, Text, Map, Image, Button } from '@tarojs/components'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { CONFIG } from '../../config'
import { getHeatmapData, getCats } from '../../services/api'
import { createMapLoader, MapData, MapMarker } from '../../services/mapData'
import './index.scss'

export default function MapPage() {
  const [data, setData] = useState<MapData>({ markers: [], errors: [], loading: true })
  const [center, setCenter] = useState(CONFIG.mapCenter)
  const [selected, setSelected] = useState<MapMarker['detail'] | null>(null)
  const [mapError, setMapError] = useState(false)
  const [mapVersion, setMapVersion] = useState(0)
  const [locationError, setLocationError] = useState('')
  const locationRequest = useRef(0)
  const loader = useRef<ReturnType<typeof createMapLoader> | null>(null)
  if (!loader.current) loader.current = createMapLoader(
    () => getHeatmapData({ days: 0, limit: 100 }),
    () => getCats({ limit: 100 }),
    setData,
  )

  function refresh() {
    setSelected(null)
    void loader.current?.load()
  }

  function leavePage() {
    loader.current?.cancel()
    locationRequest.current += 1
  }

  useDidShow(refresh)
  useDidHide(leavePage)
  useEffect(() => leavePage, [])

  async function locate() {
    const request = ++locationRequest.current
    setLocationError('')
    try {
      const result = await Taro.getLocation({ type: 'gcj02' })
      if (request === locationRequest.current) setCenter({ latitude: result.latitude, longitude: result.longitude })
    } catch {
      if (request === locationRequest.current) setLocationError('未能获取位置，仍可查看校园地图。请检查定位授权后重试。')
    }
  }

  function retryMap() {
    setMapError(false)
    setMapVersion(value => value + 1)
    refresh()
  }

  const empty = !data.loading && data.markers.length === 0

  return (
    <View className='map-page'>
      <Map
        key={mapVersion}
        className='campus-map'
        latitude={center.latitude}
        longitude={center.longitude}
        scale={15}
        markers={data.markers}
        showLocation
        onMarkerTap={event => setSelected(data.markers.find(marker => marker.id === event.detail.markerId)?.detail || null)}
        onError={() => setMapError(true)}
      />
      <View className='map-status'>
        {data.loading && <Text className='status-title'>正在加载校园点位…</Text>}
        {!data.loading && data.markers.length > 0 && <Text className='status-title'>当前显示 {data.markers.length} 个点位</Text>}
        {empty && <Text className='status-title'>{data.errors.length ? '暂时无法完整读取校园点位' : '还没有可显示的校园点位'}</Text>}
        {empty && !data.errors.length && <Text className='status-description'>带位置的偶遇经审核后会出现在这里。</Text>}
        {data.errors.length > 0 && <Text className='status-description'>{data.errors.join('；')}。{data.markers.length ? '当前仅展示成功读取的数据。' : '请检查网络后重试。'}</Text>}
        {mapError && <Text className='status-description'>底图加载失败，请检查网络后重新加载。</Text>}
        {locationError && <Text className='status-description'>{locationError}</Text>}
        <View className='map-status-actions'>
          <Button size='mini' disabled={data.loading} onClick={mapError ? retryMap : refresh}>{mapError ? '重新加载地图' : data.errors.length ? '重试加载点位' : '刷新点位'}</Button>
          <Button size='mini' onClick={locate}>定位到我</Button>
        </View>
      </View>
      {selected && (
        <View className='map-popup-card'>
          <View className='popup-header'>
            <View className='popup-avatar'>
              {selected.avatar ? <Image src={selected.avatar} mode='aspectFill' /> : <Text>🐾</Text>}
            </View>
            <View className='popup-info'>
              <Text className='popup-name'>{selected.name}</Text>
              <Text className='popup-loc'>{selected.source}{selected.location ? ` · ${selected.location}` : ''}</Text>
            </View>
            <Button className='popup-close' size='mini' onClick={() => setSelected(null)}>关闭</Button>
          </View>
          <View className='popup-actions'>
            {selected.id && <Button className='popup-btn primary' onClick={() => Taro.navigateTo({ url: `/pages/cat-detail/index?id=${selected.id}` })}>查看档案</Button>}
            <Button className='popup-btn' onClick={() => Taro.openLocation({ latitude: selected.latitude, longitude: selected.longitude, name: selected.name, address: selected.location || '' }).catch(() => Taro.showToast({ title: '无法打开导航，请重试', icon: 'none' }))}>导航到此处</Button>
          </View>
        </View>
      )}
    </View>
  )
}
