import { useEffect, useState, useRef } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'
import { MapPin, ChevronDown, ChevronRight, PawPrint } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { catRoutes } from '../constants/catRoutes'
import { getVisitedLocations } from '../api'

const AMAP_KEY = import.meta.env.VITE_AMAP_KEY
const campusCenter = [121.503, 31.3005]

export default function CatRoutes() {
  const [expanded, setExpanded] = useState(null)
  const [visited, setVisited] = useState([])
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const AMapRef = useRef(null)

  useEffect(() => {
    getVisitedLocations().then((d) => setVisited(d.locations || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (expanded === null) return
    let map = null
    AMapLoader.load({ key: AMAP_KEY, version: '1.4.15', plugins: [] })
      .then((AMap) => {
        AMapRef.current = AMap
        if (mapInstanceRef.current) {
          mapInstanceRef.current.destroy()
          mapInstanceRef.current = null
        }
        const route = catRoutes.find((r) => r.id === expanded)
        if (!route) return
        const points = route.points.filter((p) => p.lat && p.lng)
        if (points.length === 0) return
        map = new AMap.Map(mapRef.current, {
          zoom: 16,
          center: [points[0].lng, points[0].lat],
          mapStyle: 'amap://styles/whitesmoke',
        })
        mapInstanceRef.current = map

        const path = points.map((p) => new AMap.LngLat(p.lng, p.lat))
        map.add(new AMap.Polyline({ path, strokeColor: '#F97316', strokeWeight: 5, strokeOpacity: 0.9 }))
        points.forEach((p, i) => {
          const marker = new AMap.Marker({
            position: new AMap.LngLat(p.lng, p.lat),
            label: { content: `${i + 1}`, direction: 'top' },
          })
          map.add(marker)
        })
        map.setFitView()
      })
      .catch((e) => console.error('map load failed', e))

    return () => {
      if (map) map.destroy()
    }
  }, [expanded])

  function routeProgress(route) {
    const total = route.points.length
    const hit = route.points.filter((p) => visited.includes(p.name)).length
    return { hit, total }
  }

  return (
    <div className="min-h-screen bg-warm-50">
      <PageHeader title="猫猫路线" subtitle="校园主题寻猫路线" />
      <div className="p-4 space-y-3">
        {catRoutes.map((route) => {
          const prog = routeProgress(route)
          const isOpen = expanded === route.id
          return (
            <div key={route.id} className="card overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : route.id)}
                className="w-full p-4 flex items-start justify-between gap-3 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <PawPrint className="w-5 h-5 text-primary shrink-0" />
                    <h3 className="font-bold text-text truncate">{route.name}</h3>
                  </div>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">{route.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${prog.total ? (prog.hit / prog.total) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-text-muted shrink-0">{prog.hit}/{prog.total}</span>
                  </div>
                </div>
                {isOpen ? <ChevronDown className="w-5 h-5 text-text-secondary shrink-0" /> : <ChevronRight className="w-5 h-5 text-text-secondary shrink-0" />}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="space-y-2">
                    {route.points.map((p, i) => {
                      const done = visited.includes(p.name)
                      return (
                        <div key={p.name + i} className="flex items-center gap-2 text-sm">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-primary text-white' : 'bg-gray-100 text-text-muted'}`}>{i + 1}</span>
                          <MapPin className="w-4 h-4 text-text-secondary" />
                          <span className={done ? 'text-text font-medium' : 'text-text-secondary'}>{p.name}</span>
                          {done && <span className="text-xs text-primary">已打卡</span>}
                        </div>
                      )
                    })}
                  </div>
                  <div ref={mapRef} className="w-full h-64 rounded-2xl overflow-hidden border border-border" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
