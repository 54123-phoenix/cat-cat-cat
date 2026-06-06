import { useEffect, useState, useRef, useCallback } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'
import { MapPin, Navigation } from 'lucide-react'
import { getCats } from '../api'

// 高德地图 Key - 请在高德开放平台申请自己的 Key
// https://console.amap.com/dev/key/app
const AMAP_KEY = '8bb4b6d1e109f76821e371e059623c22'

// 复旦大学邯郸校区坐标 [lng, lat]
const campusCenter = [121.5068, 31.3005]

// WGS-84 → GCJ-02 坐标转换（高德地图使用 GCJ-02）
const PI = Math.PI
const A = 6378245.0 // 长半轴
const EE = 0.00669342162296594323 // 偏心率平方

function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320.0 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0
  return ret
}

function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0
  return ret
}

function outOfChina(lng, lat) {
  return (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271)
}

function wgs84ToGcj02(wgsLng, wgsLat) {
  if (outOfChina(wgsLng, wgsLat)) return [wgsLng, wgsLat]
  let dLat = transformLat(wgsLng - 105.0, wgsLat - 35.0)
  let dLng = transformLng(wgsLng - 105.0, wgsLat - 35.0)
  const radLat = wgsLat / 180.0 * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI)
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI)
  return [wgsLng + dLng, wgsLat + dLat]
}

const locationCoords = {
  '图书馆': [121.5068, 31.3005],
  '食堂': [121.5055, 31.2995],
  '教学楼': [121.5080, 31.3010],
  '图书馆门口': [121.5068, 31.3005],
  '图书馆草坪': [121.5065, 31.3008],
  '二食堂': [121.5050, 31.2990],
}

