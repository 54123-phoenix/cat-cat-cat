import { act, renderHook, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { useInfiniteSightings, useInfiniteGallery, useInfinitePosts } from '../hooks/useApi'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it.each([useInfiniteSightings, useInfiniteGallery, useInfinitePosts])('loads three distinct pages and stops at has_more=false (%#)', async (useList) => {
  const offsets: number[] = []
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const skip = Number(new URL(url, 'http://test').searchParams.get('skip'))
    offsets.push(skip)
    const items = Array.from({ length: Math.min(20, 45-skip) }, (_, i) => ({ id: skip+i }))
    return new Response(JSON.stringify({ items, total: 45, has_more: skip+20 < 45 }))
  }))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result } = renderHook(() => {
    const query = useList()
    return { data: query.data, isSuccess: query.isSuccess, fetchNextPage: query.fetchNextPage, hasNextPage: query.hasNextPage }
  }, { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  await act(async () => { await result.current.fetchNextPage() })
  await act(async () => { await result.current.fetchNextPage() })
  expect(offsets).toEqual([0, 20, 40])
  await waitFor(() => expect(result.current.data?.pages).toHaveLength(3))
  expect(new Set(result.current.data?.pages.flatMap(page => page.items.map(item => item.id))).size).toBe(45)
  expect(result.current.hasNextPage).toBe(false)
})
