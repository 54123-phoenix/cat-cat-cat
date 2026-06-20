const AVATAR_PALETTE = [
  'bg-mint-light text-mint',
  'bg-primary-light text-primary',
  'bg-info/10 text-info',
  'bg-warning/10 text-warning',
  'bg-mint-light text-mint',
]

export default function Avatar({ user, size = 'sm' }) {
  const colorIndex = (user?.id || 0) % AVATAR_PALETTE.length
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'xs' ? 'w-6 h-6 text-[11px]' : 'w-10 h-10 text-sm'

  if (user?.avatar) {
    return (
      <img src={user.avatar} alt="" className={`${sizeClass} rounded-full object-cover`} />
    )
  }

  const name = user?.nickname || `铲屎官${user?.id || ''}`
  const initial = name[0]?.toUpperCase() || '?'

  return (
    <div className={`${sizeClass} rounded-full ${AVATAR_PALETTE[colorIndex]} flex items-center justify-center font-semibold shrink-0`}>
      {initial}
    </div>
  )
}
