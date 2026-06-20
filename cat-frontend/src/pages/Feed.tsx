import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FeedItem from '../components/FeedItem'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { getSightings } from '../api'
import { PawPrint, Cat } from 'lucide-react'

export default function Feed() {
  const [sightings, setSightings] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getSightings({ limit: 30 })
      .then((data) => setSightings(Array.isArray(data) ? data : []))
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
          <EmptyState
            icon={Cat}
            title="还没有偶遇记录"
            description="去拍照识别页发现校园里的猫猫吧"
            action={{ label: '去拍第一张', onClick: () => navigate('/scan') }}
          />
        )}
      </div>
    </div>
  )
}
