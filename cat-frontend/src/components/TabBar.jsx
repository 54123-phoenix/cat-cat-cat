import { NavLink } from 'react-router-dom'
import { Camera, MapPin, MessageSquare, User } from 'lucide-react'

const tabs = [
  { to: '/', label: '首页', icon: Camera },
  { to: '/map', label: '地图', icon: MapPin },
  { to: '/community', label: '社区', icon: MessageSquare },
  { to: '/profile', label: '我的', icon: User },
]

export default function TabBar() {
  return (
    <nav className="tab-bar fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center h-16 max-w-[480px] mx-auto px-4">
      {tabs.map(({ to, label, icon: Icon }) => (
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
    </nav>
  )
}
