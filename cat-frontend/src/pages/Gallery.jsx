import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { getGalleryImages } from '../api'

export default function Gallery() {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getGalleryImages({ limit: 80 })
      .then(setImages)
      .catch((err) => setError(err.message || '照片墙加载失败'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="pb-6">
      <TopBar
        title="猫猫照片墙"
        subtitle="猫协上传的参考照片会汇聚在这里"
        action={(
          <Link to="/admin" className="bg-white/20 rounded-full px-3 py-1.5 text-xs font-medium">
            上传
          </Link>
        )}
      />

      <div className="p-3">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
            <div className="text-3xl mb-2">🐾</div>
            加载照片中…
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center text-sm text-red-500">
            {error}
          </div>
        ) : images.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5">
            {images.map((image) => (
              <Link key={image.id} to={image.cat_id ? `/cats/${image.cat_id}` : '/gallery'} className="bg-white rounded-xl border border-gray-100 overflow-hidden active:scale-95 transition-transform">
                <div className="aspect-square bg-primary-light overflow-hidden flex items-center justify-center text-4xl">
                  <img
                    src={image.image_path}
                    alt={image.cat?.name || '猫猫照片'}
                    className="w-full h-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                    }}
                  />
                  <span>🐱</span>
                </div>
                <div className="p-2.5">
                  <p className="text-sm font-medium text-gray-800 truncate">{image.cat?.name || '校园猫猫'}</p>
                  <p className="text-[11px] text-gray-400 truncate">{image.cat?.location || '参考照片'}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <div className="text-4xl mb-2">🖼️</div>
            <p className="text-sm font-medium text-gray-700">还没有参考照片</p>
            <Link to="/admin" className="inline-block mt-3 bg-primary text-white rounded-full px-5 py-2 text-sm font-medium">
              去上传照片
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
