const API_BASE = '/api'
const ADMIN_TOKEN_KEY = 'cat_admin_token'

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '请求失败' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

function adminHeaders(extra = {}) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY)
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY)
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
}

export async function adminLogin(password) {
  const data = await request('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  localStorage.setItem(ADMIN_TOKEN_KEY, data.token)
  return data
}

export function getAdminMe() {
  return request('/admin/me', { headers: adminHeaders() })
}

export function getCats() {
  return request('/cats')
}

export const fetchCats = getCats

export function getCat(catId) {
  return request(`/cats/${catId}`)
}

export function createCat(cat) {
  return request('/cats', {
    method: 'POST',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(cat),
  })
}

export function updateCat(catId, cat) {
  return request(`/cats/${catId}`, {
    method: 'PUT',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(cat),
  })
}

export function uploadCatImage(catId, file) {
  const form = new FormData()
  form.append('file', file)
  return request(`/cats/${catId}/images`, { method: 'POST', headers: adminHeaders(), body: form })
}

export function getGalleryImages(params = {}) {
  const search = new URLSearchParams()
  if (params.limit) search.set('limit', params.limit)
  if (params.skip) search.set('skip', params.skip)
  const query = search.toString()
  return request(`/cats/images${query ? `?${query}` : ''}`)
}

export function getSightings(params = {}) {
  const search = new URLSearchParams()
  if (params.catId) search.set('cat_id', params.catId)
  if (params.limit) search.set('limit', params.limit)
  const query = search.toString()
  return request(`/sightings${query ? `?${query}` : ''}`)
}

export const fetchSightings = getSightings

export async function fetchStats() {
  const [cats, sightings] = await Promise.all([
    getCats(),
    getSightings({ limit: 100 }),
  ])
  const today = new Date().toDateString()
  return {
    total: cats.length,
    today: sightings.filter((sighting) => new Date(sighting.created_at).toDateString() === today).length,
    users: Math.max(12, new Set(sightings.map((sighting) => sighting.spotted_by).filter(Boolean)).size),
  }
}

export function fetchHeatmap(params = {}) {
  const search = new URLSearchParams()
  if (params.days !== undefined) search.set('days', params.days)
  if (params.limit) search.set('limit', params.limit)
  const query = search.toString()
  return request(`/map/heatmap${query ? `?${query}` : ''}`)
}

export function recognize(file) {
  const form = new FormData()
  form.append('file', file)
  return request('/recognize', { method: 'POST', body: form })
}

export const identifyCat = recognize

export function createSighting({ catId, location, locationName, latitude, longitude, note, spottedBy, confidence, file }) {
  const form = new FormData()
  form.append('cat_id', catId)
  if (location) form.append('location', location)
  if (locationName) form.append('location_name', locationName)
  if (latitude !== undefined) form.append('latitude', latitude)
  if (longitude !== undefined) form.append('longitude', longitude)
  if (note) form.append('note', note)
  if (spottedBy) form.append('spotted_by', spottedBy)
  if (confidence !== undefined) form.append('confidence', confidence)
  if (file) form.append('file', file)
  return request('/sightings', { method: 'POST', body: form })
}

export function createDiscovery({ locationName, latitude, longitude, note, file }) {
  const form = new FormData()
  if (locationName) form.append('location_name', locationName)
  if (latitude !== undefined) form.append('latitude', latitude)
  if (longitude !== undefined) form.append('longitude', longitude)
  if (note) form.append('note', note)
  if (file) form.append('file', file)
  return request('/discoveries', { method: 'POST', body: form })
}

export function getDiscoveries(params = {}) {
  const search = new URLSearchParams()
  if (params.status) search.set('status', params.status)
  if (params.limit) search.set('limit', params.limit)
  const query = search.toString()
  return request(`/discoveries${query ? `?${query}` : ''}`, { headers: adminHeaders() })
}

export function reviewDiscovery(discoveryId, payload) {
  return request(`/discoveries/${discoveryId}/review`, {
    method: 'POST',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
}

export function getUserProfile() {
  return request('/user/profile')
}

export async function fetchProfile() {
  const [user, cats, sightings] = await Promise.all([
    getUserProfile().catch(() => ({ nickname: '猫猫爱好者', badges: ['first', 'champion', 'collect'] })),
    getCats(),
    getSightings({ limit: 5 }),
  ])

  return {
    userId: user.id || 'FDU-001',
    nickname: user.nickname || '猫猫爱好者',
    avatar: user.avatar,
    daysJoined: 28,
    sightings: sightings.length,
    catsKnown: cats.length,
    badges: user.badges || [],
    recentSightings: sightings,
  }
}

const LOCAL_POSTS_KEY = 'fdu-cat-community-posts'

const seedPosts = [
  {
    id: 'post_seed_1',
    userId: '4892',
    userEmoji: '🧑‍💻',
    topic: 'daily',
    content: '今天在图书馆门口又看到小白了，晒太阳晒得很认真，状态很好。',
    tags: ['#小白', '#图书馆', '#治愈瞬间'],
    relatedCat: { id: 1, name: '小白', emoji: '🐱' },
    image: null,
    likes: 12,
    liked: false,
    comments: 3,
    createdAt: '10分钟前',
  },
  {
    id: 'post_seed_2',
    userId: '2077',
    userEmoji: '🧡',
    topic: 'find',
    content: '有人今天看到橘子吗？昨天在二食堂附近，今天还没见到。',
    tags: ['#橘子', '#二食堂', '#求助'],
    relatedCat: { id: 2, name: '橘子', emoji: '🐱' },
    image: null,
    likes: 8,
    liked: true,
    comments: 5,
    createdAt: '32分钟前',
  },
  {
    id: 'post_seed_3',
    userId: '1024',
    userEmoji: '🏥',
    topic: 'health',
    content: '黑咪右眼看起来有点分泌物，已经记录给猫协志愿者了，大家遇到可以观察一下。',
    tags: ['#黑咪', '#健康', '#猫协'],
    relatedCat: { id: 3, name: '黑咪', emoji: '🐈‍⬛' },
    image: null,
    likes: 16,
    liked: false,
    comments: 2,
    createdAt: '1小时前',
  },
  {
    id: 'post_seed_4',
    userId: '8848',
    userEmoji: '💡',
    topic: 'suggest',
    content: '建议在地图页加一个“最近 24 小时”筛选，这样找猫会更准确。',
    tags: ['#建议反馈', '#地图'],
    relatedCat: null,
    image: null,
    likes: 5,
    liked: false,
    comments: 1,
    createdAt: '2小时前',
  },
]

function readLocalPosts() {
  try {
    const raw = localStorage.getItem(LOCAL_POSTS_KEY)
    return raw ? JSON.parse(raw) : seedPosts
  } catch {
    return seedPosts
  }
}

function writeLocalPosts(posts) {
  localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(posts))
}

export async function fetchPosts(topic = 'all') {
  try {
    const query = new URLSearchParams({ topic, limit: '20' })
    return await request(`/posts?${query.toString()}`)
  } catch {
    const posts = readLocalPosts()
    return topic === 'all' ? posts : posts.filter((post) => post.topic === topic)
  }
}

export async function createPost(data) {
  try {
    return await request('/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: data.topic,
        content: data.content,
        tags: data.tags || [],
        relatedCatId: data.relatedCatId,
        image: data.image,
      }),
    })
  } catch {
    const posts = readLocalPosts()
    const post = {
      id: `post_${Date.now()}`,
      userId: 'FDU-001',
      userEmoji: '🧑‍💻',
      topic: data.topic,
      content: data.content,
      tags: data.tags || [],
      relatedCat: data.relatedCat || null,
      image: null,
      likes: 0,
      liked: false,
      comments: 0,
      createdAt: '刚刚',
    }
    writeLocalPosts([post, ...posts])
    return post
  }
}

export async function likePost(postId) {
  try {
    return await request(`/posts/${postId}/like`, { method: 'POST' })
  } catch {
    const posts = readLocalPosts().map((post) => {
      if (post.id !== postId) return post
      const liked = !post.liked
      return { ...post, liked, likes: Math.max(0, post.likes + (liked ? 1 : -1)) }
    })
    writeLocalPosts(posts)
    return { ok: true }
  }
}

export async function fetchPostComments(postId) {
  return request(`/posts/${postId}/comments`)
}

export async function createComment(postId, content) {
  return request(`/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}
