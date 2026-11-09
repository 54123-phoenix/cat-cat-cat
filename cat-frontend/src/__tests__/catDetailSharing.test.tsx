import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import CatIdentityCard from '../components/CatIdentityCard'
import SharePoster from '../components/SharePoster'
import type { Cat } from '../types'

vi.mock('../components/ShareArtifact', () => ({ default: ({ proof, children }) => <div data-testid="share-proof">{proof}{children}</div> }))
vi.mock('../components/ShareSheet', () => ({ default: () => <div role="dialog" aria-label="分享面板" /> }))
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('') } }))
afterEach(cleanup)
const cat = { id: 1, name: '皮球', images: [] } as Cat

it('does not invent a zero sighting count in identity share proof', () => {
  render(<CatIdentityCard cat={cat} />)
  expect(screen.getByTestId('share-proof')).toHaveTextContent('校园观察员')
  expect(screen.getByTestId('share-proof')).not.toHaveTextContent(/0|已被记录|偶遇记录/)
})

it('labels a loaded sample count separately from a lifetime total', () => {
  render(<CatIdentityCard cat={cat} sightingCount={100} sightingCountLabel="已加载偶遇记录" />)
  expect(screen.getByTestId('share-proof')).toHaveTextContent('已加载偶遇记录 100 条')
  expect(screen.queryByText(/已被记录/)).not.toBeInTheDocument()
})

it('uses one native share trigger and preserves the child click handler', () => {
  const click = vi.fn()
  render(<SharePoster type="cat" data={{ name: '皮球' }}><button onClick={click}>分享猫卡</button></SharePoster>)
  const triggers = screen.getAllByRole('button')
  expect(triggers).toHaveLength(1)
  expect(triggers[0].tagName).toBe('BUTTON')
  expect(triggers[0]).toHaveAttribute('type', 'button')
  fireEvent.click(triggers[0])
  expect(click).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('dialog', { name: '分享面板' })).toBeVisible()
})

it('respects a share trigger that prevents its click action', () => {
  render(<SharePoster type="cat" data={{ name: '皮球' }}><button onClick={event => event.preventDefault()}>分享猫卡</button></SharePoster>)
  fireEvent.click(screen.getByRole('button', { name: '分享猫卡' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
