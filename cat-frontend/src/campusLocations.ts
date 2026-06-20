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
  return campusLocations.find((location) => location.name === name) || campusLocations[0]
}
