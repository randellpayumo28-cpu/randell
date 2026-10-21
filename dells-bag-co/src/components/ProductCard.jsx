import { money } from '../data/products.js'
import { useCart } from '../context/CartContext.jsx'

function ProductCard({ product }) {
  const { addToCart } = useCart()

  return (
    <div className="card h-100 shadow-sm product-card">
      <div className="position-relative">
        {product.badge && (
          <span className="badge bg-danger position-absolute top-0 start-0 m-2">{product.badge}</span>
        )}
        <img
          src={product.img}
          alt={product.name}
          className="card-img-top"
          style={{ aspectRatio: '4 / 5', objectFit: 'cover' }}
          loading="lazy"
        />
      </div>
      <div className="card-body">
        <p className="text-secondary text-uppercase small mb-0">{product.material}</p>
        <h3 className="h6 mb-0">{product.name}</h3>
        <div className="d-flex align-items-center justify-content-between mt-2">
          <span className="fw-bold">{money(product.price)}</span>
          <button
            className="btn btn-sm rounded-circle text-white" style={{ backgroundColor: '#ee4d2d' }}
            onClick={() => addToCart(product.id)}
            aria-label={`Add ${product.name} to bag`}
          >
            <i className="bi bi-plus-lg"></i>
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProductCard
