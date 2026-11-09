import Logo from './illustrations/Logo'

export default function CatSpinner({ size = 32, fullPage = false }) {
  return (
    <span role="status" aria-label="正在加载" className={`brand-spinner ${fullPage ? 'brand-spinner-page' : ''}`} style={{ width: size, height: size }}>
      <span className="brand-spinner-ring" aria-hidden="true" />
      <span aria-hidden="true"><Logo size={Math.round(size * 0.76)} withCircle={false} /></span>
    </span>
  )
}
