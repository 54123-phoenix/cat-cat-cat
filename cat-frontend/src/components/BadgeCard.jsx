export default function BadgeCard({ badge, earned, size = 'sm' }) {
  const sm = size === 'sm'
  const initial = (badge.name || '?')[0]

  return (
    <div
      className={`flex-shrink-0 rounded-xl border text-center transition-all ${
        earned
          ? 'bg-white border-primary-light badge-earned'
          : 'bg-gray-50 border-gray-100 opacity-35 grayscale'
      } ${sm ? 'w-16 p-2' : 'w-20 p-3'}`}
    >
      <div className={`${sm ? 'w-8 h-8' : 'w-10 h-10'} mx-auto rounded-full ${earned ? 'bg-primary-light text-primary' : 'bg-gray-100 text-gray-400'} flex items-center justify-center ${sm ? 'text-sm' : 'text-base'} font-bold`}>
        {initial}
      </div>
      <div className={`${sm ? 'text-xs' : 'text-sm'} text-text-secondary mt-1 leading-tight truncate`}>
        {badge.name}
      </div>
    </div>
  )
}
