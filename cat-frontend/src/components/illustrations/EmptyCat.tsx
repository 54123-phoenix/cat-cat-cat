import MascotCat from '../MascotCat'

export default function EmptyCat({ size = 120, className = '' }) {
  return <MascotCat size={size} className={className} breathe={false} />
}
