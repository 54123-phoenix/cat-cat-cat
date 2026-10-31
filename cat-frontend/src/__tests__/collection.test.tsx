import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Collection from '../pages/Collection'
import * as api from '../api'

vi.mock('../api', () => ({ getCats: vi.fn(), getFollowedCats: vi.fn(), getEncounteredCatIds: vi.fn() }))
beforeEach(() => {
  vi.mocked(api.getCats).mockResolvedValue([])
  vi.mocked(api.getFollowedCats).mockResolvedValue([])
  vi.mocked(api.getEncounteredCatIds).mockResolvedValue([])
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('survives loading to populated data and search', async () => {
  vi.mocked(api.getCats).mockResolvedValue([{ id: 1, name: '小橘' }, { id: 2, name: '小白' }])
  vi.mocked(api.getEncounteredCatIds).mockResolvedValue([2])
  render(<MemoryRouter><Collection /></MemoryRouter>)
  expect(await screen.findByText('小橘')).toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '小白' } })
  expect(screen.queryByText('小橘')).not.toBeInTheDocument()
  expect(screen.getByText('小白')).toBeInTheDocument()
  expect(screen.getByText('已相遇', { selector: 'span' })).toBeInTheDocument()
})

it('survives loading to an empty collection', async () => {
  render(<MemoryRouter><Collection /></MemoryRouter>)
  expect(await screen.findByText('还没有校园猫猫')).toBeInTheDocument()
})

it('survives a failed request without a hook-order exception', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(api.getCats).mockRejectedValue(new Error('network unavailable'))
  render(<MemoryRouter><Collection /></MemoryRouter>)
  expect(await screen.findByText('还没有校园猫猫')).toBeInTheDocument()
})
