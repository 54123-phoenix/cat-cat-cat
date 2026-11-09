import { StrictMode } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeSwitcher, { applyTheme, getStoredTheme } from '../components/ThemeSwitcher'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('theme preferences', () => {
  it.each(['original', 'orange', 'zen', 'rustic', 'modern', 'sugary', 'cafe', 'dark'])('retains the saved %s theme', key => {
    localStorage.setItem('theme', key)
    expect(getStoredTheme()).toBe(key)
    expect(applyTheme(getStoredTheme())).toBe(key)
    expect(document.documentElement.dataset.theme).toBe(key)
  })

  it.each([null, '', 'removed-theme'])('uses the brand default for a missing or invalid preference (%s)', key => {
    if (key !== null) localStorage.setItem('theme', key)
    expect(getStoredTheme()).toBe('original')
  })

  it('uses the brand default when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage is blocked') })
    expect(getStoredTheme()).toBe('original')
  })

  it('does not apply or save an unknown theme', () => {
    const save = vi.spyOn(Storage.prototype, 'setItem')
    expect(applyTheme('unknown-theme')).toBe('original')
    expect(document.documentElement.dataset.theme).toBe('original')
    expect(save).not.toHaveBeenCalled()
  })
})

describe('theme selector', () => {
  it('shows Fudan blue as the default and warm orange as a separate explicit option without saving on mount', () => {
    const save = vi.spyOn(Storage.prototype, 'setItem')
    render(<StrictMode><ThemeSwitcher /></StrictMode>)

    const group = screen.getByRole('group', { name: '主题外观' })
    expect(within(group).getByRole('button', { name: '切换到复旦蓝主题', pressed: true })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: '切换到暖橙主题', pressed: false })).toBeInTheDocument()
    expect(within(group).getAllByRole('button', { pressed: true })).toHaveLength(1)
    expect(document.documentElement.dataset.theme).toBe('original')
    expect(save).not.toHaveBeenCalled()
  })

  it('saves an explicit choice, applies it immediately, and restores it on the next initialization', () => {
    const save = vi.spyOn(Storage.prototype, 'setItem')
    const view = render(<ThemeSwitcher />)
    fireEvent.click(screen.getByRole('button', { name: '切换到暖橙主题' }))

    expect(document.documentElement.dataset.theme).toBe('orange')
    expect(localStorage.getItem('theme')).toBe('orange')
    expect(save).toHaveBeenCalledExactlyOnceWith('theme', 'orange')
    expect(screen.getByRole('button', { name: '切换到暖橙主题', pressed: true })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)

    view.unmount()
    delete document.documentElement.dataset.theme
    render(<ThemeSwitcher />)
    expect(document.documentElement.dataset.theme).toBe('orange')
    expect(screen.getByRole('button', { name: '切换到暖橙主题', pressed: true })).toBeInTheDocument()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])('keeps the current choice across remounts after a failed save (read also fails: %s)', blockReads => {
    localStorage.setItem('theme', 'zen')
    applyTheme('zen')
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage is full') })
    const view = render(<ThemeSwitcher />)
    fireEvent.click(screen.getByRole('button', { name: '切换到深色主题' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: '切换到深色主题', pressed: true })).toBeInTheDocument()
    if (blockReads) {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage is blocked') })
    } else {
      expect(localStorage.getItem('theme')).toBe('zen')
    }

    view.unmount()
    render(<ThemeSwitcher />)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: '切换到深色主题', pressed: true })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('falls back from an invalid DOM theme to the saved preference', () => {
    document.documentElement.dataset.theme = 'removed-theme'
    localStorage.setItem('theme', 'cafe')
    const save = vi.spyOn(Storage.prototype, 'setItem')
    render(<ThemeSwitcher />)

    expect(document.documentElement.dataset.theme).toBe('cafe')
    expect(screen.getByRole('button', { name: '切换到咖啡馆主题', pressed: true })).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })
})
