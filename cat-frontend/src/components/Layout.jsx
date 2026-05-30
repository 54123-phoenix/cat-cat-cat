import { Outlet } from 'react-router-dom'
import TabBar from './TabBar'

export default function Layout() {
  return (
    <div className="min-h-screen max-w-[480px] mx-auto bg-gray-50 pb-16 relative overflow-hidden">
      <main>
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}
