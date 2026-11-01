import { act, cleanup, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import Layout from '../components/Layout'
import { ApiError } from '../api'
import * as api from '../api'

vi.mock('../api', async importOriginal => ({
  ...await importOriginal<typeof import('../api')>(), getUserProfile: vi.fn(),
}))
vi.mock('../App', () => ({ useUserStore: () => ({ nickname: 'Test' }), updateUser: vi.fn() }))
vi.mock('../hooks/useEventStream', () => ({ useEventStream: vi.fn() }))
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks() })

it.each([new TypeError('Failed to fetch'), new ApiError('Temporary error', 503)])('keeps the user signed in when profile loading fails transiently (%#)', async error => {
  localStorage.setItem('token', 'still-valid')
  vi.mocked(api.getUserProfile).mockRejectedValue(error)
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><Layout /></MemoryRouter></QueryClientProvider>)
  await act(async () => { await Promise.resolve() })
  expect(localStorage.getItem('token')).toBe('still-valid')
})

it('clears the session for an explicit unauthorized profile response', async () => {
  localStorage.setItem('token', 'expired')
  vi.mocked(api.getUserProfile).mockRejectedValue(new ApiError('Expired', 401))
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><Layout /></MemoryRouter></QueryClientProvider>)
  await waitFor(() => expect(localStorage.getItem('token')).toBeNull())
})
