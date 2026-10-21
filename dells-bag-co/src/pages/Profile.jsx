import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import BottomNav from '../components/BottomNav.jsx'

function Profile() {
  const { currentUser, updateProfile, logout } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // Whatever account signed in, its users/{uid} document lands here.
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName || '')
      setEmail(currentUser.email || '')
      setPhone(currentUser.phone || '')
      setAddress(currentUser.address || '')
    }
  }, [currentUser])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const result = await updateProfile({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      address: address.trim(),
    })

    setSaving(false)

    if (!result?.ok) {
      setError(result?.error || 'Could not save your changes.')
      return
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="bg-bags-pattern app-page">
      <nav className="navbar navbar-light bg-white border-bottom">
        <div className="container d-flex align-items-center">
          <Link to="/dashboard" className="text-dark text-decoration-none me-3">
            <i className="bi bi-arrow-left fs-5"></i>
          </Link>
          <span className="navbar-brand mb-0">Profile</span>
        </div>
      </nav>

      <div className="container mt-4 col-12 col-md-6 col-lg-4">
        <div className="text-center mb-4">
          {currentUser?.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt=""
              className="rounded-circle shadow-sm"
              style={{ width: '96px', height: '96px', objectFit: 'cover' }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <i className="bi bi-person-circle text-dark" style={{ fontSize: '5rem' }}></i>
          )}

          <h5 className="fw-bold mt-3 mb-1">{currentUser?.fullName || 'Your account'}</h5>
          {currentUser?.username && <p className="text-muted small mb-1">@{currentUser.username}</p>}
          {currentUser?.role && (
            <span className={`badge ${currentUser.role === 'admin' ? 'bg-danger' : 'bg-secondary'}`}>
              {currentUser.role}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <label className="form-label small text-secondary">Full Name</label>
          <input
            type="text"
            className="form-control mb-3"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
          />

          <label className="form-label small text-secondary">Email</label>
          <input
            type="email"
            className="form-control mb-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />

          <label className="form-label small text-secondary">Phone</label>
          <input
            type="tel"
            className="form-control mb-3"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09XX XXX XXXX"
          />

          <label className="form-label small text-secondary">Delivery Address</label>
          <textarea
            className="form-control mb-3"
            rows="2"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="House no., street, barangay, city"
          />

          {saved && <div className="alert alert-success py-2 small">Profile updated!</div>}
          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <button type="submit" className="btn btn-dark w-100 mt-2" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
            {saving && <span className="spinner-border spinner-border-sm ms-2" role="status"></span>}
          </button>
        </form>

        <button className="btn btn-outline-danger w-100 mt-3" onClick={handleLogout}>Log Out</button>
      </div>

      <BottomNav />
    </div>
  )
}

export default Profile
