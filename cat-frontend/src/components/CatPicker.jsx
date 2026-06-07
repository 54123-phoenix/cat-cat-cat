import { useEffect, useState } from 'react'
import { getCats } from '../api'

export default function CatPicker({ selected, onChange }) {
  const [cats, setCats] = useState([])

  useEffect(() => {
    getCats().then(setCats).catch(console.error)
  }, [])

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
      <button
        onClick={() => onChange(null)}
        className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-xl border text-xs transition-colors ${
          !selected ? 'border-primary bg-primary-light text-primary' : 'border-gray-100 text-gray-400'
        }`}
      >
        <span className="text-xl">🐾</span>
        <span>不指定</span>
      </button>

      {cats.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat)}
          className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-xl border text-xs transition-colors ${
            selected?.id === cat.id ? 'border-primary bg-primary-light text-primary' : 'border-gray-100 text-gray-400'
          }`}
        >
          <span className="text-xl">🐱</span>
          <span className="max-w-12 truncate">{cat.name}</span>
        </button>
      ))}
    </div>
  )
}
