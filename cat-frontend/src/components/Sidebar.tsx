import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { X, Bell, Award, Images, TrendingUp, Shield, LogOut, BookOpen, Trophy, Sparkles, Route as RouteIcon, Bot } from 'lucide-react'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  user: { nickname?: string; role?: string } | null
  onLogout: () => void
}

export default function Sidebar({ isOpen, onClose, user, onLogout }: SidebarProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !isOpen) return undefined
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  const navItems = [
    { label: '猫猫图鉴', icon: BookOpen, path: '/collection' },
    { label: '猫猫路线', icon: RouteIcon, path: '/routes' },
    { label: '通知中心', icon: Bell, path: '/notifications' },
    { label: '猫情报 Agent', icon: Bot, path: '/intel' },
    { label: '联赛', icon: Trophy, path: '/league' },
    { label: '勋章墙', icon: Award, path: '/badges' },
    { label: '猫猫图库', icon: Images, path: '/gallery' },
    { label: '周报', icon: TrendingUp, path: '/weekly-report' },
    { label: '年度报告', icon: Sparkles, path: '/wrapped' },
    ...(user?.role === 'admin' ? [{ label: '管理端', icon: Shield, path: '/admin' }] : []),
  ]

  return (
    <dialog id="site-menu" ref={dialogRef} className="menu-dialog" aria-labelledby="menu-title"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')].filter(node => node.getClientRects().length > 0)
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="menu-panel">
        <header className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 id="menu-title" className="truncate text-lg font-semibold text-text">{user?.nickname || '猫猫爱好者'}</h2>
            <p className="mt-1 text-sm text-text-secondary">{user?.role === 'admin' ? '管理员' : user?.role === 'reviewer' ? '猫协审核员' : '校园猫友'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭菜单" className="icon-button shrink-0"><X size={21} /></button>
        </header>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3" aria-label="更多功能">
          {navItems.map(({ label, icon: Icon, path }) => (
            <NavLink key={path} to={path} onClick={onClose} className={({ isActive }) => 'rail-link' + (isActive ? ' is-active' : '')}>
              <Icon size={20} aria-hidden="true" />{label}
            </NavLink>
          ))}
        </nav>
        <footer className="border-t border-border p-3">
          <button onClick={() => { onLogout(); onClose() }} className="btn btn-ghost w-full gap-3"><LogOut size={18} aria-hidden="true" />退出登录</button>
        </footer>
      </div>
    </dialog>
  )
}
