import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import TabBar from './TabBar'
import Sidebar from './Sidebar'
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
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
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

  return (
    <div className="min-h-screen max-w-[480px] mx-auto bg-page-warm pb-16">
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
        <div key={location.pathname} className="tab-slide-in">
          <Outlet />
        </div>
      </main>

      <TabBar />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} onLogout={handleLogout} />
    </div>
  )
}
