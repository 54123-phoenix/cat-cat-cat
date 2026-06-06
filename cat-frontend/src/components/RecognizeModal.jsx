import { X, Eye, Camera } from 'lucide-react'

export default function RecognizeModal({ result, onClose, onViewProfile }) {
  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm p-8 text-center space-y-6 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-16 h-16 mx-auto rounded-full bg-primary-light flex items-center justify-center">
          <Eye className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-text">
            发现 {result.name}！
          </h2>
          <p className="text-text-secondary">
            匹配度：{(result.confidence * 100).toFixed(0)}%
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onViewProfile}
            className="btn-primary w-full"
          >
            查看档案
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl border border-border font-semibold text-text-secondary bg-white hover:bg-gray-50 transition-colors"
          >
            继续拍照
          </button>
        </div>
      </div>
    </div>
  )
}
