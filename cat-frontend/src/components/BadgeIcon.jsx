import { PawPrint, MessageSquare, Sparkles } from 'lucide-react'

/**
 * Small fish bone inline SVG icon
 */
function FishBone({ className, size }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* fish body outline */}
      <path
        d="M4 12 C4 8 7 6 12 6 C17 6 20 8 20 12 C20 16 17 18 12 18 C7 18 4 16 4 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
      {/* tail */}
      <path
        d="M20 12 L23 9 L23 15 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      {/* eye */}
      <circle cx="7" cy="11" r="1.2" fill="currentColor" />
      {/* spine line (bone) */}
      <line x1="8" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      {/* rib bones */}
      <line x1="10" y1="12" x2="9" y2="9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="10" y1="12" x2="9" y2="15" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="13" y1="12" x2="12" y2="9" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="13" y1="12" x2="12" y2="15" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="15.5" y1="12" x2="14.5" y2="9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="15.5" y1="12" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

/**
 * BadgeIcon — maps badge series to an appropriate icon component.
 *
 * Props:
 *   badge: object with a `series` property ('sighting'|'community'|'collect'|'special')
 *   size: icon size in px (default 24)
 *   className: optional CSS classes
 */
export default function BadgeIcon({ badge, size = 24, className }) {
  const series = badge?.series || 'special'

  switch (series) {
    case 'sighting':
      return <PawPrint size={size} className={className} />
    case 'community':
      return <MessageSquare size={size} className={className} />
    case 'collect':
      return <FishBone size={size} className={className} />
    case 'special':
    default:
      return <Sparkles size={size} className={className} />
  }
}
