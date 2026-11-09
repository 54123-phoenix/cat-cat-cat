import { afterEach, expect, it, vi } from 'vitest'
import { createSighting } from '../api'

afterEach(() => vi.unstubAllGlobals())

it('sends the retry identifier and all encounter fields in the multipart request', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1, status: 'pending' }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const file = new File(['photo'], 'cat.jpg', { type: 'image/jpeg' })
  await createSighting({ catId: 7, file, location: '图书馆', confidence: 0.72, activity_type: 'sleeping',
    weather: 'sunny', mood: 'happy', latitude: 31.3, longitude: 121.5,
    client_request_id: '4b2aca68-6a15-4c2e-b9d1-1e065315026b' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/sightings')
  expect(options.method).toBe('POST')
  const body = options.body as FormData
  expect(Object.fromEntries(body.entries())).toEqual({
    cat_id: '7', file, location: '图书馆', confidence: '0.72', activity_type: 'sleeping',
    weather: 'sunny', mood: 'happy', latitude: '31.3', longitude: '121.5',
    client_request_id: '4b2aca68-6a15-4c2e-b9d1-1e065315026b',
  })
})
