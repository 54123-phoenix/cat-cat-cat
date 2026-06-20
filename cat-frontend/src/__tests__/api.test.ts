import { describe, it, expect, beforeEach } from 'vitest'

describe('api client - localStorage operations', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('setToken stores token and user', async () => {
    const mod = await import('../api')
    mod.setToken('test-token', { id: 1, nickname: 'test' })
    expect(localStorage.getItem('token')).toBe('test-token')
    expect(JSON.parse(localStorage.getItem('user') || '{}')).toEqual({ id: 1, nickname: 'test' })
  })

  it('getToken returns stored token', async () => {
    localStorage.setItem('token', 'my-token')
    const mod = await import('../api')
    expect(mod.getToken()).toBe('my-token')
  })

  it('clearToken removes token and user', async () => {
    localStorage.setItem('token', 't')
    localStorage.setItem('user', '{}')
    const mod = await import('../api')
    mod.clearToken()
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('getStoredUser parses stored user JSON', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, nickname: 'cat' }))
    const mod = await import('../api')
    expect(mod.getStoredUser()).toEqual({ id: 1, nickname: 'cat' })
  })

  it('getStoredUser returns null on invalid JSON', async () => {
    localStorage.setItem('user', 'not-json')
    const mod = await import('../api')
    expect(mod.getStoredUser()).toBeNull()
  })

  it('admin token operations work correctly', async () => {
    const mod = await import('../api')
    mod.setAdminToken('admin-t')
    expect(mod.getAdminToken()).toBe('admin-t')
    mod.clearAdminToken()
    expect(mod.getAdminToken()).toBeNull()
  })
})

describe('auth flow - token lifecycle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('login stores token, logout clears it', async () => {
    const mod = await import('../api')
    mod.setToken('jwt-abc123', { id: 1, nickname: '猫友', role: 'user' })
    expect(mod.getToken()).toBe('jwt-abc123')
    mod.clearToken()
    expect(mod.getToken()).toBeNull()
  })

  it('user and admin tokens are independent', async () => {
    const mod = await import('../api')
    mod.setToken('user-t', null)
    mod.setAdminToken('admin-t')
    expect(mod.getToken()).toBe('user-t')
    expect(mod.getAdminToken()).toBe('admin-t')
  })
})
