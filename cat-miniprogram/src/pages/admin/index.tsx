import { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import {
  adminLogin, adminLogout, getAdminMe, getAdminToken,
  getCats, getCat, updateCat, createCat, uploadCatImage,
  getSightings, getReports, handleReport,
  getHealthRecords, createHealthRecord, deleteHealthRecord,
  getFeedingPoints, createFeedingPoint, deleteFeedingPoint,
} from '../../services/api'

const RECORD_TYPES = [
  { value: 'vaccine', label: '疫苗' }, { value: 'deworm', label: '驱虫' },
  { value: 'sterilization', label: '绝育' }, { value: 'injury', label: '伤病' },
  { value: 'illness', label: '疾病' }, { value: 'checkup', label: '体检' },
]

const emptyForm = {
  name: '', nickname: '', gender: '', neutered: '', age_estimate: '',
  color: '', personality: '', story: '', location: '', avatar: '',
}

function formatTime(v: string) {
  if (!v) return ''
  const d = new Date(v)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(Boolean(getAdminToken()))
  const [password, setPassword] = useState('')
  const [cats, setCats] = useState<any[]>([])
  const [sightings, setSightings] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [healthRecords, setHealthRecords] = useState<any[]>([])
  const [feedingPoints, setFeedingPoints] = useState<any[]>([])
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null)
  const [catHealthForm, setCatHealthForm] = useState({ record_type: 'vaccine', title: '', description: '', record_date: '', location: '' })
  const [feedingForm, setFeedingForm] = useState({ name: '', description: '', latitude: '', longitude: '' })
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useDidShow(() => {
    if (!authenticated) { setLoading(false); return }
    loadData()
  })

  function loadData() {
    setLoading(true)
    Promise.all([
      getCats(),
      getSightings({ limit: 8 }),
      getReports({ status: 'pending', limit: 20 }),
      getFeedingPoints(),
    ]).then(([catsData, sightingsData, reportsData, feedingData]) => {
      setCats(Array.isArray(catsData) ? catsData : [])
      setSightings(Array.isArray(sightingsData) ? sightingsData : [])
      setReports(Array.isArray(reportsData) ? reportsData : [])
      setFeedingPoints(Array.isArray(feedingData) ? feedingData : [])
    }).catch((err) => setError(err.message || '后台数据加载失败'))
      .finally(() => setLoading(false))
  }

  async function handleLogin() {
    if (!password.trim()) return
    setSaving(true)
    setError('')
    try {
      await adminLogin(password)
      setPassword('')
      setAuthenticated(true)
      setMessage('猫协管理员登录成功')
      loadData()
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setSaving(false)
    }
  }

  function handleLogout() {
    adminLogout()
    setAuthenticated(false)
    resetForm()
    setCats([])
    setSightings([])
    setReports([])
    setMessage('已退出')
  }

  async function selectCat(cat: any) {
    setSelectedCatId(cat.id)
    setError('')
    setMessage('')
    try {
      const detail = await getCat(cat.id)
      setForm({
        name: detail.name || '',
        nickname: detail.nickname || '',
        gender: detail.gender || '',
        neutered: detail.neutered || '',
        age_estimate: detail.age_estimate || '',
        color: detail.color || '',
        personality: detail.personality || '',
        story: detail.story || '',
        location: detail.location || '',
        avatar: detail.avatar || '',
      })
      const health = await getHealthRecords(cat.id)
      setHealthRecords(Array.isArray(health) ? health : [])
    } catch (err: any) {
      setError(err.message || '加载失败')
    }
  }

  function resetForm() {
    setSelectedCatId(null)
    setForm(emptyForm)
    setHealthRecords([])
    setCatHealthForm({ record_type: 'vaccine', title: '', description: '', record_date: '', location: '' })
    setMessage('')
    setError('')
  }

  async function handleSaveCat() {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      if (!form.name.trim()) throw new Error('猫猫名字不能为空')
      const saved = selectedCatId ? await updateCat(selectedCatId, form) : await createCat(form)
      setMessage(selectedCatId ? '猫档案已更新' : '新猫档案已创建')
      resetForm()
      loadData()
    } catch (err: any) {
      setError(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddHealthRecord() {
    if (!selectedCatId) return
    setSaving(true)
    setError('')
    try {
      await createHealthRecord(selectedCatId, {
        ...catHealthForm,
        record_date: catHealthForm.record_date || new Date().toISOString(),
      })
      setCatHealthForm({ record_type: 'vaccine', title: '', description: '', record_date: '', location: '' })
      const health = await getHealthRecords(selectedCatId)
      setHealthRecords(Array.isArray(health) ? health : [])
      setMessage('健康记录已添加')
    } catch (err: any) {
      setError(err.message || '添加失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteHealthRecord(recordId: number) {
    if (!selectedCatId) return
    const res = await Taro.showModal({ title: '确认删除', content: '确定删除这条健康记录？' })
    if (!res.confirm) return
    try {
      await deleteHealthRecord(selectedCatId, recordId)
      const health = await getHealthRecords(selectedCatId)
      setHealthRecords(Array.isArray(health) ? health : [])
      setMessage('健康记录已删除')
    } catch (err: any) {
      setError(err.message || '删除失败')
    }
  }

  async function handleAddFeedingPoint() {
    if (!feedingForm.name || !feedingForm.latitude || !feedingForm.longitude) return
    setSaving(true)
    setError('')
    try {
      await createFeedingPoint({
        name: feedingForm.name,
        description: feedingForm.description,
        latitude: parseFloat(feedingForm.latitude),
        longitude: parseFloat(feedingForm.longitude),
      })
      setFeedingForm({ name: '', description: '', latitude: '', longitude: '' })
      const pts = await getFeedingPoints()
      setFeedingPoints(Array.isArray(pts) ? pts : [])
      setMessage('喂食点已添加')
    } catch (err: any) {
      setError(err.message || '添加失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteFeedingPoint(id: number) {
    const res = await Taro.showModal({ title: '确认删除', content: '确定删除这个喂食点？' })
    if (!res.confirm) return
    try {
      await deleteFeedingPoint(id)
      const pts = await getFeedingPoints()
      setFeedingPoints(Array.isArray(pts) ? pts : [])
      setMessage('喂食点已删除')
    } catch (err: any) {
      setError(err.message || '删除失败')
    }
  }

  async function handleReportAction(reportId: number, action: string) {
    try {
      await handleReport(reportId, action)
      loadData()
      setMessage(action === 'dismiss' ? '举报已驳回' : '帖子已隐藏')
    } catch (err: any) {
      setError(err.message || '操作失败')
    }
  }

  if (loading && authenticated) {
    return (
      <View style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Text style={{ fontSize: '28rpx', color: '#A8A29E' }}>加载中...</Text>
      </View>
    )
  }

  if (!authenticated) {
    return (
      <View className='page' style={{ padding: '24rpx' }}>
        <View className='card' style={{ marginBottom: '24rpx' }}>
          <View onClick={() => Taro.navigateTo({ url: '/pages/profile/index' })}>
            <Text style={{ fontSize: '24rpx', color: '#78716C' }}>← 返回普通模式</Text>
          </View>
          <Text style={{ fontSize: '40rpx', fontWeight: 'bold', display: 'block', marginTop: '16rpx' }}>猫协管理登录</Text>
          <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginTop: '8rpx' }}>请输入猫协管理员口令后维护档案</Text>
        </View>
        {(message || error) && (
          <View style={{ padding: '24rpx', borderRadius: '16rpx', marginBottom: '24rpx', backgroundColor: error ? '#FEE2E2' : '#D1FAE5' }}>
            <Text style={{ fontSize: '26rpx', color: error ? '#DC2626' : '#059669', display: 'block' }}>{error || message}</Text>
          </View>
        )}
        <View className='card'>
          <Text style={{ fontSize: '24rpx', color: '#78716C', marginBottom: '12rpx', display: 'block' }}>管理员口令</Text>
          <Input
            type='password'
            password
            value={password}
            onInput={(e) => setPassword(e.detail.value)}
            placeholder='默认 cat-admin'
            style={{ width: '100%', height: '80rpx', borderRadius: '16rpx', backgroundColor: '#F5F5F4', padding: '0 24rpx', fontSize: '28rpx', marginBottom: '24rpx' }}
            onConfirm={handleLogin}
          />
          <View onClick={handleLogin}
            style={{ backgroundColor: password.trim() ? '#F97316' : '#E7E5E4', borderRadius: '999rpx', padding: '24rpx', textAlign: 'center', color: '#fff', fontSize: '28rpx' }}>
            {saving ? '登录中...' : '进入管理台'}
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className='page' style={{ padding: '24rpx', paddingBottom: '48rpx' }}>
      <View className='card' style={{ marginBottom: '24rpx' }}>
        <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={{ fontSize: '36rpx', fontWeight: 'bold', display: 'block' }}>猫协管理台</Text>
            <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginTop: '4rpx' }}>维护猫档案、健康记录和社区</Text>
          </View>
          <View style={{ display: 'flex', gap: '12rpx' }}>
            <View onClick={resetForm}
              style={{ backgroundColor: '#F97316', color: '#fff', borderRadius: '999rpx', padding: '12rpx 24rpx', fontSize: '22rpx' }}>
              新增猫
            </View>
            <View onClick={handleLogout}
              style={{ backgroundColor: '#F5F5F4', color: '#78716C', borderRadius: '999rpx', padding: '12rpx 24rpx', fontSize: '22rpx' }}>
              退出
            </View>
          </View>
        </View>
      </View>

      {(message || error) && (
        <View style={{ padding: '24rpx', borderRadius: '16rpx', marginBottom: '24rpx', backgroundColor: error ? '#FEE2E2' : '#D1FAE5' }}>
          <Text style={{ fontSize: '26rpx', color: error ? '#DC2626' : '#059669', display: 'block' }}>{error || message}</Text>
        </View>
      )}

      <View style={{ marginBottom: '32rpx' }}>
        <Text style={{ fontSize: '30rpx', fontWeight: 'bold', marginBottom: '16rpx', display: 'block' }}>举报审核</Text>
        {reports.length > 0 ? reports.map((r: any) => (
          <View key={r.id} className='card' style={{ marginBottom: '16rpx' }}>
            <Text style={{ fontSize: '26rpx', fontWeight: '500', display: 'block' }}>{r.post_title || '帖子'}</Text>
            <Text style={{ fontSize: '22rpx', color: '#78716C', display: 'block', marginTop: '8rpx' }}>举报原因：{r.reason}</Text>
            <View style={{ display: 'flex', gap: '12rpx', marginTop: '16rpx' }}>
              <View onClick={() => handleReportAction(r.id, 'dismiss')}
                style={{ flex: 1, textAlign: 'center', padding: '16rpx', borderRadius: '999rpx', border: '1rpx solid #E7E5E4', fontSize: '24rpx', color: '#78716C' }}>
                驳回举报
              </View>
              <View onClick={() => handleReportAction(r.id, 'hide')}
                style={{ flex: 1, textAlign: 'center', padding: '16rpx', borderRadius: '999rpx', backgroundColor: '#FEE2E2', fontSize: '24rpx', color: '#DC2626' }}>
                隐藏帖子
              </View>
            </View>
          </View>
        )) : (
          <View className='card' style={{ textAlign: 'center', padding: '40rpx' }}>
            <Text style={{ fontSize: '24rpx', color: '#78716C' }}>暂无待处理举报</Text>
          </View>
        )}
      </View>

      <View style={{ marginBottom: '32rpx' }}>
        <Text style={{ fontSize: '30rpx', fontWeight: 'bold', marginBottom: '16rpx', display: 'block' }}>猫档案列表</Text>
        <View style={{ display: 'flex', flexWrap: 'wrap', gap: '12rpx' }}>
          {cats.map((cat: any) => (
            <View key={cat.id}
              onClick={() => selectCat(cat)}
              className='card'
              style={{
                width: 'calc(50% - 6rpx)', padding: '24rpx',
                borderColor: selectedCatId === cat.id ? '#F97316' : '#E7E5E4',
                borderWidth: selectedCatId === cat.id ? '3rpx' : '1rpx',
              }}>
              <Text style={{ fontSize: '28rpx', fontWeight: '500', display: 'block' }}>{cat.name}</Text>
              <Text style={{ fontSize: '22rpx', color: '#A8A29E', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cat.nickname || cat.location || '未填写档案'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View className='card' style={{ marginBottom: '32rpx' }}>
        <Text style={{ fontSize: '28rpx', fontWeight: 'bold', marginBottom: '20rpx', display: 'block' }}>
          {selectedCatId ? '编辑猫档案' : '新增猫档案'}
        </Text>
        <View style={{ display: 'flex', flexWrap: 'wrap', gap: '12rpx', marginBottom: '12rpx' }}>
          {['name', 'nickname', 'gender', 'neutered', 'age_estimate', 'color', 'location', 'avatar'].map((field) => (
            <View key={field} style={{ width: 'calc(50% - 6rpx)' }}>
              <Text style={{ fontSize: '22rpx', color: '#78716C', marginBottom: '4rpx', display: 'block' }}>{field}</Text>
              <Input
                value={(form as any)[field]}
                onInput={(e) => setForm({ ...form, [field]: e.detail.value })}
                placeholder={field}
                style={{ width: '100%', height: '64rpx', borderRadius: '12rpx', backgroundColor: '#F5F5F4', padding: '0 16rpx', fontSize: '26rpx' }}
              />
            </View>
          ))}
        </View>
        <View style={{ marginBottom: '12rpx' }}>
          <Text style={{ fontSize: '22rpx', color: '#78716C', marginBottom: '4rpx', display: 'block' }}>性格</Text>
          <Input
            value={form.personality}
            onInput={(e) => setForm({ ...form, personality: e.detail.value })}
            placeholder='性格特征'
            style={{ width: '100%', height: '64rpx', borderRadius: '12rpx', backgroundColor: '#F5F5F4', padding: '0 16rpx', fontSize: '26rpx' }}
          />
        </View>
        <View style={{ marginBottom: '20rpx' }}>
          <Text style={{ fontSize: '22rpx', color: '#78716C', marginBottom: '4rpx', display: 'block' }}>故事</Text>
          <textarea
            value={form.story}
            onInput={(e) => setForm({ ...form, story: (e.target as any).value })}
            placeholder='猫猫故事'
            style={{ width: '100%', height: '120rpx', borderRadius: '12rpx', backgroundColor: '#F5F5F4', padding: '12rpx 16rpx', fontSize: '26rpx' }}
          />
        </View>
        <View onClick={handleSaveCat}
          style={{ backgroundColor: '#F97316', borderRadius: '999rpx', padding: '24rpx', textAlign: 'center', color: '#fff', fontSize: '28rpx' }}>
          {saving ? '保存中...' : '保存档案'}
        </View>
      </View>

      {selectedCatId && (
        <View className='card' style={{ marginBottom: '32rpx' }}>
          <Text style={{ fontSize: '28rpx', fontWeight: 'bold', marginBottom: '20rpx', display: 'block' }}>健康记录</Text>
          {healthRecords.length > 0 ? healthRecords.map((r: any) => (
            <View key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '16rpx', marginBottom: '16rpx', borderBottom: '1rpx solid #F5F5F4' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: '26rpx', fontWeight: '500', display: 'block' }}>
                  {RECORD_TYPES.find(t => t.value === r.record_type)?.label || r.record_type} · {r.title}
                </Text>
                {r.description && <Text style={{ fontSize: '22rpx', color: '#78716C', display: 'block' }}>{r.description}</Text>}
                <Text style={{ fontSize: '22rpx', color: '#A8A29E', display: 'block' }}>{formatTime(r.record_date)}{r.location ? ` · ${r.location}` : ''}</Text>
              </View>
              <View onClick={() => handleDeleteHealthRecord(r.id)} style={{ padding: '8rpx', flexShrink: 0 }}>
                <Text style={{ fontSize: '22rpx', color: '#EF4444' }}>删除</Text>
              </View>
            </View>
          )) : <Text style={{ fontSize: '24rpx', color: '#78716C', marginBottom: '20rpx', display: 'block' }}>暂无健康记录</Text>}

          <View style={{ borderTop: '1rpx solid #E7E5E4', paddingTop: '20rpx' }}>
            <Text style={{ fontSize: '26rpx', fontWeight: '500', marginBottom: '12rpx', display: 'block' }}>添加记录</Text>
            <View style={{ display: 'flex', flexWrap: 'wrap', gap: '12rpx' }}>
              {RECORD_TYPES.map((t) => (
                <Text key={t.value}
                  onClick={() => setCatHealthForm({ ...catHealthForm, record_type: t.value })}
                  style={{
                    fontSize: '24rpx', padding: '8rpx 20rpx', borderRadius: '999rpx',
                    backgroundColor: catHealthForm.record_type === t.value ? '#FFF7ED' : '#F5F5F4',
                    color: catHealthForm.record_type === t.value ? '#F97316' : '#78716C',
                  }}>
                  {t.label}
                </Text>
              ))}
            </View>
            <Input
              value={catHealthForm.title}
              onInput={(e) => setCatHealthForm({ ...catHealthForm, title: e.detail.value })}
              placeholder='标题'
              style={{ width: '100%', height: '64rpx', borderRadius: '12rpx', backgroundColor: '#F5F5F4', padding: '0 16rpx', fontSize: '26rpx', marginTop: '12rpx' }}
            />
            <Input
              value={catHealthForm.description}
              onInput={(e) => setCatHealthForm({ ...catHealthForm, description: e.detail.value })}
              placeholder='描述（可选）'
              style={{ width: '100%', height: '64rpx', borderRadius: '12rpx', backgroundColor: '#F5F5F4', padding: '0 16rpx', fontSize: '26rpx', marginTop: '12rpx' }}
            />
            <View style={{ display: 'flex', gap: '12rpx', marginTop: '12rpx' }}>
              <Input
                type='date'
                value={catHealthForm.record_date ? catHealthForm.record_date.substring(0, 10) : ''}
                onInput={(e) => setCatHealthForm({ ...catHealthForm, record_date: e.detail.value })}
                placeholder='日期'
                style={{ flex: 1, height: '64rpx', borderRadius: '12rpx', backgroundColor: '#F5F5F4', padding: '0 16rpx', fontSize: '26rpx' }}
              />
              <Input
                value={catHealthForm.location}
                onInput={(e) => setCatHealthForm({ ...catHealthForm, location: e.detail.value })}
                placeholder='地点（可选）'
                style={{ flex: 1, height: '64rpx', borderRadius: '12rpx', backgroundColor: '#F5F5F4', padding: '0 16rpx', fontSize: '26rpx' }}
              />
            </View>
            <View onClick={handleAddHealthRecord}
              style={{ backgroundColor: catHealthForm.title ? '#F97316' : '#E7E5E4', borderRadius: '999rpx', padding: '24rpx', textAlign: 'center', color: '#fff', fontSize: '28rpx', marginTop: '16rpx' }}>
              添加健康记录
            </View>
          </View>
        </View>
      )}

      <View className='card' style={{ marginBottom: '32rpx' }}>
        <Text style={{ fontSize: '28rpx', fontWeight: 'bold', marginBottom: '20rpx', display: 'block' }}>喂食点管理</Text>
        {feedingPoints.length > 0 ? feedingPoints.map((p: any) => (
          <View key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '16rpx', marginBottom: '16rpx', borderBottom: '1rpx solid #F5F5F4' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: '26rpx', fontWeight: '500', display: 'block' }}>{p.name}</Text>
              {p.description && <Text style={{ fontSize: '22rpx', color: '#78716C', display: 'block' }}>{p.description}</Text>}
              <Text style={{ fontSize: '22rpx', color: '#A8A29E', display: 'block' }}>{p.latitude}, {p.longitude}</Text>
            </View>
            <View onClick={() => handleDeleteFeedingPoint(p.id)} style={{ padding: '8rpx', flexShrink: 0 }}>
              <Text style={{ fontSize: '22rpx', color: '#EF4444' }}>删除</Text>
            </View>
          </View>
        )) : <Text style={{ fontSize: '24rpx', color: '#78716C', marginBottom: '20rpx', display: 'block' }}>暂无喂食点</Text>}

        <View style={{ borderTop: '1rpx solid #E7E5E4', paddingTop: '20rpx' }}>
          <Text style={{ fontSize: '26rpx', fontWeight: '500', marginBottom: '12rpx', display: 'block' }}>添加喂食点</Text>
          <Input value={feedingForm.name} onInput={(e) => setFeedingForm({ ...feedingForm, name: e.detail.value })}
            placeholder='名称（如：二食堂旁）'
            style={{ width: '100%', height: '64rpx', borderRadius: '12rpx', backgroundColor: '#F5F5F4', padding: '0 16rpx', fontSize: '26rpx', marginBottom: '12rpx' }} />
          <Input value={feedingForm.description} onInput={(e) => setFeedingForm({ ...feedingForm, description: e.detail.value })}
            placeholder='描述（可选）'
            style={{ width: '100%', height: '64rpx', borderRadius: '12rpx', backgroundColor: '#F5F5F4', padding: '0 16rpx', fontSize: '26rpx', marginBottom: '12rpx' }} />
          <View style={{ display: 'flex', gap: '12rpx' }}>
            <Input type='number' value={feedingForm.latitude} onInput={(e) => setFeedingForm({ ...feedingForm, latitude: e.detail.value })}
              placeholder='纬度'
              style={{ flex: 1, height: '64rpx', borderRadius: '12rpx', backgroundColor: '#F5F5F4', padding: '0 16rpx', fontSize: '26rpx' }} />
            <Input type='number' value={feedingForm.longitude} onInput={(e) => setFeedingForm({ ...feedingForm, longitude: e.detail.value })}
              placeholder='经度'
              style={{ flex: 1, height: '64rpx', borderRadius: '12rpx', backgroundColor: '#F5F5F4', padding: '0 16rpx', fontSize: '26rpx' }} />
          </View>
          <View onClick={handleAddFeedingPoint}
            style={{ backgroundColor: (feedingForm.name && feedingForm.latitude && feedingForm.longitude) ? '#F97316' : '#E7E5E4', borderRadius: '999rpx', padding: '24rpx', textAlign: 'center', color: '#fff', fontSize: '28rpx', marginTop: '16rpx' }}>
            添加喂食点
          </View>
        </View>
      </View>

      <View>
        <Text style={{ fontSize: '30rpx', fontWeight: 'bold', marginBottom: '16rpx', display: 'block' }}>最近偶遇记录</Text>
        {sightings.map((s: any) => (
          <View key={s.id} className='card' style={{ marginBottom: '12rpx' }}>
            <View style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: '26rpx', fontWeight: '500' }}>{s.cat?.name || '校园猫猫'}</Text>
              <Text style={{ fontSize: '22rpx', color: '#A8A29E' }}>{formatTime(s.created_at)}</Text>
            </View>
            <Text style={{ fontSize: '24rpx', color: '#78716C', display: 'block', marginTop: '4rpx' }}>{s.location_name || s.location || '校园某处'}</Text>
            {s.note && <Text style={{ fontSize: '22rpx', color: '#78716C', display: 'block', marginTop: '4rpx' }}>"{s.note}"</Text>}
          </View>
        ))}
      </View>
    </View>
  )
}
