import { useId } from 'react'

export default function LostCat({ size = 120, className = '' }) {
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
      aria-label="迷路小猫"
    >
      <defs>
        <radialGradient id={`lc-body-${id}`} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#FFF7ED" />
          <stop offset="100%" stopColor="#FED7AA" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="108" rx="28" ry="5" fill="#1C1917" opacity="0.06" />
      <path
        d="M38 74 Q34 96 44 104 L76 104 Q86 96 82 74 Z"
        fill={`url(#lc-body-${id})`}
        stroke="#EA580C"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <ellipse cx="50" cy="104" rx="7" ry="4" fill={`url(#lc-body-${id})`} stroke="#EA580C" strokeWidth="1.4" />
      <ellipse cx="70" cy="104" rx="7" ry="4" fill={`url(#lc-body-${id})`} stroke="#EA580C" strokeWidth="1.4" />
      <path
        d="M82 82 Q96 80 98 66 Q99 56 92 54"
        fill="none"
        stroke="#EA580C"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <polygon points="32,42 38,22 50,40" fill={`url(#lc-body-${id})`} stroke="#EA580C" strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="70,40 82,22 88,42" fill={`url(#lc-body-${id})}`} stroke="#EA580C" strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="36,38 41,28 47,38" fill="#F97316" opacity="0.55" />
      <polygon points="73,38 79,28 84,38" fill="#F97316" opacity="0.55" />
      <circle cx="60" cy="54" r="22" fill={`url(#lc-body-${id})`} stroke="#EA580C" strokeWidth="1.8" />
      <circle cx="50" cy="52" r="3.8" fill="#1C1917" />
      <circle cx="70" cy="52" r="3.8" fill="#1C1917" />
      <circle cx="51.2" cy="50.8" r="1.2" fill="#FFFFFF" />
      <circle cx="71.2" cy="50.8" r="1.2" fill="#FFFFFF" />
      <path d="M58 62 L62 62 L60 65 Z" fill="#EA580C" />
      <path d="M54 70 Q60 66 66 70" fill="none" stroke="#1C1917" strokeWidth="2" strokeLinecap="round" />
      <line x1="38" y1="58" x2="48" y2="60" stroke="#9A3412" strokeWidth="1" opacity="0.6" />
      <line x1="38" y1="63" x2="48" y2="63" stroke="#9A3412" strokeWidth="1" opacity="0.6" />
      <line x1="72" y1="60" x2="82" y2="58" stroke="#9A3412" strokeWidth="1" opacity="0.6" />
      <line x1="72" y1="63" x2="82" y2="63" stroke="#9A3412" strokeWidth="1" opacity="0.6" />
      <ellipse cx="42" cy="62" rx="4" ry="2.5" fill="#FB923C" opacity="0.35" />
      <ellipse cx="78" cy="62" rx="4" ry="2.5" fill="#FB923C" opacity="0.35" />
      <text x="60" y="22" fontSize="22" fill="#F97316" fontWeight="700" textAnchor="middle" fontFamily="system-ui, sans-serif">?</text>
      <circle cx="60" cy="8" r="1.4" fill="#F97316" opacity="0.5" />
      <circle cx="60" cy="4" r="1" fill="#F97316" opacity="0.3" />
    </svg>
  )
}
