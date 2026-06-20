export default function FishJerky({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="鱼干"
    >
      <path d="M3 12 C5 7 11 5 17 7 L20 5 L21 8 L23 9 L21 12 L23 15 L21 16 L20 19 L17 17 C11 19 5 17 3 12 Z" />
      <line x1="7" y1="10" x2="14" y2="9" />
      <line x1="7" y1="14" x2="14" y2="15" />
      <circle cx="6.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}
