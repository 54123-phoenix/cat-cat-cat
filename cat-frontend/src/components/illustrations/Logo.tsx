export default function Logo({ size = 48, className = '', withCircle = true }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="猫猫档案 Logo"
    >
      {withCircle && <circle cx="24" cy="24" r="22" fill="#F97316" />}
      <g
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      >
        <polygon points="12,19 17,6 23,18" />
        <polygon points="25,18 31,6 36,19" />
        <circle cx="24" cy="26" r="11" />
      </g>
      <circle cx="20" cy="26" r="1.7" fill="#FFFFFF" />
      <circle cx="28" cy="26" r="1.7" fill="#FFFFFF" />
      <path d="M22.4 30.4 L25.6 30.4 L24 32.6 Z" fill="#FFFFFF" />
    </svg>
  )
}
