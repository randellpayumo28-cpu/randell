import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase.js'
import { ensureUserProfile } from '../services/userProfile.js'

// ==========================================
// FIREBASE ERROR MESSAGES
// ==========================================
function friendlyError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.'

    case 'auth/invalid-email':
      return 'Please enter a valid email address.'

    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.'

    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.'

    case 'auth/popup-blocked':
      return 'The Google sign-in popup was blocked by your browser.'

    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.'

    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase.'

    default:
      return 'Unable to sign in. Please try again.'
  }
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const navigate = useNavigate()

  // ==========================================
  // ROLE-BASED REDIRECT
  // ==========================================
  async function routeByRole(user) {
    const profile = await ensureUserProfile(user)

    console.log('Logged-in profile:', profile)

    // ADMIN
    if (profile.role === 'admin') {
      navigate('/admin-dashboard', {
        replace: true,
        state: {
          name: profile.fullName || profile.email || 'Admin',
        },
      })

      return
    }

    // NORMAL USER
    navigate('/dashboard', {
      replace: true,
    })
  }

  // ==========================================
  // EMAIL / PASSWORD LOGIN
  // ==========================================
  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.')
      return
    }

    setLoading(true)

    try {
      const { user } = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      )

      await routeByRole(user)
    } catch (err) {
      console.error('Firebase login error:', err)

      setError(
        friendlyError(err?.code)
      )
    } finally {
      setLoading(false)
    }
  }

  // ==========================================
  // GOOGLE LOGIN
  // ==========================================
  async function handleGoogleLogin() {
    setError('')
    setGoogleLoading(true)

    try {
      const result = await signInWithPopup(
        auth,
        googleProvider
      )

      await routeByRole(result.user)
    } catch (err) {
      console.error('Google login error:', err)

      setError(
        friendlyError(err?.code)
      )
    } finally {
      setGoogleLoading(false)
    }
  }

  // ==========================================
  // UI
  // ==========================================
  return (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{
        minHeight: '100vh',
        backgroundImage: `linear-gradient(
          rgba(159,157,12,0.5),
          rgba(22,21,1,0.6)
        ), url('/images/images-1.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="row justify-content-center shadow-lg my-3 mx-3 mx-md-5 p-3 pb-5 bg-light rounded-4 col-11 col-sm-8 col-md-6 col-lg-4">

        {/* LOGO */}
        <div className="my-3 text-center">
          <i
            className="bi bi-bag-fill text-dark"
            style={{ fontSize: '3rem' }}
          ></i>
        </div>

        {/* BRAND */}
        <h1 className="text-center mb-2 text-danger-subtle fw-bold">
          Dell's Bag &amp; Co.
        </h1>

        <h5 className="text-center mb-4 text-secondary">
          Bags built to carry your day
        </h5>

        {/* LOGIN FORM */}
        <form onSubmit={handleSubmit}>

          {/* EMAIL */}
          <input
            type="email"
            className="form-control my-2 ps-3"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || googleLoading}
            autoComplete="email"
          />

          {/* PASSWORD */}
          <div className="input-group my-2">
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-control ps-3"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || googleLoading}
              autoComplete="current-password"
            />

            <button
              className="btn btn-outline-secondary"
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading || googleLoading}
            >
              <i
                className={`bi ${
                  showPassword
                    ? 'bi-eye-slash'
                    : 'bi-eye'
                }`}
              ></i>
            </button>
          </div>

          {/* FORGOT PASSWORD */}
          <div className="text-end mb-3">
            <a
              href="#"
              className="text-primary-emphasis small text-decoration-none"
              onClick={(e) => e.preventDefault()}
            >
              Forgot Password?
            </a>
          </div>

          {/* ERROR */}
          {error && (
            <div className="alert alert-danger py-2 small mb-2">
              {error}
            </div>
          )}

          {/* LOGIN BUTTON */}
          <div className="d-flex justify-content-center align-items-center my-2">
            <button
              type="submit"
              className="btn btn-outline-secondary w-100"
              disabled={loading || googleLoading}
            >
              {loading ? 'Logging in...' : 'Log In'}

              {loading && (
                <span
                  className="spinner-border spinner-border-sm ms-2"
                  role="status"
                  aria-hidden="true"
                ></span>
              )}
            </button>
          </div>

          {/* DIVIDER */}
          <div className="d-flex align-items-center my-3">
            <hr className="flex-grow-1" />

            <span className="mx-2 small text-secondary">
              or
            </span>

            <hr className="flex-grow-1" />
          </div>

          {/* GOOGLE LOGIN */}
          <div className="d-flex justify-content-center align-items-center my-2">
            <button
              type="button"
              className="btn btn-outline-dark w-100"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
            >
              <i className="bi bi-google me-2"></i>

              {googleLoading
                ? 'Signing in...'
                : 'Sign in with Google'}

              {googleLoading && (
                <span
                  className="spinner-border spinner-border-sm ms-2"
                  role="status"
                  aria-hidden="true"
                ></span>
              )}
            </button>
          </div>

        </form>

        {/* SIGN UP LINK */}
        <div className="d-flex justify-content-center align-items-center my-1">
          <span className="small text-secondary">
            New here?{' '}

            <Link
              to="/signup"
              className="text-danger fw-semibold text-decoration-none"
            >
              Sign Up
            </Link>
          </span>
        </div>

      </div>
    </div>
  )
}

export default Login