import { useId } from 'react'

export default function EmptyCat({ size = 120, className = '' }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="空状态小猫"
    >
      <defs>
        <radialGradient id={`ec-body-${id}`} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#FFF7ED" />
          <stop offset="100%" stopColor="#FED7AA" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="104" rx="26" ry="5" fill="#1C1917" opacity="0.06" />
      <path
        d="M38 70 Q34 92 44 100 L76 100 Q86 92 82 70 Z"
        fill={`url(#ec-body-${id})`}
        stroke="#EA580C"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <ellipse cx="50" cy="100" rx="7" ry="4" fill={`url(#ec-body-${id})`} stroke="#EA580C" strokeWidth="1.4" />
      <ellipse cx="70" cy="100" rx="7" ry="4" fill={`url(#ec-body-${id})`} stroke="#EA580C" strokeWidth="1.4" />
      <path
        d="M82 78 Q94 76 96 64 Q97 56 90 54"
        fill="none"
        stroke="#EA580C"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <polygon points="34,40 40,22 50,38" fill={`url(#ec-body-${id})`} stroke="#EA580C" strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="70,38 80,22 86,40" fill={`url(#ec-body-${id})`} stroke="#EA580C" strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="38,36 42,28 47,36" fill="#F97316" opacity="0.55" />
      <polygon points="73,36 78,28 82,36" fill="#F97316" opacity="0.55" />
      <circle cx="60" cy="52" r="22" fill={`url(#ec-body-${id})`} stroke="#EA580C" strokeWidth="1.8" />
      <path d="M44 50 Q50 53 56 50" fill="none" stroke="#1C1917" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M64 50 Q70 53 76 50" fill="none" stroke="#1C1917" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M58 60 L62 60 L60 63 Z" fill="#EA580C" />
      <path d="M54 67 Q60 63 66 67" fill="none" stroke="#1C1917" strokeWidth="2" strokeLinecap="round" />
      <line x1="38" y1="58" x2="48" y2="60" stroke="#9A3412" strokeWidth="1" opacity="0.6" />
      <line x1="38" y1="63" x2="48" y2="63" stroke="#9A3412" strokeWidth="1" opacity="0.6" />
      <line x1="72" y1="60" x2="82" y2="58" stroke="#9A3412" strokeWidth="1" opacity="0.6" />
      <line x1="72" y1="63" x2="82" y2="63" stroke="#9A3412" strokeWidth="1" opacity="0.6" />
      <ellipse cx="42" cy="60" rx="4" ry="2.5" fill="#FB923C" opacity="0.3" />
      <ellipse cx="78" cy="60" rx="4" ry="2.5" fill="#FB923C" opacity="0.3" />
      <ellipse cx="92" cy="20" rx="10" ry="7" fill="#FFF7ED" stroke="#EA580C" strokeWidth="1.4" />
      <circle cx="92" cy="20" r="1.8" fill="#EA580C" opacity="0.6" />
      <circle cx="86" cy="14" r="1.2" fill="#EA580C" opacity="0.4" />
    </svg>
  )
}
