import { useState, useRef, useEffect, type FormEvent } from 'react'
import { createPost } from '../api'
import CatPicker from './CatPicker'
import { Plus, X } from 'lucide-react'
import { TOPIC_LABEL, PRESET_TAGS } from '../constants/topics'
import { toast } from './Toast'

const TOPICS = Object.entries(TOPIC_LABEL).map(([id, label]) => ({ id, label }))
const POST_TYPES = [{ id: 'discussion', label: '讨论' }, { id: 'poll', label: '投票' }, { id: 'question', label: '求助' }]
const MAX_IMAGES = 9
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
type Attachment = { file: File; url: string }

export default function PostInput({ defaultTopic = 'daily', isOpen = true, onClose, onCreated }) {
  const [content, setContent] = useState('')
  const [topic, setTopic] = useState(defaultTopic)
  const [tags, setTags] = useState<string[]>([])
  const [customTag, setCustomTag] = useState('')
  const [relatedCat, setRelatedCat] = useState(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [postType, setPostType] = useState('discussion')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const attachmentRef = useRef<Attachment[]>([])
  const submittingRef = useRef(false)
  const previousOpen = useRef(false)
  const hasDraft = Boolean(content || tags.length || customTag || relatedCat || attachments.length || postType !== 'discussion')

  useEffect(() => {
    if (isOpen && !previousOpen.current && !hasDraft) setTopic(defaultTopic)
    previousOpen.current = isOpen
  }, [isOpen, defaultTopic, hasDraft])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !isOpen) return undefined
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow = 'hidden'
    contentRef.current?.focus()
    return () => { dialog.close(); document.body.style.overflow = previousOverflow }
  }, [isOpen])

  useEffect(() => { if (error && isOpen) errorRef.current?.focus() }, [error, isOpen])
  useEffect(() => () => { attachmentRef.current.forEach(({ url }) => URL.revokeObjectURL(url)) }, [])

  function closeDraft() {
    if (!submittingRef.current) onClose()
  }

  function toggleTag(tag: string) {
    setTags(previous => previous.includes(tag) ? previous.filter(item => item !== tag) : [...previous, tag])
  }

  function addCustomTag() {
    const normalized = customTag.trim().replace(/^#*/, '#')
    if (normalized.length > 1) setTags(previous => previous.includes(normalized) ? previous : [...previous, normalized])
    setCustomTag('')
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || submittingRef.current) return
    const next = [...attachmentRef.current]
    const errors: string[] = []
    for (const file of Array.from(fileList)) {
      if (!IMAGE_TYPES.has(file.type)) { errors.push(file.name + '：请选择 JPG、PNG 或 WebP 图片。'); continue }
      if (!file.size || file.size > MAX_IMAGE_BYTES) { errors.push(file.name + '：图片不能为空，且每张不超过 10 MB。'); continue }
      if (next.length >= MAX_IMAGES) { errors.push('最多添加 ' + MAX_IMAGES + ' 张图片。'); break }
      next.push({ file, url: URL.createObjectURL(file) })
    }
    attachmentRef.current = next
    setAttachments(next)
    setError(errors.join(' '))
  }

  function removeImage(index: number) {
    if (submittingRef.current) return
    URL.revokeObjectURL(attachmentRef.current[index].url)
    attachmentRef.current = attachmentRef.current.filter((_, i) => i !== index)
    setAttachments(attachmentRef.current)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submittingRef.current || !content.trim()) return
    const options = postType === 'poll' ? pollOptions.map(option => option.trim()).filter(Boolean) : []
    if (postType === 'poll' && options.length < 2) { setError('请填写至少两个投票选项后再发布。'); return }
    if (new Set(options).size !== options.length) { setError('投票选项不能重复，请修改后再发布。'); return }
    submittingRef.current = true
    setSubmitting(true)
    setError('')
    let created = false
    try {
      const form = new FormData()
      form.append('content', content.trim())
      form.append('topic', topic)
      form.append('tags', JSON.stringify(tags))
      form.append('postType', postType)
      form.append('pollOptions', JSON.stringify(options))
      if (relatedCat?.id) form.append('relatedCatId', String(relatedCat.id))
      attachmentRef.current.forEach(({ file }) => form.append('files', file))
      await createPost(form)
      created = true
    } catch (err) {
      setError((err.message || '发布失败') + '。文字和图片已保留，可以重试。')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
    if (created) {
      attachmentRef.current.forEach(({ url }) => URL.revokeObjectURL(url))
      attachmentRef.current = []
      setAttachments([])
      setContent(''); setTags([]); setCustomTag(''); setRelatedCat(null)
      setPostType('discussion'); setPollOptions(['', ''])
      toast('帖子已发布')
      onCreated?.()
      onClose()
    }
  }

  const choiceClass = (selected: boolean) => 'min-h-11 rounded-full border px-3 py-2 text-sm transition-colors ' + (selected ? 'border-primary bg-primary-light text-primary font-semibold' : 'border-border bg-surface-1 text-text-secondary')

  return (
    <dialog ref={dialogRef} aria-labelledby="compose-title" aria-describedby="compose-help"
      className="!m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-24px)] max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface-1 p-0 text-text backdrop:bg-black/50"
      onCancel={event => { event.preventDefault(); closeDraft() }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('*')].filter(node => node.matches('button, input, textarea, select, summary') && !node.matches(':disabled') && node.getClientRects().length > 0)
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}>
      <form onSubmit={handleSubmit} className="space-y-5 p-4 sm:p-6" aria-busy={submitting}>
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 id="compose-title" className="ui-title">分享校园日常</h2>
            <p id="compose-help" className="mt-1 text-sm leading-6 text-text-secondary">关闭后可在本页继续编辑；离开页面不会保存草稿。</p>
          </div>
          <button type="button" onClick={closeDraft} disabled={submitting} className="icon-button shrink-0" aria-label="关闭发帖，保留本页草稿"><X size={21} /></button>
        </header>
        <fieldset disabled={submitting} className="min-w-0 space-y-5">
          <div>
            <label htmlFor="post-content" className="mb-2 block text-sm font-semibold">想和猫友分享什么？</label>
            <textarea id="post-content" ref={contentRef} value={content} onChange={event => setContent(event.target.value)}
              placeholder="今天在哪里遇见了哪只猫？也可以分享近况、提出问题。"
              className="ui-input min-h-36 resize-y leading-7" maxLength={500} aria-describedby="post-content-count" />
            <p id="post-content-count" className="ui-meta mt-1 text-right tabular-nums">{content.length}/500 字</p>
          </div>
          <section aria-labelledby="post-images-label">
            <h3 id="post-images-label" className="text-sm font-semibold">添加图片（选填）</h3>
            <p id="post-images-help" className="mt-1 text-sm text-text-secondary">JPG、PNG 或 WebP，每张不超过 10 MB，最多 {MAX_IMAGES} 张。</p>
            <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
              {attachments.map(({ url, file }, index) => (
                <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-border">
                  <img src={url} alt={'待发布图片 ' + (index + 1) + '：' + file.name} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeImage(index)} aria-label={'移除图片 ' + (index + 1)} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-bl-xl bg-black/70 text-white"><X size={19} /></button>
                </div>
              ))}
              {attachments.length < MAX_IMAGES && <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-sm text-text-secondary hover:border-primary hover:text-primary"><Plus size={24} aria-hidden="true" />添加图片<span>{attachments.length}/{MAX_IMAGES}</span></button>}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" aria-label="添加帖子图片" aria-describedby="post-images-help" onChange={event => { addFiles(event.target.files); event.target.value = '' }} />
          </section>
          <details className="rounded-xl border border-border p-3 sm:p-4">
            <summary className="ui-disclosure">话题、类型与更多信息（选填）</summary>
            <div className="space-y-5 pt-3">
              <fieldset><legend className="mb-2 text-sm font-semibold">话题</legend><div className="flex flex-wrap gap-2">{TOPICS.map(item => <button key={item.id} type="button" onClick={() => setTopic(item.id)} aria-pressed={topic === item.id} className={choiceClass(topic === item.id)}>{item.label}</button>)}</div></fieldset>
              <fieldset><legend className="mb-2 text-sm font-semibold">帖子类型</legend><div className="flex flex-wrap gap-2">{POST_TYPES.map(item => <button key={item.id} type="button" onClick={() => setPostType(item.id)} aria-pressed={postType === item.id} className={choiceClass(postType === item.id)}>{item.label}</button>)}</div></fieldset>
              {postType === 'poll' && <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">投票选项（2–5 个）</legend>{pollOptions.map((option, index) => <div key={index} className="flex items-center gap-2"><label htmlFor={'poll-option-' + index} className="sr-only">投票选项 {index + 1}</label><input id={'poll-option-' + index} value={option} onChange={event => setPollOptions(previous => previous.map((value, i) => i === index ? event.target.value : value))} placeholder={'选项 ' + (index + 1)} className="ui-input flex-1" />{pollOptions.length > 2 && <button type="button" onClick={() => setPollOptions(previous => previous.filter((_, i) => i !== index))} className="icon-button shrink-0" aria-label={'移除选项 ' + (index + 1)}><X size={19} /></button>}</div>)}{pollOptions.length < 5 && <button type="button" onClick={() => setPollOptions(previous => [...previous, ''])} className="btn btn-ghost">添加选项</button>}</fieldset>}
              {postType === 'question' && <p className="rounded-xl bg-primary-light p-3 text-sm leading-6 text-text-secondary">猫友可以在评论中回答，你可以采纳有帮助的答案。</p>}
              <div><p className="mb-2 text-sm font-semibold">关联猫猫</p><CatPicker selected={relatedCat} onChange={setRelatedCat} /></div>
              <fieldset><legend className="mb-2 text-sm font-semibold">标签</legend>
                <div className="mb-3 flex flex-wrap gap-2">{PRESET_TAGS.map(tag => <button type="button" key={tag} onClick={() => toggleTag(tag)} aria-pressed={tags.includes(tag)} className={choiceClass(tags.includes(tag))}>{tag}</button>)}</div>
                <label htmlFor="post-custom-tag" className="sr-only">自定义标签</label>
                <div className="flex gap-2"><input id="post-custom-tag" value={customTag} onChange={event => setCustomTag(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addCustomTag() } }} placeholder="自定义标签" className="ui-input flex-1" /><button type="button" onClick={addCustomTag} disabled={!customTag.trim().replace(/^#*/, '')} className="btn btn-ghost">添加</button></div>
                {tags.length > 0 && <div className="mt-3 flex flex-wrap gap-2" aria-label="已选标签">{tags.map(tag => <button type="button" key={tag} onClick={() => toggleTag(tag)} aria-label={'移除标签 ' + tag} className="min-h-11 rounded-full bg-primary-light px-3 text-sm text-primary [overflow-wrap:anywhere]">{tag} ×</button>)}</div>}
              </fieldset>
            </div>
          </details>
        </fieldset>
        {error && <p ref={errorRef} role="alert" tabIndex={-1} className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm leading-6 text-danger [overflow-wrap:anywhere]">{error}</p>}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-text-secondary">发布后，猫友可在社区看到这条内容。</p>
          <button type="submit" disabled={!content.trim() || submitting} className="btn btn-primary w-full sm:w-auto">{submitting ? '发布中…' : '发布帖子'}</button>
        </footer>
      </form>
    </dialog>
  )
}
