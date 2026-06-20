import { campusLocations } from '../campusLocations'

function loc(name) {
  const found = campusLocations.find((l) => l.name === name)
  return { name, lat: found?.latitude, lng: found?.longitude }
}

export const catRoutes = [
  {
    id: 'handan-morning',
    name: '邯郸晨猫线',
    description: '清晨图书馆门口的猫刚醒，一路向南到食堂开饭，再到文科楼晒太阳',
    points: [
      loc('图书馆门口'),
      loc('二食堂'),
      loc('光华楼'),
    ],
  },
  {
    id: 'guanghua-nap',
    name: '光华午睡线',
    description: '午后光华楼草坪是猫猫午睡圣地，路过教学楼顺便看一眼',
    points: [
      loc('光华楼'),
      loc('教学楼'),
      loc('图书馆草坪'),
    ],
  },
  {
    id: 'dorm-twilight',
    name: '宿舍黄昏线',
    description: '傍晚宿舍区猫猫出没觅食，绕到二食堂再回图书馆',
    points: [
      loc('宿舍区'),
      loc('二食堂'),
      loc('图书馆门口'),
    ],
  },
  {
    id: 'library-loop',
    name: '图书馆环线',
    description: '图书馆门口与草坪之间穿梭，最适合课间十分钟',
    points: [
      loc('图书馆门口'),
      loc('图书馆草坪'),
      loc('教学楼'),
    ],
  },
]
