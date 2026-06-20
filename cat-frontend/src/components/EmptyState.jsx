import SadCat from './illustrations/SadCat'
import MascotCat from './MascotCat'

/**
 * Reusable empty state placeholder.
 * Props:
 *   - icon: lucide-react icon component (defaults to MascotCat)
 *   - useMascot: when true (default) render MascotCat instead of icon
 *   - mood: MascotCat mood (default 'curious')
 *   - title: short headline
 *   - description: optional supporting text
 *   - action: optional { label, onClick }
 */
export default function EmptyState({
  icon: Icon,
  useMascot = true,
  mood = 'curious',
  title,
  description,
  action,
}) {
  return (
    <div className="card p-10 text-center space-y-3 animate-fade-in">
      <div className="flex justify-center">
        {useMascot && !Icon ? (
          <MascotCat mood={mood} size={80} />
        ) : Icon ? (
          <Icon className="w-16 h-16 text-text-muted/40" />
        ) : (
          <MascotCat mood={mood} size={80} />
        )}
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
