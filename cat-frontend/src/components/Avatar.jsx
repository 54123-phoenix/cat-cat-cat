const AVATAR_PALETTE = [
  'bg-orange-100 text-orange-600',
  'bg-blue-100 text-blue-600',
  'bg-green-100 text-green-600',
  'bg-purple-100 text-purple-600',
  'bg-pink-100 text-pink-600',
]

export default function Avatar({ user, size = 'sm' }) {
  const colorIndex = (user?.id || 0) % AVATAR_PALETTE.length
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'xs' ? 'w-6 h-6 text-[11px]' : 'w-10 h-14 text-sm'

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
