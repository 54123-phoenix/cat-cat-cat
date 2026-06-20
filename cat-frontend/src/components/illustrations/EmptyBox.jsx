import { useId } from 'react'

export default function EmptyBox({ size = 120, className = '' }) {
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
      aria-label="空纸箱"
    >
      <defs>
        <linearGradient id={`eb-box-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FED7AA" />
          <stop offset="100%" stopColor="#FDBA74" />
        </linearGradient>
        <linearGradient id={`eb-flap-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFF7ED" />
          <stop offset="100%" stopColor="#FED7AA" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="108" rx="40" ry="5" fill="#1C1917" opacity="0.06" />
      <path
        d="M22 58 L98 58 L92 100 L28 100 Z"
        fill={`url(#eb-box-${id})`}
        stroke="#EA580C"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <line x1="22" y1="58" x2="28" y2="100" stroke="#EA580C" strokeWidth="1.2" opacity="0.5" />
      <line x1="98" y1="58" x2="92" y2="100" stroke="#EA580C" strokeWidth="1.2" opacity="0.5" />
      <path
        d="M22 58 L40 50 L60 58 L80 50 L98 58"
        fill="none"
        stroke="#EA580C"
        strokeWidth="1.4"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <path
        d="M22 58 L40 50 L40 30 L24 38 Z"
        fill={`url(#eb-flap-${id})`}
        stroke="#EA580C"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M98 58 L80 50 L80 30 L96 38 Z"
        fill={`url(#eb-flap-${id})`}
        stroke="#EA580C"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M40 50 L60 58 L60 36 L40 30 Z"
        fill={`url(#eb-flap-${id})`}
        stroke="#EA580C"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M80 50 L60 58 L60 36 L80 30 Z"
        fill={`url(#eb-flap-${id})`}
        stroke="#EA580C"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <line x1="40" y1="50" x2="40" y2="30" stroke="#EA580C" strokeWidth="1.2" opacity="0.6" />
      <line x1="80" y1="50" x2="80" y2="30" stroke="#EA580C" strokeWidth="1.2" opacity="0.6" />
      <line x1="60" y1="58" x2="60" y2="36" stroke="#EA580C" strokeWidth="1.2" opacity="0.6" />
      <path
        d="M98 70 Q108 72 110 60 Q111 52 104 50"
        fill="none"
        stroke="#EA580C"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M104 50 Q102 46 106 44 Q110 46 108 50"
        fill={`url(#eb-flap-${id})`}
        stroke="#EA580C"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="44" cy="74" r="1.6" fill="#EA580C" opacity="0.4" />
      <circle cx="50" cy="78" r="1.2" fill="#EA580C" opacity="0.3" />
    </svg>
  )
}
