export const campusLocations = [
  { name: '图书馆门口', latitude: 31.3009, longitude: 121.5037 },
  { name: '图书馆草坪', latitude: 31.3013, longitude: 121.5043 },
  { name: '二食堂', latitude: 31.2996, longitude: 121.5018 },
  { name: '光华楼', latitude: 31.3001, longitude: 121.5005 },
  { name: '教学楼', latitude: 31.2991, longitude: 121.5049 },
  { name: '宿舍区', latitude: 31.3021, longitude: 121.5012 },
]

export const CAMPUS_CENTER: [number, number] = [121.5068, 31.3005]

export const campusCenter = CAMPUS_CENTER

export function findCampusLocation(name) {
  return campusLocations.find((location) => location.name === name)
}

export function resolveSightingLocation(name: string, params: URLSearchParams) {
  const known = findCampusLocation(name)
  if (known) return known
  const lat = params.get('lat')
  const lng = params.get('lng')
  if (params.get('point') === name && lat !== null && lng !== null && lat.trim() && lng.trim()) {
    const latitude = Number(lat)
    const longitude = Number(lng)
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      return { name, latitude, longitude }
    }
  }
  return undefined
}
