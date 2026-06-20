export default function LittleFish({ size = 24, className = '' }) {
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
      aria-label="小鱼"
    >
      <path d="M4 12 C4 8 8 6 13 6 C18 6 20 8 20 12 C20 16 18 18 13 18 C8 18 4 16 4 12 Z" />
      <path d="M20 12 L23 8 L23 16 Z" />
      <circle cx="8" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}
