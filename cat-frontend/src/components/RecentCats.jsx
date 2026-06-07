import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCats } from '../api'
import CatCard from './CatCard'

export default function RecentCats() {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getCats()
      .then((data) => setCats(Array.isArray(data) ? data.slice(0, 4) : []))
      .catch(() => setCats([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null
  if (cats.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-text">最近猫猫</h2>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-primary font-medium"
        >
          查看全部
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cats.map((cat) => (
          <div key={cat.id} onClick={() => navigate(`/cats/${cat.id}`)}>
            <CatCard cat={cat} />
          </div>
        ))}
      </div>
    </section>
  )
}
