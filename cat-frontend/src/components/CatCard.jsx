import { Cat, MapPin } from 'lucide-react'
import ImageWithShimmer from './ImageWithShimmer'

export default function CatCard({ cat }) {
  return (
    <div className="card overflow-hidden rounded-card group ring-1 ring-stone-900/5 shadow-e1 transition-all duration-300 hover:shadow-e2 hover:-translate-y-0.5 p-0">
      <div className="aspect-square relative bg-primary-light">
        {cat.avatar ? (
          <ImageWithShimmer
            src={cat.avatar}
            alt={cat.name}
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Cat className="w-6 h-6 text-primary/30" />
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-bold text-sm truncate drop-shadow">
            {cat.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {cat.color && (
              <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium backdrop-blur-sm">
                {cat.color}
              </span>
            )}
            {cat.location && (
              <span className="text-xs text-white/80 flex items-center gap-0.5 truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{cat.location}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
