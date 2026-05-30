export default function TopBar({ title, subtitle, action }) {
  return (
    <div className="bg-cat-orange px-4 pt-4 pb-4 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">{title}</h1>
          {subtitle && <p className="text-xs opacity-80 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}
