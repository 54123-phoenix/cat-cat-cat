import { useState } from 'react'
import PostInput from '../components/PostInput'
import PostList from '../components/PostList'
import { reportPost } from '../api'
import { Pencil } from 'lucide-react'
import { TOPICS as TABS, TAG_TOPIC_MAP } from '../constants/topics'

export default function Community() {
  const [activeTab, setActiveTab] = useState('all')
  const [showCompose, setShowCompose] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [reportTarget, setReportTarget] = useState(null)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)

  function handleTagClick(tag) {
    const topic = TAG_TOPIC_MAP[tag]
    if (topic) setActiveTab(topic)
  }

  async function handleReport() {
    if (!reportReason.trim()) return
    setReporting(true)
    try {
      await reportPost(reportTarget.id, { reason: reportReason.trim() })
      setReportTarget(null)
      setReportReason('')
      setRefreshKey((v) => v + 1)
    } catch (e) {
      alert(e.message)
    } finally {
      setReporting(false)
    }
  }

  return (
    <div className="flex flex-col h-full pb-6">
      <div className="bg-primary px-4 pt-4 pb-3 text-white rounded-b-2xl">
        <h1 className="text-lg font-bold">社区</h1>
        <p className="text-xs opacity-80 mt-0.5">和其他铲屎官一起聊聊</p>
      </div>

      <div className="flex overflow-x-auto scrollbar-none bg-white border-b border-gray-100 px-2 sticky top-0 z-20">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-3 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-gray-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        <PostList topic={activeTab} refreshKey={refreshKey} onReport={setReportTarget} onTagClick={handleTagClick} />
      </div>

      <button
        onClick={() => setShowCompose(true)}
        className="fixed bottom-20 right-4 w-12 h-12 bg-primary rounded-full text-white text-2xl shadow-lg shadow-orange-200 flex items-center justify-center active:scale-95 transition-transform z-40"
      >
        <Pencil className="w-5 h-5" />
      </button>

      {showCompose && (
        <PostInput
          defaultTopic={activeTab === 'all' ? 'daily' : activeTab}
          onClose={() => setShowCompose(false)}
          onCreated={() => setRefreshKey((value) => value + 1)}
        />
      )}

      {/* Report dialog */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl p-5 w-80 space-y-4">
            <h3 className="font-medium text-gray-800">举报帖子</h3>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="请说明举报原因…"
              className="w-full h-24 text-sm border border-gray-200 rounded-xl p-3 outline-none resize-none"
              maxLength={200}
            />
            <div className="flex gap-2">
              <button onClick={() => { setReportTarget(null); setReportReason('') }} className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm text-gray-500">
                取消
              </button>
              <button onClick={handleReport} disabled={!reportReason.trim() || reporting} className="flex-1 py-2.5 rounded-full bg-red-500 text-white text-sm disabled:opacity-40">
                {reporting ? '提交中…' : '提交举报'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
