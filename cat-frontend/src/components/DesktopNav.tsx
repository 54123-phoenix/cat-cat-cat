import { NavLink } from 'react-router-dom'
import { Home, BookOpen, Camera, MapPin, MessageSquare, User, Route } from 'lucide-react'
import Logo from './illustrations/Logo'

const links = [
  { to: '/', label: '校园首页', icon: Home },
  { to: '/collection', label: '猫猫图鉴', icon: BookOpen },
  { to: '/map', label: '猫猫地图', icon: MapPin },
  { to: '/routes', label: '寻猫路线', icon: Route },
  { to: '/community', label: '猫友社区', icon: MessageSquare },
  { to: '/profile', label: '个人中心', icon: User },
]

export default function DesktopNav() {
  return (
    <aside className="desktop-rail">
      <NavLink to="/" className="rail-brand" aria-label="猫猫社区首页">
        <Logo size={36} />
        <span><strong>猫猫社区</strong><span className="block text-sm font-normal text-text-secondary">校园里的猫与我们</span></span>
      </NavLink>
      <NavLink to="/scan" className="btn btn-primary mt-8 w-full shrink-0 gap-2"><Camera size={18} aria-hidden="true" />拍照识猫</NavLink>
      <nav aria-label="主要导航" className="mt-6 space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => 'rail-link' + (isActive ? ' is-active' : '')}>
            <Icon size={19} aria-hidden="true" />{label}
          </NavLink>
        ))}
      </nav>
      <p className="mt-auto pt-8 text-sm leading-6 text-text-secondary">保持距离，温柔记录。<br />让每一次偶遇成为了解。</p>
    </aside>
  )
}
