import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import PhotoViewer from '../components/PhotoViewer'
import { Cat, PawPrint, Image as ImageIcon } from 'lucide-react'
import { getGalleryImages } from '../api'
import { campusLocations } from '../campusLocations'

const COLOR_CHIPS = ['全部', '橘', '黑', '白', '狸花', '三花']

function catColor(cat) {
  const name = (cat?.name || '') + (cat?.color || '') + (cat?.description || '')
  if (name.includes('橘') || name.includes('橙') || name.includes('黄')) return '橘'
  if (name.includes('黑')) return '黑'
  if (name.includes('白')) return '白'
  if (name.includes('狸') || name.includes('虎')) return '狸花'
  if (name.includes('三花') || name.includes('玳瑁')) return '三花'
  return ''
}

export default function Gallery() {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewerIndex, setViewerIndex] = useState(null)
  const [colorFilter, setColorFilter] = useState('全部')
  const [locFilter, setLocFilter] = useState('全部')

  useEffect(() => {
    getGalleryImages({ limit: 80 })
      .then(setImages)
      .catch((err) => setError(err.message || '照片墙加载失败'))
      .finally(() => setLoading(false))
  }, [])

  const locChips = useMemo(() => {
    const set = new Set(['全部'])
    images.forEach((img) => { if (img.cat?.location) set.add(img.cat.location) })
    campusLocations.forEach((l) => set.add(l.name))
    return Array.from(set)
  }, [images])

  const filtered = useMemo(() => {
    return images.filter((img) => {
      if (colorFilter !== '全部' && catColor(img.cat) !== colorFilter) return false
      if (locFilter !== '全部' && (img.cat?.location || '') !== locFilter) return false
      return true
    })
  }, [images, colorFilter, locFilter])

  const openViewer = (i) => setViewerIndex(i)

  return (
    <div className="pb-6">
      <PageHeader
        title="猫猫照片墙"
        subtitle="猫协上传的参考照片会汇聚在这里"
        action={(
          <Link to="/admin" className="bg-primary/10 rounded-full px-3 py-1.5 text-xs font-medium text-primary">
            上传
          </Link>
        )}
      />

      <div className="p-3">
        {/* Filter chips */}
        <div className="space-y-2 mb-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {COLOR_CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => setColorFilter(c)}
                aria-pressed={colorFilter === c}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${colorFilter === c ? 'bg-primary text-white' : 'bg-white text-text-secondary border border-border'}`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {locChips.map((l) => (
              <button
                key={l}
                onClick={() => setLocFilter(l)}
                aria-pressed={locFilter === l}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${locFilter === l ? 'bg-primary text-white' : 'bg-white text-text-secondary border border-border'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="columns-2 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="mb-2 break-inside-avoid aspect-square rounded-xl skeleton" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center text-sm text-red-500">
            {error}
          </div>
        ) : filtered.length > 0 ? (
          <div className="columns-2 gap-2 min-[480px]:columns-3">
            {filtered.map((image, i) => (
              <button
                key={image.id}
                onClick={() => openViewer(i)}
                className="mb-2 break-inside-avoid w-full bg-white ring-1 ring-stone-900/5 shadow-e1 rounded-card overflow-hidden active:scale-95 transition-transform text-left animate-pop-in"
              >
                <div className="bg-primary-light overflow-hidden flex items-center justify-center relative">
                  <img
                    src={image.image_path}
                    alt={image.cat?.name || '猫猫照片'}
                    loading="lazy"
                    className="w-full h-auto object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                      const sib = event.currentTarget.nextElementSibling
                      if (sib) sib.style.display = 'flex'
                    }}
                    onLoad={(event) => {
                      const sib = event.currentTarget.nextElementSibling
                      if (sib) sib.style.display = 'none'
                    }}
                  />
                  <Cat className="w-8 h-8 text-primary/30 absolute inset-0 m-auto" style={{ display: 'none' }} />
                </div>
                <div className="p-2">
                  <p className="text-sm font-medium text-gray-800 truncate">{image.cat?.name || '校园猫猫'}</p>
                  <p className="text-xs text-gray-400 truncate">{image.cat?.location || '参考照片'}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            mood="curious"
            title="没有匹配的照片"
            description="换个筛选条件，或去上传一些校园猫猫的照片吧"
            action={{ label: '去上传照片', onClick: () => (window.location.href = '/admin') }}
          />
        )}
      </div>

      {viewerIndex !== null && (
        <PhotoViewer
          images={filtered.map((img) => ({ url: img.image_path, alt: img.cat?.name || '猫猫照片' }))}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  )
}
