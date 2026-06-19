import { useState, useRef, useEffect } from 'react'
import { createPost } from '../api'
import CatPicker from './CatPicker'
import { Plus, X, Image as ImageIcon } from 'lucide-react'

const TOPICS = [
  { id: 'find', label: '寻猫问猫' },
  { id: 'daily', label: '铲屎日常' },
  { id: 'health', label: '健康互助' },
  { id: 'suggest', label: '建议反馈' },
]

const PRESET_TAGS = [
  '#橘总', '#小黑', '#奶糖', '#花花',
  '#图书馆', '#南区食堂', '#文科楼', '#东区草坪',
  '#求助', '#治愈瞬间', '#今日份猫猫', '#喂食',
]

const MAX_IMAGES = 9

export default function PostInput({ defaultTopic, onClose, onCreated }) {
  const [content, setContent] = useState('')
  const [topic, setTopic] = useState(defaultTopic)
  const [tags, setTags] = useState([])
  const [customTag, setCustomTag] = useState('')
  const [relatedCat, setRelatedCat] = useState(null)
  const [images, setImages] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef(null)
  const urlRefs = useRef([])

  useEffect(() => {
    return () => {
      urlRefs.current.forEach((url) => URL.revokeObjectURL(url))
      urlRefs.current = []
    }
  }, [])

  function toggleTag(tag) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]))
  }

  function addCustomTag() {
    const normalized = customTag.trim().replace(/^#*/, '#')
    if (normalized.length > 1 && !tags.includes(normalized)) {
      setTags((prev) => [...prev, normalized])
    }
    setCustomTag('')
  }

  function addFiles(fileList) {
    const newFiles = Array.from(fileList).slice(0, MAX_IMAGES - images.length)
    const newUrls = newFiles.map((f) => URL.createObjectURL(f))
    urlRefs.current.push(...newUrls)
    setImages((prev) => [...prev, ...newFiles])
  }

  function removeImage(index) {
    if (urlRefs.current[index]) {
      URL.revokeObjectURL(urlRefs.current[index])
      urlRefs.current.splice(index, 1)
    }
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (!content.trim()) return
    setSubmitting(true)
    try {
      const form = new FormData()
      form.append('content', content.trim())
      form.append('topic', topic)
      form.append('tags', JSON.stringify(tags))
      if (relatedCat?.id) form.append('relatedCatId', relatedCat.id)
      images.forEach((img) => form.append('files', img))

      await createPost(form)
      onCreated?.()
      onClose()
    } catch (err) {
      alert(err.message || '发布失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-t-2xl p-4 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-800">发帖</span>
          <button onClick={onClose} className="text-gray-400 text-xl">×</button>
        </div>

        <div>
          <div className="text-xs text-gray-400 mb-2">选择话题</div>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((item) => (
              <button
                key={item.id}
                onClick={() => setTopic(item.id)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  topic === item.id ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="说点什么… 比如「今天在图书馆又看到橘总了，状态很好！」"
          className="w-full h-28 text-sm text-gray-800 placeholder-gray-300 border border-gray-100 rounded-xl p-3 outline-none resize-none focus:border-primary transition-colors"
          maxLength={500}
        />
        <div className="text-right text-xs text-gray-300 -mt-2">{content.length}/500</div>

        {/* Image upload */}
        <div>
          <div className="text-xs text-gray-400 mb-2">图片（最多 {MAX_IMAGES} 张）</div>
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                <img src={urlRefs.current[i] || ''} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="text-xs mt-0.5">{images.length}/{MAX_IMAGES}</span>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
          />
        </div>

        <div>
          <div className="text-xs text-gray-400 mb-2">关联猫猫（可选）</div>
          <CatPicker selected={relatedCat} onChange={setRelatedCat} />
        </div>

        <div>
          <div className="text-xs text-gray-400 mb-2">添加标签</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESET_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  tags.includes(tag) ? 'bg-primary-light text-orange-800 border-primary-light' : 'bg-white text-gray-400 border-gray-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={customTag}
              onChange={(event) => setCustomTag(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addCustomTag()}
              placeholder="自定义标签…"
              className="flex-1 text-xs border border-gray-200 rounded-full px-3 py-1.5 outline-none focus:border-primary"
            />
            <button onClick={addCustomTag} className="text-xs text-primary px-3">添加</button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((tag) => (
                <span key={tag} onClick={() => toggleTag(tag)} className="bg-primary-light text-orange-800 text-xs px-2.5 py-1 rounded-full cursor-pointer">
                  {tag} ×
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!content.trim() || submitting}
          className="w-full bg-primary text-white rounded-full py-3 font-medium text-sm disabled:opacity-40 active:opacity-90"
        >
          {submitting ? '发布中…' : '发布'}
        </button>
      </div>
    </div>
  )
}
