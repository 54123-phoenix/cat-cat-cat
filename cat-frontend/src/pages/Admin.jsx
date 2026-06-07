import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminLogin, clearAdminToken, createCat, getAdminMe, getAdminToken, getCat, getCats, getDiscoveries, getSightings, reviewDiscovery, updateCat, uploadCatImage, getReports, handleReport, getHealthRecords, createHealthRecord, deleteHealthRecord, getFeedingPoints, createFeedingPoint, deleteFeedingPoint } from '../api'

const emptyForm = {
  name: '', nickname: '', gender: '', neutered: '', age_estimate: '',
  color: '', personality: '', story: '', location: '', avatar: '',
}

function formatTime(v) {
  if (!v) return ''
  return new Date(v).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDate(v) {
  if (!v) return ''
  return new Date(v).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function Field({ label, name, value, onChange, textarea = false }) {
  const cls = 'w-full rounded-2xl border-2 border-border bg-card px-3 py-2 text-sm text-text outline-none'
  return (
    <label className="space-y-1">
      <span className="block text-xs font-bold text-text-secondary">{label}</span>
      {textarea ? <textarea name={name} value={value} onChange={onChange} rows={3} className={cls} />
        : <input name={name} value={value} onChange={onChange} className={cls} />}
    </label>
  )
}

const RECORD_TYPES = [
  { value: 'vaccine', label: '💉 疫苗' },
  { value: 'deworm', label: '🪱 驱虫' },
  { value: 'sterilization', label: '✂️ 绝育' },
  { value: 'injury', label: '🩹 伤病' },
  { value: 'illness', label: '🤒 疾病' },
  { value: 'checkup', label: '🏥 体检' },
]

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(Boolean(getAdminToken()))
  const [password, setPassword] = useState('')
  const [cats, setCats] = useState([])
  const [discoveries, setDiscoveries] = useState([])
  const [sightings, setSightings] = useState([])
  const [reports, setReports] = useState([])
  const [healthRecords, setHealthRecords] = useState([])
  const [feedingPoints, setFeedingPoints] = useState([])
  const [selectedCatId, setSelectedCatId] = useState(null)
  const [catHealthForm, setCatHealthForm] = useState({ record_type: 'vaccine', title: '', description: '', record_date: '', location: '' })
  const [feedingForm, setFeedingForm] = useState({ name: '', description: '', latitude: '', longitude: '' })
  const [form, setForm] = useState(emptyForm)
  const [imageFile, setImageFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadData = () => {
    setLoading(true)
    Promise.all([getCats(), getSightings({ limit: 8 }), getDiscoveries({ status: 'pending', limit: 20 }), getReports({ status: 'pending', limit: 20 }), getFeedingPoints()])
      .then(([catsData, sightingsData, discoveryData, reportsData, feedingData]) => {
        setCats(catsData)
        setSightings(sightingsData)
        setDiscoveries(discoveryData)
        setReports(reportsData)
        setFeedingPoints(feedingData)
      })
      .catch((err) => setError(err.message || '后台数据加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!authenticated) { setLoading(false); return }
    getAdminMe().then(loadData).catch(() => { clearAdminToken(); setAuthenticated(false); setError('登录已过期'); setLoading(false) })
  }, [authenticated])

  const handleLogin = async (e) => {
    e.preventDefault(); setSaving(true); setError('')
    try { await adminLogin(password); setPassword(''); setAuthenticated(true); setMessage('猫协管理员登录成功') }
    catch (err) { setError(err.message || '登录失败') }
    finally { setSaving(false) }
  }

  const handleLogout = () => {
    clearAdminToken(); setAuthenticated(false); resetForm(); setCats([]); setSightings([]); setMessage('已退出')
  }

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const selectCat = async (cat) => {
    setSelectedCatId(cat.id); setError(''); setMessage('')
    try {
      const detail = await getCat(cat.id)
      setForm({
        name: detail.name || '', nickname: detail.nickname || '', gender: detail.gender || '',
        neutered: detail.neutered || '', age_estimate: detail.age_estimate || '',
        color: detail.color || '', personality: detail.personality || '', story: detail.story || '',
        location: detail.location || '', avatar: detail.avatar || '',
      })
      const health = await getHealthRecords(cat.id)
      setHealthRecords(health)
    } catch (err) { setError(err.message || '加载失败') }
    setImageFile(null)
  }

  const resetForm = (keep = false) => {
    setSelectedCatId(null); setForm(emptyForm); setImageFile(null); setHealthRecords([]); setCatHealthForm({ record_type: 'vaccine', title: '', description: '', record_date: '', location: '' })
    if (!keep) { setMessage(''); setError('') }
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setMessage(''); setError('')
    try {
      if (!form.name.trim()) throw new Error('猫猫名字不能为空')
      const saved = selectedCatId ? await updateCat(selectedCatId, form) : await createCat(form)
      if (imageFile) await uploadCatImage(saved.id, imageFile)
      setMessage(selectedCatId ? '猫档案已更新' : '新猫档案已创建')
      resetForm(true); loadData()
    } catch (err) { setError(err.message || '保存失败') }
    finally { setSaving(false) }
  }

  const handleDiscoveryReview = async (discovery, action) => {
    setSaving(true); setError(''); setMessage('')
    try {
      await reviewDiscovery(discovery.id, { action, name: discovery.suggested_name || '新朋友', color: discovery.suggested_color || '', note: discovery.note || discovery.ai_summary || '' })
      setMessage(action === 'approve' ? '新猫已建档，并已发放发现者勋章' : '线索已拒绝'); loadData()
    } catch (err) { setError(err.message || '审核失败') }
    finally { setSaving(false) }
  }

  async function handleAddHealthRecord() {
    setSaving(true); setError('')
    try {
      await createHealthRecord(selectedCatId, {
        ...catHealthForm,
        record_date: catHealthForm.record_date || new Date().toISOString(),
      })
      setCatHealthForm({ record_type: 'vaccine', title: '', description: '', record_date: '', location: '' })
      const health = await getHealthRecords(selectedCatId)
      setHealthRecords(health)
      setMessage('健康记录已添加')
    } catch (err) { setError(err.message || '添加失败') }
    finally { setSaving(false) }
  }

  async function handleDeleteHealthRecord(recordId) {
    if (!confirm('确定删除这条健康记录？')) return
    try {
      await deleteHealthRecord(selectedCatId, recordId)
      const health = await getHealthRecords(selectedCatId)
      setHealthRecords(health)
      setMessage('健康记录已删除')
    } catch (err) { setError(err.message || '删除失败') }
  }

  async function handleAddFeedingPoint() {
    setSaving(true); setError('')
    try {
      await createFeedingPoint({
        name: feedingForm.name,
        description: feedingForm.description,
        latitude: parseFloat(feedingForm.latitude),
        longitude: parseFloat(feedingForm.longitude),
      })
      setFeedingForm({ name: '', description: '', latitude: '', longitude: '' })
      const pts = await getFeedingPoints()
      setFeedingPoints(pts)
      setMessage('喂食点已添加')
    } catch (err) { setError(err.message || '添加失败') }
    finally { setSaving(false) }
  }

  async function handleDeleteFeedingPoint(id) {
    if (!confirm('确定删除这个喂食点？')) return
    try {
      await deleteFeedingPoint(id)
      const pts = await getFeedingPoints()
      setFeedingPoints(pts)
      setMessage('喂食点已删除')
    } catch (err) { setError(err.message || '删除失败') }
  }

  if (loading) return <div className="flex items-center justify-center h-[calc(100vh-8rem)]"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>

  if (!authenticated) {
    return (
      <div className="space-y-5 p-4">
        <div className="card p-5 space-y-2">
          <Link to="/profile" className="text-sm font-bold text-text-secondary">← 返回普通模式</Link>
          <h1 className="text-2xl font-bold text-text">猫协管理登录</h1>
          <p className="text-sm text-text-secondary mt-1">请输入猫协管理员口令后维护档案</p>
        </div>
        {(message || error) && <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-500' : 'bg-green-50 text-success'}`}>{error || message}</div>}
        <form onSubmit={handleLogin} className="card p-5 space-y-4">
          <label className="space-y-1 block">
            <span className="block text-xs font-bold text-text-secondary">管理员口令</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-2xl border-2 border-border bg-card px-3 py-3 text-sm text-text outline-none" placeholder="默认 cat-admin" />
          </label>
          <button type="submit" disabled={saving || !password.trim()} className="btn btn-primary w-full disabled:opacity-60">{saving ? '登录中...' : '进入管理台'}</button>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4">
      <header className="card p-5 space-y-2">
        <Link to="/profile" className="text-sm font-bold text-text-secondary">← 返回普通模式</Link>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text">猫协管理台</h1>
            <p className="text-sm text-text-secondary">维护猫档案、健康记录、喂食点和社区</p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button onClick={resetForm} className="btn btn-primary btn-sm">新增猫</button>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm">退出</button>
          </div>
        </div>
      </header>

      {(message || error) && <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-500' : 'bg-green-50 text-success'}`}>{error || message}</div>}

      {/* Reports */}
      <section className="space-y-3">
        <h2 className="font-bold text-lg text-text">举报审核</h2>
        {reports.length > 0 ? reports.map((r) => (
          <article key={r.id} className="card space-y-3">
            <p className="text-sm font-bold text-text truncate">{r.post_title || '帖子'}</p>
            <p className="text-xs text-text-secondary">举报原因：{r.reason} · 举报人 ID：{r.reported_by}</p>
            <div className="grid grid-cols-2 gap-2">
              <button disabled={saving} onClick={() => handleReport(r.id, 'dismiss').then(loadData).catch((e) => setError(e.message))} className="btn btn-ghost btn-sm">驳回举报</button>
              <button disabled={saving} onClick={() => handleReport(r.id, 'hide').then(loadData).catch((e) => setError(e.message))} className="btn btn-danger btn-sm">隐藏帖子</button>
            </div>
          </article>
        )) : <div className="card p-5 text-sm text-text-secondary text-center">暂无待处理举报</div>}
      </section>

      {/* Discoveries */}
      <section className="space-y-3">
        <h2 className="font-bold text-lg text-text">新猫发现审核</h2>
        {discoveries.length > 0 ? discoveries.map((d) => (
          <article key={d.id} className="card space-y-3">
            <div className="flex gap-3">
              <div className="w-20 h-20 rounded-2xl bg-primary-light overflow-hidden shrink-0 flex items-center justify-center text-2xl">
                {d.image_path ? <img src={d.image_path} alt="" className="w-full h-full object-cover" /> : '🐾'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-text">{d.suggested_name || '新猫线索'} · {d.suggested_color || '待确认'}</p>
                <p className="text-xs text-text-secondary mt-1">📍 {d.location_name || '未知地点'}</p>
                <p className="text-xs text-text-secondary">AI 置信度 {Math.round((d.ai_confidence || 0) * 100)}%</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary">{d.ai_summary}</p>
            {d.note && <p className="text-xs text-text-secondary">用户备注：“{d.note}”</p>}
            <div className="grid grid-cols-2 gap-2">
              <button disabled={saving} onClick={() => handleDiscoveryReview(d, 'approve')} className="btn btn-primary btn-sm">通过并建档</button>
              <button disabled={saving} onClick={() => handleDiscoveryReview(d, 'reject')} className="btn btn-ghost btn-sm">拒绝</button>
            </div>
          </article>
        )) : <div className="card p-5 text-sm text-text-secondary text-center">暂无待审核新猫线索</div>}
      </section>

      {/* Cat list + edit */}
      <section className="space-y-3">
        <h2 className="font-bold text-lg text-text">猫档案列表</h2>
        <div className="grid grid-cols-2 gap-3">
          {cats.map((cat) => (
            <button key={cat.id} onClick={() => selectCat(cat)}
              className={`card p-3 text-left active:scale-95 transition-transform ${selectedCatId === cat.id ? 'ring-2 ring-primary' : ''}`}>
              <p className="font-bold text-text truncate">{cat.name}</p>
              <p className="text-xs text-text-secondary truncate">{cat.nickname || cat.location || '未填写档案'}</p>
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg text-text">{selectedCatId ? '编辑猫档案' : '新增猫档案'}</h2>
          {selectedCatId && <Link to={`/cats/${selectedCatId}`} className="text-sm font-bold text-primary">预览</Link>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="名字" name="name" value={form.name} onChange={handleChange} />
          <Field label="昵称" name="nickname" value={form.nickname} onChange={handleChange} />
          <Field label="性别" name="gender" value={form.gender} onChange={handleChange} />
          <Field label="绝育" name="neutered" value={form.neutered} onChange={handleChange} />
          <Field label="年龄" name="age_estimate" value={form.age_estimate} onChange={handleChange} />
          <Field label="毛色" name="color" value={form.color} onChange={handleChange} />
          <Field label="常出没" name="location" value={form.location} onChange={handleChange} />
          <Field label="头像路径" name="avatar" value={form.avatar} onChange={handleChange} />
        </div>
        <Field label="性格" name="personality" value={form.personality} onChange={handleChange} />
        <Field label="故事" name="story" value={form.story} onChange={handleChange} textarea />
        <label className="space-y-1 block">
          <span className="block text-xs font-bold text-text-secondary">上传参考照片</span>
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="w-full text-sm text-text-secondary" />
        </label>
        <button type="submit" disabled={saving} className="btn btn-primary w-full disabled:opacity-60">{saving ? '保存中...' : '保存档案'}</button>
      </form>

      {/* Health records for selected cat */}
      {selectedCatId && (
        <section className="card space-y-4">
          <h2 className="font-bold text-lg text-text">健康记录</h2>
          {healthRecords.length > 0 ? healthRecords.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0">
              <div>
                <p className="text-sm font-bold text-text">{RECORD_TYPES.find(t => t.value === r.record_type)?.label || r.record_type} · {r.title}</p>
                {r.description && <p className="text-xs text-text-secondary">{r.description}</p>}
                <p className="text-[10px] text-text-muted">{formatDate(r.record_date)}{r.location ? ` · ${r.location}` : ''}</p>
              </div>
              <button onClick={() => handleDeleteHealthRecord(r.id)} className="text-xs text-red-400 shrink-0">删除</button>
            </div>
          )) : <p className="text-sm text-text-secondary">暂无健康记录</p>}

          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-sm font-bold text-text">添加记录</p>
            <select value={catHealthForm.record_type} onChange={(e) => setCatHealthForm({ ...catHealthForm, record_type: e.target.value })} className="w-full rounded-2xl border-2 border-border px-3 py-2 text-sm outline-none">
              {RECORD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input placeholder="标题" value={catHealthForm.title} onChange={(e) => setCatHealthForm({ ...catHealthForm, title: e.target.value })} className="w-full rounded-2xl border-2 border-border px-3 py-2 text-sm outline-none" />
            <input placeholder="描述（可选）" value={catHealthForm.description} onChange={(e) => setCatHealthForm({ ...catHealthForm, description: e.target.value })} className="w-full rounded-2xl border-2 border-border px-3 py-2 text-sm outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={catHealthForm.record_date} onChange={(e) => setCatHealthForm({ ...catHealthForm, record_date: e.target.value })} className="rounded-2xl border-2 border-border px-3 py-2 text-sm outline-none" />
              <input placeholder="地点（可选）" value={catHealthForm.location} onChange={(e) => setCatHealthForm({ ...catHealthForm, location: e.target.value })} className="rounded-2xl border-2 border-border px-3 py-2 text-sm outline-none" />
            </div>
            <button onClick={handleAddHealthRecord} disabled={saving || !catHealthForm.title} className="btn btn-primary btn-sm w-full disabled:opacity-60">添加健康记录</button>
          </div>
        </section>
      )}

      {/* Feeding points */}
      <section className="card space-y-4">
        <h2 className="font-bold text-lg text-text">喂食点管理</h2>
        {feedingPoints.length > 0 ? feedingPoints.map((p) => (
          <div key={p.id} className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0">
            <div>
              <p className="text-sm font-bold text-text">{p.name}</p>
              {p.description && <p className="text-xs text-text-secondary">{p.description}</p>}
              <p className="text-[10px] text-text-muted">📍 {p.latitude}, {p.longitude}</p>
            </div>
            <button onClick={() => handleDeleteFeedingPoint(p.id)} className="text-xs text-red-400 shrink-0">删除</button>
          </div>
        )) : <p className="text-sm text-text-secondary">暂无喂食点</p>}

        <div className="border-t border-border pt-3 space-y-3">
          <p className="text-sm font-bold text-text">添加喂食点</p>
          <input placeholder="名称（如：二食堂旁）" value={feedingForm.name} onChange={(e) => setFeedingForm({ ...feedingForm, name: e.target.value })} className="w-full rounded-2xl border-2 border-border px-3 py-2 text-sm outline-none" />
          <input placeholder="描述（可选）" value={feedingForm.description} onChange={(e) => setFeedingForm({ ...feedingForm, description: e.target.value })} className="w-full rounded-2xl border-2 border-border px-3 py-2 text-sm outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="any" placeholder="纬度" value={feedingForm.latitude} onChange={(e) => setFeedingForm({ ...feedingForm, latitude: e.target.value })} className="rounded-2xl border-2 border-border px-3 py-2 text-sm outline-none" />
            <input type="number" step="any" placeholder="经度" value={feedingForm.longitude} onChange={(e) => setFeedingForm({ ...feedingForm, longitude: e.target.value })} className="rounded-2xl border-2 border-border px-3 py-2 text-sm outline-none" />
          </div>
          <button onClick={handleAddFeedingPoint} disabled={saving || !feedingForm.name || !feedingForm.latitude || !feedingForm.longitude} className="btn btn-primary btn-sm w-full disabled:opacity-60">添加喂食点</button>
        </div>
      </section>

      {/* Recent sightings */}
      <section className="space-y-3">
        <h2 className="font-bold text-lg text-text">最近偶遇记录</h2>
        {sightings.map((s) => (
          <article key={s.id} className="card">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-text">{s.cat?.name || '校园猫猫'}</p>
              <span className="text-xs text-text-secondary">{formatTime(s.created_at)}</span>
            </div>
            <p className="text-sm text-text-secondary mt-1">{s.location_name || s.location || '校园某处'}</p>
            {s.note && <p className="text-xs text-text-secondary mt-1">“{s.note}”</p>}
          </article>
        ))}
      </section>
    </div>
  )
}
