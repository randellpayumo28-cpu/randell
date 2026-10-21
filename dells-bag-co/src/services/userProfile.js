import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'

// Everything about a signed-in account lives in Firestore under users/{uid}.
// Both Login and Signup go through here so the shape is always the same.

export function usersDoc(uid) {
  return doc(db, 'users', uid)
}

function shapeProfile(uid, data) {
  return {
    id: uid,
    uid,
    fullName: data.fullName || data.displayName || '',
    displayName: data.displayName || data.fullName || '',
    username: data.username || '',
    email: data.email || '',
    photoURL: data.photoURL || null,
    phone: data.phone || '',
    address: data.address || '',
    role: data.role || 'user',
    provider: 'firebase',
  }
}

/**
 * Reads users/{uid}. Creates the document on first sign-in so every account
 * that exists in Firebase Auth also has a profile. Always stamps lastLoginAt.
 * Returns the profile object used by the app (AuthContext -> Profile page).
 */
export async function ensureUserProfile(user, extra = {}) {
  const ref = usersDoc(user.uid)
  const snap = await getDoc(ref)

  const fallbackName =
    extra.fullName || user.displayName || (user.email || '').split('@')[0] || ''
  const fallbackUsername =
    extra.username || (user.email || '').split('@')[0] || user.uid.slice(0, 8)

  if (snap.exists()) {
    const data = snap.data()

    // Keep the record fresh: last login + anything Google gave us that the
    // document is still missing.
    const patch = { lastLoginAt: serverTimestamp() }
    if (!data.fullName && fallbackName) patch.fullName = fallbackName
    if (!data.username && fallbackUsername) patch.username = fallbackUsername
    if (!data.photoURL && user.photoURL) patch.photoURL = user.photoURL
    if (!data.email && user.email) patch.email = user.email
    await setDoc(ref, patch, { merge: true })

    return shapeProfile(user.uid, { ...data, ...patch, lastLoginAt: undefined })
  }

  const profile = {
    fullName: fallbackName,
    displayName: user.displayName || fallbackName,
    username: fallbackUsername,
    email: user.email || extra.email || '',
    photoURL: user.photoURL || null,
    phone: '',
    address: '',
    role: extra.role || 'user',
    provider: user.providerData?.[0]?.providerId || 'password',
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  }

  await setDoc(ref, profile)
  return shapeProfile(user.uid, profile)
}

/** Merges changes from the Profile ("Me") page back into users/{uid}. */
export async function saveUserProfile(uid, updates) {
  await setDoc(
    usersDoc(uid),
    { ...updates, updatedAt: serverTimestamp() },
    { merge: true }
  )
}
