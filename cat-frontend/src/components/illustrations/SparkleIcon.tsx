export default function SparkleIcon({ size = 24, className = '' }) {
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
      aria-label="火花"
    >
      <path d="M12 2 L13.6 9 L21 12 L13.6 15 L12 22 L10.4 15 L3 12 L10.4 9 Z" />
      <path d="M19 4 L19.6 6 L21.5 6.5 L19.6 7 L19 9 L18.4 7 L16.5 6.5 L18.4 6 Z" />
    </svg>
  )
}
