import { useState } from 'react'
import MascotCat from './MascotCat'
import { campusLocations } from '../campusLocations'

const COLOR_OPTIONS = [
  { value: '橘', label: '橘猫', emoji: '🟠' },
  { value: '黑', label: '黑猫', emoji: '⚫' },
  { value: '白', label: '白猫', emoji: '⚪' },
  { value: '狸花', label: '狸花', emoji: '🐯' },
  { value: '三花', label: '三花', emoji: '🐱' },
]

const PERSONALITY_OPTIONS = [
  { value: 'friendly', label: '亲人', emoji: '🤗' },
  { value: 'shy', label: '胆小', emoji: '🙈' },
  { value: 'playful', label: '爱玩', emoji: '🎾' },
  { value: 'lazy', label: '慵懒', emoji: '😴' },
]

function isOnboarded() {
  try { return !!localStorage.getItem('onboarded') } catch { return true }
}

export function getPrefs() {
  try {
    const raw = localStorage.getItem('prefs')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem('prefs', JSON.stringify(prefs))
    localStorage.setItem('onboarded', '1')
  } catch {}
}

export default function Onboarding({ onClose }) {
  const [step, setStep] = useState(0)
  const [colors, setColors] = useState([])
  const [locations, setLocations] = useState([])
  const [personality, setPersonality] = useState('')

  const toggle = (list, setList, val) => {
    setList(list.includes(val) ? list.filter((v) => v !== val) : [...list, val])
  }

  const finish = () => {
    savePrefs({ colors, locations, personality })
    if (onClose) onClose()
  }

  const skip = () => {
    savePrefs({})
    if (onClose) onClose()
  }

  const steps = [
    {
      title: '你喜欢什么花色的猫？',
      sub: '可多选，我们会优先推荐',
      content: (
        <div className="grid grid-cols-3 gap-3">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.value}
              onClick={() => toggle(colors, setColors, c.value)}
              aria-pressed={colors.includes(c.value)}
              className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-colors ${colors.includes(c.value) ? 'border-primary bg-primary-light' : 'border-border bg-white'}`}
            >
              <span className="text-2xl">{c.emoji}</span>
              <span className="text-xs font-medium text-text">{c.label}</span>
            </button>
          ))}
        </div>
      ),
      canNext: colors.length > 0,
    },
    {
      title: '你常去哪些地点？',
      sub: '选你常偶遇猫猫的地方',
      content: (
        <div className="flex flex-wrap gap-2">
          {campusLocations.map((l) => (
            <button
              key={l.name}
              onClick={() => toggle(locations, setLocations, l.name)}
              aria-pressed={locations.includes(l.name)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${locations.includes(l.name) ? 'bg-primary text-white' : 'bg-white text-text-secondary border border-border'}`}
            >
              {l.name}
            </button>
          ))}
        </div>
      ),
      canNext: true,
    },
    {
      title: '你偏好什么性格的猫？',
      sub: '选一个最吸引你的',
      content: (
        <div className="grid grid-cols-2 gap-3">
          {PERSONALITY_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPersonality(p.value)}
              aria-pressed={personality === p.value}
              className={`flex items-center gap-2 py-3 px-4 rounded-2xl border-2 transition-colors ${personality === p.value ? 'border-primary bg-primary-light' : 'border-border bg-white'}`}
            >
              <span className="text-xl">{p.emoji}</span>
              <span className="text-sm font-medium text-text">{p.label}</span>
            </button>
          ))}
        </div>
      ),
      canNext: true,
    },
  ]

  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div className="celebration-overlay" role="dialog" aria-modal="true" aria-label="新手引导">
      <div className="celebration-card space-y-5" style={{ maxWidth: 360 }}>
        <div className="flex justify-center">
          <MascotCat mood="happy" size={84} />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold theme-text">{current.title}</h2>
          <p className="text-sm theme-muted">{current.sub}</p>
        </div>
        <div>{current.content}</div>
        <div className="flex items-center justify-between pt-2">
          <button onClick={skip} className="text-sm theme-muted hover:underline">跳过</button>
          <div className="flex items-center gap-2">
            {steps.map((_, i) => (
              <span key={i} className={`w-2 h-2 rounded-full ${i === step ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
          {isLast ? (
            <button onClick={finish} className="clay-btn btn-sm">完成</button>
          ) : (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!current.canNext}
              className="clay-btn btn-sm"
            >
              下一步
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export { isOnboarded }
