import { useState } from 'react'
import PostInput from '../components/PostInput'
import PostList from '../components/PostList'

const TABS = [
  { id: 'all', label: '广场' },
  { id: 'find', label: '🔍 寻猫' },
  { id: 'daily', label: '💬 日常' },
  { id: 'health', label: '🏥 健康' },
  { id: 'suggest', label: '💡 建议' },
]

export default function Community() {
  const [activeTab, setActiveTab] = useState('all')
  const [showCompose, setShowCompose] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="flex flex-col h-full pb-6">
      <div className="bg-cat-orange px-4 pt-4 pb-3 text-white rounded-b-[24px] shadow-lg shadow-orange-100">
        <h1 className="text-lg font-medium">社区</h1>
        <p className="text-xs opacity-80 mt-0.5">和其他铲屎官一起聊聊</p>
      </div>

      <div className="flex overflow-x-auto scrollbar-none bg-white border-b border-gray-100 px-2 sticky top-0 z-20">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-3 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id ? 'border-cat-orange text-cat-orange' : 'border-transparent text-gray-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        <PostList topic={activeTab} refreshKey={refreshKey} />
      </div>

      <button
        onClick={() => setShowCompose(true)}
        className="fixed bottom-20 right-4 w-12 h-12 bg-cat-orange rounded-full text-white text-2xl shadow-lg shadow-orange-200 flex items-center justify-center active:scale-95 transition-transform z-40"
      >
        ✏️
      </button>

      {showCompose && (
        <PostInput
          defaultTopic={activeTab === 'all' ? 'daily' : activeTab}
          onClose={() => setShowCompose(false)}
          onCreated={() => setRefreshKey((value) => value + 1)}
        />
      )}
    </div>
  )
}
