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
      className={`flex-shrink-0 rounded-xl border text-center transition-all ${
        earned
          ? 'bg-white border-mint-light badge-earned'
          : 'bg-gray-50 border-gray-100 opacity-35 grayscale'
      } ${sm ? 'w-20 p-2' : 'w-20 p-3'}`}
    >
      <div className={`${
        sm ? 'w-16 h-16' : 'w-20 h-20'
      } mx-auto rounded-full ${
        earned ? 'bg-mint-light text-mint' : 'bg-gray-100 text-gray-400'
      } flex items-center justify-center`}>
        <BadgeIcon series={badge.series || badge.type || badge.category || 'default'} size={sm ? 32 : 40} className={earned ? 'text-mint' : 'text-gray-400'} />
      </div>
      <div className={`text-h3 text-text-secondary mt-1 leading-tight truncate`}>
        {badge.name}
      </div>
    </div>
  )
}
