import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as api from '../api'

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
})
afterEach(() => vi.unstubAllGlobals())

const operations = [
  () => api.createCat({ name: 'cat' }),
  () => api.updateCat(1, { name: 'cat' }),
  () => api.deleteCat(1),
  () => api.uploadCatImage(1, new File(['image'], 'cat.png')),
  () => api.getReports(),
  () => api.handleReport(1, 'dismiss'),
  () => api.createHealthRecord(1, {}),
  () => api.deleteHealthRecord(1, 2),
  () => api.createFeedingPoint({}),
  () => api.deleteFeedingPoint(1),
  () => api.reviewSighting(1, 'approve'),
  () => api.reviewSighting(1, 'reject'),
]

it.each([false, true])('admin operations use admin credentials with user-token=%s', async (withUser) => {
  localStorage.setItem('admin_token', 'admin-test')
  if (withUser) localStorage.setItem('token', 'user-test')
  for (const operation of operations) {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}'))
    await operation()
    expect(fetch).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer admin-test' }),
    }))
  }
})

it('never falls back to the user token for an admin operation', async () => {
  localStorage.setItem('token', 'user-test')
  await api.createCat({})
  expect(vi.mocked(fetch).mock.calls[0][1]?.headers).not.toHaveProperty('Authorization')
})

it('revokes only the admin session on an expired admin operation and signals the UI', async () => {
  localStorage.setItem('token', 'user-test')
  localStorage.setItem('admin_token', 'expired-admin')
  const listener = vi.fn()
  window.addEventListener(api.ADMIN_AUTH_EXPIRED, listener)
  vi.mocked(fetch).mockResolvedValueOnce(new Response('{"detail":"expired"}', { status: 401 }))
  await expect(api.createFeedingPoint({})).rejects.toThrow('expired')
  expect(localStorage.getItem('admin_token')).toBeNull()
  expect(localStorage.getItem('token')).toBe('user-test')
  expect(listener).toHaveBeenCalledOnce()
  window.removeEventListener(api.ADMIN_AUTH_EXPIRED, listener)
})

it('keeps ordinary requests in the user context when both tokens exist', async () => {
  localStorage.setItem('token', 'user-test')
  localStorage.setItem('admin_token', 'admin-test')
  await api.getMe()
  expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
    headers: expect.objectContaining({ Authorization: 'Bearer user-test' }),
  }))
})

it('loads all moderation statuses with the admin context', async () => {
  localStorage.setItem('admin_token', 'admin-test')
  localStorage.setItem('token', 'ordinary-user')
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: 1, status: 'pending' }], total: 1, has_more: false })))
  expect(await api.getAdminSightings({ limit: 20 })).toEqual([{ id: 1, status: 'pending' }])
  expect(fetch).toHaveBeenCalledWith('/api/sightings?status=all&limit=20', expect.objectContaining({
    headers: expect.objectContaining({ Authorization: 'Bearer admin-test' }),
  }))
})

it('does not erase a newer login when an older request returns 401', async () => {
  localStorage.setItem('admin_token', 'old-login')
  let respond: (response: Response) => void
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { respond = resolve }))
  const pending = api.getAdminMe()
  localStorage.setItem('admin_token', 'new-login')
  respond(new Response('{"detail":"expired"}', { status: 401 }))
  await expect(pending).rejects.toThrow('expired')
  expect(localStorage.getItem('admin_token')).toBe('new-login')
})
