import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import TabBar from './TabBar'
import Sidebar from './Sidebar'
import { getUserProfile, getToken, clearToken, setToken } from '../api'
import { useUserStore, updateUser } from '../App'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const user = useUserStore()
  const navigate = useNavigate()

  useEffect(() => {
    const token = getToken()
    if (!token) {
      navigate('/login')
      return
    }
    getUserProfile()
      .then((u) => {
        updateUser(u)
        setToken(token, u)
      })
      .catch(() => {
        clearToken()
        navigate('/login')
      })
  }, [])

  const handleLogout = () => {
    clearToken()
    updateUser(null)
    navigate('/login')
  }

  return (
    <div className="min-h-screen max-w-[480px] mx-auto bg-warm-50 pb-16">
      {/* Top bar with avatar */}
      <header className="sticky top-0 z-40 bg-warm-50/80 backdrop-blur-md px-4 py-3 flex items-center justify-between">
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
        
        <h1 className="text-lg font-bold text-text">猫猫社区</h1>
        
        <div className="w-9" /> {/* Spacer for centering */}
      </header>

      {/* Main content */}
      <main className="px-4 pt-2 pb-4">
        <Outlet />
      </main>

      {/* Bottom tab bar */}
      <TabBar />

      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        user={user}
        onLogout={handleLogout}
      />
    </div>
  )
}
