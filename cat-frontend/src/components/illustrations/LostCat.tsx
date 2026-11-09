import MascotCat from '../MascotCat'

export default function LostCat({ size = 120, className = '' }) {
  return <MascotCat mood="sad" size={size} className={className} breathe={false} />
}
