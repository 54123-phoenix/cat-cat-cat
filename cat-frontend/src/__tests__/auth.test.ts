import { describe, it, expect, beforeEach } from 'vitest'

describe('Auth flow - localStorage token lifecycle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('login stores token, logout clears it', async () => {
    const { setToken, getToken, clearToken } = await import('../api')
    setToken('jwt-abc123', { id: 1, nickname: '猫友', role: 'user' })
    expect(getToken()).toBe('jwt-abc123')
    clearToken()
    expect(getToken()).toBeNull()
  })

  it('admin login stores separate admin token', async () => {
    const { setAdminToken, getAdminToken, clearAdminToken } = await import('../api')
    setAdminToken('admin-jwt')
    expect(getAdminToken()).toBe('admin-jwt')
    clearAdminToken()
    expect(getAdminToken()).toBeNull()
  })

  it('user and admin tokens are independent', async () => {
    const { setToken, getToken, setAdminToken, getAdminToken } = await import('../api')
    setToken('user-t', null)
    setAdminToken('admin-t')
    expect(getToken()).toBe('user-t')
    expect(getAdminToken()).toBe('admin-t')
  })
})
