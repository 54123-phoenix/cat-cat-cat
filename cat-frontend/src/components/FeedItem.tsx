import { Link } from 'react-router-dom'
import { Cat, MapPin, Utensils, Moon, Swords, Gamepad2 } from 'lucide-react'

const ACTIVITY_ICON = {
  eating: Utensils,
  sleeping: Moon,
  fighting: Swords,
  playing: Gamepad2,
}
const ACTIVITY_LABEL = {
  eating: '在吃饭',
  sleeping: '在睡觉',
  fighting: '在打架',
  playing: '在玩耍',
}

function formatTime(value) {
  if (!value) return '刚刚'
  return new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function FeedItem({ sighting }) {
  const ActivityIcon = sighting.activity_type ? ACTIVITY_ICON[sighting.activity_type] : null
  const content = (
    <div className="bg-white ring-1 ring-stone-900/5 shadow-e1 rounded-card px-4 py-3 flex gap-3 active:bg-primary-light transition-colors animate-fade-up">
      <div className="w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center overflow-hidden shrink-0 text-2xl">
        {sighting.image_path ? (
          <img src={sighting.image_path} alt="偶遇照片" className="w-full h-full object-cover" />
        ) : (
          <Cat className="w-6 h-6 text-primary/30" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-text truncate">{sighting.cat?.name || '校园猫猫'}</p>
          <span className="text-xs text-text-muted shrink-0">{formatTime(sighting.created_at)}</span>
        </div>
        {ActivityIcon && (
          <p className="text-xs text-primary flex items-center gap-1 mt-0.5">
            <ActivityIcon className="w-3 h-3" />
            {ACTIVITY_LABEL[sighting.activity_type] || sighting.activity_type}
          </p>
        )}
        <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{sighting.location_name || sighting.location || '校园某处'}</p>
        {sighting.note && <p className="text-xs text-text-muted mt-1 truncate">“{sighting.note}”</p>}
      </div>
    </div>
  )

  if (!sighting.cat_id) return content
  return <Link to={`/cats/${sighting.cat_id}`}>{content}</Link>
}
