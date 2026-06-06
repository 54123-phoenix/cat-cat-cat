const API_BASE = '/api'

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '请求失败' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export function getCats() {
  return request('/cats')
}

export function getCat(catId) {
  return request(`/cats/${catId}`)
}

export function recognize(file) {
  const form = new FormData()
  form.append('file', file)
  return request('/recognize', { method: 'POST', body: form })
}

export function createSighting({ catId, location, confidence, file }) {
  const form = new FormData()
  form.append('cat_id', catId)
  if (location) form.append('location', location)
  if (confidence !== undefined) form.append('confidence', confidence)
  if (file) form.append('file', file)
  return request('/sightings', { method: 'POST', body: form })
}

export function getUserProfile() {
  return request('/user/profile')
}
