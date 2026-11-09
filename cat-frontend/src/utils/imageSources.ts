export const IMAGE_WIDTHS = [160, 320, 640, 960, 1280] as const
export type ImageWidth = typeof IMAGE_WIDTHS[number]

// Signed external URLs, blob previews and inline images retain their exact source.
export function imageSources(src?: string, width: ImageWidth = 640, retry = 0) {
  if (!src) return { src }
  try {
    const url = new URL(src, window.location.href)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/uploads/') || url.username || url.password) return { src }
    const variant = (size: number) => {
      const copy = new URL(url)
      copy.searchParams.set('w', String(size))
      if (retry) copy.searchParams.set('_image_retry', String(retry))
      return `${copy.pathname}${copy.search}${copy.hash}`
    }
    return { src: variant(width), srcSet: IMAGE_WIDTHS.map(size => `${variant(size)} ${size}w`).join(', ') }
  } catch {
    return { src }
  }
}
