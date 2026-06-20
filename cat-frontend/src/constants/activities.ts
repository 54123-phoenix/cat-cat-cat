export const ACTIVITY_OPTIONS = [
  { value: 'eating', label: '进食', emoji: '🍽️' },
  { value: 'sleeping', label: '睡觉', emoji: '😴' },
  { value: 'playing', label: '玩耍', emoji: '🎾' },
  { value: 'fighting', label: '打架', emoji: '⚔️' },
  { value: 'sunbathing', label: '晒太阳', emoji: '☀️' },
  { value: 'hunting', label: '捕猎', emoji: '🐭' },
  { value: 'curious', label: '好奇', emoji: '👀' },
  { value: 'grooming', label: '理毛', emoji: '🧹' },
]

export const WEATHER_OPTIONS = [
  { value: 'sunny', label: '晴', emoji: '☀️' },
  { value: 'cloudy', label: '阴', emoji: '☁️' },
  { value: 'rainy', label: '雨', emoji: '🌧️' },
  { value: 'snow', label: '雪', emoji: '❄️' },
]

export const MOOD_OPTIONS = [
  { value: 'happy', label: '开心', emoji: '😊' },
  { value: 'calm', label: '平静', emoji: '😌' },
  { value: 'excited', label: '兴奋', emoji: '🤩' },
  { value: 'sad', label: '低落', emoji: '😿' },
]

export const ACTIVITY_LABEL = Object.fromEntries(
  ACTIVITY_OPTIONS.map((a) => [a.value, a.label])
)
export const WEATHER_LABEL = Object.fromEntries(
  WEATHER_OPTIONS.map((w) => [w.value, w.label])
)
export const MOOD_LABEL = Object.fromEntries(
  MOOD_OPTIONS.map((m) => [m.value, m.label])
)
