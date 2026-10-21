import { useState } from 'react'
import { money } from '../data/products.js'
import { useProducts } from '../context/ProductContext.jsx'
import { useCart } from '../context/CartContext.jsx'

const PAYMENT_METHODS = [
  { id: 'gcash', label: 'GCash', icon: 'bi-phone', hint: 'Pay via GCash e-wallet' },
  { id: 'maya', label: 'Maya', icon: 'bi-credit-card-2-front', hint: 'Pay via Maya e-wallet' },
  { id: 'cod', label: 'Cash on Delivery', icon: 'bi-cash-coin', hint: 'Pay when your order arrives' },
]

function CheckoutModal({ isOpen, onClose, onPlaced }) {
  const { selectedEntries, selectedTotal, placeOrder } = useCart()
  const { products: PRODUCTS } = useProducts()
  const [form, setForm] = useState({
    name: '',
    contactNumber: '',
    address: '',
    city: '',
    postalCode: '',
    paymentMethod: 'cod',
    walletNumber: '',
  })
  const [error, setError] = useState('')

  if (!isOpen) return null

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function selectPayment(id) {
    setForm((prev) => ({ ...prev, paymentMethod: id, walletNumber: id === 'cod' ? '' : prev.walletNumber }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const { name, contactNumber, address, city, postalCode, paymentMethod, walletNumber } = form

    if (!name.trim() || !contactNumber.trim() || !address.trim() || !city.trim()) {
      setError('Please complete your name, contact number, and delivery address.')
      return
    }

    if ((paymentMethod === 'gcash' || paymentMethod === 'maya') && !walletNumber.trim()) {
      const methodLabel = PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label
      setError(`Please enter the mobile number you'll pay with for ${methodLabel}.`)
      return
    }

    setError('')
    const fullAddress = `${address.trim()}, ${city.trim()}${postalCode.trim() ? ` ${postalCode.trim()}` : ''}`
    const methodInfo = PAYMENT_METHODS.find((m) => m.id === paymentMethod)
    const paymentMethodLabel =
      paymentMethod === 'cod' ? methodInfo.label : `${methodInfo.label} · ${walletNumber.trim()}`

    placeOrder({
      name: name.trim(),
      address: fullAddress,
      contactNumber: contactNumber.trim(),
      paymentMethod: paymentMethodLabel,
    }).then((order) => {
      if (!order) return
      setForm({
        name: '',
        contactNumber: '',
        address: '',
        city: '',
        postalCode: '',
        paymentMethod: 'cod',
        walletNumber: '',
      })
      onPlaced?.(order)
    }).catch((err) => {
      console.error('Could not place order', err)
      setError('Could not place your order. Please try again.')
    })
  }

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 2150 }} onClick={onClose}></div>
      <div className="modal d-block checkout-modal" style={{ zIndex: 2160 }} tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title fw-bold">Checkout</h5>
                <small className="text-muted">Delivery information</small>
              </div>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close checkout"></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="checkout-summary p-3 mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong>Order Summary</strong>
                    <span className="small text-muted">{selectedEntries.length} product{selectedEntries.length !== 1 ? 's' : ''}</span>
                  </div>
                  {selectedEntries.map(([id, value]) => {
                    const p = PRODUCTS.find((prod) => prod.id === id)
                    if (!p) return null
                    return (
                      <div key={id} className="d-flex justify-content-between small py-2 border-top">
                        <span className="text-truncate me-3">{p.name} × {value.qty}</span>
                        <strong>{money(p.price * value.qty)}</strong>
                      </div>
                    )
                  })}
                  <div className="d-flex justify-content-between mt-2 pt-2 border-top">
                    <span className="fw-semibold">Total</span>
                    <span className="fw-bold fs-5" style={{ color: '#ee4d2d' }}>{money(selectedTotal)}</span>
                  </div>
                </div>

                <h6 className="fw-bold mb-3">Recipient Details</h6>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold">Full Name *</label>
                    <input className="form-control" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Juan Dela Cruz" required />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold">Contact Number *</label>
                    <input className="form-control" type="tel" value={form.contactNumber} onChange={(e) => update('contactNumber', e.target.value)} placeholder="09XX XXX XXXX" required />
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-semibold">House / Unit / Street *</label>
                    <input className="form-control" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="House no., street, subdivision" required />
                  </div>
                  <div className="col-12 col-md-7">
                    <label className="form-label small fw-semibold">City / Municipality *</label>
                    <input className="form-control" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="City or municipality" required />
                  </div>
                  <div className="col-12 col-md-5">
                    <label className="form-label small fw-semibold">Postal Code</label>
                    <input className="form-control" value={form.postalCode} onChange={(e) => update('postalCode', e.target.value)} placeholder="e.g. 8000" inputMode="numeric" />
                  </div>
                </div>

                <h6 className="fw-bold mb-3 mt-4">Mode of Payment</h6>
                <div className="row g-2">
                  {PAYMENT_METHODS.map((method) => (
                    <div className="col-12 col-md-4" key={method.id}>
                      <label
                        className={`payment-option d-flex align-items-center gap-2 p-3 border rounded-3 w-100 ${
                          form.paymentMethod === method.id ? 'border-dark bg-light' : 'border-secondary-subtle'
                        }`}
                        style={{ cursor: 'pointer' }}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          className="form-check-input m-0"
                          checked={form.paymentMethod === method.id}
                          onChange={() => selectPayment(method.id)}
                        />
                        <i className={`bi ${method.icon} fs-5`}></i>
                        <div>
                          <div className="fw-semibold small">{method.label}</div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>{method.hint}</div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>

                {(form.paymentMethod === 'gcash' || form.paymentMethod === 'maya') && (
                  <div className="mt-3">
                    <label className="form-label small fw-semibold">
                      {form.paymentMethod === 'gcash' ? 'GCash' : 'Maya'} Mobile Number *
                    </label>
                    <input
                      className="form-control"
                      type="tel"
                      value={form.walletNumber}
                      onChange={(e) => update('walletNumber', e.target.value)}
                      placeholder="09XX XXX XXXX"
                    />
                    <div className="form-text">
                      We'll send payment instructions to this number after you place your order.
                    </div>
                  </div>
                )}

                {error && <div className="alert alert-danger py-2 small mt-3 mb-0">{error}</div>}
              </div>

              <div className="modal-footer d-flex">
                <button type="button" className="btn btn-outline-secondary flex-grow-1" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn text-white flex-grow-1 fw-semibold" style={{ backgroundColor: '#ee4d2d' }}>
                  Place Order · {money(selectedTotal)}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

export default CheckoutModal
