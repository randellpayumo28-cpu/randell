import { useState } from 'react'
import { money } from '../data/products.js'
import { useProducts } from '../context/ProductContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import CheckoutModal from './CheckoutModal.jsx'

function CartOffcanvas({ isOpen, onClose }) {
  const { products: PRODUCTS } = useProducts()
  const {
    cart,
    changeQuantity,
    removeFromCart,
    toggleSelect,
    selectAll,
    allSelected,
    selectedTotal,
    selectedCount,
  } = useCart()
  const entries = Object.entries(cart)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [confirmedOrder, setConfirmedOrder] = useState(null)

  function handleCheckout() {
    if (selectedCount > 0) setCheckoutOpen(true)
  }

  function handlePlaced(order) {
    setCheckoutOpen(false)
    setConfirmedOrder(order)
  }

  function handleCloseAll() {
    setConfirmedOrder(null)
    onClose()
  }

  return (
    <>
      {isOpen && <div className="offcanvas-backdrop fade show" style={{ zIndex: 2050 }} onClick={onClose}></div>}

      <aside
        className={`offcanvas offcanvas-end cart-offcanvas ${isOpen ? 'show' : ''}`}
        style={{ visibility: isOpen ? 'visible' : 'hidden' }}
        tabIndex="-1"
        aria-label="Shopping cart"
      >
        <div className="offcanvas-header border-bottom bg-white">
          <div>
            <h5 className="offcanvas-title fw-bold mb-0">My Cart</h5>
            <small className="text-muted">Select the items you want to checkout</small>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close cart"></button>
        </div>

        <div className="offcanvas-body d-flex flex-column p-0">
          {entries.length === 0 ? (
            <div className="text-center text-muted py-5 px-3">
              <i className="bi bi-cart-x display-4 d-block mb-3"></i>
              <h6>Your cart is empty</h6>
              <p className="small mb-0">Add some bags from the shop to get started.</p>
            </div>
          ) : (
            <>
              <div className="d-flex align-items-center gap-2 px-3 py-3 bg-white border-bottom">
                <input
                  type="checkbox"
                  className="cart-checkbox form-check-input m-0"
                  id="select-all-cart"
                  checked={allSelected}
                  onChange={(e) => selectAll(e.target.checked)}
                />
                <label htmlFor="select-all-cart" className="small fw-semibold mb-0 flex-grow-1">
                  Select all
                </label>
                <span className="small text-muted">{selectedCount} item{selectedCount !== 1 ? 's' : ''} selected</span>
              </div>

              <div className="flex-grow-1 overflow-auto bg-light p-2">
                {entries.map(([id, value]) => {
                  const p = PRODUCTS.find((prod) => prod.id === id)
                  if (!p) return null

                  return (
                    <div key={id} className="cart-item d-flex align-items-center gap-2 p-2 mb-2 border rounded-2">
                      <input
                        type="checkbox"
                        className="cart-checkbox form-check-input m-0"
                        checked={!!value.selected}
                        onChange={() => toggleSelect(id)}
                        aria-label={`Select ${p.name} for checkout`}
                      />
                      <img src={p.img} alt={p.name} className="rounded-2 flex-shrink-0" style={{ width: 72, height: 72, objectFit: 'cover' }} />
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-semibold small text-truncate">{p.name}</div>
                        <div className="text-muted small">{money(p.price)}</div>
                        <div className="d-flex align-items-center mt-2">
                          <button className="btn btn-light border btn-sm py-0 px-2" onClick={() => changeQuantity(id, -1)} aria-label="Decrease quantity">−</button>
                          <span className="small px-2">{value.qty}</span>
                          <button className="btn btn-light border btn-sm py-0 px-2" onClick={() => changeQuantity(id, 1)} aria-label="Increase quantity">+</button>
                        </div>
                      </div>
                      <div className="text-end align-self-stretch d-flex flex-column justify-content-between">
                        <strong className="small">{money(p.price * value.qty)}</strong>
                        <button className="btn btn-link btn-sm text-danger p-0" onClick={() => removeFromCart(id)}>Delete</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <div className="border-top bg-white p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="small text-muted">Selected subtotal</span>
              <span className="fs-5 fw-bold" style={{ color: '#ee4d2d' }}>{money(selectedTotal)}</span>
            </div>
            <button className="btn text-white w-100 fw-semibold py-2" style={{ backgroundColor: '#ee4d2d' }} disabled={selectedCount === 0} onClick={handleCheckout}>
              Checkout ({selectedCount})
            </button>
          </div>
        </div>
      </aside>

      <CheckoutModal isOpen={checkoutOpen} onClose={() => setCheckoutOpen(false)} onPlaced={handlePlaced} />

      {confirmedOrder && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 2250 }} onClick={handleCloseAll}></div>
          <div className="modal d-block" style={{ zIndex: 2260 }} tabIndex="-1" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content text-center p-4">
                <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '3rem' }}></i>
                <h5 className="mt-3">Order Placed!</h5>
                <p className="text-muted small mb-4">
                  Thanks, {confirmedOrder.buyer.name}! Your order will be delivered to {confirmedOrder.buyer.address}.
                  We'll reach you at {confirmedOrder.buyer.contactNumber} for updates.
                </p>
                <div className="small text-secondary mb-4">
                  <i className="bi bi-wallet2 me-2"></i>Payment: {confirmedOrder.paymentMethod}
                </div>
                <button className="btn text-white" style={{ backgroundColor: '#ee4d2d' }} onClick={handleCloseAll}>Done</button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default CartOffcanvas
