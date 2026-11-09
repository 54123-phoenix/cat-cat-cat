
import MascotCat from './MascotCat'
import EmptyCat from './illustrations/EmptyCat'
import LostCat from './illustrations/LostCat'
import EmptyBox from './illustrations/EmptyBox'

const VARIANT_ILLUSTRATIONS = {
  empty: EmptyCat,
  lost: LostCat,
  box: EmptyBox,
}

interface EmptyStateProps {
  icon?: any
  useMascot?: boolean
  mood?: string
  variant?: string
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  onRetry?: () => void
}

export default function EmptyState({
  icon: Icon,
  useMascot = true,
  mood = 'curious',
  variant,
  title,
  description,
  action,
  onRetry,
}: EmptyStateProps) {
  const VariantIllustration = variant ? VARIANT_ILLUSTRATIONS[variant] : null

  return (
    <div className="card px-5 py-8 text-center space-y-3 sm:p-8">
      <div className="flex justify-center text-text-secondary" aria-hidden="true">
        {VariantIllustration && !useMascot ? (
          <VariantIllustration size={64} />
        ) : useMascot && !Icon ? (
          <MascotCat mood={mood} size={112} />
        ) : Icon ? (
          <Icon className="w-14 h-14 text-text-secondary" />
        ) : (
          <MascotCat mood={mood} size={112} />
        )}
      </div>
      {title && (
        <p className="text-base font-semibold text-text [overflow-wrap:anywhere]">{title}</p>
      )}
      {description && (
        <p className="mx-auto max-w-prose text-sm text-text-secondary leading-relaxed [overflow-wrap:anywhere]">
          {description}
        </p>
      )}
      {((action && action.label) || onRetry) && (
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {action && action.label && (
            <button type="button" onClick={action.onClick} className="btn btn-primary min-h-11 px-5 py-2.5 text-sm text-on-primary">
              {action.label}
            </button>
          )}
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn btn-ghost min-h-11 px-5 py-2.5 text-sm">
              重试
            </button>
          )}
        </div>
      )}
    </div>
  )
}
