import { PawPrint } from 'lucide-react'

/**
 * Reusable empty state placeholder.
 * Props:
 *   - icon: lucide-react icon component (defaults to PawPrint)
 *   - title: short headline
 *   - description: optional supporting text
 *   - action: optional { label, onClick }
 */
export default function EmptyState({
  icon: Icon = PawPrint,
  title,
  description,
  action,
}) {
  return (
    <div className="card p-8 text-center space-y-3 animate-fade-in">
      <div className="flex justify-center">
        <Icon className="w-10 h-10 text-text-muted" />
      </div>
      {title && (
        <p className="text-sm font-medium text-text">{title}</p>
      )}
      {description && (
        <p className="text-xs text-text-secondary leading-relaxed">
          {description}
        </p>
      )}
      {action && action.label && (
        <button
          onClick={action.onClick}
          className="btn btn-primary btn-sm mt-2"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
