export default function CatSpinner({ size = 32, fullPage = false }) {
  const s = size

  return (
    <div className="inline-flex items-center justify-center" style={{ width: s, height: s }}>
      <svg
        width={s}
        height={s}
        viewBox="0 0 40 40"
        fill="none"
        className="animate-cat-spin"
        style={{ animationDuration: '0.6s' }}
      >
        {/* Body */}
        <ellipse cx="20" cy="24" rx="10" ry="8" fill="#F97316" />
        {/* Head */}
        <circle cx="20" cy="14" r="8" fill="#F97316" />
        {/* Left ear */}
        <polygon points="14,10 12,2 17,8" fill="#F97316" />
        {/* Right ear */}
        <polygon points="26,10 28,2 23,8" fill="#F97316" />
        {/* Eyes */}
        <circle cx="17" cy="13" r="1.5" fill="white" />
        <circle cx="23" cy="13" r="1.5" fill="white" />
        <circle cx="17" cy="13" r="0.8" fill="#1C1917" />
        <circle cx="23" cy="13" r="0.8" fill="#1C1917" />
        {/* Tail - the moving part */}
        <path
          d="M30 24 Q36 20 34 14 Q32 10 36 8"
          stroke="#F97316"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          className="animate-tail-wag"
        />
      </svg>
      {fullPage && (
        <div className="cat-dash-loader">
          <div className="cat-dash-silhouette">
            <svg width="48" height="24" viewBox="0 0 48 24">
              <ellipse cx="24" cy="16" rx="8" ry="5" fill="#F97316" opacity="0.6" />
              <circle cx="24" cy="9" r="6" fill="#F97316" opacity="0.6" />
              <polygon points="20,5 18,0 22,4" fill="#F97316" opacity="0.6" />
              <polygon points="28,5 30,0 26,4" fill="#F97316" opacity="0.6" />
              <path d="M32 12 Q38 10 36 6" stroke="#F97316" strokeWidth="2" fill="none" opacity="0.6" />
              <line x1="16" y1="16" x2="32" y2="16" stroke="#F97316" strokeWidth="1.5" opacity="0.2" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}
