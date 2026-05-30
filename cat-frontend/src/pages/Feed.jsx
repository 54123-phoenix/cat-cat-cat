import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import FeedItem from '../components/FeedItem'
import TopBar from '../components/TopBar'
import { getSightings } from '../api'

export default function Feed() {
  const [sightings, setSightings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSightings({ limit: 30 })
      .then(setSightings)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="pb-6">
      <TopBar title="偶遇动态" subtitle="复旦校园猫咪时间线" />

      <div className="p-3 space-y-2">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
            <div className="text-3xl animate-paw mb-2">🐾</div>
            加载动态中…
          </div>
        ) : sightings.length > 0 ? (
          sightings.map((sighting) => <FeedItem key={sighting.id} sighting={sighting} />)
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <div className="text-4xl mb-2">🐱</div>
            <p className="text-sm font-medium text-gray-700">还没有偶遇记录</p>
            <Link to="/scan" className="inline-block mt-3 bg-cat-orange text-white rounded-full px-5 py-2 text-sm font-medium">
              去拍第一张
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
