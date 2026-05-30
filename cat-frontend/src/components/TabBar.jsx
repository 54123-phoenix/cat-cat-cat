import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: '首页', icon: '🏠' },
  { to: '/feed', label: '动态', icon: '📋' },
  { to: '/scan', label: '识别', icon: '📷', featured: true },
  { to: '/community', label: '社区', icon: '💬' },
  { to: '/profile', label: '我的', icon: '👤' },
]

export default function TabBar() {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-100 flex items-end pb-2 z-50 shadow-[0_-8px_20px_rgba(249,115,22,0.08)]">
      {tabs.map(({ to, label, icon, featured }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-0.5 transition-colors duration-150 ${featured ? '-mt-4' : 'pt-2'} ${
              isActive ? 'text-cat-orange' : 'text-gray-400'
            }`
          }
        >
          {featured ? (
            <span className="w-14 h-14 rounded-full bg-cat-orange flex items-center justify-center text-white text-2xl shadow-lg shadow-orange-200">
              {icon}
            </span>
          ) : (
            <span className="text-xl">{icon}</span>
          )}
          <span className="text-[10px] font-medium">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
