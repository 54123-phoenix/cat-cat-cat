export default function Logo({ size = 48, className = '', withCircle = true }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="猫猫社区 Logo"
    >
      {withCircle && <circle cx="24" cy="24" r="22" fill="#EA580C" />}
      <circle cx="24" cy="24" r="17" fill="#FFF7ED" />
      <path d="M13.5 20.2L17.3 10.2L22.3 18.7" fill="#FFF7ED" stroke="#FFFFFF" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M25.7 18.7L30.7 10.2L34.5 20.2" fill="#FFF7ED" stroke="#FFFFFF" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M13.5 20.2L17.3 10.2L22.3 18.7" fill="none" stroke="#EA580C" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M25.7 18.7L30.7 10.2L34.5 20.2" fill="none" stroke="#EA580C" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="19" cy="24" r="2" fill="#7C2D12" />
      <circle cx="29" cy="24" r="2" fill="#7C2D12" />
      <path d="M21.8 30C23 31.2 25 31.2 26.2 30" fill="none" stroke="#7C2D12" strokeWidth="2" strokeLinecap="round" />
      <path d="M22.7 27.4H25.3L24 29.2Z" fill="#EA580C" />
      <path d="M14.5 28H19M29 28H33.5" stroke="#FB923C" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14.8 31H19.2M28.8 31H33.2" stroke="#FB923C" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="35.5" cy="34.5" r="4.2" fill="#FFFFFF" />
      <path d="M35.5 37.3C34.8 36 32.7 34.8 32.7 32.8C32.7 31.2 33.9 30.1 35.5 30.1C37.1 30.1 38.3 31.2 38.3 32.8C38.3 34.8 36.2 36 35.5 37.3Z" fill="#EA580C" />
    </svg>
  )
}
