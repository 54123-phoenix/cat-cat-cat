import { type CSSProperties } from 'react'
import BrandImage from './BrandImage'

const MOODS = ['happy', 'sleep', 'sad', 'curious']

interface MascotCatProps {
  mood?: string
  size?: number
  className?: string
  style?: CSSProperties
  breathe?: boolean
}

export default function MascotCat({ mood = 'happy', size = 96, className = '', style, breathe = false }: MascotCatProps) {
  const safeMood = MOODS.includes(mood) ? mood : 'happy'
  // The approved artwork has one expression; surrounding copy conveys state.
  const animate = breathe && safeMood !== 'sad' && safeMood !== 'sleep'
  return (
    <BrandImage
      variant="full"
      size={size}
      height={Math.round(size * 1.05)}
      label="蓝白校园猫吉祥物"
      className={`mascot-cat ${animate ? 'mascot-breathe' : ''} ${className}`.trim()}
      style={style}
    />
  )
}
