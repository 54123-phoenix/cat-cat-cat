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

function markerShell(inner: string, clipDef = '') {
  return (
    '<svg width="40" height="46" viewBox="0 0 40 46" xmlns="http://www.w3.org/2000/svg">' +
    clipDef +
    '<path d="M20 44C17.2 38.8 6 32.6 6 19.8C6 10 12.2 3 20 3C27.8 3 34 10 34 19.8C34 32.6 22.8 38.8 20 44Z" fill="#EA580C"/>' +
    '<path d="M20 40.8C17.4 36.2 9.2 30.8 9.2 20C9.2 11.8 14 6.2 20 6.2C26 6.2 30.8 11.8 30.8 20C30.8 30.8 22.6 36.2 20 40.8Z" fill="#F97316"/>' +
    '<circle cx="20" cy="19" r="12.8" fill="#FFF7ED"/>' +
    inner +
    '<circle cx="20" cy="19" r="12.8" fill="none" stroke="#FFFFFF" stroke-width="2"/>' +
    '</svg>'
  )
}

function fallbackFace() {
  return (
    '<path d="M11.4 15.2L14.4 8.4L18.1 14.1" fill="#FFF7ED" stroke="#EA580C" stroke-width="1.8" stroke-linejoin="round"/>' +
    '<path d="M21.9 14.1L25.6 8.4L28.6 15.2" fill="#FFF7ED" stroke="#EA580C" stroke-width="1.8" stroke-linejoin="round"/>' +
    '<circle cx="16.1" cy="18.7" r="1.7" fill="#7C2D12"/>' +
    '<circle cx="23.9" cy="18.7" r="1.7" fill="#7C2D12"/>' +
    '<path d="M18.4 23.2C19.2 24 20.8 24 21.6 23.2" fill="none" stroke="#7C2D12" stroke-width="1.7" stroke-linecap="round"/>' +
    '<path d="M19 21.4H21L20 22.6Z" fill="#EA580C"/>' +
    '<path d="M12.2 22H16.2M23.8 22H27.8" stroke="#F97316" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M12.8 24.5H16.3M23.7 24.5H27.2" stroke="#F97316" stroke-width="1.2" stroke-linecap="round"/>'
  )
}

export function catMarkerString(avatar: string | null = null) {
  if (avatar) {
    const id = nextClipId()
    const safe = escapeSvgText(avatar)
    return markerShell(
      `<image href="${safe}" x="8.5" y="7.5" width="23" height="23" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`,
      `<defs><clipPath id="${id}"><circle cx="20" cy="19" r="11.5"/></clipPath></defs>`
    )
  }
  return markerShell(fallbackFace())
}

export default function CatMarker({ avatar = null, size = 40, className = '' }: { avatar?: string | null; size?: number; className?: string }) {
  const id = nextClipId()
  const height = Math.round(size * 1.15)

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 40 46"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="猫猫位置标记"
    >
      <path d="M20 44C17.2 38.8 6 32.6 6 19.8C6 10 12.2 3 20 3C27.8 3 34 10 34 19.8C34 32.6 22.8 38.8 20 44Z" fill="#EA580C" />
      <path d="M20 40.8C17.4 36.2 9.2 30.8 9.2 20C9.2 11.8 14 6.2 20 6.2C26 6.2 30.8 11.8 30.8 20C30.8 30.8 22.6 36.2 20 40.8Z" fill="#F97316" />
      <circle cx="20" cy="19" r="12.8" fill="#FFF7ED" />
      {avatar ? (
        <>
          <defs>
            <clipPath id={id}>
              <circle cx="20" cy="19" r="11.5" />
            </clipPath>
          </defs>
          <image
            href={avatar}
            x="8.5"
            y="7.5"
            width="23"
            height="23"
            clipPath={`url(#${id})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      ) : (
        <>
          <path d="M11.4 15.2L14.4 8.4L18.1 14.1" fill="#FFF7ED" stroke="#EA580C" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M21.9 14.1L25.6 8.4L28.6 15.2" fill="#FFF7ED" stroke="#EA580C" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="16.1" cy="18.7" r="1.7" fill="#7C2D12" />
          <circle cx="23.9" cy="18.7" r="1.7" fill="#7C2D12" />
          <path d="M18.4 23.2C19.2 24 20.8 24 21.6 23.2" fill="none" stroke="#7C2D12" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M19 21.4H21L20 22.6Z" fill="#EA580C" />
          <path d="M12.2 22H16.2M23.8 22H27.8" stroke="#F97316" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M12.8 24.5H16.3M23.7 24.5H27.2" stroke="#F97316" strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}
      <circle cx="20" cy="19" r="12.8" fill="none" stroke="#FFFFFF" strokeWidth="2" />
    </svg>
  )
}
