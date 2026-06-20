export default function PawIcon({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="currentColor"
      role="img"
      aria-label="猫爪"
    >
      <ellipse cx="12" cy="15.5" rx="5.2" ry="4.2" />
      <ellipse cx="6" cy="9" rx="2" ry="2.6" />
      <ellipse cx="12" cy="7" rx="2" ry="2.6" />
      <ellipse cx="18" cy="9" rx="2" ry="2.6" />
    </svg>
  )
}
