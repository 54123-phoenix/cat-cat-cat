export default function ConfidenceBar({ value = 0, showExplanation = true }: { value?: number; showExplanation?: boolean }) {
  const pct = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value * 100))) : 0

  return (
    <div className="space-y-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-8 flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden" aria-hidden="true">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-sm font-medium text-text-secondary tabular-nums">匹配相似度 {pct}%</span>
      </div>
      {showExplanation && <p className="text-sm leading-5 text-text-secondary">相似度用于比较照片，不代表识别正确的概率。</p>}
    </div>
  )
}
