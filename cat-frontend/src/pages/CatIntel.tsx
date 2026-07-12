import { FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, LocateFixed, MapPin, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { askCatIntel } from '../api'
import MascotCat from '../components/MascotCat'

type AgentAction = { type: string; label: string; params?: Record<string, unknown> }
type AgentResult = {
  answer: string
  mode: 'agent' | 'fallback'
  confidence: string
  evidence: Array<{ label: string; source: string; observed_at?: string }>
  actions: AgentAction[]
  limitations: string[]
}
type ChatMessage = { id: number; role: 'user' | 'assistant'; text: string; result?: AgentResult }

const starters = ['现在去哪里更容易遇到猫？', '光草最近有哪些猫？', '帮我规划一条半小时寻猫路线']
const confidenceLabels = { high: '数据较充分', medium: '数据一般', low: '样本较少', none: '暂无数据' }

export default function CatIntel() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationState, setLocationState] = useState<'idle' | 'loading' | 'ready' | 'denied'>('idle')
  const nextId = useRef(1)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = bottomRef.current
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, sending])

  function requestLocation() {
    if (!navigator.geolocation) return setLocationState('denied')
    setLocationState('loading')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ latitude: coords.latitude, longitude: coords.longitude })
        setLocationState('ready')
      },
      () => setLocationState('denied'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  }

  async function send(text = input) {
    const question = text.trim()
    if (!question || sending) return
    setInput('')
    setMessages((items) => [...items, { id: nextId.current++, role: 'user', text: question }])
    setSending(true)
    try {
      const result = await askCatIntel(question, {
        ...location,
        client_time: new Date().toISOString(),
      }) as AgentResult
      setMessages((items) => [...items, { id: nextId.current++, role: 'assistant', text: result.answer, result }])
    } catch (error) {
      const text = error instanceof Error ? error.message : '猫情报暂时无法响应'
      setMessages((items) => [...items, { id: nextId.current++, role: 'assistant', text }])
    } finally {
      setSending(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void send()
  }

  function runAction(action: AgentAction) {
    const params = action.params || {}
    if (action.type === 'open_cat' && params.cat_id) navigate(`/cats/${params.cat_id}`)
    else if (action.type === 'start_route') navigate(`/routes?time_slot=${params.time_slot || 'anytime'}`)
    else if (action.type === 'open_scan') navigate('/scan')
    else {
      const query = params.location ? `?location=${encodeURIComponent(String(params.location))}` : ''
      navigate(`/map${query}`)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col">
      {messages.length === 0 ? (
        <section className="flex flex-1 flex-col justify-center py-8">
          <div className="flex items-center gap-4 border-b border-border pb-5">
            <MascotCat mood="curious" size={76} />
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-primary"><Sparkles className="h-4 w-4" />运行时情报</div>
              <h2 className="mt-1 text-xl font-bold text-text">今天想了解哪只猫？</h2>
              <p className="mt-1 text-sm leading-6 text-text-secondary">回答来自猫档案和近期已审核偶遇。</p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {starters.map((item) => (
              <button key={item} onClick={() => void send(item)} className="flex w-full items-center justify-between border-b border-border px-1 py-4 text-left text-sm font-medium text-text transition-colors hover:text-primary">
                {item}<Send className="h-4 w-4 text-text-muted" />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="flex-1 space-y-5 py-3">
          {messages.map((message) => (
            <article key={message.id} className={message.role === 'user' ? 'ml-10' : 'mr-2'}>
              <div className={`flex items-start gap-2 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role === 'assistant' && <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white"><Bot className="h-4 w-4" /></div>}
                <div className={message.role === 'user' ? 'rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm leading-6 text-white' : 'min-w-0 flex-1 border-b border-border pb-4 text-sm leading-7 text-text'}>
                  {message.text}
                </div>
              </div>
              {message.result && (
                <div className="ml-10 mt-3 space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-text-secondary"><ShieldCheck className="h-3.5 w-3.5 text-success" />{confidenceLabels[message.result.confidence] || message.result.confidence}</span>
                    <span className="text-text-muted">{message.result.mode === 'agent' ? '语言模型 + 工具' : '本地情报引擎'}</span>
                  </div>
                  {message.result.evidence.map((item, index) => <p key={`${item.label}-${index}`} className="border-l-2 border-primary/40 pl-3 text-xs leading-5 text-text-secondary">{item.label}</p>)}
                  <div className="flex flex-wrap gap-2">
                    {message.result.actions.map((action) => <button key={`${action.type}-${action.label}`} onClick={() => runAction(action)} className="rounded-full border border-primary/30 bg-white px-3 py-2 text-xs font-semibold text-primary">{action.label}</button>)}
                  </div>
                  {message.result.limitations[0] && <p className="text-[11px] leading-5 text-text-muted">{message.result.limitations[0]}</p>}
                </div>
              )}
            </article>
          ))}
          {sending && <div className="flex items-center gap-2 text-sm text-text-muted"><Bot className="h-4 w-4 text-primary" /><span className="animate-pulse">正在查询社区观测...</span></div>}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="sticky bottom-16 bg-page-warm pb-2 pt-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <button onClick={requestLocation} disabled={locationState === 'loading'} className={`inline-flex items-center gap-1.5 text-xs font-medium ${locationState === 'ready' ? 'text-success' : 'text-text-secondary'}`}>
            {locationState === 'ready' ? <MapPin className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" />}
            {locationState === 'loading' ? '正在定位' : locationState === 'ready' ? '已使用当前位置' : locationState === 'denied' ? '定位未授权' : '使用当前位置'}
          </button>
          <span className="text-[11px] text-text-muted">位置仅随本次问题发送</span>
        </div>
        <form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-border bg-white p-2 shadow-sm">
          <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} rows={1} maxLength={500} placeholder="问地点、猫或寻猫路线..." className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-text outline-none" />
          <button type="submit" disabled={!input.trim() || sending} aria-label="发送" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </form>
      </div>
    </div>
  )
}
