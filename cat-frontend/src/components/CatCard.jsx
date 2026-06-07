import { Cat, MapPin } from 'lucide-react'

export default function CatCard({ cat }) {

  return (
    <div className="card overflow-hidden">
      <div className="aspect-square bg-primary-light flex items-center justify-center overflow-hidden">
        {cat.avatar ? (
          <img
            src={cat.avatar}
            alt={cat.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Cat className="w-6 h-6 text-primary/30" />
          </div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <h3 className="font-semibold text-text text-sm truncate">
          {cat.name}
        </h3>
        <div className="flex items-center gap-2">
          {cat.color && (
            <span className="text-xs bg-primary-light text-primary px-2 py-0.5 rounded-full font-medium">
              {cat.color}
            </span>
          )}
          {cat.location && (
            <span className="text-xs text-text-secondary flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />{cat.location}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
