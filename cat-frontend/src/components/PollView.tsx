import { useEffect, useRef, useState } from 'react'
import { pollVote } from '../api'
import { toast } from './Toast'

export default function PollView({ post }) {
  const [pollData, setPollData] = useState(post.pollData || [])
  useEffect(() => { setPollData(post.pollData || []) }, [post.pollData])
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState('')
  const votingRef = useRef(false)
  const total = pollData.reduce((a, b) => a + b, 0)
  async function handleVote(idx) {
    if (votingRef.current) return
    votingRef.current = true
    setVoting(true)
    setError('')
    try {
      const res = await pollVote(post.id, idx)
      setPollData(res.pollData || [])
    } catch (e) {
      setError((e.message || '投票失败') + '，请重试。')
      toast(e.message || '投票失败', { emoji: '⚠️' })
    } finally {
      votingRef.current = false
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
            type="button"
            key={i}
            onClick={() => handleVote(i)}
            disabled={voting}
            className="min-h-11 w-full text-left relative overflow-hidden rounded-xl border border-border px-3 py-2 active:bg-surface-3"
          >
            <div aria-hidden="true" className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${pct}%` }} />
            <div className="relative flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 text-text [overflow-wrap:anywhere]">{opt}</span>
              <span className="shrink-0 text-text-secondary">{count} 票 · {pct}%</span>
            </div>
          </button>
        )
      })}
      <p className="text-sm text-text-secondary">共 {total} 票，点击选项投票</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  )
}
