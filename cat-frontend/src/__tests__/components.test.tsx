import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

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
  it('renders nothing when no toasts', async () => {
    const mod = await import('../components/Toast')
    const { container } = render(<mod.default />)
    expect(container.firstChild).toBeNull()
  })
})

describe('MascotCat renders moods', () => {
  it('renders happy mood SVG', async () => {
    const mod = await import('../components/MascotCat')
    const { container } = render(<mod.default mood="happy" size={64} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders sleep mood SVG', async () => {
    const mod = await import('../components/MascotCat')
    const { container } = render(<mod.default mood="sleep" size={64} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
})

describe('Logo SVG illustration', () => {
  it('renders with role=img', async () => {
    const mod = await import('../components/illustrations/Logo')
    const { container } = render(<mod.default size={32} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('role')).toBe('img')
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
