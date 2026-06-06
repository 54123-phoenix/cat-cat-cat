import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Sparkles } from 'lucide-react'
import CameraButton from '../components/CameraButton'
import RecognizeModal from '../components/RecognizeModal'
import RecentCats from '../components/RecentCats'
import { recognize, createSighting } from '../api'

export default function Home() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleCapture = useCallback(async (file) => {
    setLoading(true)
    setError(null)

    try {
      const res = await recognize(file)
      setResult(res)

      // Save sighting in background
      try {
        await createSighting({
          catId: res.cat_id,
          confidence: res.confidence,
          file,
        })
      } catch (sightErr) {
        console.warn('Failed to save sighting:', sightErr)
      }
    } catch (err) {
      setError(err.message || '识别失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleClose = useCallback(() => {
    setResult(null)
  }, [])

  const handleViewProfile = useCallback(() => {
    navigate('/profile')
  }, [navigate])

  return (
    <div className="space-y-6">
      {/* Recent cats section */}
      <RecentCats />

      {/* Camera section */}
      <div className="flex flex-col items-center space-y-4">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-text">拍照识猫</h2>
          </div>
          <p className="text-text-secondary text-sm">
            拍一张校园猫咪，AI 帮你识别
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-[180px] h-[180px] rounded-full bg-primary-light flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-text-secondary font-medium">正在识别...</p>
          </div>
        ) : (
          <CameraButton onCapture={handleCapture} />
        )}

        {error && (
          <p className="text-red-500 font-medium text-sm bg-red-50 px-4 py-2 rounded-xl">
            {error}
          </p>
        )}
      </div>

      {/* Recognize modal */}
      {result && (
        <RecognizeModal
          result={result}
          onClose={handleClose}
          onViewProfile={handleViewProfile}
        />
      )}
    </div>
  )
}
