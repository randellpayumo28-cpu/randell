import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProducts } from '../context/ProductContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import ProductCard from '../components/ProductCard.jsx'
import CartOffcanvas from '../components/CartOffcanvas.jsx'
import BottomNav from '../components/BottomNav.jsx'



function Dashboard() {
  const navigate = useNavigate()
  const { cartCount } = useCart()
  const { products: PRODUCTS } = useProducts()
  const categories = ['All', ...new Set(PRODUCTS.map((p) => p.category).filter(Boolean))]
  const { currentUser, logout } = useAuth()
  const [cartOpen, setCartOpen] = useState(false)
  const [query, setQuery] = useState('')

  const name = currentUser?.fullName || currentUser?.username || ''
  const featured = PRODUCTS.slice(0, 4)

  function handleLogout() {
    logout()
    navigate('/')
  }

  function handleSearchSubmit(e) {
    e.preventDefault()
    const trimmed = query.trim()
    navigate(trimmed ? `/shop?q=${encodeURIComponent(trimmed)}` : '/shop')
  }

  return (
    <div className="bg-bags-pattern app-page">
      <div className="bg-warning-subtle bg-gradient text-white pt-4 pb-5 px-3">
        <div className="container">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-bag-fill fs-4 text-dark"></i>
              <span className="fw-bold fs-5 text-dark">Dell's Bag &amp; Co.</span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={`btn btn-outline-secondary btn-sm rounded-circle position-relative ${cartCount > 0 ? 'pulse' : ''}`}
                onClick={() => setCartOpen(true)}
                aria-label="View bag"
              >
                <i className="bi bi-bag"></i>
                {cartCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                    {cartCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm rounded-circle"
                onClick={() => navigate('/seller-dashboard')}
                aria-label="Switch to seller dashboard"
                title="Switch to seller"
              >
                <i className="bi bi-shop-window"></i>
              </button>
              <button className="btn btn-outline-secondary btn-sm rounded-circle" onClick={handleLogout} aria-label="Log out">
                <i className="bi bi-box-arrow-right"></i>
              </button>
            </div>
          </div>
          <p className="mb-3 opacity-75 small text-primary-emphasis">
            {name ? `Welcome back, ${name}! What would you like to carry today?` : 'Welcome back! What would you like to carry today?'}
          </p>

          <form className="d-flex" role="search" onSubmit={handleSearchSubmit}>
            <div className="input-group">
              <span className="input-group-text bg-white border-0"><i className="bi bi-search"></i></span>
              <input
                type="search"
                className="form-control border-0"
                placeholder="Search totes, backpacks, duffels..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </form>
        </div>
      </div>

      <div className="container" style={{ marginTop: '-1.5rem' }}>
        <div className="d-flex gap-2 overflow-auto pb-2 mb-3" style={{ whiteSpace: 'nowrap' }}>
          {categories.map((cat, i) => (
            <Link
              key={cat}
              to={cat === 'All' ? '/shop' : `/shop?category=${encodeURIComponent(cat)}`}
              className={`btn btn-sm rounded-pill flex-shrink-0 ${i === 0 ? 'btn-warning' : 'btn-outline-warning bg-white'}`}
            >
              {cat}
            </Link>
          ))}
        </div>

        <Link to="/shop" className="text-decoration-none">
          <div className="card bg-dark text-white mb-4 border-0 shadow-sm">
            <div className="card-body d-flex align-items-center justify-content-between p-4">
              <div>
                <p className="text-uppercase small mb-1 opacity-75">Weekend Sale</p>
                <h5 className="mb-0 fw-bold">20% off all duffels</h5>
              </div>
              <span className="btn btn-light btn-sm">Shop Now</span>
            </div>
          </div>
        </Link>

        <div className="d-flex align-items-center justify-content-between mb-3">
          <h2 className="h5 fw-bold mb-0">Featured Picks</h2>
          <Link to="/shop" className="small text-dark">See all <i className="bi bi-arrow-right text-dark"></i></Link>
        </div>
        <div className="row g-3 mb-4">
          {featured.map((p) => (
            <div className="col-6" key={p.id}>
              <ProductCard product={p} />
            </div>
          ))}
        </div>

        <div className="row g-3 mb-4">
          <div className="col-6">
            <Link to="/orders" className="text-decoration-none">
              <div className="card shadow-sm h-100 text-center p-3">
                <i className="bi bi-clock-history text-dark" style={{ fontSize: '1.75rem' }}></i>
                <p className="mb-0 mt-2 small fw-semibold">My Orders</p>
              </div>
            </Link>
          </div>
          <div className="col-6">
            <Link to="/profile" className="text-decoration-none">
              <div className="card shadow-sm h-100 text-center p-3">
                <i className="bi bi-person-circle text-dark" style={{ fontSize: '1.75rem' }}></i>
                <p className="mb-0 mt-2 small fw-semibold">Profile</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      <CartOffcanvas isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      <BottomNav />
    </div>
  )
}

export default Dashboard
