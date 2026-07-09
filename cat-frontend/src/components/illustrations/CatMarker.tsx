let clipCounter = 0

function nextClipId() {
  clipCounter += 1
  return `catMarkerClip${clipCounter}`
}

function escapeSvgText(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function markerShell(inner: string, clipDef = '', count?: number | null) {
  const countBadge = count && count > 1
    ? `<g><circle cx="34.5" cy="10.5" r="8.5" fill="#7C2D12" stroke="#FFFFFF" stroke-width="2"/><text x="34.5" y="14.2" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="10" font-weight="800" fill="#FFFFFF">${Math.min(count, 99)}</text></g>`
    : ''
  return (
    '<svg width="46" height="52" viewBox="0 0 46 52" xmlns="http://www.w3.org/2000/svg">' +
    clipDef +
    '<ellipse cx="23" cy="47" rx="10" ry="3" fill="#7C2D12" opacity="0.18"/>' +
    '<path d="M23 48C20 42.4 8 35.8 8 22C8 11.5 14.5 4 23 4C31.5 4 38 11.5 38 22C38 35.8 26 42.4 23 48Z" fill="#7C2D12" opacity="0.18"/>' +
    '<path d="M23 46C20 40.5 7 33.8 7 20.5C7 9.8 13.6 2.8 23 2.8C32.4 2.8 39 9.8 39 20.5C39 33.8 26 40.5 23 46Z" fill="#EA580C"/>' +
    '<path d="M23 42.4C20.3 37.5 10.5 31.5 10.5 20.7C10.5 12.2 15.6 6.2 23 6.2C30.4 6.2 35.5 12.2 35.5 20.7C35.5 31.5 25.7 37.5 23 42.4Z" fill="#F97316"/>' +
    '<circle cx="23" cy="20.4" r="13.2" fill="#FFF7ED"/>' +
    inner +
    '<circle cx="23" cy="20.4" r="13.2" fill="none" stroke="#FFFFFF" stroke-width="2.2"/>' +
    countBadge +
    '</svg>'
  )
}

function fallbackFace() {
  return (
    '<path d="M14.3 16.2L17 9.4L20.9 15.1" fill="#FFF7ED" stroke="#EA580C" stroke-width="1.8" stroke-linejoin="round"/>' +
    '<path d="M25.1 15.1L29 9.4L31.7 16.2" fill="#FFF7ED" stroke="#EA580C" stroke-width="1.8" stroke-linejoin="round"/>' +
    '<circle cx="19" cy="20.4" r="1.7" fill="#7C2D12"/>' +
    '<circle cx="27" cy="20.4" r="1.7" fill="#7C2D12"/>' +
    '<path d="M21.3 24.7C22.2 25.5 23.8 25.5 24.7 24.7" fill="none" stroke="#7C2D12" stroke-width="1.7" stroke-linecap="round"/>' +
    '<path d="M22 22.8H24L23 24Z" fill="#EA580C"/>' +
    '<path d="M15.2 23.6H19.1M26.9 23.6H30.8" stroke="#F97316" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M15.8 26H19.2M26.8 26H30.2" stroke="#F97316" stroke-width="1.2" stroke-linecap="round"/>'
  )
}

export function catMarkerString(avatar: string | null = null, count?: number | null) {
  if (avatar) {
    const id = nextClipId()
    const safe = escapeSvgText(avatar)
    return markerShell(
      `<image href="${safe}" x="11.2" y="8.6" width="23.6" height="23.6" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`,
      `<defs><clipPath id="${id}"><circle cx="23" cy="20.4" r="11.8"/></clipPath></defs>`,
      count
    )
  }
  return markerShell(fallbackFace(), '', count)
}

export default function CatMarker({ avatar = null, count = null, size = 40, className = '' }: { avatar?: string | null; count?: number | null; size?: number; className?: string }) {
  const id = nextClipId()
  const height = Math.round(size * 1.13)

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 46 52"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="猫猫位置标记"
    >
      <ellipse cx="23" cy="47" rx="10" ry="3" fill="#7C2D12" opacity="0.18" />
      <path d="M23 48C20 42.4 8 35.8 8 22C8 11.5 14.5 4 23 4C31.5 4 38 11.5 38 22C38 35.8 26 42.4 23 48Z" fill="#7C2D12" opacity="0.18" />
      <path d="M23 46C20 40.5 7 33.8 7 20.5C7 9.8 13.6 2.8 23 2.8C32.4 2.8 39 9.8 39 20.5C39 33.8 26 40.5 23 46Z" fill="#EA580C" />
      <path d="M23 42.4C20.3 37.5 10.5 31.5 10.5 20.7C10.5 12.2 15.6 6.2 23 6.2C30.4 6.2 35.5 12.2 35.5 20.7C35.5 31.5 25.7 37.5 23 42.4Z" fill="#F97316" />
      <circle cx="23" cy="20.4" r="13.2" fill="#FFF7ED" />
      {avatar ? (
        <>
          <defs>
            <clipPath id={id}>
              <circle cx="23" cy="20.4" r="11.8" />
            </clipPath>
          </defs>
          <image
            href={avatar}
            x="11.2"
            y="8.6"
            width="23.6"
            height="23.6"
            clipPath={`url(#${id})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      ) : (
        <>
          <path d="M14.3 16.2L17 9.4L20.9 15.1" fill="#FFF7ED" stroke="#EA580C" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M25.1 15.1L29 9.4L31.7 16.2" fill="#FFF7ED" stroke="#EA580C" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="19" cy="20.4" r="1.7" fill="#7C2D12" />
          <circle cx="27" cy="20.4" r="1.7" fill="#7C2D12" />
          <path d="M21.3 24.7C22.2 25.5 23.8 25.5 24.7 24.7" fill="none" stroke="#7C2D12" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M22 22.8H24L23 24Z" fill="#EA580C" />
          <path d="M15.2 23.6H19.1M26.9 23.6H30.8" stroke="#F97316" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M15.8 26H19.2M26.8 26H30.2" stroke="#F97316" strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}
      <circle cx="23" cy="20.4" r="13.2" fill="none" stroke="#FFFFFF" strokeWidth="2.2" />
      {count && count > 1 && (
        <g>
          <circle cx="34.5" cy="10.5" r="8.5" fill="#7C2D12" stroke="#FFFFFF" strokeWidth="2" />
          <text x="34.5" y="14.2" textAnchor="middle" fontFamily="Inter, Arial, sans-serif" fontSize="10" fontWeight="800" fill="#FFFFFF">
            {Math.min(count, 99)}
          </text>
        </g>
      )}
    </svg>
  )
}
