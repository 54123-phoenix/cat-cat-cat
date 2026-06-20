import PawIcon from './illustrations/PawIcon'
import LittleFish from './illustrations/LittleFish'
import FishJerky from './illustrations/FishJerky'
import SparkleIcon from './illustrations/SparkleIcon'
import YarnBall from './illustrations/YarnBall'

export default function BadgeIcon({ series, badge, size = 24, className = '' }) {
  const s = series || badge?.series || badge?.type || badge?.category || 'default'

  switch (s) {
    case 'sighting':
      return <PawIcon size={size} className={className} />
    case 'community':
      return <LittleFish size={size} className={className} />
    case 'collect':
      return <FishJerky size={size} className={className} />
    case 'special':
      return <SparkleIcon size={size} className={className} />
    default:
      return <YarnBall size={size} className={className} />
  }
}
