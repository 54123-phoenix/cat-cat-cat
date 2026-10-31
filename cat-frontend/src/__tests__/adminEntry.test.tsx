import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../App'

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '/admin')
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    if (url === '/api/admin/login') return new Response(JSON.stringify({ token: 'valid-admin' }))
    if (url === '/api/admin/me') {
      return options.headers.Authorization === 'Bearer valid-admin'
        ? new Response(JSON.stringify({ role: 'admin' }))
        : new Response(JSON.stringify({ detail: 'expired' }), { status: 401 })
    }
    if (url.startsWith('/api/cats') || url.startsWith('/api/sightings')) {
      return new Response(JSON.stringify({ items: [], total: 0, has_more: false }))
    }
    return new Response(JSON.stringify(url === '/api/admin/dashboard' ? {} : []))
  }))
})

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('opens the admin login without a token and supports login/logout', async () => {
  render(<App />)
  expect(await screen.findByRole('heading', { name: '猫协管理登录' })).toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
  fireEvent.change(screen.getByPlaceholderText('管理员口令'), { target: { value: 'test-only' } })
  fireEvent.click(screen.getByRole('button', { name: '进入管理台' }))
  expect(await screen.findByRole('heading', { name: '管理台' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '退出' }))
  expect(await screen.findByRole('heading', { name: '猫协管理登录' })).toBeInTheDocument()
  expect(localStorage.getItem('admin_token')).toBeNull()
})

it('returns an expired admin token to an operable login page', async () => {
  localStorage.setItem('admin_token', 'expired')
  render(<App />)
  expect(await screen.findByText('登录已过期')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '进入管理台' })).toBeInTheDocument()
  expect(localStorage.getItem('admin_token')).toBeNull()
})

it('does not use a normal-user token to open the admin dashboard', async () => {
  localStorage.setItem('token', 'ordinary-user')
  render(<App />)
  expect(await screen.findByRole('heading', { name: '猫协管理登录' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '管理台' })).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})

it.each(['network', '503'])('keeps admin credentials after %s failure and retries verification', async (failure) => {
  localStorage.setItem('admin_token', 'valid-admin')
  const normalFetch = vi.mocked(fetch).getMockImplementation()!
  let failed = true
  vi.mocked(fetch).mockImplementation(async (...args) => {
    if (args[0] === '/api/admin/me' && failed) {
      if (failure === 'network') throw new TypeError('Failed to fetch')
      return new Response(JSON.stringify({ detail: 'unavailable' }), { status: 503 })
    }
    return normalFetch(...args)
  })
  render(<App />)
  expect(await screen.findByRole('alert')).toHaveTextContent('暂时无法验证管理身份')
  expect(localStorage.getItem('admin_token')).toBe('valid-admin')
  expect(screen.queryByRole('heading', { name: '管理台' })).not.toBeInTheDocument()
  failed = false
  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  expect(await screen.findByRole('heading', { name: '管理台' })).toBeInTheDocument()
})

it.each([
  ['通过', 'approve', '已通过'],
  ['拒绝', 'reject', '已拒绝'],
])('reviews a pending sighting with %s and does not claim success on failure', async (label, action, result) => {
  localStorage.setItem('admin_token', 'valid-admin')
  localStorage.setItem('token', 'ordinary-user')
  const normalFetch = vi.mocked(fetch).getMockImplementation()!
  let status = 'pending'
  let fail = true
  vi.mocked(fetch).mockImplementation(async (...args) => {
    if (String(args[0]).startsWith('/api/sightings?')) {
      return new Response(JSON.stringify({ items: [{ id: 8, status, location_name: '审核地点' }], total: 1, has_more: false }))
    }
    if (args[0] === '/api/admin/sightings/8/review') {
      expect(args[1]?.headers).toMatchObject({ Authorization: 'Bearer valid-admin' })
      expect(JSON.parse(args[1]?.body as string)).toEqual({ action })
      if (fail) return new Response(JSON.stringify({ detail: '审核服务暂不可用' }), { status: 503 })
      status = action === 'approve' ? 'approved' : 'rejected'
      return new Response(JSON.stringify({ ok: true, status }))
    }
    return normalFetch(...args)
  })
  render(<App />)
  expect(await screen.findByRole('heading', { name: '管理台' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '偶遇' }))
  fireEvent.click(await screen.findByRole('button', { name: label }))
  expect(await screen.findByText('审核服务暂不可用')).toBeInTheDocument()
  expect(screen.getByText('待审核', { exact: true })).toBeInTheDocument()
  expect(screen.queryByText('偶遇已通过审核，现已公开')).not.toBeInTheDocument()
  expect(screen.queryByText('偶遇已拒绝，未公开')).not.toBeInTheDocument()
  fail = false
  fireEvent.click(await screen.findByRole('button', { name: label }))
  expect(await screen.findByText(result, { exact: true })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
})
