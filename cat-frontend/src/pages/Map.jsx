import { useEffect, useRef, useState } from 'react'
import TopBar from '../components/TopBar'
import { fetchHeatmap } from '../api'

const AMAP_SCRIPT_ID = 'amap-js-api'
const AMAP_SRC = 'https://webapi.amap.com/maps?v=2.0&key=0d15d65bde2a1d89e879f0791097d0aa&plugin=AMap.HeatMap'

const RANGE_OPTIONS = [
  { label: '24小时', days: 1 },
  { label: '7天', days: 7 },
  { label: '全部', days: 0 },
]

function loadAmap() {
  if (window.AMap) return Promise.resolve()

  const existing = document.getElementById(AMAP_SCRIPT_ID)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener('error', reject, { once: true })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = AMAP_SCRIPT_ID
    script.src = AMAP_SRC
    script.async = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export default function Map() {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const [days, setDays] = useState(7)
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(Boolean(window.AMap))
  const [mapError, setMapError] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchHeatmap({ days, limit: 100 })
      .then(setPoints)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [days])

  useEffect(() => {
    let cancelled = false
    loadAmap()
      .then(() => {
        if (!cancelled) setMapReady(true)
      })
      .catch(() => {
        if (!cancelled) setMapError('高德地图加载失败，请检查网络或 Key 白名单')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!mapReady || !mapRef.current || loading) return undefined

    const map = new window.AMap.Map(mapRef.current, {
      center: [121.503, 31.3005],
      zoom: 16,
      mapStyle: 'amap://styles/whitesmoke',
      viewMode: '2D',
    })
    mapInstanceRef.current = map

    const heatPoints = points

    if (heatPoints.length > 0) {
      window.AMap.plugin('AMap.HeatMap', () => {
        const heatmap = new window.AMap.HeatMap(map, {
          radius: 25,
          opacity: [0, 0.8],
          gradient: {
            0.4: '#FED7AA',
            0.65: '#F97316',
            1.0: '#C2410C',
          },
        })
        heatmap.setDataSet({
          data: heatPoints.map((point) => ({ lng: point.longitude, lat: point.latitude, count: point.count })),
          max: Math.max(10, ...heatPoints.map((point) => point.count)),
        })
      })
    }

    heatPoints.forEach((point) => {
      const marker = new window.AMap.Marker({
        position: [point.longitude, point.latitude],
        content: '<div style="font-size:24px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.22))">🐱</div>',
        offset: new window.AMap.Pixel(-12, -24),
        map,
      })
      marker.on('click', () => {
        const info = new window.AMap.InfoWindow({
          content: `<div style="font-size:13px;padding:4px 2px"><b>${escapeHtml(point.name || '校园猫猫')}</b><br/>今日热度 ${point.count}</div>`,
          offset: new window.AMap.Pixel(0, -20),
        })
        info.open(map, [point.longitude, point.latitude])
      })
    })

    return () => {
      map.destroy()
      mapInstanceRef.current = null
    }
  }, [loading, mapReady, points])

  return (
    <div className="pb-6">
      <TopBar
        title="猫猫地图"
        subtitle="今日校园猫咪分布热力图"
        action={(
          <a href="https://map.fudan.edu.cn/" target="_blank" rel="noreferrer" className="bg-white/20 rounded-full px-3 py-1.5 text-xs font-medium">
            复旦地图
          </a>
        )}
      />

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <div className="text-xl font-medium text-cat-orange">{points.length}</div>
            <div className="text-[11px] text-gray-400">热点</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <div className="text-xl font-medium text-cat-orange">{points.reduce((sum, point) => sum + point.count, 0)}</div>
            <div className="text-[11px] text-gray-400">记录</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <div className="text-xl font-medium text-cat-orange">{days === 0 ? 'ALL' : `${days}D`}</div>
            <div className="text-[11px] text-gray-400">范围</div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.days}
              onClick={() => setDays(option.days)}
              className={`px-4 py-2 rounded-full text-xs font-medium border transition-colors ${
                days === option.days ? 'bg-cat-orange text-white border-cat-orange' : 'bg-white text-gray-500 border-gray-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="relative bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ height: 'calc(100vh - 230px)' }}>
          <div ref={mapRef} className="w-full h-full" />
          {mapError && (
            <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center text-gray-500 text-sm px-8 text-center">
              <div className="text-3xl mb-2">🗺️</div>
              {mapError}
            </div>
          )}
          {!mapError && (loading || !mapReady) && (
            <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center text-gray-400 text-sm">
              <div className="text-3xl animate-paw mb-2">🐾</div>
              加载高德地图中…
            </div>
          )}
          {!mapError && !loading && mapReady && points.length === 0 && (
            <div className="absolute inset-x-4 bottom-4 bg-white/95 rounded-2xl border border-gray-100 p-4 text-center shadow-lg">
              <div className="text-3xl mb-1">🐾</div>
              <p className="text-sm font-medium text-gray-700">当前范围暂无真实偶遇点位</p>
              <p className="text-xs text-gray-400 mt-1">去识别页记录一次偶遇后，这里会自动生成热力点</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
