import { useState } from 'react'
import { pollVote } from '../api'
import { toast } from './Toast'

export default function PollView({ post }) {
  const [pollData, setPollData] = useState(post.pollData || [])
  const [voting, setVoting] = useState(false)
  const total = pollData.reduce((a, b) => a + b, 0)
  async function handleVote(idx) {
    if (voting) return
    setVoting(true)
    try {
      const res = await pollVote(post.id, idx)
      setPollData(res.pollData || [])
    } catch (e) {
      toast(e.message || '投票失败', { emoji: '⚠️' })
    } finally {
      setVoting(false)
    }
  }
  return (
    <div className="space-y-2 mt-2">
      {post.pollOptions?.map((opt, i) => {
        const count = pollData[i] || 0
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        return (
          <button
            key={i}
            onClick={() => handleVote(i)}
            disabled={voting}
            className="w-full text-left relative overflow-hidden rounded-lg border border-border px-3 py-2 active:bg-surface-3"
          >
            <div className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${pct}%` }} />
            <div className="relative flex items-center justify-between text-sm">
              <span className="text-text">{opt}</span>
              <span className="text-text-secondary text-xs">{count} 票 · {pct}%</span>
            </div>
          </button>
        )
      })}
      <p className="text-xs text-text-muted">共 {total} 票，点击选项投票</p>
    </div>
  )
}
