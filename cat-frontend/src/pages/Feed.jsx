import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import FeedItem from '../components/FeedItem'
import PageHeader from '../components/PageHeader'
import { getSightings } from '../api'
import { PawPrint, Cat } from 'lucide-react'

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
      <PageHeader title="偶遇动态" subtitle="校园猫咪时间线" />

      <div className="p-3 space-y-2">
        {loading ? (
          <div className="card p-8 text-center text-gray-400">
            <PawPrint className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            加载动态中…
          </div>
        ) : sightings.length > 0 ? (
          sightings.map((sighting) => <FeedItem key={sighting.id} sighting={sighting} />)
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <Cat className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium text-gray-700">还没有偶遇记录</p>
            <Link to="/scan" className="inline-block mt-3 btn btn-primary">
              去拍第一张
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
