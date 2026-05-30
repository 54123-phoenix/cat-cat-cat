export default function BadgeCard({ badge, earned }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 p-2.5 text-center ${!earned ? 'opacity-35 grayscale' : ''}`}>
      <div className="text-2xl">{badge.emoji}</div>
      <div className="text-[9px] text-gray-500 mt-1 leading-tight">{badge.name}</div>
    </div>
  )
}