export default function Map() {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showGeoModal, setShowGeoModal] = useState(true)
  const [userLocation, setUserLocation] = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    getCats()
      .then(setCats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleAllowLocation = useCallback(() => {
    setGeoLoading(true)
    setShowGeoModal(false)
  }, [])

  const handleSkipLocation = useCallback(() => {
    setShowGeoModal(false)
  }, [])

  useEffect(() => {
    if (loading || !mapRef.current) return

    let map = null

    AMapLoader.load({
      key: AMAP_KEY,
      version: '1.4.15',
      plugins: ['AMap.Scale', 'AMap.Marker', 'AMap.InfoWindow', 'AMap.Geolocation'],
    })
      .then((AMap) => {
        map = new AMap.Map(mapRef.current, {
          zoom: 16,
          center: campusCenter,
          mapStyle: 'amap://styles/whitesmoke',
          resizeEnable: true,
        })

        map.addControl(new AMap.Scale())

        // Add cat markers
        cats.forEach((cat) => {
          const position = getCatPosition(cat)

          // Create custom marker content
          const markerContent = document.createElement('div')
          markerContent.innerHTML = `
            <div style="
              width: 36px; height: 36px;
              background: linear-gradient(135deg, #F97316, #EA580C);
              border: 3px solid white;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.2);
              cursor: pointer;
            ">🐱</div>
          `

          const marker = new AMap.Marker({
            position: new AMap.LngLat(position[0], position[1]),
            content: markerContent,
            offset: new AMap.Pixel(-18, -18),
          })

          // Info window
          const infoWindow = new AMap.InfoWindow({
            content: `
              <div style="padding: 8px; text-align: center; font-family: Inter, sans-serif;">
                <p style="font-weight: 600; margin: 0 0 4px 0;">${cat.name}</p>
                ${cat.location ? `<p style="color: #78716C; font-size: 12px; margin: 0;">📍 ${cat.location}</p>` : ''}
              </div>
            `,
            offset: new AMap.Pixel(0, -24),
          })

          marker.on('click', () => {
            infoWindow.open(map, marker.getPosition())
          })

          map.add(marker)
        })

        mapInstanceRef.current = map
      })
      .catch((e) => {
        console.error('高德地图加载失败:', e)
        setError('地图加载失败，请检查网络或 API Key 配置')
      })

    return () => {
      if (map) {
        map.destroy()
      }
    }
  }, [cats, loading])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || showGeoModal) return

    const timer = setTimeout(() => {
      map.plugin('AMap.Geolocation', () => {
        const geolocation = new AMap.Geolocation({
          enableHighAccuracy: true,
          GeoLocationFirst: true,       // 优先使用浏览器定位（PC端关键）
          noIpLocate: 3,                // 禁用IP定位（精度太差）
          maximumAge: 0,                // 不使用缓存，获取最新位置
          timeout: 15000,               // 增加超时时间（Chrome较慢）
          convert: true,                // 确保转换为GCJ-02坐标系
          showButton: false,
          showMarker: false,
          showCircle: false,
          panToLocation: true,          // 定位成功后平移到用户位置
          zoomToAccuracy: false,
        })
        map.addControl(geolocation)

        geolocation.getCurrentPosition((status, result) => {
          if (status === 'complete') {
            // 诊断：检查定位方式和精度
            console.log('定位方式:', result.location_type) // 'html5'=浏览器, 'ip'=IP定位, 'sdk'=SDK
            console.log('定位精度:', result.accuracy, '米')
            console.log('是否转换坐标:', result.isConverted)

            const pos = result.position
            // 如果高德未转换坐标，手动 WGS-84 → GCJ-02
            const [gcjLng, gcjLat] = result.isConverted
              ? [pos.lng, pos.lat]
              : wgs84ToGcj02(pos.lng, pos.lat)
            console.log('转换后坐标:', gcjLng, gcjLat)

            setUserLocation([gcjLng, gcjLat])

            const userMarkerContent = document.createElement('div')
            userMarkerContent.innerHTML = `
              <div style="
                width: 20px; height: 20px;
                background: #3B82F6;
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 0 0 8px rgba(59,130,246,0.2), 0 2px 8px rgba(0,0,0,0.2);
              "></div>
            `
            const userMarker = new AMap.Marker({
              position: new AMap.LngLat(gcjLng, gcjLat),
              content: userMarkerContent,
              offset: new AMap.Pixel(-10, -10),
              zIndex: 120,
            })
            map.add(userMarker)

            // 平移地图到用户位置
            map.setCenter(new AMap.LngLat(gcjLng, gcjLat))
            map.setZoom(16)
          } else {
            // 定位失败，检查原因
            console.error('定位失败:', result.info, result.message)
          }
          setGeoLoading(false)
        })
      })
    }, 300)

    return () => clearTimeout(timer)
  }, [showGeoModal, loading])

  const getCatPosition = (cat) => {
    if (cat.location && locationCoords[cat.location]) {
      return locationCoords[cat.location]
    }
    // Fallback: slight random offset from campus center
    return [
      campusCenter[0] + (Math.random() - 0.5) * 0.01,
      campusCenter[1] + (Math.random() - 0.5) * 0.01,
    ]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] gap-4 px-4">
        <div className="text-4xl">🗺️</div>
        <p className="text-stone-500 text-center">{error}</p>
        <p className="text-stone-400 text-sm text-center">
          请前往 <a href="https://console.amap.com/dev/key/app" target="_blank" rel="noreferrer" className="text-primary underline">高德开放平台</a> 申请有效的 API Key
        </p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)] -mx-4 -mt-2 relative">
      <div ref={mapRef} className="w-full h-full" />

      {/* Geolocation permission modal overlay */}
      {showGeoModal && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-6" onClick={handleSkipLocation}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-8 text-center space-y-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 mx-auto rounded-full bg-primary-light flex items-center justify-center">
              <MapPin className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-text">是否开启定位？</h2>
              <p className="text-text-secondary">允许获取位置信息，可在地图上查看您的位置</p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={handleAllowLocation} disabled={geoLoading} className="btn-primary w-full flex items-center justify-center gap-2">
                {geoLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Navigation className="w-5 h-5" />}
                {geoLoading ? '定位中...' : '允许定位'}
              </button>
              <button onClick={handleSkipLocation} className="w-full py-3 rounded-xl border border-border font-semibold text-text-secondary bg-white hover:bg-gray-50 transition-colors">暂不开启</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
