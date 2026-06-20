import { useId, type CSSProperties } from 'react'

const MOODS = ['happy', 'sleep', 'sad', 'curious']

interface MascotCatProps {
  mood?: string
  size?: number
  className?: string
  style?: CSSProperties
  breathe?: boolean
}

export default function MascotCat({ mood = 'happy', size = 96, className = '', style, breathe = true }: MascotCatProps) {
  const id = useId().replace(/:/g, '')
  const safeMood = MOODS.includes(mood) ? mood : 'happy'
  const w = size
  const h = Math.round(size * 1.05)

  const eyeY = 46
  let leftEye, rightEye
  if (safeMood === 'sleep') {
    leftEye = <path d="M34 46 Q40 49 46 46" fill="none" stroke="#1C1917" strokeWidth="2.4" strokeLinecap="round" />
    rightEye = <path d="M54 46 Q60 49 66 46" fill="none" stroke="#1C1917" strokeWidth="2.4" strokeLinecap="round" />
  } else if (safeMood === 'sad') {
    leftEye = <ellipse cx="40" cy={eyeY} rx="3.2" ry="2.4" fill="#1C1917" />
    rightEye = <ellipse cx="60" cy={eyeY} rx="3.2" ry="2.4" fill="#1C1917" />
  } else if (safeMood === 'curious') {
    leftEye = <circle cx="40" cy={eyeY} r="3.6" fill="#1C1917" />
    rightEye = <circle cx="60" cy={eyeY} r="3.6" fill="#1C1917" />
  } else {
    leftEye = (
      <>
        <circle cx="40" cy={eyeY} r="3.8" fill="#1C1917" />
        <circle cx="41.2" cy={eyeY - 1.2} r="1.2" fill="#FFFFFF" />
      </>
    )
    rightEye = (
      <>
        <circle cx="60" cy={eyeY} r="3.8" fill="#1C1917" />
        <circle cx="61.2" cy={eyeY - 1.2} r="1.2" fill="#FFFFFF" />
      </>
    )
  }

  let mouth
  if (safeMood === 'happy') {
    mouth = <path d="M44 58 Q50 64 56 58" fill="none" stroke="#1C1917" strokeWidth="2.2" strokeLinecap="round" />
  } else if (safeMood === 'sleep') {
    mouth = <path d="M46 60 Q50 62 54 60" fill="none" stroke="#1C1917" strokeWidth="2" strokeLinecap="round" />
  } else if (safeMood === 'sad') {
    mouth = <path d="M44 62 Q50 57 56 62" fill="none" stroke="#1C1917" strokeWidth="2.2" strokeLinecap="round" />
  } else {
    mouth = <path d="M47 59 Q50 62 53 59" fill="none" stroke="#1C1917" strokeWidth="2" strokeLinecap="round" />
  }

  const showZzz = safeMood === 'sleep'
  const showQuestion = safeMood === 'curious'

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 100 105"
      xmlns="http://www.w3.org/2000/svg"
      className={`mascot-cat ${breathe ? 'mascot-breathe' : ''} ${className}`.trim()}
      style={style}
      role="img"
      aria-label={`猫猫吉祥物·${safeMood}`}
    >
      <defs>
        <radialGradient id={`body-${id}`} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#FFF7ED" />
          <stop offset="100%" stopColor="#FED7AA" />
        </radialGradient>
      </defs>
      {/* ears */}
      <polygon points="22,30 30,8 42,28" fill={`url(#body-${id})`} stroke="#EA580C" strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="58,28 70,8 78,30" fill={`url(#body-${id})`} stroke="#EA580C" strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="26,26 31,16 38,26" fill="#F97316" opacity="0.55" />
      <polygon points="62,26 69,16 74,26" fill="#F97316" opacity="0.55" />
      {/* head */}
      <circle cx="50" cy="48" r="30" fill={`url(#body-${id})`} stroke="#EA580C" strokeWidth="1.8" />
      {/* cheeks blush */}
      <ellipse cx="30" cy="56" rx="5" ry="3" fill="#FB923C" opacity="0.35" />
      <ellipse cx="70" cy="56" rx="5" ry="3" fill="#FB923C" opacity="0.35" />
      {/* eyes */}
      {leftEye}
      {rightEye}
      {/* nose */}
      <path d="M48 53 L52 53 L50 56 Z" fill="#EA580C" />
      {/* mouth */}
      {mouth}
      {/* whiskers */}
      <line x1="18" y1="52" x2="30" y2="54" stroke="#9A3412" strokeWidth="1" opacity="0.6" />
      <line x1="18" y1="57" x2="30" y2="57" stroke="#9A3412" strokeWidth="1" opacity="0.6" />
      <line x1="70" y1="54" x2="82" y2="52" stroke="#9A3412" strokeWidth="1" opacity="0.6" />
      <line x1="70" y1="57" x2="82" y2="57" stroke="#9A3412" strokeWidth="1" opacity="0.6" />
      {/* paws */}
      <ellipse cx="38" cy="92" rx="7" ry="5" fill={`url(#body-${id})`} stroke="#EA580C" strokeWidth="1.4" />
      <ellipse cx="62" cy="92" rx="7" ry="5" fill={`url(#body-${id})`} stroke="#EA580C" strokeWidth="1.4" />
      {showZzz && (
        <g className="mascot-zzz">
          <text x="74" y="20" fontSize="10" fill="#78716C" fontWeight="700">z</text>
          <text x="82" y="14" fontSize="8" fill="#A8A29E" fontWeight="700">z</text>
        </g>
      )}
      {showQuestion && (
        <text x="76" y="22" fontSize="14" fill="#F97316" fontWeight="700">?</text>
      )}
    </svg>
  )
}
