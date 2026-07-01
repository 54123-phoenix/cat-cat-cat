import { useSyncExternalStore, Suspense, lazy, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import Login from './pages/Login'
import MascotCat from './components/MascotCat'
import DailyCapsuleModal from './components/DailyCapsuleModal'
import { getToken, getStoredUser, getAdminToken } from './api'
import { ROUTES } from './constants/routes'
import { toast } from './components/Toast'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
    mutations: {
      onError: (error: Error) => {
        toast(error.message || '操作失败', { emoji: '⚠️' })
      },
    },
  },
})

const Home = lazy(() => import('./pages/Home'))
const Map = lazy(() => import('./pages/Map'))
const Profile = lazy(() => import('./pages/Profile'))
const Community = lazy(() => import('./pages/Community'))
const Admin = lazy(() => import('./pages/Admin'))
const BadgeGallery = lazy(() => import('./pages/BadgeGallery'))
const CatDetail = lazy(() => import('./pages/CatDetail'))
const PublicCat = lazy(() => import('./pages/PublicCat'))
const SightingShare = lazy(() => import('./pages/SightingShare'))
const PostDetail = lazy(() => import('./pages/PostDetail'))
const Feed = lazy(() => import('./pages/Feed'))
const Scan = lazy(() => import('./pages/Scan'))
const Gallery = lazy(() => import('./pages/Gallery'))
const Notifications = lazy(() => import('./pages/Notifications'))
const WeeklyReport = lazy(() => import('./pages/WeeklyReport'))
const Collection = lazy(() => import('./pages/Collection'))
const League = lazy(() => import('./pages/League'))
const Wrapped = lazy(() => import('./pages/Wrapped'))
const CatRoutes = lazy(() => import('./pages/CatRoutes'))

function FullScreenLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-warm-50">
      <div className="flex flex-col items-center gap-3">
        <MascotCat mood="curious" size={72} />
        <p className="text-sm text-text-muted">猫猫加载中…</p>
      </div>
    </div>
  )
}

// Shared user store: single source of truth for auth state
let currentUser = getStoredUser()
const listeners = new Set<(user: any) => void>()

function emitChange() {
  listeners.forEach((fn) => fn(currentUser))
}

export function useUserStore() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    () => currentUser
  )
}

export function updateUser(newUser: any) {
  currentUser = newUser
  emitChange()
}

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const token = adminOnly ? getAdminToken() : getToken()
  const [showCapsule, setShowCapsule] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!adminOnly && token && location.pathname === ROUTES.HOME) {
      const t = setTimeout(() => setShowCapsule(true), 800)
      return () => clearTimeout(t)
    }
    setShowCapsule(false)
  }, [adminOnly, token, location.pathname])

  if (!token) return <Navigate to={adminOnly ? "/admin" : "/login"} replace />
  return (
    <>
      {children}
      {showCapsule && (
        <DailyCapsuleModal
          onClose={() => setShowCapsule(false)}
          onViewCat={(catId) => navigate(ROUTES.CAT_DETAIL.replace(':catId', String(catId)))}
        />
      )}
    </>
  )
}

export default function App() {
  const handleLogin = (u: any) => {
    updateUser(u)
  }

  return (
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<Login onLogin={handleLogin} />} />
          <Route path={ROUTES.PUBLIC_CAT} element={<PublicCat />} />
          <Route path={ROUTES.SIGHTING_SHARE} element={<SightingShare />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path={ROUTES.HOME} element={<Home />} />
            <Route path={ROUTES.MAP} element={<Map />} />
            <Route path={ROUTES.COMMUNITY} element={<Community />} />
            <Route path={ROUTES.PROFILE} element={<Profile />} />
            <Route path={ROUTES.CAT_DETAIL} element={<CatDetail />} />
            <Route path={ROUTES.POST_DETAIL} element={<PostDetail />} />
            <Route path={ROUTES.FEED} element={<Feed />} />
            <Route path={ROUTES.SCAN} element={<Scan />} />
            <Route path={ROUTES.GALLERY} element={<Gallery />} />
            <Route path={ROUTES.COLLECTION} element={<Collection />} />
            <Route path={ROUTES.LEAGUE} element={<League />} />
            <Route path={ROUTES.WRAPPED} element={<Wrapped />} />
            <Route path={ROUTES.ROUTES_PAGE} element={<CatRoutes />} />
            <Route path={ROUTES.BADGES} element={<BadgeGallery />} />
            <Route path={ROUTES.NOTIFICATIONS} element={<Notifications />} />
            <Route path={ROUTES.WEEKLY_REPORT} element={<WeeklyReport />} />
          </Route>
          <Route
            path={ROUTES.ADMIN}
            element={
              <ProtectedRoute adminOnly>
                <Admin />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
    </QueryClientProvider>
  )
}
