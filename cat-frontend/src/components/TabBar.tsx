import { NavLink } from 'react-router-dom'
import { Home, MapPin, MessageSquare, User, Camera } from 'lucide-react'

const tabs = [
  { to: '/', label: '首页', icon: Home },
  { to: '/map', label: '地图', icon: MapPin },
  { to: '/scan', label: '识猫', icon: Camera },
  { to: '/community', label: '社区', icon: MessageSquare },
  { to: '/profile', label: '我的', icon: User },
]

export default function TabBar() {
  return (
    <nav className="mobile-nav" aria-label="主要导航">
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} aria-label={to === '/scan' ? '拍照识猫' : label}
          className={({ isActive }) => ['mobile-nav-link', isActive ? 'is-active' : '', to === '/scan' ? 'mobile-nav-scan' : ''].join(' ')}>
          <span className="nav-icon"><Icon size={21} aria-hidden="true" /></span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
