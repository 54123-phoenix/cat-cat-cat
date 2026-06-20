let _clipId = 0

function nextClipId() {
  _clipId += 1
  return `catMarkerClip${_clipId}`
}

function catSilhouette() {
  return (
    '<g fill="#F97316">' +
    '<polygon points="7,12 11,3 15,11"/>' +
    '<polygon points="17,11 21,3 25,12"/>' +
    '<ellipse cx="16" cy="19" rx="8" ry="7"/>' +
    '</g>' +
    '<circle cx="13" cy="18" r="1.4" fill="#FFFFFF"/>' +
    '<circle cx="19" cy="18" r="1.4" fill="#FFFFFF"/>'
  )
}

export function catMarkerString(avatar = null) {
  const head = '<circle cx="16" cy="16" r="15" fill="#FFFFFF" stroke="#F97316" stroke-width="2"/>'
  if (avatar) {
    const id = nextClipId()
    const safe = String(avatar).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return (
      '<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
      `<defs><clipPath id="${id}"><circle cx="16" cy="16" r="14"/></clipPath></defs>` +
      head +
      `<image href="${safe}" x="2" y="2" width="28" height="28" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>` +
      '</svg>'
    )
  }
  return (
    '<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">' +
    head +
    catSilhouette() +
    '</svg>'
  )
}

export default function CatMarker({ avatar = null, size = 32, className = '' }) {
  const id = nextClipId()
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="猫咪标记"
    >
      <circle cx="16" cy="16" r="15" fill="#FFFFFF" stroke="#F97316" strokeWidth="2" />
      {avatar ? (
        <>
          <defs>
            <clipPath id={id}>
              <circle cx="16" cy="16" r="14" />
            </clipPath>
          </defs>
          <image
            href={avatar}
            x="2"
            y="2"
            width="28"
            height="28"
            clipPath={`url(#${id})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      ) : (
        <>
          <g fill="#F97316">
            <polygon points="7,12 11,3 15,11" />
            <polygon points="17,11 21,3 25,12" />
            <ellipse cx="16" cy="19" rx="8" ry="7" />
          </g>
          <circle cx="13" cy="18" r="1.4" fill="#FFFFFF" />
          <circle cx="19" cy="18" r="1.4" fill="#FFFFFF" />
        </>
      )}
    </svg>
  )
}
