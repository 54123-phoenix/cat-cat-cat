import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register, setToken } from '../api'

export default function Login({ onLogin }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', password: '', nickname: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const fn = mode === 'login' ? login : register
      const data = mode === 'login'
        ? { username: form.username, password: form.password }
        : { username: form.username, password: form.password, nickname: form.nickname }
      const res = await fn(data)
      setToken(res.token, res.user)
      onLogin(res.user)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggle = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
  }

  return (
    <div className="min-h-screen max-w-[480px] mx-auto bg-warm-50 flex flex-col items-center justify-center px-6">
      <div className="w-full clay-card p-6 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-display font-bold text-text">猫猫社区</h1>
          <p className="text-sm text-text-secondary">
            {mode === 'login' ? '登录以继续' : '注册新账号'}
          </p>
        </div>

        {error && (
          <div className="rounded-2xl px-4 py-3 text-sm font-bold bg-red-50 text-red-500">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="space-y-1 block">
            <span className="block text-xs font-bold text-text-secondary">用户名</span>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full rounded-2xl border-2 border-border bg-card px-3 py-3 text-sm text-text outline-none"
              required
            />
          </label>

          <label className="space-y-1 block">
            <span className="block text-xs font-bold text-text-secondary">密码</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-2xl border-2 border-border bg-card px-3 py-3 text-sm text-text outline-none"
              required
            />
          </label>

          {mode === 'register' && (
            <label className="space-y-1 block">
              <span className="block text-xs font-bold text-text-secondary">昵称</span>
              <input
                type="text"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                className="w-full rounded-2xl border-2 border-border bg-card px-3 py-3 text-sm text-text outline-none"
                required
              />
            </label>
          )}

          <button type="submit" disabled={loading} className="clay-btn w-full disabled:opacity-60">
            {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          {mode === 'login' ? '没有账号？' : '已有账号？'}
          <button onClick={toggle} className="text-primary font-bold ml-1">
            {mode === 'login' ? '去注册' : '去登录'}
          </button>
        </p>

        <div className="text-center text-xs text-text-secondary space-y-1">
          <p>演示账号：demo / demo123</p>
          <p>管理员：admin / cat-admin</p>
        </div>
      </div>
    </div>
  )
}
