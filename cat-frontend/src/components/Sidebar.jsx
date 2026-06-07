import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Home, Map, Camera, MessageSquare, User, Shield, LogOut } from 'lucide-react'

export default function Sidebar({ isOpen, onClose, user, onLogout }) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const navItems = [
    { label: '首页', icon: Home, path: '/' },
    { label: '地图', icon: Map, path: '/map' },
    { label: '拍照识别', icon: Camera, path: '/scan' },
    { label: '社区', icon: MessageSquare, path: '/community' },
    { label: '个人', icon: User, path: '/profile' },
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
        className={`fixed top-0 left-0 h-full w-64 bg-warm-50 z-50 shadow-xl transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg">{user?.nickname?.[0] || '猫'}</span>
              )}
            </div>
            <span className="font-semibold text-text">
              {user?.nickname || '猫猫爱好者'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
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
