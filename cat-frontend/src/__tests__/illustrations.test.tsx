import { describe, it, expect } from 'vitest'

describe('MascotCat renders different moods', () => {
  it('renders happy mood without crash', async () => {
    const { default: MascotCat } = await import('../components/MascotCat')
    const { render } = await import('@testing-library/react')
    const { container } = render(<MascotCat mood="happy" size={64} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders sleep mood without crash', async () => {
    const { default: MascotCat } = await import('../components/MascotCat')
    const { render } = await import('@testing-library/react')
    const { container } = render(<MascotCat mood="sleep" size={64} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
})

describe('Logo SVG illustration', () => {
  it('renders with role=img', async () => {
    const { default: Logo } = await import('../components/illustrations/Logo')
    const { render } = await import('@testing-library/react')
    const { container } = render(<Logo size={32} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('role')).toBe('img')
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
