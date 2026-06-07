const MOCK_DATA: Record<string, any> = {
  'GET /cats': [
    { id: 1, name: '橘总', color: '橘色', location: '图书馆', avatar: '', nickname: '大橘' },
    { id: 2, name: '小黑', color: '黑色', location: '食堂', avatar: '', nickname: '' },
    { id: 3, name: '奶糖', color: '白色', location: '花坛', avatar: '', nickname: '小白' },
  ],
  'GET /sightings': [
    { id: 1, cat_id: 1, cat: { name: '橘总' }, location_name: '图书馆门口', created_at: new Date().toISOString(), activity_type: 'eating' },
    { id: 2, cat_id: 2, cat: { name: '小黑' }, location_name: '食堂后门', created_at: new Date().toISOString() },
  ],
  'GET /posts': [
    { id: 1, user: { nickname: '猫协管理员' }, userId: 1, topic: 'daily', content: '今天橘总又在图书馆门口晒太阳了 ☀️', likes: 5, comments: 2, liked: false, tags: ['#橘总', '#图书馆'], createdAt: '2小时前', images: [] },
  ],
  'GET /user/profile': {
    id: 1, username: 'demo', nickname: '猫猫爱好者', role: 'user',
    avatar: null, stats: { sightings: 3, badges_count: 2, locations_count: 1, posts: 1 },
    badges: [{ badge_key: 'first_sighting', earned: true }]
  },
  'GET /user/follows': [],
  'GET /user/follows/1': { following: false },
  'POST /auth/wechat-login': {
    token: 'demo_token', token_type: 'bearer',
    user: { id: 1, username: 'demo', nickname: '猫猫爱好者', role: 'user', avatar: null, stats: {}, badges: [] },
    is_new: false,
  },
  'POST /posts/1/like': { ok: true },
  'POST /user/follows/1': { ok: true },
}

export function demoApi(url: string, options: any = {}): any {
  const method = options.method || 'GET'
  const key = `${method} ${url.split('?')[0]}`
  if (MOCK_DATA[key]) {
    return Promise.resolve(MOCK_DATA[key])
  }
  console.warn(`[Demo] No mock for: ${key}`)
  return Promise.resolve({ ok: true })
}
