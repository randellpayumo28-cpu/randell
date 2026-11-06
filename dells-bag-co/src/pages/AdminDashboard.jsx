
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

// API configuration — unchanged
const API_BASE = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? 'https://randell.onrender.com'
    : 'http://localhost:8080')
).replace(/\/+$/, '')

const TABS = ['Overview', 'Products', 'Users', 'Orders']

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

function getOrderTotal(order) {
  if (
    order.total !== undefined &&
    order.total !== null &&
    Number.isFinite(Number(order.total))
  ) {
    return Number(order.total)
  }

  return (Array.isArray(order.items) ? order.items : []).reduce(
    (sum, item) =>
      sum + Number(item.price || 0) * Number(item.qty || 1),
    0
  )
}

function getDateValue(value) {
  if (!value) return null

  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value)
  }

  if (value.seconds) {
    return new Date(value.seconds * 1000)
  }

  return null
}

export default function AdminDashboard() {
  // getIdToken is the important addition.
  // currentUser remains the existing Firestore profile.
  const {
    currentUser,
    logout,
    getIdToken,
    authReady,
  } = useAuth()

  const [tab, setTab] = useState('Overview')
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  // ---------- Firebase authentication headers ----------

  const getAuthHeaders = useCallback(async (json = false) => {
    if (typeof getIdToken !== 'function') {
      throw new Error(
        'getIdToken is unavailable. Please check AuthContext.jsx.'
      )
    }

    // Get the token from the actual Firebase Authentication user.
    const token = await getIdToken()

    if (!token) {
      throw new Error(
        'Firebase ID token is unavailable. Please sign in again.'
      )
    }

    return {
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
    }
  }, [getIdToken])

  // ---------- API request ----------

  const apiRequest = useCallback(async (path, options = {}) => {
    const headers = await getAuthHeaders(Boolean(options.body))

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    })

    const contentType = response.headers.get('content-type') || ''

    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    if (!response.ok) {
      const messageText =
        typeof data === 'object' ? data.message : data

      throw new Error(
        messageText || `Request failed (${response.status})`
      )
    }

    if (typeof data === 'string') {
      throw new Error(
        'The API returned HTML/text instead of JSON. Check VITE_API_URL and the backend route.'
      )
    }

    return data
  }, [getAuthHeaders])

  // ---------- Load dashboard data ----------

  const loadAllData = useCallback(async () => {
    // Do not request protected endpoints before Firebase is ready.
    if (!authReady || !currentUser) {
      return
    }

    setLoading(true)
    setLoadError('')

    try {
      const results = await Promise.allSettled([
        apiRequest('/api/products'),
        apiRequest('/api/users'),
        apiRequest('/api/orders'),
      ])

      const errors = []

      if (
        results[0].status === 'fulfilled' &&
        Array.isArray(results[0].value)
      ) {
        setProducts(results[0].value)
      } else {
        errors.push(
          `Products: ${
            results[0].status === 'rejected'
              ? results[0].reason.message
              : 'Invalid API response'
          }`
        )
      }

      if (
        results[1].status === 'fulfilled' &&
        Array.isArray(results[1].value)
      ) {
        setUsers(results[1].value)
      } else {
        errors.push(
          `Users: ${
            results[1].status === 'rejected'
              ? results[1].reason.message
              : 'Invalid API response'
          }`
        )
      }

      if (
        results[2].status === 'fulfilled' &&
        Array.isArray(results[2].value)
      ) {
        setOrders(results[2].value)
      } else {
        errors.push(
          `Orders: ${
            results[2].status === 'rejected'
              ? results[2].reason.message
              : 'Invalid API response'
          }`
        )
      }

      if (errors.length) {
        setLoadError(errors.join(' | '))
      }
    } catch (error) {
      console.error('Dashboard loading failed:', error)
      setLoadError(error.message)
    } finally {
      setLoading(false)
    }
  }, [apiRequest, authReady, currentUser])

  useEffect(() => {
    if (authReady && currentUser) {
      loadAllData()
    }
  }, [authReady, currentUser, loadAllData])

  // ---------- Dashboard statistics ----------

  const stats = useMemo(() => ({
    products: products.length,
    users: users.length,
    orders: orders.length,
    revenue: orders
      .filter(order => order.status !== 'Cancelled')
      .reduce(
        (sum, order) => sum + getOrderTotal(order),
        0
      ),
  }), [products, users, orders])

  function flash(text) {
    setMessage(text)
    window.setTimeout(() => setMessage(''), 3000)
  }

  // ---------- Save product ----------

  async function saveProduct(product) {
    if (
      !String(product.name || '').trim() ||
      !String(product.category || '').trim()
    ) {
      flash('Product name and category are required.')
      return
    }

    setBusy(true)

    try {
      const payload = {
        name: String(product.name).trim(),
        material: String(product.material || '').trim(),
        price: Number(product.price || 0),
        badge: product.badge?.trim() || null,
        category: String(product.category).trim(),
        img: String(product.img || '').trim(),
        stock: Math.max(0, Number(product.stock || 0)),
      }

      if (!product.id) {
        flash(
          'Admin can no longer add products. Sellers add products from the Seller Dashboard.'
        )
        return
      }

      await apiRequest(
        `/api/products/${encodeURIComponent(product.id)}`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        }
      )

      await loadAllData()
      setEditing(null)
      flash('Product saved.')
    } catch (error) {
      console.error('Save product failed:', error)
      flash(`Could not save product: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  // ---------- Delete product ----------

  async function removeProduct(id) {
    if (!window.confirm('Delete this product?')) return

    try {
      await apiRequest(
        `/api/products/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      )

      setProducts(previous =>
        previous.filter(product => product.id !== id)
      )

      flash('Product deleted.')
    } catch (error) {
      console.error('Delete product failed:', error)
      flash(`Could not delete product: ${error.message}`)
    }
  }

  // ---------- Update user ----------

  async function updateUser(id, updates) {
    try {
      const saved = await apiRequest(
        `/api/users/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        }
      )

      setUsers(previous =>
        previous.map(user =>
          user.id === id ? saved : user
        )
      )

      flash('User updated.')
    } catch (error) {
      console.error('Update user failed:', error)
      flash(`Could not update user: ${error.message}`)
    }
  }

  // ---------- Update order ----------

  async function updateOrder(id, status) {
    try {
      const saved = await apiRequest(
        `/api/orders/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }
      )

      setOrders(previous =>
        previous.map(order =>
          order.id === id
            ? { ...order, ...saved }
            : order
        )
      )

      flash('Order updated.')
    } catch (error) {
      console.error('Update order failed:', error)
      flash(`Could not update order: ${error.message}`)
    }
  }

  function logoutAdmin() {
    logout()
  }

  // ---------- Wait for Firebase authentication ----------

  if (!authReady) {
    return (
      <div
        className="d-flex justify-content-center align-items-center bg-bags-pattern"
        style={{ minHeight: '100vh' }}
      >
        <div className="text-center">
          <div
            className="spinner-border text-dark mb-3"
            role="status"
          />
          <div>Checking Firebase authentication...</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-bags-pattern app-page"
      style={{ minHeight: '100vh' }}
    >
      <nav className="navbar navbar-dark bg-dark sticky-top shadow-sm">
        <div className="container-fluid px-3">
          <span className="navbar-brand fw-bold">
            <i className="bi bi-bag-fill me-2"></i>
            Dell's Bag & Co. Admin
          </span>

          <div className="d-flex align-items-center gap-2 text-white small">
            <span className="d-none d-md-inline">
              {currentUser?.fullName ||
                currentUser?.displayName ||
                currentUser?.email}
            </span>

            <button
              className="btn btn-outline-light btn-sm"
              onClick={logoutAdmin}
            >
              <i className="bi bi-box-arrow-right me-1"></i>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid py-3">
        {loadError && (
          <div className="alert alert-danger py-2">
            {loadError}

            <button
              className="btn btn-sm btn-outline-danger ms-2"
              onClick={loadAllData}
              disabled={loading}
            >
              Retry
            </button>
          </div>
        )}

        {message && (
          <div className="alert alert-success py-2">
            {message}
          </div>
        )}

        <div className="d-flex gap-2 overflow-auto mb-3">
          {TABS.map(item => (
            <button
              key={item}
              className={`btn btn-sm flex-shrink-0 ${
                tab === item
                  ? 'btn-dark'
                  : 'btn-outline-dark'
              }`}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}

          <button
            className="btn btn-sm btn-outline-secondary ms-auto"
            onClick={loadAllData}
            disabled={loading}
          >
            <i className="bi bi-arrow-clockwise me-1"></i>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loading && (
          <div className="text-muted small mb-3">
            Loading dashboard data...
          </div>
        )}

        {tab === 'Overview' && (
          <div className="row g-3">
            {[
              ['Products', stats.products, 'bi-bag'],
              ['Users', stats.users, 'bi-people'],
              ['Orders', stats.orders, 'bi-receipt'],
              ['Revenue', money(stats.revenue), 'bi-cash-stack'],
            ].map(([label, value, icon]) => (
              <div className="col-6 col-lg-3" key={label}>
                <div className="card shadow-sm h-100">
                  <div className="card-body">
                    <i className={`bi ${icon} fs-3`}></i>
                    <div className="text-muted small mt-2">
                      {label}
                    </div>
                    <div className="h4 fw-bold mb-0">
                      {value}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Products' && (
          <ProductManager
            products={products}
            editing={editing}
            setEditing={setEditing}
            saveProduct={saveProduct}
            removeProduct={removeProduct}
            busy={busy}
          />
        )}

        {tab === 'Users' && (
          <UserManager
            users={users}
            updateUser={updateUser}
          />
        )}

        {tab === 'Orders' && (
          <OrderManager
            orders={orders}
            updateOrder={updateOrder}
          />
        )}
      </div>
    </div>
  )
}

// ==================================================
// PRODUCT MANAGER
// ==================================================

function ProductManager({
  products,
  editing,
  setEditing,
  saveProduct,
  removeProduct,
  busy,
}) {
  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="fw-bold mb-0">Products</h5>
        </div>

        {editing && (
          <ProductForm
            product={editing}
            setProduct={setEditing}
            onSave={() => saveProduct(editing)}
            onCancel={() => setEditing(null)}
            busy={busy}
          />
        )}

        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {products.map(product => (
                <tr key={product.id}>
                  <td>
                    {product.img ? (
                      <img
                        src={product.img}
                        alt={product.name || 'Product'}
                        style={{
                          width: 52,
                          height: 52,
                          objectFit: 'cover',
                        }}
                        className="rounded"
                      />
                    ) : (
                      <i className="bi bi-image fs-3 text-muted" />
                    )}
                  </td>

                  <td>
                    <div className="fw-semibold">
                      {product.name}
                    </div>
                    <small className="text-muted">
                      {product.material}
                    </small>
                  </td>

                  <td>{product.category}</td>
                  <td>{money(product.price)}</td>
                  <td>{product.stock ?? 0}</td>

                  <td className="text-end">
                    <button
                      className="btn btn-outline-dark btn-sm me-1"
                      onClick={() => setEditing({ ...product })}
                    >
                      Edit
                    </button>

                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => removeProduct(product.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {!products.length && (
                <tr>
                  <td
                    colSpan="6"
                    className="text-center text-muted py-4"
                  >
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ==================================================
// PRODUCT FORM
// ==================================================

function ProductForm({
  product,
  setProduct,
  onSave,
  onCancel,
  busy,
}) {
  const change = (key, value) => {
    setProduct(previous => ({
      ...previous,
      [key]: value,
    }))
  }

  return (
    <div className="border rounded-3 p-3 mb-3 bg-light">
      <div className="row g-2">
        {['name', 'material', 'category', 'badge', 'img'].map(key => (
          <div
            className={`col-12 ${
              key === 'img' ? '' : 'col-md-6'
            }`}
            key={key}
          >
            <label className="form-label small text-capitalize">
              {key}
            </label>

            <input
              className="form-control"
              value={product[key] ?? ''}
              onChange={event =>
                change(key, event.target.value)
              }
            />
          </div>
        ))}

        <div className="col-md-3">
          <label className="form-label small">Price</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="form-control"
            value={product.price ?? ''}
            onChange={event =>
              change('price', event.target.value)
            }
          />
        </div>

        <div className="col-md-3">
          <label className="form-label small">Stock</label>
          <input
            type="number"
            min="0"
            className="form-control"
            value={product.stock ?? 0}
            onChange={event =>
              change('stock', event.target.value)
            }
          />
        </div>

        <div className="col-12 d-flex gap-2 mt-2">
          <button
            className="btn btn-dark"
            disabled={busy}
            onClick={onSave}
          >
            {busy ? 'Saving...' : 'Save'}
          </button>

          <button
            className="btn btn-outline-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================================================
// USER MANAGER
// ==================================================

function UserManager({ users, updateUser }) {
  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <h5 className="fw-bold mb-3">Users</h5>

        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
              </tr>
            </thead>

            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>
                    {user.fullName ||
                      user.displayName ||
                      user.username ||
                      '—'}
                  </td>

                  <td>{user.email || '—'}</td>
                  <td>{user.phone || '—'}</td>

                  <td>
                    <select
                      className="form-select form-select-sm"
                      value={user.role || 'user'}
                      onChange={event =>
                        updateUser(user.id, {
                          role: event.target.value,
                        })
                      }
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))}

              {!users.length && (
                <tr>
                  <td
                    colSpan="4"
                    className="text-center text-muted py-4"
                  >
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ==================================================
// ORDER MANAGER
// ==================================================

function OrderManager({ orders, updateOrder }) {
  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <h5 className="fw-bold mb-3">Orders</h5>

        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Items</th>
              </tr>
            </thead>

            <tbody>
              {orders.map(order => {
                const date = getDateValue(
                  order.placedAt ||
                  order.createdAt ||
                  order.orderDate
                )

                return (
                  <tr key={order.id}>
                    <td>
                      <span className="small">
                        {order.id}
                      </span>

                      <div className="text-muted small">
                        {date && !Number.isNaN(date.getTime())
                          ? date.toLocaleString()
                          : '—'}
                      </div>
                    </td>

                    <td>
                      {order.buyer?.name || '—'}

                      <div className="text-muted small">
                        {order.buyer?.contactNumber || ''}
                      </div>
                    </td>

                    <td>{money(getOrderTotal(order))}</td>

                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={order.status || 'To Ship'}
                        onChange={event =>
                          updateOrder(
                            order.id,
                            event.target.value
                          )
                        }
                      >
                        <option>To Ship</option>
                        <option>Processing</option>
                        <option>Shipped</option>
                        <option>Delivered</option>
                        <option>Cancelled</option>
                      </select>
                    </td>

                    <td>
                      <div className="small text-muted">
                        {order.items?.length || 0} item(s)
                      </div>
                    </td>
                  </tr>
                )
              })}

              {!orders.length && (
                <tr>
                  <td
                    colSpan="5"
                    className="text-center text-muted py-4"
                  >
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
