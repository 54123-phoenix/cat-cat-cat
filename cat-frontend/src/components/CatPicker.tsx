import { useEffect, useState } from 'react'
import { getCats } from '../api'
import { PawPrint, Cat } from 'lucide-react'

export default function CatPicker({ selected, onChange }) {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(false)
    getCats().then(data => { if (!cancelled) setCats(data) }).catch(() => { if (!cancelled) setError(true) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [retry])
  const choiceClass = (active: boolean) => 'flex min-h-16 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-3 py-2 text-sm ' + (active ? 'border-primary bg-primary-light text-primary' : 'border-border text-text-secondary')
  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-2" role="group" aria-label="关联猫猫">
        <button type="button" onClick={() => onChange(null)} aria-pressed={!selected} className={choiceClass(!selected)}><PawPrint size={20} aria-hidden="true" /><span>不指定</span></button>
        {cats.map(cat => <button type="button" key={cat.id} onClick={() => onChange(cat)} aria-pressed={selected?.id === cat.id} className={choiceClass(selected?.id === cat.id)}><Cat size={20} aria-hidden="true" /><span>{cat.name}</span></button>)}
      </div>
      {loading && <p role="status" className="text-sm text-text-secondary">正在加载猫猫…</p>}
      {error && <div className="flex flex-wrap items-center gap-2"><p role="status" className="text-sm text-text-secondary">猫猫列表暂时无法加载，仍可不指定猫猫发布。</p><button type="button" onClick={() => setRetry(value => value + 1)} className="btn btn-ghost">重试加载猫猫</button></div>}
    </div>
  )
}
