export default function YarnBall({ size = 24, className = '' }) {
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
      aria-label="毛线球"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 10 C7 8 17 8 20.5 14" />
      <path d="M4 15 C8 17 16 16 20 9" />
      <path d="M12 3 C9 7 9 17 12 21" />
    </svg>
  )
}
