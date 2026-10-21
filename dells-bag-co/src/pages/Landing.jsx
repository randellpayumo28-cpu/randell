import { Link } from 'react-router-dom'
import promoBanner from '../assets/landing.jpg'

function Landing() {
  return (
    <div className="app-page bg-bags-pattern" style={{ paddingBottom: 0 }}>
      {/* Top bar */}
      <nav className="d-flex justify-content-between align-items-center px-4 py-3">
        <span className="d-flex align-items-center gap-2 fw-bold fs-5 text-dark">
          <i className="bi bi-bag-fill text-danger"></i>
          Dell's Bag &amp; Co.
        </span>
        <div className="d-none d-sm-flex gap-2">
          
        </div>
      </nav>

      {/* Hero */}
      <div
        className="position-relative d-flex align-items-center"
        style={{
          minHeight: '78vh',
          backgroundImage: `linear-gradient(90deg, rgba(20,20,20,0.88) 30%, rgba(20,20,20,0.35) 75%), url(${promoBanner})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="container">
          <div className="row">
            <div className="col-12 col-lg-7 py-5 px-3 px-md-4">
              <span className="badge bg-danger-subtle text-danger-emphasis fw-semibold px-3 py-2 mb-3">
                
              </span>
              <h1 className="display-4 fw-bold text-white mb-3" style={{ letterSpacing: '-0.02em' }}>
                Handcrafted Leather,<br />Now On Sale
              </h1>
              <p className="text-light fs-5 mb-4" style={{ maxWidth: '32rem', opacity: 0.9 }}>
                Our finest, artisan-made bags are now available with special pricing.
                Discover quality that lasts a lifetime, meticulously crafted in our workshop.
              </p>

              <div className="d-flex flex-column flex-sm-row gap-3">
                <Link to="/signup" className="btn btn-danger btn-lg px-4 fw-semibold">
                  Sign Up <i className="bi bi-arrow-right ms-1"></i>
                </Link>
                <Link to="/login" className="btn btn-outline-light btn-lg px-4 fw-semibold">
                  Log In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature strip */}
      <div className="container py-5">
        <div className="row g-4 text-center">
          <div className="col-12 col-md-4">
            <i className="bi bi-award fs-1 text-danger"></i>
            <h5 className="fw-bold mt-3">Handcrafted Quality</h5>
            <p className="text-secondary small mb-0">Every bag is made by hand in our own workshop, built to last for years.</p>
          </div>
          <div className="col-12 col-md-4">
            <i className="bi bi-truck fs-1 text-danger"></i>
            <h5 className="fw-bold mt-3">Fast Shipping</h5>
            <p className="text-secondary small mb-0">Orders ship quickly, so your new favorite bag arrives when you need it.</p>
          </div>
          <div className="col-12 col-md-4">
            <i className="bi bi-arrow-repeat fs-1 text-danger"></i>
            <h5 className="fw-bold mt-3">Easy Returns</h5>
            <p className="text-secondary small mb-0">Not the right fit? Send it back, hassle-free, within 30 days.</p>
          </div>
        </div>

        <div className="text-center mt-4">
          <p className="text-secondary mb-3">Ready to shop the sale?</p>
          <div className="d-flex justify-content-center gap-3">
            
          </div>
        </div>
      </div>
    </div>
  )
}

export default Landing
