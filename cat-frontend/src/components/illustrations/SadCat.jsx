/**
 * SadCat — a simple sad/lonely cat SVG illustration
 * Props:
 *   className: optional CSS classes
 *   size: viewBox width/height (default 120)
 */
export default function SadCat({ className, size = 120 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Sad cat"
    >
      {/* body */}
      <path
        d="M40 70 Q30 55 35 40 Q38 30 45 28 L75 28 Q82 30 85 40 Q90 55 80 70 L75 85 L45 85 Z"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* head */}
      <ellipse cx="60" cy="35" rx="20" ry="18" stroke="currentColor" strokeWidth="2.5" fill="none" />
      {/* left ear (droopy) */}
      <path
        d="M42 25 Q35 10 45 12 L48 20"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* right ear (droopy) */}
      <path
        d="M78 25 Q85 10 75 12 L72 20"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* eyes */}
      <ellipse cx="50" cy="33" rx="3" ry="4" fill="currentColor" />
      <ellipse cx="70" cy="33" rx="3" ry="4" fill="currentColor" />
      {/* droopy inner-eye lines (sad eyebrows) */}
      <path
        d="M45 27 Q50 25 55 28"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M75 27 Q70 25 65 28"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* nose */}
      <path
        d="M59 38 Q60 40 61 38"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* mouth (frown) */}
      <path
        d="M55 42 Q60 39 65 42"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* whiskers */}
      <line x1="35" y1="35" x2="44" y2="37" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="35" y1="40" x2="44" y2="40" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="85" y1="35" x2="76" y2="37" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="85" y1="40" x2="76" y2="40" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      {/* tail (droopy) */}
      <path
        d="M40 80 Q25 90 20 75 Q18 65 25 60"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* paws */}
      <ellipse cx="45" cy="88" rx="5" ry="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <ellipse cx="75" cy="88" rx="5" ry="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  )
}
