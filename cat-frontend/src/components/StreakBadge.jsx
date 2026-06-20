export default function StreakBadge({ streak = 0, className = '' }) {
  const active = streak > 0
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${active ? 'bg-orange-50 text-orange-700' : 'bg-stone-100 text-stone-500'} ${className}`}
      title={`连续 ${streak} 天`}
    >
      <span
        className={active ? 'streak-flame' : ''}
        style={active ? { display: 'inline-block' } : undefined}
      >
        🔥
      </span>
      <span>{streak}</span>
    </span>
  )
}
