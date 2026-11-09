import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PawPrint } from 'lucide-react'
import { login, register, setToken } from '../api'
import Logo from '../components/illustrations/Logo'
import Wordmark from '../components/illustrations/Wordmark'

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
    <div className="min-h-screen max-w-[480px] mx-auto bg-warm-50 flex flex-col">
      {/* Hero section */}
      <div className="bg-gradient-to-b from-primary to-primary-hover px-6 pb-16 pt-16 relative overflow-hidden">
        <div className="absolute right-4 top-8 opacity-10">
          <PawPrint className="w-32 h-32 text-white" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <Logo size={64} />
            <div className="text-on-primary">
              <Wordmark size={28} className="block" />
              <h1 className="text-3xl font-extrabold text-on-primary mt-1">猫猫社区</h1>
            </div>
          </div>
          <p className="text-on-primary text-sm mt-2 opacity-80">
            {mode === 'login' ? '让每一只校园猫被看见' : '加入猫猫社区，开始记录'}
          </p>
        </div>
      </div>

      {/* Login card - overlaps hero */}
      <div className="relative z-10 flex-1 px-4 -mt-8">
        <div className="bg-card rounded-3xl p-6 shadow-lg space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-text">
              {mode === 'login' ? '欢迎回来' : '注册新账号'}
            </h2>
            <p className="text-sm text-text-secondary">
              {mode === 'login' ? '登录继续探索校园猫猫' : '创建账号加入猫猫社区'}
            </p>
          </div>

          {error && (
            <div role="alert" className="rounded-2xl border border-danger bg-card px-4 py-3 text-sm font-medium text-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="space-y-1 block">
              <span className="block text-sm font-medium text-text-secondary">用户名</span>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="ui-input"
                required
              />
            </label>

            <label className="space-y-1 block">
              <span className="block text-sm font-medium text-text-secondary">密码</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="ui-input"
                required
              />
            </label>

            {mode === 'register' && (
              <label className="space-y-1 block">
                <span className="block text-sm font-medium text-text-secondary">昵称</span>
                <input
                  type="text"
                  value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                  className="ui-input"
                  required
                />
              </label>
            )}

            <button type="submit" disabled={loading} className="clay-btn w-full text-on-primary disabled:opacity-60">
              {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary">
            {mode === 'login' ? '没有账号？' : '已有账号？'}
            <button onClick={toggle} className="text-primary font-bold ml-1">
              {mode === 'login' ? '去注册' : '去登录'}
            </button>
          </p>

          {import.meta.env.DEV && (
            <div className="text-center text-xs text-text-secondary space-y-1 pt-2 border-t border-border">
              <p>演示账号：demo（口令见后端 DEMO_PASSWORD 环境变量）</p>
              <p>管理员：admin（口令见后端 ADMIN_PASSWORD 环境变量）</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
