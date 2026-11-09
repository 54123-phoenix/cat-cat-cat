import { useState, useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import TabBar from './TabBar'
import DesktopNav from './DesktopNav'
import Sidebar from './Sidebar'
import Toast, { toast } from './Toast'
import CelebrationOverlay from './CelebrationOverlay'
import { useEventStream, type StreamEvent } from '../hooks/useEventStream'
import { LiveDataContext } from '../hooks/useLiveData'
import { ApiError, getUserProfile, getToken, clearToken, setToken } from '../api'
import { useUserStore, updateUser } from '../App'
import Logo from './illustrations/Logo'

const routeTitles: Record<string, string> = {
  '/': '校园猫猫',
  '/map': '猫猫地图',
  '/scan': '拍照识猫',
  '/community': '猫猫社区',
  '/profile': '个人中心',
  '/feed': '偶遇动态',
  '/gallery': '猫猫图库',
  '/collection': '猫猫图鉴',
  '/league': '联赛季榜',
  '/intel': '猫情报 Agent',
  '/notifications': '通知中心',
  '/weekly-report': '校园周报',
  '/wrapped': '年度报告',
  '/routes': '寻猫路线',
  '/badges': '勋章墙',
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [celebration, setCelebration] = useState(null)
  const user = useUserStore()
  const navigate = useNavigate()
  const location = useLocation()
  // Cat archives provide their own named h1 once loaded; other routes keep their existing heading behavior.
  const AppHeading = location.pathname.startsWith('/cats/') ? 'p' : 'h1'
  const queryClient = useQueryClient()
  const [revision, setRevision] = useState(0)
  const [event, setEvent] = useState<StreamEvent | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refresh = useCallback(() => {
    if (refreshTimer.current) return
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null
      if (!getToken()) return
      void queryClient.invalidateQueries()
      setRevision(value => value + 1)
    }, 200)
  }, [queryClient])
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current) }, [])

  const getTitle = () => {
    const exact = routeTitles[location.pathname]
    if (exact) return exact
    if (location.pathname.startsWith('/cats/')) return '猫猫档案'
    if (location.pathname.startsWith('/posts/')) return '帖子详情'
    return '猫猫社区'
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      navigate('/login')
      return undefined
    }
    let cancelled = false
    getUserProfile()
      .then((u) => {
        if (!cancelled && getToken() === token) {
          updateUser(u)
          setToken(token, u)
        }
      })
      .catch((error) => {
        if (!cancelled && error instanceof ApiError && error.status === 401 && (!getToken() || getToken() === token)) {
          clearToken()
          navigate('/login')
        } else if (!cancelled) {
          toast('个人资料暂时无法加载，请稍后重试')
        }
      })
    return () => { cancelled = true }
  }, [revision, navigate])

  const handleLogout = () => {
    clearToken()
    queryClient.clear()
    updateUser(null)
    navigate('/login')
  }

  const handleEvent = useCallback((payload) => {
    if (!payload || !payload.type) return
    setEvent(payload)
    refresh()
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
  }, [refresh])

  useEventStream(handleEvent, { onOpen: refresh, onUnauthorized: handleLogout })

  return (
    <LiveDataContext.Provider value={{ revision, event }}>
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        跳到主要内容
      </a>
      <DesktopNav />
      <div className="app-column">
      <header className="app-header">
        <button
          onClick={() => setSidebarOpen(true)}
          className="icon-button shrink-0"
          aria-label="打开菜单"
          aria-expanded={sidebarOpen}
          aria-controls="site-menu"
        >
          <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center overflow-hidden">
            {user?.avatar ? (
              <img src={user.avatar} alt={`${user?.nickname || '用户'}的头像`} className="w-full h-full object-cover" />
            ) : (
              <Menu className="w-5 h-5 text-primary" />
            )}
          </div>
        </button>

        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 lg:hidden"><Logo size={28} /></span>
          <AppHeading className="ui-section-title truncate text-text">{getTitle()}</AppHeading>
        </div>

        <div className="w-11 shrink-0" aria-hidden="true" />
      </header>

      {/* Main content */}
      <main id="main-content" tabIndex={-1} className="app-main">
        <Outlet />
      </main>

      <TabBar />
      </div>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} onLogout={handleLogout} />
      <Toast />
      {celebration && (
        <CelebrationOverlay
          badgeName={celebration.name}
          onClose={() => setCelebration(null)}
        />
      )}
    </div>
    </LiveDataContext.Provider>
  )
}
