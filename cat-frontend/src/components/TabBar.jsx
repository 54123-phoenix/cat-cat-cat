import { NavLink, useNavigate } from 'react-router-dom'
import { Camera, MapPin, MessageSquare, User } from 'lucide-react'

const tabs = [
  { to: '/', label: '首页', icon: Camera },
  { to: '/map', label: '地图', icon: MapPin },
  { to: '/community', label: '社区', icon: MessageSquare },
  { to: '/profile', label: '我的', icon: User },
]

export default function TabBar() {
  const navigate = useNavigate()

  return (
    <nav className="tab-bar fixed bottom-0 left-0 right-0 z-50 flex justify-around items-end h-16 max-w-[480px] mx-auto px-4">
      {tabs.slice(0, 2).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 transition-colors duration-200 ${
              isActive ? 'text-primary' : 'text-text-muted'
            }`
          }
        >
          <Icon className="w-5 h-5" />
          <span className="text-xs font-medium">{label}</span>
        </NavLink>
      ))}

      {/* Center scan button */}
      <button
        onClick={() => navigate('/scan')}
        className="flex flex-col items-center -mt-5 focus-ring rounded-full"
        aria-label="拍照识猫"
      >
        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform">
          <Camera className="w-6 h-6 text-white" />
        </div>
        <span className="text-xs font-medium text-primary mt-0.5">识猫</span>
      </button>

      {tabs.slice(2).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 transition-colors duration-200 ${
              isActive ? 'text-primary' : 'text-text-muted'
            }`
          }
        >
          <Icon className="w-5 h-5" />
          <span className="text-xs font-medium">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
