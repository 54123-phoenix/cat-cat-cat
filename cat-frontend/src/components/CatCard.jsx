import { Link } from 'react-router-dom'

export default function CatCard({ cat }) {
  const avatarUrl = cat.avatar ? cat.avatar : null
  const personality = Array.isArray(cat.personality) ? cat.personality[0] : cat.personality

  return (
    <Link to={`/cats/${cat.id}`} className="bg-white rounded-xl border border-gray-100 block overflow-hidden active:scale-95 transition-transform cursor-pointer">
      <div className="aspect-square bg-cat-warm flex items-center justify-center overflow-hidden text-5xl relative">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={cat.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>🐱</span>
        )}
        <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white" />
      </div>
      <div className="p-2.5">
        <h3 className="font-medium text-sm text-gray-800 truncate">
          {cat.name}
        </h3>
        <div className="text-[11px] text-gray-400 mt-0.5 truncate">
          📍 {cat.location || '复旦校园'} · 最近活跃
        </div>
        {personality && (
          <span className="inline-block mt-1.5 bg-cat-orange-lt text-orange-800 text-[10px] px-2 py-0.5 rounded-full max-w-full truncate">
            {personality}
          </span>
        )}
      </div>
    </Link>
  )
}
