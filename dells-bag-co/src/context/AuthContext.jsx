import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  updateProfile as updateFirebaseProfile,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase.js'
import { ensureUserProfile, saveUserProfile } from '../services/userProfile.js'

const SESSION_KEY = 'dellsBagCoSession'

const AuthContext = createContext(null)

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  // Cached copy of the Firestore profile so a refresh shows the name right
  // away instead of flashing empty while Firebase restores the session.
  const [currentUser, setCurrentUser] = useState(loadSession)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser))
    } else {
      localStorage.removeItem(SESSION_KEY)
    }
  }, [currentUser])

  // Single source of truth: whoever Firebase says is signed in gets their
  // users/{uid} document loaded (or created) and stored here.
  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setCurrentUser(null)
        setAuthReady(true)
        return
      }
      try {
        const profile = await ensureUserProfile(fbUser)
        setCurrentUser(profile)
      } catch (err) {
        console.error('Could not load Firestore profile', err)
        // Still let them in with whatever Auth gave us.
        setCurrentUser({
          id: fbUser.uid,
          uid: fbUser.uid,
          fullName: fbUser.displayName || '',
          email: fbUser.email || '',
          username: (fbUser.email || '').split('@')[0],
          photoURL: fbUser.photoURL || null,
          role: 'user',
        })
      } finally {
        setAuthReady(true)
      }
    })
  }, [])

  const signup = useCallback(async ({ fullName, email, username, password }) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      if (fullName.trim()) {
        await updateFirebaseProfile(cred.user, { displayName: fullName.trim() })
      }
      const profile = await ensureUserProfile(cred.user, {
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        role: 'user',
      })
      setCurrentUser(profile)
      return { ok: true, user: profile }
    } catch (err) {
      console.error('Sign up failed', err)
      const map = {
        'auth/email-already-in-use': 'That email is already registered.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/network-request-failed': 'Network error. Check your connection.',
      }
      return { ok: false, error: map[err?.code] || 'Could not create the account. Please try again.' }
    }
  }, [])

  const loginWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const profile = await ensureUserProfile(result.user)
      setCurrentUser(profile)
      return { ok: true, user: profile }
    } catch (err) {
      console.error('Google sign-in failed', err)
      if (err?.code === 'auth/popup-closed-by-user') {
        return { ok: false, error: 'Google sign-in was cancelled.' }
      }
      return { ok: false, error: 'Google sign-in failed. Please try again.' }
    }
  }, [])

  const logout = useCallback(() => {
    setCurrentUser(null)
    signOut(auth).catch(() => {})
  }, [])

  const updateProfile = useCallback(
    async (updates) => {
      if (!currentUser) return { ok: false, error: 'Not signed in.' }
      setCurrentUser((prev) => ({ ...prev, ...updates }))
      try {
        await saveUserProfile(currentUser.uid || currentUser.id, updates)
        if (auth.currentUser && updates.fullName) {
          await updateFirebaseProfile(auth.currentUser, { displayName: updates.fullName })
        }
        return { ok: true }
      } catch (err) {
        console.error('Could not save profile', err)
        return { ok: false, error: 'Saved locally, but the server update failed.' }
      }
    },
    [currentUser]
  )

  const value = {
    currentUser,
    authReady,
    isAuthenticated: !!currentUser,
    isAdmin: currentUser?.role === 'admin',
    signup,
    loginWithGoogle,
    logout,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
