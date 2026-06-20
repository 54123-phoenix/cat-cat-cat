import { useState, useEffect, useCallback } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import TabBar from './TabBar'
import Sidebar from './Sidebar'
import Toast, { toast } from './Toast'
import CelebrationOverlay from './CelebrationOverlay'
import Onboarding, { isOnboarded } from './Onboarding'
import { useEventStream } from '../hooks/useEventStream'
import { getUserProfile, getToken, clearToken, setToken } from '../api'
import { useUserStore, updateUser } from '../App'

const routeTitles = {
  '/': '猫猫社区',
  '/map': '猫猫地图',
  '/scan': '拍照识猫',
  '/community': '猫猫社区',
  '/profile': '个人中心',
  '/feed': '偶遇动态',
  '/gallery': '猫猫图库',
  '/collection': '猫猫图鉴',
  '/league': '联赛季榜',
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [celebration, setCelebration] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboarded())
  const user = useUserStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [tabIndex, setTabIndex] = useState(0)

  const getTitle = () => {
    const exact = routeTitles[location.pathname]
    if (exact) return exact
    if (location.pathname.startsWith('/cats/')) return '猫猫档案'
    if (location.pathname.startsWith('/posts/')) return '帖子详情'
    return '猫猫社区'
  }

  useEffect(() => {
    const path = location.pathname
    if (path === '/') setTabIndex(0)
    else if (path === '/map') setTabIndex(1)
    else if (path === '/community') setTabIndex(2)
    else if (path === '/profile') setTabIndex(3)
  }, [location.pathname])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      navigate('/login')
      return
    }
    let cancelled = false
    getUserProfile()
      .then((u) => {
        if (!cancelled) {
          updateUser(u)
          setToken(token, u)
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearToken()
          navigate('/login')
        }
      })
    return () => { cancelled = true }
  }, [])

  const handleLogout = () => {
    clearToken()
    updateUser(null)
    navigate('/login')
  }

  const handleEvent = useCallback((payload) => {
    if (!payload || !payload.type) return
    const data = payload.data || {}
    const nick = data.user_nickname || '有人'
    switch (payload.type) {
      case 'post_new':
        toast(`${nick} 发布了新动态`, { type: 'post_new' })
        break
      case 'comment_new':
        toast(`${nick} 评论了动态`, { type: 'comment_new' })
        break
      case 'like_new':
        toast(`${nick} 赞了动态`, { type: 'like_new' })
        break
      case 'badge_unlock':
        toast(`解锁新勋章！`, { type: 'badge_unlock' })
        setCelebration({ name: data.badge_name || data.name || '新勋章' })
        break
      case 'sighting_confirmed':
        toast(`偶遇记录被确认，等级 ${data.grade || ''}`, { type: 'sighting_confirmed' })
        break
      case 'discovery_reviewed':
        toast(`发现线索已审核`, { type: 'discovery_reviewed' })
        break
      default:
        toast('收到新通知', {})
    }
  }, [])

  useEventStream(handleEvent)

  return (
    <div className="min-h-screen max-w-[480px] mx-auto theme-bg pb-16">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-surface-0/80 backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 rounded-xl hover:bg-primary-light transition-colors"
          aria-label="打开菜单"
        >
          <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <Menu className="w-5 h-5 text-primary" />
            )}
          </div>
        </button>

        <h1 className="text-lg font-bold text-text">{getTitle()}</h1>

        <div className="w-9" />
      </header>

      {/* Main content */}
      <main className="px-4 pt-2 pb-4">
        <div key={location.pathname} className="animate-fade-up">
          <Outlet />
        </div>
      </main>

      <TabBar />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} onLogout={handleLogout} />
      <Toast />
      {celebration && (
        <CelebrationOverlay
          badgeName={celebration.name}
          onClose={() => setCelebration(null)}
        />
      )}
      {showOnboarding && (
        <Onboarding onClose={() => setShowOnboarding(false)} />
      )}
    </div>
  )
}
