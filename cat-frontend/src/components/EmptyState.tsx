import { type ReactNode } from 'react'
import SadCat from './illustrations/SadCat'
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
    <div className="card p-10 text-center space-y-3 animate-fade-in">
      <div className="flex justify-center text-text-muted/40">
        {VariantIllustration && !useMascot ? (
          <VariantIllustration size={64} />
        ) : useMascot && !Icon ? (
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
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn btn-ghost btn-sm mt-2"
        >
          重试
        </button>
      )}
    </div>
  )
}
