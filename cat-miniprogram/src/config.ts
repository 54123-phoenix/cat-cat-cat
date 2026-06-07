export const CONFIG = {
  appName: '猫猫社区',
  apiBase: process.env.API_BASE || 'http://localhost:8000/api',
  mapCenter: { latitude: 31.3005, longitude: 121.5068 },
  mapZoom: 15,
  homeCatLimit: 20,
  postPageSize: 10,
  maxImageSize: 10,
  demoMode: false,
  text: {
    homeTitle: '猫猫社区',
    scanTip: '拍照识别校园猫咪',
    noCat: '还没有认识的猫猫',
    loginTip: '登录后查看个人资料',
  },
}

export const ACTIVITY_TYPES = [
  { value: 'eating', emoji: '🍽️', label: '在吃饭' },
  { value: 'sleeping', emoji: '😴', label: '在睡觉' },
  { value: 'fighting', emoji: '⚔️', label: '在打架' },
  { value: 'playing', emoji: '🎾', label: '在玩耍' },
]

export const TOPICS = [
  { id: 'find', label: '寻猫问猫' },
  { id: 'daily', label: '铲屎日常' },
  { id: 'health', label: '健康互助' },
  { id: 'suggest', label: '建议反馈' },
]
