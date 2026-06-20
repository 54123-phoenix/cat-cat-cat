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

function getAdminToken() {
  return localStorage.getItem('admin_token')
}

function setAdminToken(token) {
  localStorage.setItem('admin_token', token)
}

function clearAdminToken() {
  localStorage.removeItem('admin_token')
}

async function request(url: string, options: RequestInit = {}): Promise<any> {
  const isAdminUrl = url.startsWith('/admin')
  const token = isAdminUrl ? getAdminToken() : getToken()
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) }
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
    if (res.status === 401) {
      if (isAdminUrl) {
        clearAdminToken()
      } else {
        clearToken()
      }
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: '请求失败' }))
      throw new Error(Array.isArray(err.detail) ? err.detail.map(e => e.msg || JSON.stringify(e)).join("; ") : (err.detail || `HTTP ${res.status}`))
    }
    if (res.status === 204 || res.headers.get('content-length') === '0') return null
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text)
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

export { getToken, setToken, clearToken, getStoredUser, getAdminToken, setAdminToken, clearAdminToken }

export function adminLogin(password) {
  return request('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }).then((res) => {
    setAdminToken(res.token)
    return res
  })
}

export function getAdminMe() {
  return request('/admin/me')
}

export function getCats(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/cats${qs ? '?' + qs : ''}`).then(r => r.items ?? r)
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

export function createSighting({ catId, location, confidence, file, activity_type, weather, mood }) {
  const form = new FormData()
  form.append('cat_id', catId)
  if (location) form.append('location', location)
  if (confidence !== undefined) form.append('confidence', confidence)
  if (file) form.append('file', file)
  if (activity_type) form.append('activity_type', activity_type)
  if (weather) form.append('weather', weather)
  if (mood) form.append('mood', mood)
  return request('/sightings', { method: 'POST', body: form })
}

export function getSightings(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/sightings${qs ? '?' + qs : ''}`).then(r => r.items ?? r)
}

export function confirmSighting(id) {
  return request(`/sightings/${id}/confirm`, { method: 'POST' })
}

export function voteSighting(id, catId) {
  return request(`/sightings/${id}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cat_id: catId }),
  })
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
  return request(`/gallery${qs ? '?' + qs : ''}`)
}

export function getPosts(params = {}) {
  const qs = new URLSearchParams(params).toString()
  return request(`/posts${qs ? '?' + qs : ''}`).then(r => r.items ?? r)
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
  return request(`/map/heatmap${qs ? '?' + qs : ''}`).then(r => r.items ?? r)
}

export function getNearbyCats(lat, lng, n = 8) {
  return Promise.all([
    getCats(),
    getSightings({ limit: 200 }),
  ])
    .then(([cats, sightings]) => {
      if (!Array.isArray(cats)) return []
      const catById = new Map(cats.map((c) => [c.id, c]))
      if (lat == null || lng == null || !Array.isArray(sightings) || sightings.length === 0) {
        return cats.slice(0, n)
      }
      const bestDist = new Map()
      for (const s of sightings) {
        if (s.cat_id == null || s.latitude == null || s.longitude == null) continue
        const dLat = s.latitude - lat
        const dLng = s.longitude - lng
        const dist = dLat * dLat + dLng * dLng
        const prev = bestDist.get(s.cat_id)
        if (prev == null || dist < prev) bestDist.set(s.cat_id, dist)
      }
      const ranked = [...bestDist.entries()]
        .sort((a, b) => a[1] - b[1])
        .map(([cid]) => catById.get(cid))
        .filter(Boolean)
      if (ranked.length >= n) return ranked.slice(0, n)
      const seen = new Set(ranked.map((c) => c.id))
      for (const c of cats) {
        if (ranked.length >= n) break
        if (!seen.has(c.id)) { ranked.push(c); seen.add(c.id) }
      }
      return ranked.slice(0, n)
    })
    .catch(() => [])
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

export function getWrapped() {
  return request('/users/me/wrapped')
}

export function getVisitedLocations() {
  return request('/users/me/visited-locations')
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

export function getLeaderboard() {
  return request('/leaderboard')
}

export function getDailyQuest() {
  return request('/users/me/daily-quest')
}

export function getMyStats() {
  return request('/users/me')
}

export function pollVote(postId, optionIndex) {
  return request(`/posts/${postId}/poll-vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ option_index: optionIndex }),
  })
}

export function acceptAnswer(postId, commentId) {
  return request(`/posts/${postId}/accept-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment_id: commentId }),
  })
}
