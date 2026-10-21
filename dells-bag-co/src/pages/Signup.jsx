import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function Signup() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const navigate = useNavigate()
  const { signup, loginWithGoogle } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()

    if (!fullName.trim() || !email.trim() || !username.trim() || !password.trim()) {
      setError('Please fill out every field.')
      return
    }

    setError('')
    setLoading(true)

    // Creates the Firebase Auth account AND the users/{uid} document, so the
    // details show up on the Me page right after signing up.
    const result = await signup({ fullName, email, username, password })
    setLoading(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    navigate('/dashboard', { replace: true })
  }

  async function handleGoogleSignup() {
    setError('')
    setGoogleLoading(true)
    const result = await loginWithGoogle()
    setGoogleLoading(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    navigate('/dashboard', { replace: true })
  }

  return (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{
        minHeight: '100vh',
        backgroundImage: `linear-gradient(rgba(255,255,255,.55), rgba(255,255,255,.74)), url('/images/bags-pattern.png')`,
        backgroundRepeat: 'repeat',
        backgroundSize: '280px auto',
      }}
    >
      <div className="row justify-content-center shadow-lg my-3 mx-3 mx-md-5 p-3 pb-5 bg-light rounded-4 col-11 col-sm-8 col-md-6 col-lg-4">
        <div className="my-3 text-center">
          <i className="bi bi-bag-fill text-dark" style={{ fontSize: '3rem' }}></i>
        </div>

        <h1 className="text-center mb-4 text-dark fw-bold">Create Account</h1>

        <form onSubmit={handleSubmit}>
          <input type="text" className="form-control my-2 ps-3" placeholder="Full Name"
            value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <input type="email" className="form-control my-2 ps-3" placeholder="Email"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="text" className="form-control my-2 ps-3" placeholder="Username"
            value={username} onChange={(e) => setUsername(e.target.value)} required />

          <div className="input-group my-2">
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-control ps-3"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button className="btn btn-outline-secondary" type="button" onClick={() => setShowPassword(!showPassword)}>
              <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
            </button>
          </div>

          {error && <div className="text-danger small mb-2">{error}</div>}

          <div className="d-flex justify-content-center align-items-center my-3">
            <button type="submit" className="btn btn-outline-secondary w-100" disabled={loading}>
              {loading ? 'Signing up...' : 'Sign Up'}
              {loading && <span className="spinner-border spinner-border-sm ms-2" role="status"></span>}
            </button>
          </div>
        </form>

        <div className="d-flex align-items-center my-3">
          <hr className="flex-grow-1" />
          <span className="mx-2 small text-secondary">or</span>
          <hr className="flex-grow-1" />
        </div>

        <div className="d-flex justify-content-center align-items-center my-2">
          <button
            type="button"
            className="btn btn-outline-dark w-100"
            onClick={handleGoogleSignup}
            disabled={googleLoading}
          >
            <i className="bi bi-google me-2"></i>
            {googleLoading ? 'Signing in...' : 'Sign up with Google'}
            {googleLoading && <span className="spinner-border spinner-border-sm ms-2" role="status"></span>}
          </button>
        </div>

        <div className="d-flex justify-content-center align-items-center my-1">
          <span className="small text-secondary">
            Already have an account? <Link to="/login" className="text-warning fw-semibold text-decoration-none">Log In</Link>
          </span>
        </div>
      </div>
    </div>
  )
}

export default Signup
