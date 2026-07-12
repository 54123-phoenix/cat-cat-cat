import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Bell, Award, Images, TrendingUp, Shield, LogOut, BookOpen, Trophy, Sparkles, Route as RouteIcon, Bot } from 'lucide-react'

export default function Sidebar({ isOpen, onClose, user, onLogout }) {
  const navigate = useNavigate()
  const sidebarRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)

    const container = sidebarRef.current
    if (!container) return undefined
    const focusable = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length > 0) focusable[0].focus()

    function trapFocus(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    container.addEventListener('keydown', trapFocus)

    return () => {
      window.removeEventListener('keydown', handler)
      container.removeEventListener('keydown', trapFocus)
    }
  }, [isOpen, onClose])

  const navItems = [
    { label: '猫情报 Agent', icon: Bot, path: '/intel' },
    { label: '通知中心', icon: Bell, path: '/notifications' },
    { label: '猫猫图鉴', icon: BookOpen, path: '/collection' },
    { label: '联赛', icon: Trophy, path: '/league' },
    { label: '年度报告', icon: Sparkles, path: '/wrapped' },
    { label: '猫猫路线', icon: RouteIcon, path: '/routes' },
    { label: '勋章墙', icon: Award, path: '/badges' },
    { label: '猫猫图库', icon: Images, path: '/gallery' },
    { label: '周报', icon: TrendingUp, path: '/weekly-report' },
    ...(user?.role === 'admin'
      ? [{ label: '管理端', icon: Shield, path: '/admin' }]
      : []),
  ]

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 transition-opacity"
          onClick={onClose}
        />
      )}

      <div
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-full w-64 bg-warm-50 z-50 shadow-xl transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="侧边菜单"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt={`${user?.nickname || '用户'}的头像`} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg">{user?.nickname?.[0] || '猫'}</span>
              )}
            </div>
            <div>
              <span className="font-semibold text-text block">
                {user?.nickname || '猫猫爱好者'}
              </span>
              {user?.role && (
                <span className="text-xs text-text-secondary">
                  {user.role === 'admin' ? '管理员' : '猫友'}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="关闭菜单" className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <nav className="p-3 space-y-1">
          {navItems.map(({ label, icon: Icon, path }) => (
            <button
              key={path}
              onClick={() => { navigate(path); onClose() }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-text-secondary hover:bg-primary-light hover:text-primary transition-colors font-medium"
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-4 left-3 right-3">
          <button
            onClick={() => { onLogout(); onClose() }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-50 transition-colors font-medium"
          >
            <LogOut className="w-5 h-5" />
            退出登录
          </button>
        </div>
      </div>
    </>
  )
}
