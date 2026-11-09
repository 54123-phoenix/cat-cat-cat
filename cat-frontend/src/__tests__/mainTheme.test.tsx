import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('react-dom/client', () => ({ default: { createRoot: () => ({ render: vi.fn() }) } }))
vi.mock('../App', () => ({ default: () => null }))
vi.mock('../components/ErrorBoundary', () => ({ default: () => null }))

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  delete document.documentElement.dataset.theme
  document.body.innerHTML = '<div id="root"></div>'
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  delete document.documentElement.dataset.theme
  document.body.innerHTML = ''
})

it.each([[null, 'original'], ['dark', 'dark']])('applies the startup preference %s without creating or rewriting a saved choice', async (stored, expected) => {
  if (stored !== null) localStorage.setItem('theme', stored)
  const save = vi.spyOn(Storage.prototype, 'setItem')
  await import('../main')

  expect(document.documentElement.dataset.theme).toBe(expected)
  expect(localStorage.getItem('theme')).toBe(stored)
  expect(save).not.toHaveBeenCalled()
})
