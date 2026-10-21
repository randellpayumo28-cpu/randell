import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { money } from '../data/products.js'
import { useCart } from '../context/CartContext.jsx'
import { useProducts } from '../context/ProductContext.jsx'
import BottomNav from '../components/BottomNav.jsx'

const CANCEL_REASONS = [
  'Changed my mind',
  'Ordered by mistake',
  'Found a better price elsewhere',
  'Item will arrive too late',
  'Other',
]

// An order counts as Shipped once every seller on it has sent their product.
function displayStatus(order) {
  const sellers = order.sellerIds || []
  const shipped = order.shippedSellerIds || []
  if (order.status === 'To Ship' && sellers.length && sellers.every((id) => shipped.includes(id))) return 'Shipped'
  return order.status
}

function statusBadgeClass(status) {
  if (status === 'Cancelled') return 'bg-danger-subtle text-danger'
  if (status === 'Shipped') return 'bg-success-subtle text-success'
  return 'bg-warning-subtle text-dark'
}

function Orders() {
  const { orders, markOrdersSeen, cancelOrder } = useCart()
  const { products } = useProducts()
  const [cancelTarget, setCancelTarget] = useState(null)
  const [reason, setReason] = useState(CANCEL_REASONS[0])
  const [otherReason, setOtherReason] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    markOrdersSeen()
  }, [])

  function openCancel(order) {
    setCancelTarget(order)
    setReason(CANCEL_REASONS[0])
    setOtherReason('')
    setError('')
  }

  function closeCancel() {
    setCancelTarget(null)
  }

  function confirmCancel() {
    const finalReason = reason === 'Other' ? otherReason.trim() : reason
    if (!finalReason) {
      setError('Please tell us why you want to cancel this order.')
      return
    }
    cancelOrder(cancelTarget.id, finalReason)
    setCancelTarget(null)
  }

  return (
    <div className="bg-bags-pattern app-page">
      <nav className="navbar navbar-light bg-white border-bottom">
        <div className="container d-flex align-items-center">
          <Link to="/dashboard" className="text-dark text-decoration-none me-3">
            <i className="bi bi-arrow-left fs-5"></i>
          </Link>
          <span className="navbar-brand mb-0">My Orders</span>
        </div>
      </nav>

      {orders.length === 0 ? (
        <div className="container mt-5 text-center text-muted py-5">
          <i className="bi bi-clock-history display-4 d-block mb-3"></i>
          <p>No orders yet. Once you check out, your orders will show up here.</p>
        </div>
      ) : (
        <div className="container mt-4">
          {orders.map((order) => (
            <div key={order.id} className="card shadow-sm mb-3">
              <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <span className="small text-muted">
                  {new Date(order.placedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className={`badge ${statusBadgeClass(displayStatus(order))}`}>{displayStatus(order)}</span>
              </div>
              <div className="card-body">
                {order.items.map((item) => (
                  <div key={item.id} className="d-flex align-items-center gap-3 py-2 border-bottom">
                    <img src={item.img || products.find((p) => p.id === item.id)?.img} alt={item.name} className="rounded" style={{ width: '48px', height: '48px', objectFit: 'cover' }} />
                    <div className="flex-grow-1">
                      <div className="fw-semibold small">{item.name}</div>
                      <div className="text-muted small">x{item.qty}</div>
                    </div>
                    <div className="fw-semibold small">{money(item.price * item.qty)}</div>
                  </div>
                ))}

                <div className="d-flex justify-content-between fw-bold mt-3">
                  <span>Order Total</span>
                  <span>{money(order.total)}</span>
                </div>

                <div className="mt-3 pt-3 border-top small text-secondary">
                  <div><i className="bi bi-person-fill me-2"></i>{order.buyer.name}</div>
                  <div><i className="bi bi-geo-alt-fill me-2"></i>{order.buyer.address}</div>
                  <div><i className="bi bi-telephone-fill me-2"></i>{order.buyer.contactNumber}</div>
                  {order.paymentMethod && (
                    <div><i className="bi bi-wallet2 me-2"></i>{order.paymentMethod}</div>
                  )}
                </div>

                {order.status === 'Cancelled' && order.cancelReason && (
                  <div className="alert alert-danger py-2 px-3 small mt-3 mb-0">
                    <i className="bi bi-x-circle-fill me-2"></i>
                    Cancelled: {order.cancelReason}
                  </div>
                )}

                {order.status === 'To Ship' && !(order.shippedSellerIds || []).length && (
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm w-100 mt-3"
                    onClick={() => openCancel(order)}
                  >
                    Cancel Order
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {cancelTarget && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 2150 }} onClick={closeCancel}></div>
          <div className="modal d-block" style={{ zIndex: 2160 }} tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">Cancel Order</h5>
                  <button type="button" className="btn-close" onClick={closeCancel} aria-label="Close"></button>
                </div>
                <div className="modal-body">
                  <p className="small text-muted">Please let us know why you're cancelling this order.</p>

                  <label className="form-label small fw-semibold">Reason</label>
                  <select
                    className="form-select mb-3"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    {CANCEL_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>

                  {reason === 'Other' && (
                    <div className="mb-2">
                      <label className="form-label small fw-semibold">Tell us more</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={otherReason}
                        onChange={(e) => setOtherReason(e.target.value)}
                        placeholder="What's the reason for cancelling?"
                      />
                    </div>
                  )}

                  {error && <div className="alert alert-danger py-2 small mt-2 mb-0">{error}</div>}
                </div>
                <div className="modal-footer d-flex">
                  <button type="button" className="btn btn-outline-secondary flex-grow-1" onClick={closeCancel}>
                    Keep Order
                  </button>
                  <button type="button" className="btn btn-danger flex-grow-1 fw-semibold" onClick={confirmCancel}>
                    Confirm Cancellation
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  )
}

export default Orders
