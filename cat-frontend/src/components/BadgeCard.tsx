import BadgeIcon from './BadgeIcon'

interface BadgeCardProps {
  badge?: any
  earned?: boolean
  size?: string
  className?: string
}

export default function BadgeCard({ badge = {}, earned, size = 'sm' }: BadgeCardProps) {
  const sm = size === 'sm'

  return (
    <div
      className={`flex-shrink-0 rounded-2xl border text-center transition-all ${
        earned
          ? 'bg-gradient-to-b from-white to-primary-light/50 border-primary/20 shadow-e2'
          : 'bg-gray-50 border-gray-100 opacity-55 grayscale'
      } ${sm ? 'w-20 p-2' : 'w-20 p-3'}`}
    >
      <div className={`${
        sm ? 'w-16 h-16' : 'w-20 h-20'
      } mx-auto rounded-2xl ${
        earned ? 'bg-white text-primary ring-1 ring-primary/20' : 'bg-gray-100 text-gray-400'
      } flex items-center justify-center`}>
        <BadgeIcon series={badge.series || badge.type || badge.category || 'default'} size={sm ? 46 : 58} className={earned ? 'text-primary' : 'text-gray-400'} />
      </div>
      <div className={`text-h3 text-text-secondary mt-1 leading-tight truncate`}>
        {badge.name}
      </div>
    </div>
  )
}
