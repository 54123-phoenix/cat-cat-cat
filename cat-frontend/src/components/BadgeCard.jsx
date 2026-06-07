export default function BadgeCard({ badge, earned, size = 'sm' }) {
  const sm = size === 'sm'

  return (
    <div
      className={`flex-shrink-0 rounded-xl border text-center transition-all ${
        earned
          ? 'bg-white border-primary-light badge-earned'
          : 'bg-gray-50 border-gray-100 opacity-35 grayscale'
      } ${sm ? 'w-16 p-2' : 'w-20 p-3'}`}
    >
      <div className={sm ? 'text-xl' : 'text-2xl'}>{badge.emoji || '🎖️'}</div>
      <div className={`${sm ? 'text-[9px]' : 'text-[10px]'} text-gray-500 mt-1 leading-tight truncate`}>
        {badge.name}
      </div>
    </div>
  )
}
