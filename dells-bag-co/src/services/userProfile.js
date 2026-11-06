import { auth } from '../firebase.js'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\\/$/, '')

async function request(path, options = {}, user = auth.currentUser) {
  if (!user) throw new Error('Please sign in again.')
  const token = await user.getIdToken()
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || 'MySQL profile request failed.')
  return body
}

// Creates the MySQL account row on first sign-in. The backend always assigns new accounts role=user.
export async function ensureUserProfile(user, extra = {}) {
  const profile = await request('/auth/me', {}, user)
  if (extra.fullName || extra.username) {
    return request('/profile', {
      method: 'PATCH',
      body: JSON.stringify({ ...(extra.fullName ? { fullName: extra.fullName } : {}), ...(extra.username ? { username: extra.username } : {}) }),
    }, user)
  }
  return {
    ...profile,
    fullName: profile.fullName || profile.name || user.displayName || '',
    displayName: profile.fullName || profile.name || user.displayName || '',
    username: profile.username || (user.email || '').split('@')[0],
    photoURL: profile.photoURL || user.photoURL || null,
    provider: user.providerData?.[0]?.providerId || 'password',
  }
}

export async function saveUserProfile(uid, updates) {
  return request('/profile', { method: 'PATCH', body: JSON.stringify(updates) })
}

export async function getDatabaseProfile(user) {
  return request('/auth/me', {}, user)
}
