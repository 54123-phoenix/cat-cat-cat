import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Feed from './pages/Feed'
import Scan from './pages/Scan'
import Community from './pages/Community'
import Map from './pages/Map'
import Profile from './pages/Profile'
import CatDetail from './pages/CatDetail'
import Admin from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/community" element={<Community />} />
          <Route path="/map" element={<Map />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/cats/:catId" element={<CatDetail />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
