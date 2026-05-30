import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminLogin, clearAdminToken, createCat, getAdminMe, getAdminToken, getCat, getCats, getDiscoveries, getSightings, reviewDiscovery, updateCat, uploadCatImage } from '../api'

const emptyForm = {
  name: '',
  nickname: '',
  gender: '',
  neutered: '',
  age_estimate: '',
  color: '',
  personality: '',
  story: '',
  location: '',
  avatar: '',
}

function formatTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Field({ label, name, value, onChange, textarea = false }) {
  const className = 'w-full rounded-2xl border-2 border-border bg-card px-3 py-2 text-sm text-text outline-none'

  return (
    <label className="space-y-1">
      <span className="block text-xs font-bold text-text-secondary">{label}</span>
      {textarea ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          rows={3}
          className={className}
        />
      ) : (
        <input
          name={name}
          value={value}
          onChange={onChange}
          className={className}
        />
      )}
    </label>
  )
}

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(Boolean(getAdminToken()))
  const [password, setPassword] = useState('')
  const [cats, setCats] = useState([])
  const [discoveries, setDiscoveries] = useState([])
  const [sightings, setSightings] = useState([])
  const [selectedCatId, setSelectedCatId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [imageFile, setImageFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadData = () => {
    setLoading(true)
    Promise.all([getCats(), getSightings({ limit: 8 }), getDiscoveries({ status: 'pending', limit: 20 })])
      .then(([catsData, sightingsData, discoveryData]) => {
        setCats(catsData)
        setSightings(sightingsData)
        setDiscoveries(discoveryData)
      })
      .catch((err) => setError(err.message || '后台数据加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!authenticated) {
      setLoading(false)
      return
    }

    getAdminMe()
      .then(loadData)
      .catch(() => {
        clearAdminToken()
        setAuthenticated(false)
        setError('登录已过期，请重新登录')
        setLoading(false)
      })
  }, [authenticated])

  const handleLogin = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await adminLogin(password)
      setPassword('')
      setAuthenticated(true)
      setMessage('猫协管理员登录成功')
    } catch (err) {
      setError(err.message || '登录失败')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    clearAdminToken()
    setAuthenticated(false)
    resetForm()
    setCats([])
    setSightings([])
    setMessage('已退出猫协管理模式')
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const selectCat = async (cat) => {
    setSelectedCatId(cat.id)
    setError('')
    setMessage('')

    let catDetail = cat
    try {
      catDetail = await getCat(cat.id)
    } catch (err) {
      setError(err.message || '猫档案详情加载失败')
    }

    setForm({
      name: catDetail.name || '',
      nickname: catDetail.nickname || '',
      gender: catDetail.gender || '',
      neutered: catDetail.neutered || '',
      age_estimate: catDetail.age_estimate || '',
      color: catDetail.color || '',
      personality: catDetail.personality || '',
      story: catDetail.story || '',
      location: catDetail.location || '',
      avatar: catDetail.avatar || '',
    })
    setImageFile(null)
  }

  const resetForm = (keepFeedback = false) => {
    setSelectedCatId(null)
    setForm(emptyForm)
    setImageFile(null)
    if (!keepFeedback) {
      setMessage('')
      setError('')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    try {
      if (!form.name.trim()) {
        throw new Error('猫猫名字不能为空')
      }

      const payload = {
        ...form,
        name: form.name.trim(),
      }

      const savedCat = selectedCatId
        ? await updateCat(selectedCatId, payload)
        : await createCat(payload)

      if (imageFile) {
        await uploadCatImage(savedCat.id, imageFile)
      }

      const successMessage = selectedCatId ? '猫档案已更新' : '新猫档案已创建'
      resetForm(true)
      setMessage(successMessage)
      loadData()
    } catch (err) {
      setError(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscoveryReview = async (discovery, action) => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await reviewDiscovery(discovery.id, {
        action,
        name: discovery.suggested_name || '新朋友',
        color: discovery.suggested_color || '',
        note: discovery.note || discovery.ai_summary || '',
      })
      setMessage(action === 'approve' ? '新猫已建档，并已发放发现者勋章' : '线索已拒绝')
      loadData()
    } catch (err) {
      setError(err.message || '审核失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="space-y-5">
        <header className="clay-card p-5 space-y-2">
          <Link to="/profile" className="text-sm font-bold text-text-secondary">
            ← 返回普通模式
          </Link>
          <div>
            <h1 className="text-2xl font-display font-bold text-text">猫协管理登录</h1>
            <p className="text-sm text-text-secondary mt-1">请输入猫协管理员口令后维护档案</p>
          </div>
        </header>

        {(message || error) && (
          <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-500' : 'bg-green-50 text-success'}`}>
            {error || message}
          </div>
        )}

        <form onSubmit={handleLogin} className="clay-card p-5 space-y-4">
          <label className="space-y-1 block">
            <span className="block text-xs font-bold text-text-secondary">管理员口令</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border-2 border-border bg-card px-3 py-3 text-sm text-text outline-none"
              placeholder="默认 cat-admin，可通过 .env 修改"
            />
          </label>
          <button type="submit" disabled={saving || !password.trim()} className="clay-btn w-full disabled:opacity-60">
            {saving ? '登录中...' : '进入管理台'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="clay-card p-5 space-y-2">
        <Link to="/profile" className="text-sm font-bold text-text-secondary">
          ← 返回普通模式
        </Link>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-text">猫协管理台</h1>
            <p className="text-sm text-text-secondary">维护猫档案、参考照片和偶遇记录</p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button onClick={resetForm} className="text-xs font-bold text-primary bg-primary-light px-3 py-2 rounded-full">
              新增猫
            </button>
            <button onClick={handleLogout} className="text-xs font-bold text-text-secondary bg-card px-3 py-2 rounded-full border border-border">
              退出
            </button>
          </div>
        </div>
      </header>

      {(message || error) && (
        <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-500' : 'bg-green-50 text-success'}`}>
          {error || message}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-display font-bold text-lg text-text">新猫发现审核</h2>
        {discoveries.length > 0 ? (
          <div className="space-y-3">
            {discoveries.map((discovery) => (
              <article key={discovery.id} className="clay-card p-4 space-y-3">
                <div className="flex gap-3">
                  <div className="w-20 h-20 rounded-2xl bg-primary-light overflow-hidden shrink-0 flex items-center justify-center text-2xl">
                    {discovery.image_path ? <img src={discovery.image_path} alt="新猫线索" className="w-full h-full object-cover" /> : '🐾'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-text">{discovery.suggested_name || '新猫线索'} · {discovery.suggested_color || '待确认'}</p>
                    <p className="text-xs text-text-secondary mt-1">📍 {discovery.location_name || '未知地点'}</p>
                    <p className="text-xs text-text-secondary mt-1">AI 置信度 {Math.round((discovery.ai_confidence || 0) * 100)}%</p>
                  </div>
                </div>
                <p className="text-sm text-text-secondary">{discovery.ai_summary}</p>
                {discovery.note && <p className="text-xs text-text-secondary">用户备注：“{discovery.note}”</p>}
                <div className="grid grid-cols-2 gap-2">
                  <button disabled={saving} onClick={() => handleDiscoveryReview(discovery, 'approve')} className="rounded-full bg-primary text-white py-2 text-sm font-bold disabled:opacity-60">
                    通过并建档
                  </button>
                  <button disabled={saving} onClick={() => handleDiscoveryReview(discovery, 'reject')} className="rounded-full border border-border text-text-secondary py-2 text-sm font-bold disabled:opacity-60">
                    拒绝
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="clay-card p-5 text-sm text-text-secondary text-center">暂无待审核新猫线索</div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-bold text-lg text-text">猫档案列表</h2>
        <div className="grid grid-cols-2 gap-3">
          {cats.map((cat) => (
            <button
              key={cat.id}
              onClick={() => selectCat(cat)}
              className={`clay-card p-3 text-left active:scale-97 transition-transform ${selectedCatId === cat.id ? 'ring-2 ring-primary' : ''}`}
            >
              <p className="font-bold text-text truncate">{cat.name}</p>
              <p className="text-xs text-text-secondary truncate">{cat.nickname || cat.location || '未填写档案'}</p>
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="clay-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-text">
            {selectedCatId ? '编辑猫档案' : '新增猫档案'}
          </h2>
          {selectedCatId && (
            <Link to={`/cats/${selectedCatId}`} className="text-sm font-bold text-primary">
              预览
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="名字" name="name" value={form.name} onChange={handleChange} />
          <Field label="昵称" name="nickname" value={form.nickname} onChange={handleChange} />
          <Field label="性别" name="gender" value={form.gender} onChange={handleChange} />
          <Field label="绝育" name="neutered" value={form.neutered} onChange={handleChange} />
          <Field label="年龄估计" name="age_estimate" value={form.age_estimate} onChange={handleChange} />
          <Field label="毛色" name="color" value={form.color} onChange={handleChange} />
          <Field label="常出没地点" name="location" value={form.location} onChange={handleChange} />
          <Field label="头像路径" name="avatar" value={form.avatar} onChange={handleChange} />
        </div>

        <Field label="性格标签" name="personality" value={form.personality} onChange={handleChange} />
        <Field label="猫猫故事" name="story" value={form.story} onChange={handleChange} textarea />

        <label className="space-y-1 block">
          <span className="block text-xs font-bold text-text-secondary">上传参考照片</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setImageFile(event.target.files?.[0] || null)}
            className="w-full text-sm text-text-secondary"
          />
        </label>

        <button type="submit" disabled={saving} className="clay-btn w-full disabled:opacity-60">
          {saving ? '保存中...' : '保存档案'}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-display font-bold text-lg text-text">最近偶遇记录</h2>
        <div className="space-y-3">
          {sightings.map((sighting) => (
            <article key={sighting.id} className="clay-card p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-text">{sighting.cat?.name || '校园猫猫'}</p>
                <span className="text-xs text-text-secondary">{formatTime(sighting.created_at)}</span>
              </div>
              <p className="text-sm text-text-secondary mt-1">
                {sighting.location_name || sighting.location || '校园某处'}
              </p>
              {sighting.note && (
                <p className="text-xs text-text-secondary mt-1">“{sighting.note}”</p>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
