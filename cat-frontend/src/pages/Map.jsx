import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import AMapLoader from '@amap/amap-jsapi-loader'
import { MapPin, Navigation, HelpCircle } from 'lucide-react'
import CatSpinner from '../components/CatSpinner'
import { getHeatmapData, getCats } from '../api'

const AMAP_KEY = '8bb4b6d1e109f76821e371e059623c22'
const campusCenter = [121.5068, 31.3005]

// WGS-84 → GCJ-02
const PI = Math.PI
const A = 6378245.0
const EE = 0.00669342162296594323

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

export default function Map() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showGeoModal, setShowGeoModal] = useState(true)
  const [geoLoading, setGeoLoading] = useState(false)
  const [days, setDays] = useState(0)
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const AMapRef = useRef(null)
  const catMarkersRef = useRef([])

  const handleAllowLocation = useCallback(() => {
    setGeoLoading(true)
    setShowGeoModal(false)
  }, [])

  const handleSkipLocation = useCallback(() => {
    setShowGeoModal(false)
  }, [])

  useEffect(() => {
    let map = null
    setError(null)
    setLoading(true)

    AMapLoader.load({
      key: AMAP_KEY,
      version: '1.4.15',
      plugins: ['AMap.Scale', 'AMap.Marker', 'AMap.Geolocation'],
    })
      .then((AMap) => {
        AMapRef.current = AMap
        map = new AMap.Map(mapRef.current, {
          zoom: 16,
          center: campusCenter,
          mapStyle: 'amap://styles/whitesmoke',
          resizeEnable: true,
        })
        map.addControl(new AMap.Scale())
        mapInstanceRef.current = map
        setMapReady(true)
      })
      .catch((e) => {
        console.error('高德地图加载失败:', e)
        setError('地图加载失败，请检查网络或 API Key 配置')
      })
      .finally(() => setLoading(false))

    return () => {
      if (map) map.destroy()
    }
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || showGeoModal) return

    const timer = setTimeout(() => {
      map.plugin('AMap.Geolocation', () => {
        const geolocation = new AMap.Geolocation({
          enableHighAccuracy: true,
          GeoLocationFirst: true,
          noIpLocate: 3,
          maximumAge: 0,
          timeout: 15000,
          convert: true,
          showButton: false,
          showMarker: false,
          showCircle: false,
          panToLocation: true,
          zoomToAccuracy: false,
        })
        map.addControl(geolocation)

        geolocation.getCurrentPosition((status, result) => {
          if (status === 'complete') {
            const pos = result.position
            const [gcjLng, gcjLat] = result.isConverted
              ? [pos.lng, pos.lat]
              : wgs84ToGcj02(pos.lng, pos.lat)

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
            map.setCenter(new AMap.LngLat(gcjLng, gcjLat))
            map.setZoom(16)
          } else {
            console.error('定位失败:', result.info, result.message)
          }
          setGeoLoading(false)
        })
      })
    }, 300)

    return () => clearTimeout(timer)
  }, [showGeoModal])

  useEffect(() => {
    const map = mapInstanceRef.current
    const AMap = AMapRef.current
    if (!map || !AMap) return

    let cancelled = false

    async function loadMarkers() {
      try {
        const [heatmap, cats] = await Promise.all([
          getHeatmapData({ days, limit: 100 }),
          getCats().catch(() => []),
        ])
        if (cancelled) return

        const catByName = new Map()
        for (const c of cats) {
          if (c.name) catByName.set(c.name, c.id)
        }

        catMarkersRef.current.forEach((m) => map.remove(m))
        catMarkersRef.current = []

        for (const point of heatmap) {
          if (!point.latitude || !point.longitude) continue
          const catId = catByName.get(point.name)
          const markerContent = document.createElement('div')
          markerContent.innerHTML = `<div style="
            width: 32px; height: 32px;
            display: flex; align-items: center; justify-content: center;
            font-size: 22px; line-height: 1;
            background: rgba(255,255,255,0.9);
            border: 2px solid #F97316;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.25);
            cursor: pointer;
          ">🐱</div>`

          const marker = new AMap.Marker({
            position: new AMap.LngLat(point.longitude, point.latitude),
            content: markerContent,
            offset: new AMap.Pixel(-16, -16),
            zIndex: 110,
          })

          const infoWindow = new AMap.InfoWindow({
            content: `<div style="padding:6px 10px;font-size:14px;font-weight:600;">${point.name}${point.count ? ` · 目击 ${point.count} 次` : ''}</div>`,
            offset: new AMap.Pixel(0, -20),
          })

          marker.on('click', () => {
            infoWindow.open(map, marker.getPosition())
            if (catId) {
              setTimeout(() => navigate(`/cats/${catId}`), 600)
            }
          })

          map.add(marker)
          catMarkersRef.current.push(marker)
        }
      } catch (e) {
        console.error('加载热力数据失败:', e)
      }
    }

    loadMarkers()

    return () => {
      cancelled = true
      if (map) {
        catMarkersRef.current.forEach((m) => map.remove(m))
        catMarkersRef.current = []
      }
    }
  }, [days, navigate, mapReady])

  return (
    <div className="fixed inset-0 z-30 top-[52px] bottom-16">
      {/* Map container - always rendered so ref is always available */}
      <div ref={mapRef} className="w-full h-full amap-container" />

      {/* Time filter row */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex gap-2 bg-white/90 backdrop-blur rounded-full px-2 py-1.5 shadow-md">
        {[
          { label: '24小时', value: 1 },
          { label: '7天', value: 7 },
          { label: '全部', value: 0 },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setDays(opt.value)}
            className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${
              days === opt.value
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:bg-gray-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-warm-50/80">
          <CatSpinner size={36} />
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4 bg-warm-50/90">
          <HelpCircle className="w-10 h-10 text-text-muted" />
          <p className="text-stone-500 text-center">{error}</p>
          <p className="text-stone-400 text-sm text-center">
            请前往 <a href="https://console.amap.com/dev/key/app" target="_blank" rel="noreferrer" className="text-primary underline">高德开放平台</a> 申请有效的 API Key
          </p>
        </div>
      )}

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
