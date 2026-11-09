import { describe, it, expect } from 'vitest'
import { fireEvent } from '@testing-library/react'

describe('MascotCat image recovery', () => {
  it('falls back to PNG when WebP fails without leaving srcset active', async () => {
    const { default: MascotCat } = await import('../components/MascotCat')
    const { render } = await import('@testing-library/react')
    const { container } = render(<MascotCat mood="happy" size={64} />)
    const img = container.querySelector('img')!
    fireEvent.error(img)
    expect(img).toHaveAttribute('src', '/brand/mascot-384.png')
    expect(img).not.toHaveAttribute('srcset')
  })

  it('replaces failed artwork with an accessible stable fallback', async () => {
    const { default: MascotCat } = await import('../components/MascotCat')
    const { render } = await import('@testing-library/react')
    const { container } = render(<MascotCat mood="sleep" size={64} />)
    fireEvent.error(container.querySelector('img')!)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[role="img"]')).toHaveAccessibleName('蓝白校园猫吉祥物')
    expect(container.querySelector('[role="img"]')).toHaveStyle({ width: '64px', height: '67px' })
  })
})

describe('Logo illustration', () => {
  it('allows the navigation backdrop to be disabled', async () => {
    const { default: Logo } = await import('../components/illustrations/Logo')
    const { render } = await import('@testing-library/react')
    const { container, rerender } = render(<Logo size={32} />)
    expect(container.querySelector('[role="img"]')).toHaveClass('brand-logo-circle')
    rerender(<Logo size={32} withCircle={false} />)
    expect(container.querySelector('[role="img"]')).not.toHaveClass('brand-logo-circle')
  })
})

describe('SadCat SVG illustration', () => {
  it('renders with aria-label', async () => {
    const { default: SadCat } = await import('../components/illustrations/SadCat')
    const { render } = await import('@testing-library/react')
    const { container } = render(<SadCat size={48} className="" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('aria-label')).toBeTruthy()
  })
})

describe('PawIcon SVG illustration', () => {
  it('renders without crash', async () => {
    const { default: PawIcon } = await import('../components/illustrations/PawIcon')
    const { render } = await import('@testing-library/react')
    const { container } = render(<PawIcon size={24} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
