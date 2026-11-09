import BrandImage from '../BrandImage'

export default function Logo({ size = 48, className = '', withCircle = true }) {
  return <BrandImage variant="head" size={size} label="猫猫社区 Logo" className={`brand-logo ${withCircle ? 'brand-logo-circle' : ''} ${className}`.trim()} />
}
