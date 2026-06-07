import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Map from './pages/Map'
import Profile from './pages/Profile'
import Community from './pages/Community'
import Login from './pages/Login'
import Admin from './pages/Admin'
import BadgeGallery from './pages/BadgeGallery'
import CatDetail from './pages/CatDetail'
import Feed from './pages/Feed'
import Scan from './pages/Scan'
import Gallery from './pages/Gallery'
import Notifications from './pages/Notifications'
import WeeklyReport from './pages/WeeklyReport'
import { getToken, getStoredUser } from './api'

function ProtectedRoute({ children }) {
  const token = getToken()
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [user, setUser] = useState(getStoredUser)

  const handleLogin = (u) => {
    setUser(u)
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<Map />} />
          <Route path="/community" element={<Community />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/cats/:catId" element={<CatDetail />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/gallery" element={<Gallery />} />
        </Route>
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/badges"
          element={
            <ProtectedRoute>
              <BadgeGallery />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/weekly-report"
          element={
            <ProtectedRoute>
              <WeeklyReport />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
