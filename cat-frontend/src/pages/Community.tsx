import { useEffect, useRef, useState } from 'react'
import PostInput from '../components/PostInput'
import PostList from '../components/PostList'
import { reportPost } from '../api'
import { Pencil, X } from 'lucide-react'
import { TOPICS as TABS, TAG_TOPIC_MAP } from '../constants/topics'
import { toast } from '../components/Toast'

export default function Community() {
  const [activeTab, setActiveTab] = useState('all')
  const [showCompose, setShowCompose] = useState(false)
  const [composeMounted, setComposeMounted] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [reportTarget, setReportTarget] = useState(null)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reportError, setReportError] = useState('')
  const reportLock = useRef(false)
  const reportDialog = useRef<HTMLDialogElement>(null)
  const reasonRef = useRef<HTMLTextAreaElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const dialog = reportDialog.current
    if (!dialog || !reportTarget) return undefined
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    reasonRef.current?.focus()
    return () => { dialog.close(); document.body.style.overflow = previousOverflow }
  }, [reportTarget])
  useEffect(() => { if (reportError) errorRef.current?.focus() }, [reportError])

  function closeReport() {
    if (reportLock.current) return
    setReportTarget(null); setReportReason(''); setReportError('')
  }

  async function handleReport(event: React.FormEvent) {
    event.preventDefault()
    if (reportLock.current || !reportTarget || !reportReason.trim()) return
    reportLock.current = true
    setReporting(true); setReportError('')
    try {
      await reportPost(reportTarget.id, { reason: reportReason.trim() })
      setReportTarget(null); setReportReason('')
      toast('举报已提交，等待管理员处理')
    } catch (error) {
      setReportError((error.message || '举报提交失败') + '。原因已保留，请重试。')
    } finally {
      reportLock.current = false
      setReporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="ui-title">和猫友分享校园日常</h2><p className="ui-meta mt-2">记录猫猫近况，交流照护经验，也可以在这里寻求帮助。</p></div>
        <button type="button" onClick={() => { setComposeMounted(true); setShowCompose(true) }} className="btn btn-primary"><Pencil size={18} aria-hidden="true" />发布帖子</button>
      </section>
      <div className="flex gap-2 overflow-x-auto pb-2" role="group" aria-label="按话题筛选">
        {TABS.map(tab => <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} aria-pressed={activeTab === tab.id} className={'min-h-11 shrink-0 rounded-full border px-4 py-2 text-sm font-medium ' + (activeTab === tab.id ? 'border-primary bg-primary-light text-primary' : 'border-border bg-surface-1 text-text-secondary')}>{tab.label}</button>)}
      </div>
      <PostList topic={activeTab} refreshKey={refreshKey} onReport={post => { setReportTarget(post); setReportReason(''); setReportError('') }} onTagClick={tag => { const next = TAG_TOPIC_MAP[tag]; if (next) setActiveTab(next) }} />
      {composeMounted && <PostInput defaultTopic={activeTab === 'all' ? 'daily' : activeTab} isOpen={showCompose} onClose={() => setShowCompose(false)} onCreated={() => setRefreshKey(value => value + 1)} />}
      <dialog ref={reportDialog} aria-labelledby="report-title" aria-describedby="report-help" className="!m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-24px)] max-w-md overflow-y-auto rounded-2xl border border-border bg-surface-1 p-5 text-text backdrop:bg-black/50"
        onCancel={event => { event.preventDefault(); closeReport() }}
        onKeyDown={event => {
          if (event.key !== 'Tab') return
          const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('*')].filter(node => node.matches('button, textarea') && !node.matches(':disabled') && node.getClientRects().length > 0)
          const first = controls[0], last = controls[controls.length - 1]
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }}>
        <form onSubmit={handleReport} className="space-y-4" aria-busy={reporting}>
          <header className="flex items-center justify-between gap-3"><h2 id="report-title" className="text-xl font-bold">举报帖子</h2><button type="button" onClick={closeReport} disabled={reporting} className="icon-button" aria-label="关闭举报"><X size={20} /></button></header>
          <p id="report-help" className="text-sm leading-6 text-text-secondary">请说明需要管理员关注的问题。举报原因不会公开展示。</p>
          <div><label htmlFor="report-reason" className="mb-2 block text-sm font-semibold">举报原因</label><textarea id="report-reason" ref={reasonRef} value={reportReason} onChange={event => setReportReason(event.target.value)} disabled={reporting} placeholder="例如：内容存在不实信息或可能伤害猫猫…" className="min-h-28 w-full resize-y rounded-xl border border-border bg-surface-1 p-3 text-base" maxLength={200} aria-describedby="report-count" /><p id="report-count" className="mt-1 text-right text-sm text-text-secondary">{reportReason.length}/200 字</p></div>
          {reportError && <p ref={errorRef} role="alert" tabIndex={-1} className="rounded-xl bg-danger/5 p-3 text-sm leading-6 text-danger">{reportError}</p>}
          <footer className="flex flex-wrap justify-end gap-2"><button type="button" onClick={closeReport} disabled={reporting} className="btn btn-ghost">取消</button><button type="submit" disabled={!reportReason.trim() || reporting} className="btn btn-danger">{reporting ? '提交中…' : '提交举报'}</button></footer>
        </form>
      </dialog>
    </div>
  )
}
