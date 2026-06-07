import Taro from '@tarojs/taro'

const TOKEN_KEY = 'token'
const USER_KEY = 'user'
const CACHE_TIMESTAMP = 'cache_ts'

export function initStorage() {
  const ts = Taro.getStorageSync(CACHE_TIMESTAMP)
  if (ts && Date.now() - ts > 48 * 3600 * 1000) {
    Taro.clearStorageSync()
  }
  Taro.setStorageSync(CACHE_TIMESTAMP, Date.now())
}

export function getToken(): string | null {
  return Taro.getStorageSync(TOKEN_KEY) || null
}

export function setToken(token: string) {
  Taro.setStorageSync(TOKEN_KEY, token)
}

export function clearToken() {
  Taro.removeStorageSync(TOKEN_KEY)
  Taro.removeStorageSync(USER_KEY)
}

export function getStoredUser() {
  try {
    return JSON.parse(Taro.getStorageSync(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export function setStoredUser(user: any) {
  Taro.setStorageSync(USER_KEY, JSON.stringify(user))
}
