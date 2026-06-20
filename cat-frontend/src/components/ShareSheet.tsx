import { useState } from 'react'
import { X, Download, Link2, Share2 } from 'lucide-react'
import html2canvas from 'html2canvas'
import { toPng } from 'html-to-image'

interface ShareSheetProps {
  posterRef: React.RefObject<HTMLDivElement>
  onClose: () => void
}

export default function ShareSheet({ posterRef, onClose }: ShareSheetProps) {
  const [copied, setCopied] = useState(false)

  async function handleSave() {
    if (!posterRef.current) return
    try {
      const canvas = await html2canvas(posterRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      })
      const link = document.createElement('a')
      link.download = `猫猫社区_${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      try {
        const dataUrl = await toPng(posterRef.current, { pixelRatio: 2 })
        const link = document.createElement('a')
        link.download = `猫猫社区_${Date.now()}.png`
        link.href = dataUrl
        link.click()
      } catch {
        alert('保存失败，请截图分享')
      }
    }
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}${window.location.pathname}?utm_source=share&utm_campaign=cat_share`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('复制失败')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="分享">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-surface-0 rounded-t-3xl p-6 pb-8 animate-slide-up">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100" aria-label="关闭">
          <X className="w-5 h-5 text-text-secondary" />
        </button>
        <h3 className="text-lg font-bold text-text mb-4">分享给朋友</h3>
        <div className="flex gap-4 justify-center">
          <button onClick={handleSave} className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-primary-light transition-colors">
            <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center">
              <Download className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xs font-medium text-text">保存图片</span>
          </button>
          <button onClick={handleCopyLink} className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-primary-light transition-colors">
            <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center">
              <Link2 className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xs font-medium text-text">{copied ? '已复制' : '复制链接'}</span>
          </button>
          <button onClick={handleSave} className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-primary-light transition-colors">
            <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center">
              <Share2 className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xs font-medium text-text">更多</span>
          </button>
        </div>
      </div>
    </div>
  )
}
