import { validCoordinates } from './sightingSubmission'

export interface MapMarker {
  id: number
  latitude: number
  longitude: number
  iconPath: string
  width: number
  height: number
  title: string
  detail: { id?: number; name: string; avatar?: string; location?: string; latitude: number; longitude: number; source: string }
}

export interface MapData { markers: MapMarker[]; errors: string[]; loading: boolean }

function markersFrom(items: any[], source: '偶遇点位' | '猫咪档案'): MapMarker[] {
  return items.filter(item => validCoordinates(item)).map((item: any, index) => {
    const name = item.name || item.location_name || (source === '偶遇点位' ? '已审核偶遇点' : '校园猫咪')
    return {
      id: (source === '偶遇点位' ? 10000 : 20000) + index,
      latitude: item.latitude, longitude: item.longitude,
      iconPath: '/assets/map/cat.png', width: 32, height: 32,
      title: name,
      detail: {
        id: source === '猫咪档案' ? item.id : undefined,
        name, avatar: item.avatar, location: item.location || item.location_name,
        latitude: item.latitude, longitude: item.longitude, source,
      },
    }
  })
}

// Only the latest visible-page request may publish data or errors.
export function createMapLoader(
  heatmap: () => Promise<any[]>, cats: () => Promise<any[]>, onState: (state: MapData) => void,
) {
  let generation = 0
  return {
    cancel() { generation += 1 },
    async load() {
      const request = ++generation
      onState({ markers: [], errors: [], loading: true })
      const sources = await Promise.all([
        Promise.resolve().then(heatmap).then(items => ({ items, source: '偶遇点位' as const, failed: false }), () => ({ items: [], source: '偶遇点位' as const, failed: true })),
        Promise.resolve().then(cats).then(items => ({ items, source: '猫咪档案' as const, failed: false }), () => ({ items: [], source: '猫咪档案' as const, failed: true })),
      ])
      if (request !== generation) return
      onState({
        markers: sources.reduce<MapMarker[]>((markers, source) => markers.concat(Array.isArray(source.items) ? markersFrom(source.items, source.source) : []), []),
        errors: sources.filter(source => source.failed || !Array.isArray(source.items)).map(source => `${source.source}加载失败`),
        loading: false,
      })
    },
  }
}
