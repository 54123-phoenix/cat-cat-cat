const API_BASE = '/api'

function getToken() {
  return localStorage.getItem('token')
}

function clearToken() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

function setToken(token, user) {
  localStorage.setItem('token', token)
  if (user) localStorage.setItem('user', JSON.stringify(user))
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user'))
  } catch {
    return null
  }
}

async function request(url, options = {}) {
  const token = getToken()
  const headers = { ...options.headers }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
      signal: controller.signal,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: '请求失败' }))
      throw new Error(err.detail || `HTTP ${res.status}`)
    }
    return res.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

// Auth
export function register(data) {
  return request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function login(data) {
  return request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function getMe() {
  return request('/auth/me')
}

export { getToken, setToken, clearToken, getStoredUser }

// Backward compat aliases for Admin.jsx
export const getAdminToken = getToken
export const clearAdminToken = clearToken

export function adminLogin(password) {
  return request('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }).then((res) => {
    setToken(res.token)
    return res
  })
}

export function getAdminMe() {
  return request('/admin/me')
}

export function getCats() {
  return request('/cats')
}

export function getCat(catId) {
  return request(`/cats/${catId}`)
}

export function createCat(data) {
  return request('/cats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function updateCat(catId, data) {
  return request(`/cats/${catId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteCat(catId) {
  return request(`/cats/${catId}`, { method: 'DELETE' })
}

export function uploadCatImage(catId, file) {
  const form = new FormData()
  form.append('file', file)
  return request(`/cats/${catId}/images`, { method: 'POST', body: form })
}

export function recognize(file) {
  const form = new FormData()
  form.append('file', file)
  return request('/recognize', { method: 'POST', body: form })
}

export function createSighting({ catId, location, confidence, file, activity_type }) {
  const form = new FormData()
  form.append('cat_id', catId)
  if (location) form.append('location', location)
  if (confidence !== undefined) form.append('confidence', confidence)
  if (file) form.append('file', file)
  if (activity_type) form.append('activity_type', activity_type)
  return request('/sightings', { method: 'POST', body: form })
}

export function getSightings(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/sightings${qs ? '?' + qs : ''}`)
}

export function getUserProfile() {
  return request('/user/profile')
}

export function getDiscoveries(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/discoveries${qs ? '?' + qs : ''}`)
}

export function createDiscovery(data) {
  const form = new FormData()
  if (data.file) form.append('file', data.file)
  if (data.locationName) form.append('location_name', data.locationName)
  if (data.latitude !== undefined) form.append('latitude', String(data.latitude))
  if (data.longitude !== undefined) form.append('longitude', String(data.longitude))
  if (data.note) form.append('note', data.note)
  return request('/discoveries', { method: 'POST', body: form })
}

export function reviewDiscovery(id, data) {
  return request(`/discoveries/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function getGalleryImages(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/cats/images${qs ? '?' + qs : ''}`)
}

export function getPosts(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/posts${qs ? '?' + qs : ''}`)
}

export function getPost(postId) {
  return request(`/posts/${postId}`)
}

export function createPost(data) {
  // FormData 不需要手动设置 Content-Type（浏览器自动加 boundary）
  return request('/posts', {
    method: 'POST',
    body: data,
  })
}

export function deletePost(postId) {
  return request(`/posts/${postId}`, { method: 'DELETE' })
}

export function likePost(postId) {
  return request(`/posts/${postId}/like`, { method: 'POST' })
}

export function getPostComments(postId) {
  return request(`/posts/${postId}/comments`)
}

export function createComment(postId, data) {
  return request(`/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function reportPost(postId, data) {
  return request(`/posts/${postId}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function getReports(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/posts/reports${qs ? '?' + qs : ''}`)
}

export function handleReport(reportId, action) {
  return request(`/posts/reports/${reportId}/handle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
}

export function getHeatmapData(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/map/heatmap${qs ? '?' + qs : ''}`)
}

export function identifyCat(file) {
  return recognize(file)
}

export function getBadges() {
  return request('/user/badges')
}

export function getHealthRecords(catId, params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/cats/${catId}/health${qs ? '?' + qs : ''}`)
}

export function createHealthRecord(catId, data) {
  return request(`/cats/${catId}/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteHealthRecord(catId, recordId) {
  return request(`/cats/${catId}/health/${recordId}`, { method: 'DELETE' })
}

export function getFeedingPoints(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/feeding/points${qs ? '?' + qs : ''}`)
}

export function createFeedingPoint(data) {
  return request('/feeding/points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteFeedingPoint(pointId) {
  return request(`/feeding/points/${pointId}`, { method: 'DELETE' })
}

export function getFeedingCheckIns(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/feeding/check-ins${qs ? '?' + qs : ''}`)
}

export function createFeedingCheckIn(pointId, data) {
  return request(`/feeding/points/${pointId}/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function getNotifications(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/notifications${qs ? '?' + qs : ''}`)
}

export function markNotificationRead(id) {
  return request(`/notifications/${id}/read`, { method: 'POST' })
}

export function markAllNotificationsRead() {
  return request('/notifications/read-all', { method: 'POST' })
}

export function getWeeklyReport() {
  return request('/user/weekly-report')
}

export function followCat(catId) {
  return request(`/user/follows/${catId}`, { method: 'POST' })
}
export function unfollowCat(catId) {
  return request(`/user/follows/${catId}`, { method: 'DELETE' })
}
export function checkFollow(catId) {
  return request(`/user/follows/${catId}`)
}
export function getFollowedCats() {
  return request('/user/follows')
}
