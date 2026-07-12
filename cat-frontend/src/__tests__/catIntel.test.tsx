import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CatIntel from '../pages/CatIntel'
import * as api from '../api'

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')
  return { ...actual, askCatIntel: vi.fn() }
})

describe('CatIntel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends a runtime question and renders evidence and actions', async () => {
    vi.mocked(api.askCatIntel).mockResolvedValue({
      answer: '光草近 14 天记录较多。',
      mode: 'agent',
      confidence: 'medium',
      evidence: [{ label: '近14天已审核观测 4 条', source: 'approved_sightings' }],
      actions: [{ type: 'open_map', label: '查看热度地图', params: {} }],
      limitations: ['历史观测不代表实时位置。'],
    })

    render(<MemoryRouter><CatIntel /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText('问地点、猫或寻猫路线...'), { target: { value: '现在去哪里？' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() => expect(api.askCatIntel).toHaveBeenCalledWith('现在去哪里？', expect.objectContaining({ client_time: expect.any(String) })))
    expect(await screen.findByText('光草近 14 天记录较多。')).toBeInTheDocument()
    expect(screen.getByText('近14天已审核观测 4 条')).toBeInTheDocument()
    expect(screen.getByText('语言模型 + 工具')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看热度地图' })).toBeInTheDocument()
  })
})
