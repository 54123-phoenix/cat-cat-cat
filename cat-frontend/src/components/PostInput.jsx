import { useState } from 'react'
import { createPost } from '../api'
import CatPicker from './CatPicker'

const TOPICS = [
  { id: 'find', label: '🔍 寻猫问猫' },
  { id: 'daily', label: '💬 铲屎日常' },
  { id: 'health', label: '🏥 健康互助' },
  { id: 'suggest', label: '💡 建议反馈' },
]

const PRESET_TAGS = [
  '#橘总', '#小黑', '#奶糖', '#花花',
  '#图书馆', '#南区食堂', '#文科楼', '#东区草坪',
  '#求助', '#治愈瞬间', '#今日份猫猫', '#喂食',
]

export default function PostInput({ defaultTopic, onClose, onCreated }) {
  const [content, setContent] = useState('')
  const [topic, setTopic] = useState(defaultTopic)
  const [tags, setTags] = useState([])
  const [customTag, setCustomTag] = useState('')
  const [relatedCat, setRelatedCat] = useState(null)
  const [submitting, setSubmitting] = useState(false)

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

  async function handleSubmit() {
    if (!content.trim()) return
    setSubmitting(true)
    try {
      await createPost({
        content: content.trim(),
        topic,
        tags,
        relatedCatId: relatedCat?.id,
        relatedCat: relatedCat ? { id: relatedCat.id, name: relatedCat.name, emoji: '🐱' } : null,
      })
      onCreated?.()
      onClose()
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
                  topic === item.id ? 'bg-cat-orange text-white border-cat-orange' : 'bg-white text-gray-500 border-gray-200'
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
          className="w-full h-28 text-sm text-gray-800 placeholder-gray-300 border border-gray-100 rounded-xl p-3 outline-none resize-none focus:border-cat-orange transition-colors"
          maxLength={500}
        />
        <div className="text-right text-xs text-gray-300 -mt-2">{content.length}/500</div>

        <div>
          <div className="text-xs text-gray-400 mb-2">关联猫猫（可选）</div>
          <CatPicker selected={relatedCat} onChange={setRelatedCat} />
        </div>

        <div>
          <div className="text-xs text-gray-400 mb-2">添加标签</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PRESET_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                  tags.includes(tag) ? 'bg-cat-orange-lt text-orange-800 border-cat-orange-lt' : 'bg-white text-gray-400 border-gray-200'
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
              className="flex-1 text-xs border border-gray-200 rounded-full px-3 py-1.5 outline-none focus:border-cat-orange"
            />
            <button onClick={addCustomTag} className="text-xs text-cat-orange px-3">添加</button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((tag) => (
                <span key={tag} onClick={() => toggleTag(tag)} className="bg-cat-orange-lt text-orange-800 text-[11px] px-2.5 py-1 rounded-full cursor-pointer">
                  {tag} ×
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!content.trim() || submitting}
          className="w-full bg-cat-orange text-white rounded-full py-3 font-medium text-sm disabled:opacity-40 active:opacity-90"
        >
          {submitting ? '发布中…' : '发布 🐾'}
        </button>
      </div>
    </div>
  )
}
