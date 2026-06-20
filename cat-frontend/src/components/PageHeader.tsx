import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  onBack?: () => void
}

export default function PageHeader({ title, subtitle, action, onBack }: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 bg-surface-0/80 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-border">
      <button
        onClick={onBack || (() => navigate(-1))}
        className="p-1 -ml-1 rounded-lg hover:bg-primary-light transition-colors focus-ring"
        aria-label="返回"
      >
        <ArrowLeft className="w-5 h-5 text-text" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-bold text-text truncate">{title}</h1>
        {subtitle && <p className="text-xs text-text-secondary">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
