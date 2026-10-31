import Taro from '@tarojs/taro'
import { CONFIG } from '../config'
import { getToken, setToken, clearToken, setStoredUser } from '../utils/storage'
import { demoApi } from './demo'

const BASE = CONFIG.apiBase

function buildQS(params: Record<string, any> = {}): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (!entries.length) return ''
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')
}

async function request<T = any>(url: string, options: any = {}): Promise<T> {
  if (CONFIG.demoMode) {
    return demoApi(url, options) as T
  }

  const token = getToken()
  const header: any = { ...options.header }
  if (token) {
    header['Authorization'] = `Bearer ${token}`
  }
  if (!header['Content-Type']) header['Content-Type'] = 'application/json'

  try {
    const res = await Taro.request({
      url: `${BASE}${url}`,
      method: options.method || 'GET',
      header,
      data: options.body,
      timeout: 30000,
    })
    if (res.statusCode < 200 || res.statusCode >= 300) {
      const err = res.data as any
      throw new Error(err?.detail || `HTTP ${res.statusCode}`)
    }
    return res.data as T
  } catch (err: any) {
    if (err.errMsg?.includes('timeout')) {
      throw new Error('网络请求超时')
    }
    throw err
  }
}


function requestForm(url: string, data: Record<string, unknown>) {
  const body = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return request(url, { method: 'POST', header: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
}

function parseUploadResponse(res: { statusCode: number; data: string }) {
  let body: any
  try { body = JSON.parse(res.data) } catch { throw new Error('服务器返回了无效的上传结果') }
  if (res.statusCode < 200 || res.statusCode >= 300) {
    if (res.statusCode === 401) clearToken()
    throw new Error(body?.detail || `HTTP ${res.statusCode}`)
  }
  return body
}

export function wechatLogin(code: string, nickname?: string, avatarUrl?: string) {
  return request('/auth/wechat-login', {
    method: 'POST',
    body: { code, nickname, avatar_url: avatarUrl },
  })
}

export function login(data: { username: string; password: string }) {
  return request('/auth/login', {
    method: 'POST',
    body: data,
  })
}


export interface Page<T = any> { items: T[]; total: number; has_more: boolean }

async function requestPage(url: string, params: any = {}): Promise<Page> {
  const { page, catId, ...query } = params
  if (catId !== undefined) query.cat_id = catId
  if (page !== undefined) query.skip = (Math.max(1, Number(page)) - 1) * (query.limit || 20)
  const result = await request(`${url}${buildQS(query)}`)
  if (Array.isArray(result)) return { items: result, total: result.length, has_more: false }
  if (!result || !Array.isArray(result.items)) throw new Error('列表返回格式错误')
  return result
}

export function getCatsPage(params: any = {}) { return requestPage('/cats', params) }
export function getPostsPage(params: any = {}) { return requestPage('/posts', params) }
export function getSightingsPage(params: any = {}) { return requestPage('/sightings', params) }

export function getCats(params: any = {}) { return getCatsPage(params).then(page => page.items) }
export function getCat(catId: number) { return request(`/cats/${catId}`) }

export function getSightings(params: any = {}) {
  return getSightingsPage(params).then(page => page.items)
}

export function createSighting(data: any) {
  const { file, catId, ...fields } = data
  const formData: Record<string, string> = {}
  for (const [key, value] of Object.entries({ ...fields, cat_id: catId ?? fields.cat_id })) {
    if (value !== undefined && value !== null && value !== '') formData[key] = String(value)
  }
  if (file) {
    return Taro.uploadFile({
      url: `${BASE}/sightings`, filePath: file, name: 'file', formData,
      header: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    }).then(parseUploadResponse)
  }
  return requestForm('/sightings', formData)
}

export function getPosts(params: any = {}) {
  return getPostsPage(params).then(page => page.items)
}

export function createPost(data: Record<string, string>) {
  return requestForm('/posts', data)
}

export function likePost(postId: number) {
  return request(`/posts/${postId}/like`, { method: 'POST' })
}

export function getUserProfile() { return request('/user/profile') }
export function updateUserProfile(data: { nickname?: string; avatar?: string | null }) {
  return request('/user/profile', { method: 'PATCH', body: data })
}
export function uploadUserAvatar(filePath: string) {
  if (CONFIG.demoMode) {
    return Promise.resolve({
      id: 1,
      username: 'demo',
      nickname: '猫猫爱好者',
      role: 'user',
      avatar: filePath,
      stats: {},
      badges: [],
    })
  }
  return Taro.uploadFile({
    url: `${BASE}/user/profile/avatar`,
    filePath,
    name: 'file',
    header: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  }).then(parseUploadResponse)
}
export function followCat(catId: number) { return request(`/user/follows/${catId}`, { method: 'POST' }) }
export function unfollowCat(catId: number) { return request(`/user/follows/${catId}`, { method: 'DELETE' }) }
export function checkFollow(catId: number) { return request(`/user/follows/${catId}`) }

export function recognize(filePath: string) {
  return Taro.uploadFile({
    url: `${BASE}/recognize`,
    filePath,
    name: 'file',
    header: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  }).then(parseUploadResponse)
}

export function getNotifications(params: any = {}) {
  return request(`/notifications${buildQS(params)}`)
}

export function getPost(postId: number) { return request(`/posts/${postId}`) }

export function deletePost(postId: number) { return request(`/posts/${postId}`, { method: 'DELETE' }) }

export function getPostComments(postId: number) { return request(`/posts/${postId}/comments`) }

export function createComment(postId: number, data: { content: string }) {
  return request(`/posts/${postId}/comments`, { method: 'POST', body: data })
}

export function reportPost(postId: number, data: { reason: string }) {
  return request(`/posts/${postId}/report`, { method: 'POST', body: data })
}

export function getReports(params: any = {}) {
  return request(`/posts/reports${buildQS(params)}`)
}

export function handleReport(reportId: number, action: string) {
  return request(`/posts/reports/${reportId}/handle`, { method: 'POST', body: { action } })
}

export function getHealthRecords(catId: number, params: any = {}) {
  return request(`/cats/${catId}/health${buildQS(params)}`)
}

export function createHealthRecord(catId: number, data: any) {
  return request(`/cats/${catId}/health`, { method: 'POST', body: data })
}

export function deleteHealthRecord(catId: number, recordId: number) {
  return request(`/cats/${catId}/health/${recordId}`, { method: 'DELETE' })
}

export function getFeedingPoints(params: any = {}) {
  return request(`/feeding/points${buildQS(params)}`)
}

export function createFeedingPoint(data: any) {
  return request('/feeding/points', { method: 'POST', body: data })
}

export function deleteFeedingPoint(pointId: number) {
  return request(`/feeding/points/${pointId}`, { method: 'DELETE' })
}

export function getBadges() { return request('/user/badges') }

export function getWeeklyReport() { return request('/user/weekly-report') }

export function markNotificationRead(id: number) { return request(`/notifications/${id}/read`, { method: 'POST' }) }

export function markAllNotificationsRead() { return request('/notifications/read-all', { method: 'POST' }) }

export function getGalleryImages(params: any = {}) {
  return requestPage('/gallery', params).then(page => page.items)
}

export function getFollowedCats() { return request('/user/follows') }

export function getLeaderboard(params: any = {}) {
  return request(`/leaderboard${buildQS(params)}`)
}

export function getDailyQuest() { return request('/users/me/daily-quest') }

export function adminLogin(password: string) {
  return request('/admin/login', { method: 'POST', body: { password } }).then((res: any) => {
    setToken(res.token)
    setStoredUser({ role: 'admin', nickname: '管理员' })
    return res
  })
}

export function getAdminMe() { return request('/admin/me') }

export function createCat(data: any) { return request('/cats', { method: 'POST', body: data }) }

export function updateCat(catId: number, data: any) { return request(`/cats/${catId}`, { method: 'PUT', body: data }) }

export function uploadCatImage(catId: number, filePath: string) {
  return Taro.uploadFile({
    url: `${BASE}/cats/${catId}/images`,
    filePath,
    name: 'file',
    header: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  }).then(parseUploadResponse)
}

export function createDiscovery(data: any) {
  const hasFile = !!data.file
  if (hasFile) {
    return Taro.uploadFile({
      url: `${BASE}/discoveries`,
      filePath: data.file,
      name: 'file',
      formData: {
        location_name: data.locationName || '',
        latitude: data.latitude !== undefined ? String(data.latitude) : '',
        longitude: data.longitude !== undefined ? String(data.longitude) : '',
        note: data.note || '',
      },
      header: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    }).then(parseUploadResponse)
  }
  return request('/discoveries', { method: 'POST', body: data })
}

export function identifyCat(filePath: string) { return recognize(filePath) }

export function deleteCat(catId: number) {
  return request(`/cats/${catId}`, { method: 'DELETE' })
}

export function getDiscoveries(params: any = {}) {
  return request(`/discoveries${buildQS(params)}`)
}

export function reviewDiscovery(id: number, data: any) {
  return request(`/discoveries/${id}/review`, { method: 'POST', body: data })
}

export function getHeatmapData(params: any = {}) {
  return requestPage('/map/heatmap', params).then(page => page.items)
}

export function adminLogout() {
  clearToken()
}

export function getMyStats() { return request('/users/me') }

export { getToken, setToken, clearToken, getStoredUser, setStoredUser } from '../utils/storage'

export function getEncounteredCatIds(): Promise<number[]> { return request('/users/me/encountered-cats') }
