import { useEffect, useState } from 'react'
import { Camera, PawPrint, MessageSquare, ScanLine, Check } from 'lucide-react'
import { getDailyQuest } from '../api'

const QUEST_ICONS = {
  sighting: PawPrint,
  photo: Camera,
  post: MessageSquare,
  recognize: ScanLine,
}

export default function DailyQuestCard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDailyQuest()
      .then(setData)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="card p-4 h-24 skeleton" />
  }
  if (!data) return null

  const { quests = [], all_done, reward_xp } = data

  return (
    <div className={`card p-4 ${all_done ? 'bg-mint-light' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-text">今日任务</h3>
        {all_done ? (
          <span className="text-xs font-bold text-mint">
            今日已圆满 +{reward_xp} XP 可领
          </span>
        ) : (
          <span className="text-xs text-text-secondary">
            {quests.filter((q) => q.done).length}/{quests.length}
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {quests.map((q) => {
          const Icon = QUEST_ICONS[q.key] || PawPrint
          const pct = q.target > 0 ? Math.min(1, q.progress / q.target) : 0
          return (
            <div
              key={q.key}
              className={`rounded-xl p-2 flex flex-col items-center gap-1.5 ${q.done ? 'bg-mint-light' : 'bg-gray-50'}`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${q.done ? 'text-mint' : 'text-text-secondary'}`} />
                {q.done && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-mint flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </span>
                )}
              </div>
              <p className={`text-[10px] text-center leading-tight ${q.done ? 'text-mint font-medium' : 'text-text-secondary'}`}>
                {q.label}
              </p>
              <div className="w-full h-1 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={`h-full rounded-full ${q.done ? 'bg-mint' : 'bg-primary'}`}
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
