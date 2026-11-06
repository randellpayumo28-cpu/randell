
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  updateProfile as updateFirebaseProfile,
} from 'firebase/auth'

import { auth, googleProvider } from '../firebase.js'

import {
  ensureUserProfile,
  saveUserProfile
} from '../services/userProfile.js'

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
  // Existing Firestore profile
  const [currentUser, setCurrentUser] = useState(loadSession)

  // NEW: Actual Firebase Authentication user
  const [firebaseUser, setFirebaseUser] = useState(null)

  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify(currentUser)
      )
    } else {
      localStorage.removeItem(SESSION_KEY)
    }
  }, [currentUser])

  // Single source of truth: Firebase Authentication
  useEffect(() => {
    return onAuthStateChanged(auth, async (fbUser) => {

      // NEW: Save the actual Firebase user
      setFirebaseUser(fbUser)

      if (!fbUser) {
        setCurrentUser(null)
        setAuthReady(true)
        return
      }

      try {
        const profile = await ensureUserProfile(fbUser)

        setCurrentUser(profile)

      } catch (err) {
        console.error(
          'Could not load Firestore profile',
          err
        )

        // Preserve the original fallback behavior
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

  // NEW: Get Firebase ID token for Admin API requests
  const getIdToken = useCallback(async () => {
    const user = auth.currentUser || firebaseUser

    if (!user) {
      throw new Error(
        'Firebase user token is unavailable. Please sign in again.'
      )
    }

    return await user.getIdToken()
  }, [firebaseUser])

  // Existing signup function
  const signup = useCallback(
    async ({ fullName, email, username, password }) => {
      try {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        )

        // NEW: Store Firebase user
        setFirebaseUser(cred.user)

        if (fullName.trim()) {
          await updateFirebaseProfile(cred.user, {
            displayName: fullName.trim()
          })
        }

        const profile = await ensureUserProfile(
          cred.user,
          {
            fullName: fullName.trim(),
            username: username.trim(),
            email: email.trim(),
            role: 'user',
          }
        )

        setCurrentUser(profile)

        return {
          ok: true,
          user: profile
        }

      } catch (err) {
        console.error('Sign up failed', err)

        const map = {
          'auth/email-already-in-use':
            'That email is already registered.',
          'auth/invalid-email':
            'Please enter a valid email address.',
          'auth/weak-password':
            'Password should be at least 6 characters.',
          'auth/network-request-failed':
            'Network error. Check your connection.',
        }

        return {
          ok: false,
          error:
            map[err?.code] ||
            'Could not create the account. Please try again.'
        }
      }
    },
    []
  )

  // Existing Google login
  const loginWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(
        auth,
        googleProvider
      )

      // NEW: Store Firebase user
      setFirebaseUser(result.user)

      const profile = await ensureUserProfile(result.user)

      setCurrentUser(profile)

      return {
        ok: true,
        user: profile
      }

    } catch (err) {
      console.error('Google sign-in failed', err)

      if (err?.code === 'auth/popup-closed-by-user') {
        return {
          ok: false,
          error: 'Google sign-in was cancelled.'
        }
      }

      return {
        ok: false,
        error: 'Google sign-in failed. Please try again.'
      }
    }
  }, [])

  // Existing logout
  const logout = useCallback(() => {
    setCurrentUser(null)

    // NEW: Clear Firebase user
    setFirebaseUser(null)

    signOut(auth).catch(() => {})
  }, [])

  // Existing profile update
  const updateProfile = useCallback(
    async (updates) => {
      if (!currentUser) {
        return {
          ok: false,
          error: 'Not signed in.'
        }
      }

      setCurrentUser((prev) => ({
        ...prev,
        ...updates
      }))

      try {
        await saveUserProfile(
          currentUser.uid || currentUser.id,
          updates
        )

        if (auth.currentUser && updates.fullName) {
          await updateFirebaseProfile(
            auth.currentUser,
            {
              displayName: updates.fullName
            }
          )
        }

        return { ok: true }

      } catch (err) {
        console.error('Could not save profile', err)

        return {
          ok: false,
          error: 'Saved locally, but the server update failed.'
        }
      }
    },
    [currentUser]
  )

  const value = {
    // Existing values
    currentUser,
    authReady,
    isAuthenticated: !!currentUser,
    isAdmin: currentUser?.role === 'admin',

    // NEW: Firebase Authentication values
    firebaseUser,
    getIdToken,

    // Existing functions
    signup,
    loginWithGoogle,
    logout,
    updateProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
