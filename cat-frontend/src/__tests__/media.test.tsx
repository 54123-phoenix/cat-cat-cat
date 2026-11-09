import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ImageWithShimmer from '../components/ImageWithShimmer'
import PhotoViewer from '../components/PhotoViewer'
import { imageSources } from '../utils/imageSources'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('upload image sources', () => {
  it('offers bounded local variants and preserves existing query parameters', () => {
    const sources = imageSources('/uploads/cats/a.jpg?v=1', 320)
    expect(sources.src).toBe('/uploads/cats/a.jpg?v=1&w=320')
    expect(sources.srcSet).toContain('/uploads/cats/a.jpg?v=1&w=1280 1280w')
    expect(imageSources('/uploads/a.jpg?w=160', 640).src).toBe('/uploads/a.jpg?w=640')
  })
  it('never modifies external, inline, blob or non-upload images', () => {
    for (const src of ['https://images.example/a.jpg?signature=abc', '//images.example/a.jpg', 'data:image/png;base64,abc', 'blob:http://localhost/a', '/logo.svg']) {
      expect(imageSources(src)).toEqual({ src })
    }
  })
})

describe('image feedback', () => {
  it('falls back from a rejected thumbnail to its original only once', () => {
    render(<ImageWithShimmer src="/uploads/a.jpg" alt="小橘" retryable />)
    fireEvent.error(screen.getByRole('img', { name: '小橘' }))
    expect(screen.getByRole('img', { name: '小橘' })).toHaveAttribute('src', '/uploads/a.jpg')
    expect(screen.getByRole('img', { name: '小橘' })).not.toHaveAttribute('srcset')
    fireEvent.error(screen.getByRole('img', { name: '小橘' }))
    expect(screen.getByRole('img', { name: '小橘：暂时无法显示' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新加载图片' }))
    expect(screen.getByRole('group', { name: '小橘' })).toHaveFocus()
    expect(screen.getByRole('img', { name: '小橘' }).getAttribute('src')).toContain('_image_retry=1')
    fireEvent.load(screen.getByRole('img', { name: '小橘' }))
    expect(screen.queryByText('图片暂时无法显示')).not.toBeInTheDocument()
  })
  it('does not add a nested retry control in a clickable card', () => {
    render(<button><ImageWithShimmer src="/broken.jpg" alt="猫" /></button>)
    fireEvent.error(screen.getByRole('img', { name: '猫' }))
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
  it('replaces stale failure state when the source changes', () => {
    const { rerender } = render(<ImageWithShimmer src="/a.jpg" alt="猫" />)
    fireEvent.error(screen.getByRole('img', { name: '猫' }))
    rerender(<ImageWithShimmer src="/b.jpg" alt="猫" />)
    fireEvent.load(screen.getByRole('img', { name: '猫' }))
    expect(screen.getByRole('img', { name: '猫' })).toHaveAttribute('src', '/b.jpg')
    expect(screen.queryByText('图片暂时无法显示')).not.toBeInTheDocument()
  })
  it('shows a slow hint without giving up on an in-flight image', () => {
    vi.useFakeTimers()
    render(<ImageWithShimmer src="/a.jpg" alt="猫" loading="eager" retryable />)
    act(() => vi.advanceTimersByTime(8000))
    expect(screen.getByText('图片加载较慢，仍在尝试…')).toBeInTheDocument()
    fireEvent.load(screen.getByRole('img', { name: '猫' }))
    expect(screen.queryByText('图片加载较慢，仍在尝试…')).not.toBeInTheDocument()
  })
  it('distinguishes missing media from a network error', () => {
    render(<ImageWithShimmer alt="待补充的猫" retryable />)
    expect(screen.getByText('还没有照片')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('photo viewer', () => {
  beforeEach(() => {
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: { configurable: true, value: function () { this.setAttribute('open', '') } },
      close: { configurable: true, value: function () { this.removeAttribute('open') } },
    })
  })
  it('opens original photos, navigates with arrows and restores scroll and focus', () => {
    const opener = document.createElement('button')
    document.body.append(opener); opener.focus()
    document.body.style.overflow = 'auto'
    const { unmount } = render(<PhotoViewer images={['/uploads/a.jpg', '/uploads/b.jpg']} onClose={vi.fn()} />)
    expect(screen.getByRole('img', { name: '照片 1' })).toHaveAttribute('src', '/uploads/a.jpg')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' })
    expect(screen.getByRole('img', { name: '照片 2' })).toHaveAttribute('src', '/uploads/b.jpg')
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('auto')
    expect(opener).toHaveFocus()
    opener.remove(); document.body.style.overflow = ''
  })
  it('can close with the native cancel event and retry a failed original', () => {
    const onClose = vi.fn()
    render(<PhotoViewer images={['/uploads/a.jpg']} onClose={onClose} />)
    fireEvent.error(screen.getByRole('img', { name: '照片 1' }))
    fireEvent.click(screen.getByRole('button', { name: '重新加载图片' }))
    expect(screen.getByRole('img', { name: '照片 1' })).toHaveAttribute('src', '/uploads/a.jpg')
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
  it('keeps the viewer open after a horizontal swipe', () => {
    const onClose = vi.fn()
    render(<PhotoViewer images={['/a.jpg', '/b.jpg']} onClose={onClose} />)
    const img = screen.getByRole('img', { name: '照片 1' })
    fireEvent.touchStart(img, { touches: [{ clientX: 200, clientY: 100 }] })
    fireEvent.touchEnd(img, { changedTouches: [{ clientX: 80, clientY: 110 }] })
    expect(screen.getByRole('img', { name: '照片 2' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
  it('preserves the selected photo index when an earlier photo is missing', () => {
    render(<PhotoViewer images={['/a.jpg', {}, '/c.jpg', '/d.jpg']} initialIndex={2} onClose={vi.fn()} />)
    expect(screen.getByRole('img', { name: '照片 3' })).toHaveAttribute('src', '/c.jpg')
  })
  it('keeps keyboard focus inside the viewer when leaving a failed photo', () => {
    render(<PhotoViewer images={['/a.jpg', '/b.jpg']} onClose={vi.fn()} />)
    fireEvent.error(screen.getByRole('img', { name: '照片 1' }))
    const retry = screen.getByRole('button', { name: '重新加载图片' })
    retry.focus()
    fireEvent.keyDown(retry, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: '关闭照片' })).toHaveFocus()
    expect(screen.getByRole('img', { name: '照片 2' })).toBeInTheDocument()
  })
})
