import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useProducts } from '../context/ProductContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import ProductCard from '../components/ProductCard.jsx'
import CartOffcanvas from '../components/CartOffcanvas.jsx'
import BottomNav from '../components/BottomNav.jsx'



function Shop() {
  const { cartCount } = useCart()
  const { products: PRODUCTS } = useProducts()
  const categories = ['All', ...new Set(PRODUCTS.map((p) => p.category).filter(Boolean))]
  const [cartOpen, setCartOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const activeCategory = searchParams.get('category') || 'All'
  const [query, setQuery] = useState(searchParams.get('q') || '')

  useEffect(() => {
    setQuery(searchParams.get('q') || '')
  }, [searchParams])

  function handleSearchSubmit(e) {
    e.preventDefault()
    const next = new URLSearchParams(searchParams)
    if (query.trim()) {
      next.set('q', query.trim())
    } else {
      next.delete('q')
    }
    setSearchParams(next)
  }

  function selectCategory(cat) {
    const next = new URLSearchParams(searchParams)
    if (cat === 'All') {
      next.delete('category')
    } else {
      next.set('category', cat)
    }
    setSearchParams(next)
  }

  const filtered = useMemo(() => {
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    return PRODUCTS.filter((p) => {
      const matchesCategory = activeCategory === 'All' || p.category === activeCategory
      const matchesQuery =
        !q || p.name.toLowerCase().includes(q) || p.material.toLowerCase().includes(q)
      return matchesCategory && matchesQuery
    })
  }, [activeCategory, searchParams])

  return (
    <div className="bg-bags-pattern app-page">
      <nav className="navbar navbar-light bg-white border-bottom">
        <div className="container d-flex align-items-center justify-content-between">
          <Link to="/dashboard" className="text-dark text-decoration-none">
            <i className="bi bi-arrow-left fs-5 me-2"></i>
          </Link>
          <span className="navbar-brand mb-0">Shop All</span>
          <button className="btn btn-outline-secondary btn-sm rounded-circle position-relative" onClick={() => setCartOpen(true)}>
            <i className="bi bi-bag"></i>
            {cartCount > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{cartCount}</span>
            )}
          </button>
        </div>
      </nav>

      <div className="container mt-3">
        <form className="d-flex mb-3" role="search" onSubmit={handleSearchSubmit}>
          <div className="input-group">
            <span className="input-group-text bg-white"><i className="bi bi-search"></i></span>
            <input
              type="search"
              className="form-control"
              placeholder="Search totes, backpacks, duffels..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-dark">Search</button>
          </div>
        </form>

        <div className="d-flex gap-2 overflow-auto pb-2 mb-3" style={{ whiteSpace: 'nowrap' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => selectCategory(cat)}
              className={`btn btn-sm rounded-pill flex-shrink-0 ${activeCategory === cat ? 'btn-warning' : 'btn-outline-warning bg-white'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center text-muted py-5">
            <i className="bi bi-search display-4 d-block mb-3"></i>
            <p className="mb-0">No bags matched your search. Try a different keyword or category.</p>
          </div>
        ) : (
          <div className="row g-3">
            {filtered.map((p) => (
              <div className="col-6 col-md-4 col-lg-3" key={p.id}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        )}
      </div>

      <CartOffcanvas isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      <BottomNav />
    </div>
  )
}

export default Shop
