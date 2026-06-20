export default function Wordmark({ size = 20, className = '' }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 700,
        fontSize: `${size}px`,
        color: 'currentColor',
        lineHeight: 1.2,
        letterSpacing: '0.02em',
      }}
    >
      猫猫档案
    </span>
  )
}
