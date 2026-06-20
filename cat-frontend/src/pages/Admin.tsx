import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PawPrint, QrCode, X, Download } from 'lucide-react'
import QRCode from 'qrcode'
import { adminLogin, clearAdminToken, createCat, getAdminMe, getAdminToken, getCat, getCats, getSightings, updateCat, uploadCatImage, getReports, handleReport, getHealthRecords, createHealthRecord, deleteHealthRecord, getFeedingPoints, createFeedingPoint, deleteFeedingPoint } from '../api'

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
  { value: 'vaccine', label: '疫苗' },
  { value: 'deworm', label: '驱虫' },
  { value: 'sterilization', label: '绝育' },
  { value: 'injury', label: '伤病' },
  { value: 'illness', label: '疾病' },
  { value: 'checkup', label: '体检' },
]

const TABS = [
  { key: 'cats', label: '猫档案' },
  { key: 'health', label: '健康' },
  { key: 'feeding', label: '喂食' },
  { key: 'reports', label: '举报' },
  { key: 'sightings', label: '偶遇' },
]

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(Boolean(getAdminToken()))
  const [password, setPassword] = useState('')
  const [cats, setCats] = useState([])
  const [sightings, setSightings] = useState([])
  const [reports, setReports] = useState([])
  const [healthRecords, setHealthRecords] = useState([])
  const [healthCats, setHealthCats] = useState([])
  const [healthCatId, setHealthCatId] = useState(null)
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
  const [adminTab, setAdminTab] = useState('cats')
  const [qrPoint, setQrPoint] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState('')

  const loadCats = () => getCats().then(setCats).catch(e => setError(e.message))
  const loadSightings = () => getSightings({ limit: 20 }).then(data => setSightings(Array.isArray(data) ? data : [])).catch(e => setError(e.message))
  const loadReports = () => getReports({ status: 'pending', limit: 20 }).then(data => setReports(Array.isArray(data) ? data : [])).catch(e => setError(e.message))
  const loadFeeding = () => getFeedingPoints().then(setFeedingPoints).catch(e => setError(e.message))
  const loadHealthCats = () => getCats().then(setHealthCats).catch(e => setError(e.message))

  const loadData = () => {
    setLoading(true)
    Promise.all([loadCats(), loadSightings(), loadReports(), loadFeeding(), loadHealthCats()])
      .catch((err) => setError(err.message || '后台数据加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!authenticated) { setLoading(false); return }
    getAdminMe().then(loadData).catch(() => { clearAdminToken(); setAuthenticated(false); setError('登录已过期'); setLoading(false) })
  }, [authenticated])

  useEffect(() => {
    if (!healthCatId) { setHealthRecords([]); return }
    getHealthRecords(healthCatId).then(setHealthRecords).catch(() => setHealthRecords([]))
  }, [healthCatId])

  useEffect(() => {
    if (!qrPoint) { setQrDataUrl(''); return }
    const url = `${window.location.origin}/#/scan?point=${encodeURIComponent(qrPoint.name)}&lat=${qrPoint.latitude}&lng=${qrPoint.longitude}`
    QRCode.toDataURL(url, { width: 240, margin: 2 }).then(setQrDataUrl).catch(() => setQrDataUrl(''))
  }, [qrPoint])

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
    } catch (err) { setError(err.message || '加载失败') }
    setImageFile(null)
  }

  const resetForm = (keep = false) => {
    setSelectedCatId(null); setForm(emptyForm); setImageFile(null); setHealthRecords([])
    setCatHealthForm({ record_type: 'vaccine', title: '', description: '', record_date: '', location: '' })
    if (!keep) { setMessage(''); setError('') }
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setMessage(''); setError('')
    try {
      if (!form.name.trim()) throw new Error('猫猫名字不能为空')
      const saved = selectedCatId ? await updateCat(selectedCatId, form) : await createCat(form)
      if (imageFile) await uploadCatImage(saved.id, imageFile)
      setMessage(selectedCatId ? '猫档案已更新' : '新猫档案已创建')
      resetForm(true)
      loadCats()
    } catch (err) { setError(err.message || '保存失败') }
    finally { setSaving(false) }
  }

  async function handleAddHealthRecord() {
    if (!healthCatId) return
    setSaving(true); setError('')
    try {
      await createHealthRecord(healthCatId, {
        ...catHealthForm,
        record_date: catHealthForm.record_date || new Date().toISOString(),
      })
      setCatHealthForm({ record_type: 'vaccine', title: '', description: '', record_date: '', location: '' })
      const health = await getHealthRecords(healthCatId)
      setHealthRecords(health)
      setMessage('健康记录已添加')
    } catch (err) { setError(err.message || '添加失败') }
    finally { setSaving(false) }
  }

  async function handleDeleteHealthRecord(recordId) {
    try {
      await deleteHealthRecord(healthCatId, recordId)
      const health = await getHealthRecords(healthCatId)
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
    try {
      await deleteFeedingPoint(id)
      const pts = await getFeedingPoints()
      setFeedingPoints(pts)
      setMessage('喂食点已删除')
    } catch (err) { setError(err.message || '删除失败') }
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>

  if (!authenticated) {
    return (
      <div className="space-y-5 p-4 max-w-[480px] mx-auto">
        <div className="card p-5 space-y-2">
          <Link to="/profile" className="text-sm font-bold text-text-secondary">← 返回</Link>
          <h1 className="text-2xl font-bold text-text">猫协管理登录</h1>
          <p className="text-sm text-text-secondary mt-1">请输入猫协管理员口令</p>
        </div>
        {(message || error) && <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-500' : 'bg-green-50 text-success'}`}>{error || message}</div>}
        <form onSubmit={handleLogin} className="card p-5 space-y-4">
          <label className="space-y-1 block">
            <span className="block text-xs font-bold text-text-secondary">管理员口令</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-2xl border-2 border-border bg-card px-3 py-3 text-sm text-text outline-none" placeholder="管理员口令" />
          </label>
          <button type="submit" disabled={saving || !password.trim()} className="btn btn-primary w-full disabled:opacity-60">{saving ? '登录中...' : '进入管理台'}</button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen max-w-[480px] mx-auto bg-warm-50">
      <header className="sticky top-0 z-10 bg-warm-50/90 backdrop-blur-md px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <Link to="/profile" className="text-sm text-text-secondary font-medium hover:text-primary transition-colors">← 返回</Link>
          <h1 className="text-lg font-bold text-text">管理台</h1>
          <button onClick={handleLogout} className="text-sm text-red-400 font-medium">退出</button>
        </div>
        <div className="flex mt-3 -mb-3 space-x-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setAdminTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                adminTab === t.key ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {(message || error) && (
        <div className={`mx-4 mt-3 rounded-2xl px-4 py-3 text-sm font-bold ${error ? 'bg-red-50 text-red-500' : 'bg-green-50 text-success'}`}>
          {error || message}
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Tab: 猫档案 */}
        {adminTab === 'cats' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-text">猫档案列表</h2>
              <button onClick={() => { resetForm(); setAdminTab('cats') }} className="btn btn-primary btn-sm">+ 新增</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {cats.map((cat) => (
                <button key={cat.id} onClick={() => selectCat(cat)}
                  className={`card p-3 text-left active:scale-95 transition-transform ${selectedCatId === cat.id ? 'ring-2 ring-primary' : ''}`}>
                  <p className="font-bold text-text truncate">{cat.name}</p>
                  <p className="text-xs text-text-secondary truncate">{cat.nickname || cat.location || '未填写档案'}</p>
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="card space-y-4">
              <h2 className="font-bold text-lg text-text">{selectedCatId ? '编辑猫档案' : '新增猫档案'}</h2>
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
          </>
        )}

        {/* Tab: 健康 */}
        {adminTab === 'health' && (
          <div className="card space-y-4">
            <h2 className="font-bold text-lg text-text">健康记录</h2>
            <select
              value={healthCatId || ''}
              onChange={(e) => setHealthCatId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-2xl border-2 border-border px-3 py-2 text-sm outline-none"
            >
              <option value="">-- 选择猫猫 --</option>
              {healthCats.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            {healthCatId && (
              <>
                {healthRecords.length > 0 ? healthRecords.map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-bold text-text">{RECORD_TYPES.find(t => t.value === r.record_type)?.label || r.record_type} · {r.title}</p>
                      {r.description && <p className="text-xs text-text-secondary">{r.description}</p>}
                      <p className="text-xs text-text-muted">{formatDate(r.record_date)}{r.location ? ` · ${r.location}` : ''}</p>
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
              </>
            )}
          </div>
        )}

        {/* Tab: 喂食 */}
        {adminTab === 'feeding' && (
          <div className="card space-y-4">
            <h2 className="font-bold text-lg text-text">喂食点管理</h2>
            {feedingPoints.length > 0 ? feedingPoints.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-text">{p.name}</p>
                  {p.description && <p className="text-xs text-text-secondary">{p.description}</p>}
                  <p className="text-xs text-text-muted">{p.latitude}, {p.longitude}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setQrPoint(p)} className="text-xs text-primary font-medium flex items-center gap-1">
                    <QrCode className="w-4 h-4" />二维码
                  </button>
                  <button onClick={() => handleDeleteFeedingPoint(p.id)} className="text-xs text-red-400">删除</button>
                </div>
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
          </div>
        )}

        {/* Tab: 举报 */}
        {adminTab === 'reports' && (
          <section className="space-y-3">
            <h2 className="font-bold text-lg text-text">举报审核</h2>
            {reports.length > 0 ? reports.map((r) => (
              <article key={r.id} className="card space-y-3">
                <p className="text-sm font-bold text-text truncate">{r.post_title || '帖子'}</p>
                <p className="text-xs text-text-secondary">举报原因：{r.reason} · 举报人 ID：{r.reported_by}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button disabled={saving} onClick={() => handleReport(r.id, 'dismiss').then(loadReports).catch(e => setError(e.message))} className="btn btn-ghost btn-sm">驳回举报</button>
                  <button disabled={saving} onClick={() => handleReport(r.id, 'hide').then(loadReports).catch(e => setError(e.message))} className="btn btn-danger btn-sm">隐藏帖子</button>
                </div>
              </article>
            )) : <div className="card p-5 text-sm text-text-secondary text-center">暂无待处理举报</div>}
          </section>
        )}

        {/* Tab: 偶遇 */}
        {adminTab === 'sightings' && (
          <section className="space-y-3">
            <h2 className="font-bold text-lg text-text">最近偶遇记录</h2>
            {sightings.map((s) => (
              <article key={s.id} className="card">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-text">{s.cat?.name || '校园猫猫'}</p>
                  <span className="text-xs text-text-secondary">{formatTime(s.created_at)}</span>
                </div>
                <p className="text-sm text-text-secondary mt-1">{s.location_name || s.location || '校园某处'}</p>
                {s.note && <p className="text-xs text-text-secondary mt-1">"{s.note}"</p>}
              </article>
            ))}
          </section>
        )}
      </div>

      {qrPoint && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setQrPoint(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-text">喂食点二维码</h3>
              <button onClick={() => setQrPoint(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-text-secondary" /></button>
            </div>
            <p className="text-sm text-text-secondary">{qrPoint.name}</p>
            <div className="flex justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="二维码"
                  className="w-60 h-60 rounded-xl border border-border"
                />
              ) : (
                <div className="w-60 h-60 rounded-xl border border-border flex items-center justify-center text-text-muted text-sm">生成中…</div>
              )}
            </div>
            <div className="flex gap-2">
              {qrDataUrl ? (
                <a
                  href={qrDataUrl}
                  download={`qr-${qrPoint.name}.png`}
                  className="btn btn-primary btn-sm flex-1 flex items-center justify-center gap-1"
                >
                  <Download className="w-4 h-4" />下载
                </a>
              ) : null}
              <button onClick={() => window.print()} className="btn btn-ghost btn-sm flex-1">打印</button>
            </div>
            <p className="text-xs text-text-muted text-center">贴在喂食点供扫码打卡</p>
          </div>
        </div>
      )}
    </div>
  )
}
