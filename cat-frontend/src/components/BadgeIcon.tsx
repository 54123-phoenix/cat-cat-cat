interface BadgeIconProps {
  series?: string
  badge?: any
  size?: number
  className?: string
  earned?: boolean
}

function themeFor(series: string) {
  switch (series) {
    case 'sighting':
      return { ink: '#2563EB', soft: '#DBEAFE', deep: '#1D4ED8' }
    case 'community':
      return { ink: '#16A34A', soft: '#DCFCE7', deep: '#15803D' }
    case 'collect':
      return { ink: '#7C3AED', soft: '#EDE9FE', deep: '#6D28D9' }
    case 'special':
      return { ink: '#D97706', soft: '#FEF3C7', deep: '#B45309' }
    default:
      return { ink: '#F97316', soft: '#FFF7ED', deep: '#EA580C' }
  }
}

function glyphFor(series: string, color: string) {
  const stroke = color
  switch (series) {
    case 'sighting':
      return (
        <>
          <path d="M32 45c-2.8-5-12-10.4-12-20.2C20 17.1 25.2 12 32 12s12 5.1 12 12.8C44 34.6 34.8 40 32 45Z" fill="none" stroke={stroke} strokeWidth="3.2" strokeLinejoin="round" />
          <circle cx="32" cy="24" r="4.5" fill={stroke} />
        </>
      )
    case 'community':
      return (
        <>
          <path d="M18 25c0-6.1 5.8-10.5 14-10.5S46 18.9 46 25s-5.8 10.5-14 10.5c-1.5 0-2.9-.1-4.2-.4L20 40l2.1-7.1C19.5 31 18 28.2 18 25Z" fill="none" stroke={stroke} strokeWidth="3.2" strokeLinejoin="round" />
          <path d="M27 25h10" stroke={stroke} strokeWidth="3.2" strokeLinecap="round" />
        </>
      )
    case 'collect':
      return (
        <>
          <path d="M32 13l5.2 10.5 11.6 1.7-8.4 8.2 2 11.6L32 39.5 21.6 45l2-11.6-8.4-8.2 11.6-1.7L32 13Z" fill="none" stroke={stroke} strokeWidth="3.2" strokeLinejoin="round" />
          <circle cx="32" cy="31" r="3" fill={stroke} />
        </>
      )
    case 'special':
      return (
        <>
          <path d="M32 11l3.6 15.4L50 32l-14.4 5.6L32 53l-3.6-15.4L14 32l14.4-5.6L32 11Z" fill="none" stroke={stroke} strokeWidth="3.2" strokeLinejoin="round" />
          <path d="M48 13l1.2 4.5L54 19l-4.8 1.5L48 25l-1.2-4.5L42 19l4.8-1.5L48 13Z" fill={stroke} />
        </>
      )
    default:
      return (
        <>
          <circle cx="32" cy="32" r="12" fill="none" stroke={stroke} strokeWidth="3.2" />
          <path d="M21 29c4-2.8 18-2.8 22 4M26 20c-2.2 6.8-2.2 17.2 0 24M38 20c2.2 6.8 2.2 17.2 0 24" fill="none" stroke={stroke} strokeWidth="3.2" strokeLinecap="round" />
        </>
      )
  }
}

export default function BadgeIcon({ series, badge, size = 24, className = '', earned = true }: BadgeIconProps) {
  const s = series || badge?.series || badge?.type || badge?.category || 'default'
  const theme = themeFor(s)
  const ink = earned ? theme.ink : '#A8A29E'
  const soft = earned ? theme.soft : '#F5F5F4'
  const deep = earned ? theme.deep : '#78716C'

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
      <defs>
        <linearGradient id={`badgeRibbon-${s}`} x1="14" y1="51" x2="50" y2="61" gradientUnits="userSpaceOnUse">
          <stop stopColor={soft} />
          <stop offset="1" stopColor={ink} stopOpacity="0.34" />
        </linearGradient>
        <linearGradient id={`badgeFace-${s}`} x1="14" y1="8" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor={soft} />
        </linearGradient>
      </defs>
      <path d="M20 49l-4 11 10.5-5.2L32 61l5.5-6.2L48 60l-4-11" fill={`url(#badgeRibbon-${s})`} />
      <circle cx="32" cy="30" r="27" fill={ink} opacity={earned ? '0.18' : '0.10'} />
      <circle cx="32" cy="30" r="24" fill={`url(#badgeFace-${s})`} />
      <circle cx="32" cy="30" r="24" stroke={ink} strokeWidth="2.8" />
      <circle cx="32" cy="30" r="19" stroke={deep} strokeWidth="1.6" strokeDasharray="3 4" opacity="0.42" />
      {earned && <path d="M45.5 10.5l1.4 4.6 4.6 1.4-4.6 1.4-1.4 4.6-1.4-4.6-4.6-1.4 4.6-1.4 1.4-4.6Z" fill={ink} opacity="0.7" />}
      {glyphFor(s, deep)}
      {!earned && <path d="M18 47L47 18" stroke="#A8A29E" strokeWidth="3" strokeLinecap="round" opacity="0.45" />}
    </svg>
  )
}
