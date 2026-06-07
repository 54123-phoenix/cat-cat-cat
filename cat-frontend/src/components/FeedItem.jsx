import { Link } from 'react-router-dom'
import { Cat } from 'lucide-react'

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
  const content = (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex gap-3 active:bg-orange-50 transition-colors animate-fade-up">
      <div className="w-12 h-12 rounded-xl bg-cat-warm flex items-center justify-center overflow-hidden shrink-0 text-2xl">
        {sighting.image_path ? (
          <img src={sighting.image_path} alt="偶遇照片" className="w-full h-full object-cover" />
        ) : (
          <Cat className="w-6 h-6 text-primary/30" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-800 truncate">{sighting.cat?.name || '校园猫猫'}</p>
          <span className="text-xs text-gray-400 shrink-0">{formatTime(sighting.created_at)}</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">📍 {sighting.location_name || sighting.location || '校园某处'}</p>
        {sighting.note && <p className="text-xs text-gray-500 mt-1 truncate">“{sighting.note}”</p>}
      </div>
    </div>
  )

  if (!sighting.cat_id) return content
  return <Link to={`/cats/${sighting.cat_id}`}>{content}</Link>
}
