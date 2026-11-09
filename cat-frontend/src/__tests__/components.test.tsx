import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'


describe('ErrorBoundary', () => {
  it('renders children when no error', async () => {
    const mod = await import('../components/ErrorBoundary')
    render(<mod.default><div>正常内容</div></mod.default>)
    expect(screen.getByText('正常内容')).toBeInTheDocument()
  })

  it('renders fallback UI when child throws', async () => {
    const mod = await import('../components/ErrorBoundary')
    const Throw = () => { throw new Error('test') }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<mod.default><Throw /></mod.default>)
    expect(screen.getByText(/喵呜/)).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('renders title and description', async () => {
    const mod = await import('../components/EmptyState')
    render(<mod.default title="暂无数据" description="快去偶遇猫猫吧" />)
    expect(screen.getByText('暂无数据')).toBeInTheDocument()
    expect(screen.getByText('快去偶遇猫猫吧')).toBeInTheDocument()
  })
})

describe('Toast', () => {
  it('mounts an empty live region before any notification arrives', async () => {
    const mod = await import('../components/Toast')
    render(<mod.default />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.queryByRole('button', { name: '关闭通知' })).not.toBeInTheDocument()
  })
})

describe('MascotCat renders moods', () => {
  it('reserves illustration space and stays still by default', async () => {
    const mod = await import('../components/MascotCat')
    const { container } = render(<mod.default mood="happy" size={64} />)
    const mascot = container.querySelector('[role="img"]')
    expect(mascot).toHaveAccessibleName('蓝白校园猫吉祥物')
    expect(mascot).toHaveStyle({ width: '64px', height: '67px' })
    expect(mascot).not.toHaveClass('mascot-breathe')
  })

  it('keeps quiet states still when animation is requested', async () => {
    const mod = await import('../components/MascotCat')
    const { container } = render(<mod.default mood="sleep" size={64} breathe />)
    expect(container.querySelector('[role="img"]')).not.toHaveClass('mascot-breathe')
  })
})

describe('Logo illustration', () => {
  it('renders with role=img', async () => {
    const mod = await import('../components/illustrations/Logo')
    const { container } = render(<mod.default size={32} />)
    const logo = container.querySelector('[role="img"]')
    expect(logo).toHaveAccessibleName('猫猫社区 Logo')
    expect(logo).toHaveStyle({ width: '32px', height: '32px' })
  })
})

describe('SadCat SVG illustration', () => {
  it('renders with aria-label', async () => {
    const mod = await import('../components/illustrations/SadCat')
    const { container } = render(<mod.default size={48} className="" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('aria-label')).toBeTruthy()
  })
})

describe('PawIcon SVG illustration', () => {
  it('renders without crash', async () => {
    const mod = await import('../components/illustrations/PawIcon')
    const { container } = render(<mod.default size={24} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
