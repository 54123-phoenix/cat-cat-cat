interface BadgeIconProps {
  series?: string
  badge?: any
  size?: number
  className?: string
}

function glyphFor(series: string) {
  switch (series) {
    case 'sighting':
      return (
        <>
          <path d="M32 45c-2.8-5-12-10.4-12-20.2C20 17.1 25.2 12 32 12s12 5.1 12 12.8C44 34.6 34.8 40 32 45Z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
          <circle cx="32" cy="24" r="4.5" fill="currentColor" />
        </>
      )
    case 'community':
      return (
        <>
          <path d="M18 25c0-6.1 5.8-10.5 14-10.5S46 18.9 46 25s-5.8 10.5-14 10.5c-1.5 0-2.9-.1-4.2-.4L20 40l2.1-7.1C19.5 31 18 28.2 18 25Z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
          <path d="M27 25h10" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        </>
      )
    case 'collect':
      return (
        <>
          <path d="M32 13l5.2 10.5 11.6 1.7-8.4 8.2 2 11.6L32 39.5 21.6 45l2-11.6-8.4-8.2 11.6-1.7L32 13Z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
          <circle cx="32" cy="31" r="3" fill="currentColor" />
        </>
      )
    case 'special':
      return (
        <>
          <path d="M32 11l3.6 15.4L50 32l-14.4 5.6L32 53l-3.6-15.4L14 32l14.4-5.6L32 11Z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
          <path d="M48 13l1.2 4.5L54 19l-4.8 1.5L48 25l-1.2-4.5L42 19l4.8-1.5L48 13Z" fill="currentColor" />
        </>
      )
    default:
      return (
        <>
          <circle cx="32" cy="32" r="12" fill="none" stroke="currentColor" strokeWidth="3.2" />
          <path d="M21 29c4-2.8 18-2.8 22 4M26 20c-2.2 6.8-2.2 17.2 0 24M38 20c2.2 6.8 2.2 17.2 0 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
        </>
      )
  }
}

export default function BadgeIcon({ series, badge, size = 24, className = '' }: BadgeIconProps) {
  const s = series || badge?.series || badge?.type || badge?.category || 'default'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      role="img"
      aria-label="勋章"
    >
      <path d="M20 50l-4 10 10-5 6 6 6-6 10 5-4-10" fill="currentColor" opacity="0.16" />
      <circle cx="32" cy="30" r="25" fill="#FFFFFF" opacity="0.92" />
      <circle cx="32" cy="30" r="25" fill="currentColor" opacity="0.10" />
      <circle cx="32" cy="30" r="21" stroke="currentColor" strokeWidth="2.4" opacity="0.45" />
      <circle cx="32" cy="30" r="27" stroke="currentColor" strokeWidth="3" />
      {glyphFor(s)}
    </svg>
  )
}
