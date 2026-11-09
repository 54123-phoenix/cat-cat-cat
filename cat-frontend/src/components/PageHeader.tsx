import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  onBack?: () => void
  compact?: boolean
}

export default function PageHeader({ title, subtitle, action, onBack, compact = false }: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className={compact ? 'flex items-center justify-between gap-3' : `grid items-start gap-3 border-b border-border py-3 ${action ? 'grid-cols-[2.75rem_minmax(0,1fr)_auto]' : 'grid-cols-[2.75rem_minmax(0,1fr)]'}`}>
      <button
        type="button"
        onClick={onBack || (() => navigate(-1))}
        className={`focus-ring flex h-11 items-center justify-center rounded-xl text-text transition-colors hover:bg-primary-light active:bg-surface-3 ${compact ? 'gap-2 px-3' : 'w-11'}`}
        aria-label="返回"
      >
        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        {compact && <span className="ui-meta font-medium">返回</span>}
      </button>
      {!compact && <div className="min-w-0 py-1.5">
        <h1 className="ui-section-title text-text [overflow-wrap:anywhere]">{title}</h1>
        {subtitle && <p className="ui-meta mt-1 text-text-secondary [overflow-wrap:anywhere]">{subtitle}</p>}
      </div>}
      {action && <div className="min-w-0 max-w-28 justify-self-end [overflow-wrap:anywhere] [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:whitespace-normal [&_button]:min-h-11 [&_button]:whitespace-normal">{action}</div>}
    </header>
  )
}
