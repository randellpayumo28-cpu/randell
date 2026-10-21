import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

const API_BASE = 'http://localhost:8080/api'
const TABS = ['Overview', 'Products', 'Users']

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

export default function AdminDashboard() {
  const { currentUser, logout } = useAuth()
  const [tab, setTab] = useState('Overview')
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [categories, setCategories] = useState([])
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState('')

  // Load all data from API
  useEffect(() => {
    fetch(`${API_BASE}/products`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) {
          throw new Error('Expected an array from /api/products but got: ' + JSON.stringify(data))
        }
        setProducts(data)
      })
      .catch(err => {
        console.error('Failed to load products:', err)
        setLoadError('Could not load products. Is the backend server running on ' + API_BASE + '?')
      })

    fetch(`${API_BASE}/users`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) {
          throw new Error('Expected an array from /api/users but got: ' + JSON.stringify(data))
        }
        setUsers(data)
      })
      .catch(err => {
        console.error('Failed to load users:', err)
        setLoadError('Could not load users. Is the backend server running on ' + API_BASE + '?')
      })

    fetch(`${API_BASE}/orders`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) {
          throw new Error('Expected an array from /api/orders but got: ' + JSON.stringify(data))
        }
        const sorted = [...data].sort((a, b) => new Date(b.placedAt || 0) - new Date(a.placedAt || 0))
        setOrders(sorted)
      })
      .catch(err => {
        console.error('Failed to load orders:', err)
        setLoadError('Could not load orders. Is the backend server running on ' + API_BASE + '?')
      })
  }, [])

  // Update categories when products change
  useEffect(() => {
    const values = [...new Set(products.map(p => p.category).filter(Boolean))].sort()
    setCategories(values)
  }, [products])

  const stats = useMemo(() => ({
    products: products.length,
    users: users.length,
    orders: orders.length,
    revenue: orders
      .filter(o => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + Number(o.total || 0), 0)
  }), [products, users, orders])

  function flash(text) {
    setMessage(text)
    window.setTimeout(() => setMessage(''), 2500)
  }

  async function saveProduct(product) {
    if (!product.name.trim() || !product.category.trim()) {
      return flash('Product name and category are required.')
    }
    setBusy(true)
    try {
      const payload = {
        name: product.name.trim(),
        material: product.material.trim(),
        price: Number(product.price || 0),
        badge: product.badge?.trim() || null,
        category: product.category.trim(),
        img: product.img.trim(),
        stock: Math.max(0, Number(product.stock || 0))
      }

      if (!product.id) {
        return flash('Admin can no longer add products. Sellers add products from the Seller Dashboard.')
      }
      await fetch(`${API_BASE}/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      // Refresh list
      const res = await fetch(`${API_BASE}/products`)
      setProducts(await res.json())
      setEditing(null)
      flash('Product saved.')
    } catch (err) {
      console.error(err)
      flash('Could not save product.')
    } finally {
      setBusy(false)
    }
  }

  async function removeProduct(id) {
    if (!window.confirm('Delete this product?')) return
    try {
      await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' })
      setProducts(products.filter(p => p.id !== id))
      flash('Product deleted.')
    } catch (err) {
      console.error(err)
      flash('Could not delete product.')
    }
  }

  async function updateUser(id, updates) {
    try {
      await fetch(`${API_BASE}/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      setUsers(users.map(u => u.id === id ? { ...u, ...updates } : u))
      flash('User updated.')
    } catch (err) {
      console.error(err)
      flash('Could not update user.')
    }
  }

  async function updateOrder(id, status) {
    try {
      await fetch(`${API_BASE}/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      setOrders(orders.map(o => o.id === id ? { ...o, status } : o))
      flash('Order updated.')
    } catch (err) {
      console.error(err)
      flash('Could not update order.')
    }
  }

  function logoutAdmin() {
    logout()
  }

  return (
    <div className="bg-bags-pattern app-page" style={{ minHeight: '100vh' }}>
      <nav className="navbar navbar-dark bg-dark sticky-top shadow-sm">
        <div className="container-fluid px-3">
          <span className="navbar-brand fw-bold">
            <i className="bi bi-bag-fill me-2"></i>Dell's Bag & Co. Admin
          </span>
          <div className="d-flex align-items-center gap-2 text-white small">
            <span className="d-none d-md-inline">
              {currentUser?.fullName || currentUser?.email}
            </span>
            <button className="btn btn-outline-light btn-sm" onClick={logoutAdmin}>
              <i className="bi bi-box-arrow-right me-1"></i>Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid py-3">
        {loadError && <div className="alert alert-danger py-2">{loadError}</div>}
        {message && <div className="alert alert-success py-2">{message}</div>}

        <div className="d-flex gap-2 overflow-auto mb-3">
          {TABS.map(item => (
            <button
              key={item}
              className={`btn btn-sm flex-shrink-0 ${tab === item ? 'btn-dark' : 'btn-outline-dark'}`}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {tab === 'Overview' && (
          <>
            <div className="row g-3">
              {[
                ['Products', stats.products, 'bi-bag'],
                ['Users', stats.users, 'bi-people'],
                ['Orders', stats.orders, 'bi-receipt'],
                ['Revenue', money(stats.revenue), 'bi-cash-stack']
              ].map(([label, value, icon]) => (
                <div className="col-6 col-lg-3" key={label}>
                  <div className="card shadow-sm h-100">
                    <div className="card-body">
                      <i className={`bi ${icon} fs-3`}></i>
                      <div className="text-muted small mt-2">{label}</div>
                      <div className="h4 fw-bold mb-0">{value}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
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

        {tab === 'Users' && <UserManager users={users} updateUser={updateUser} />}
      </div>
    </div>
  )
}

function ProductManager({ products, editing, setEditing, saveProduct, removeProduct, busy }) {
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
              {products.map(p => (
                <tr key={p.id}>
                  <td>
                    {p.img ? (
                      <img src={p.img} alt="" style={{ width: 52, height: 52, objectFit: 'cover' }} className="rounded" />
                    ) : (
                      <i className="bi bi-image fs-3 text-muted" />
                    )}
                  </td>
                  <td>
                    <div className="fw-semibold">{p.name}</div>
                    <small className="text-muted">{p.material}</small>
                  </td>
                  <td>{p.category}</td>
                  <td>{money(p.price)}</td>
                  <td>{p.stock ?? 0}</td>
                  <td className="text-end">
                    <button className="btn btn-outline-dark btn-sm me-1" onClick={() => setEditing({ ...p })}>Edit</button>
                    <button className="btn btn-outline-danger btn-sm" onClick={() => removeProduct(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ProductForm({ product, setProduct, onSave, onCancel, busy }) {
  const change = (key, value) => setProduct(p => ({ ...p, [key]: value }))

  return (
    <div className="border rounded-3 p-3 mb-3 bg-light">
      <div className="row g-2">
        {['name', 'material', 'category', 'badge', 'img'].map(key => (
          <div className={`col-12 ${key === 'img' ? '' : 'col-md-6'}`} key={key}>
            <label className="form-label small text-capitalize">{key}</label>
            <input className="form-control" value={product[key] || ''}
              onChange={e => change(key, e.target.value)} />
          </div>
        ))}
        <div className="col-md-3">
          <label className="form-label small">Price</label>
          <input type="number" min="0" step="0.01" className="form-control"
            value={product.price ?? ''} onChange={e => change('price', e.target.value)} />
        </div>
        <div className="col-md-3">
          <label className="form-label small">Stock</label>
          <input type="number" min="0" className="form-control"
            value={product.stock ?? 0} onChange={e => change('stock', e.target.value)} />
        </div>
        <div className="col-12 d-flex gap-2 mt-2">
          <button className="btn btn-dark" disabled={busy} onClick={onSave}>
            {busy ? 'Saving...' : 'Save'}
          </button>
          <button className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.fullName || u.username || '—'}</td>
                  <td>{u.email || '—'}</td>
                  <td>{u.phone || '—'}</td>
                  <td>
                    <select className="form-select form-select-sm" value={u.role || 'user'}
                      onChange={e => updateUser(u.id, { role: e.target.value })}>
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>
                    <button className="btn btn-outline-secondary btn-sm"
                      onClick={() => updateUser(u.id, { updatedAt: new Date() })}>Save</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td>
                    <span className="small">{o.id}</span>
                    <div className="text-muted small">
                      {o.placedAt ? new Date(o.placedAt).toLocaleString() : '—'}
                    </div>
                  </td>
                  <td>
                    {o.buyer?.name || '—'}
                    <div className="text-muted small">{o.buyer?.contactNumber || ''}</div>
                  </td>
                  <td>{money(o.total)}</td>
                  <td>
                    <select className="form-select form-select-sm" value={o.status || 'To Ship'}
                      onChange={e => updateOrder(o.id, e.target.value)}>
                      <option>To Ship</option>
                      <option>Processing</option>
                      <option>Shipped</option>
                      <option>Delivered</option>
                      <option>Cancelled</option>
                    </select>
                  </td>
                  <td>
                    <div className="small text-muted">{o.items?.length || 0} item(s)</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!orders.length && <div className="text-muted">No orders yet.</div>}
      </div>
    </div>
  )
}