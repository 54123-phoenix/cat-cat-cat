export function isOnboarded() {
  return true
}

export function getPrefs() {
  try {
    const raw = localStorage.getItem('prefs')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function Onboarding() {
  return null
}
