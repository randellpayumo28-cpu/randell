import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { useAuth } from '../context/AuthContext.jsx'
import { db } from '../firebase.js'

const TABS = ['Overview', 'Products', 'Users', 'Orders']

function money(value) {
  return `₱${Number(value || 0).toFixed(2)}`
}

function orderTotal(order) {
  if (Number.isFinite(Number(order.total))) return Number(order.total)
  return (Array.isArray(order.items) ? order.items : []).reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1),
    0
  )
}

function dateValue(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value?.seconds) return new Date(value.seconds * 1000)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const EMPTY_PRODUCT = {
  name: '',
  material: '',
  price: '',
  badge: '',
  category: '',
  img: '',
  stock: 0,
}

export default function AdminDashboard() {
  const { currentUser, logout, authReady } = useAuth()
  const [tab, setTab] = useState('Overview')
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!authReady || !currentUser) return undefined

    setLoading(true)
    setLoadError('')
    const errors = new Set()
    const finish = (label, error) => {
      console.error(`Admin ${label} listener failed:`, error)
      errors.add(label)
      setLoadError(`Unable to load: ${[...errors].join(', ')}. Check your Firestore rules and admin role.`)
      setLoading(false)
    }
    const clear = (label) => {
      errors.delete(label)
      if (!errors.size) setLoadError('')
      setLoading(false)
    }

    const unsubscribers = [
      onSnapshot(collection(db, 'products'), (snapshot) => {
        setProducts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
        clear('products')
      }, (error) => finish('products', error)),
      onSnapshot(collection(db, 'users'), (snapshot) => {
        setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
        clear('users')
      }, (error) => finish('users', error)),
      onSnapshot(collection(db, 'orders'), (snapshot) => {
        const next = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
        next.sort((a, b) => (dateValue(b.placedAt)?.getTime() || 0) - (dateValue(a.placedAt)?.getTime() || 0))
        setOrders(next)
        clear('orders')
      }, (error) => finish('orders', error)),
    ]

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [authReady, currentUser?.uid])

  const stats = useMemo(() => ({
    products: products.length,
    users: users.length,
    orders: orders.length,
    revenue: orders.filter((order) => order.status !== 'Cancelled').reduce((sum, order) => sum + orderTotal(order), 0),
  }), [products, users, orders])

  function flash(text) {
    setMessage(text)
    window.setTimeout(() => setMessage(''), 3000)
  }

  async function saveProduct() {
    if (!editing?.name?.trim() || !editing?.category?.trim()) {
      flash('Product name and category are required.')
      return
    }
    setBusy(true)
    try {
      const { id, ...fields } = editing
      await updateDoc(doc(db, 'products', id), {
        name: fields.name.trim(),
        material: String(fields.material || '').trim(),
        price: Math.max(0, Number(fields.price || 0)),
        badge: String(fields.badge || '').trim() || null,
        category: fields.category.trim(),
        img: String(fields.img || '').trim(),
        stock: Math.max(0, Number(fields.stock || 0)),
        updatedAt: serverTimestamp(),
      })
      setEditing(null)
      flash('Product updated successfully.')
    } catch (error) {
      console.error('Product update failed:', error)
      flash(`Could not update product: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function removeProduct(id) {
    if (!window.confirm('Delete this product?')) return
    try {
      await deleteDoc(doc(db, 'products', id))
      flash('Product deleted successfully.')
    } catch (error) {
      console.error('Product delete failed:', error)
      flash(`Could not delete product: ${error.message}`)
    }
  }

  async function updateUser(id, role) {
    try {
      await updateDoc(doc(db, 'users', id), { role, updatedAt: serverTimestamp() })
      flash('User role updated.')
    } catch (error) {
      console.error('User update failed:', error)
      flash(`Could not update user: ${error.message}`)
    }
  }

  async function updateOrder(id, status) {
    try {
      await updateDoc(doc(db, 'orders', id), { status, updatedAt: serverTimestamp() })
      flash('Order status updated.')
    } catch (error) {
      console.error('Order update failed:', error)
      flash(`Could not update order: ${error.message}`)
    }
  }

  if (!authReady) {
    return <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <div className="text-center"><div className="spinner-border text-dark mb-3" /><div>Checking Firebase authentication...</div></div>
    </div>
  }

  if (!currentUser) return <div className="container py-5"><div className="alert alert-warning">Please sign in to access the admin dashboard.</div></div>

  return (
    <div className="bg-bags-pattern app-page" style={{ minHeight: '100vh' }}>
      <nav className="navbar navbar-dark bg-dark sticky-top shadow-sm">
        <div className="container-fluid px-3">
          <span className="navbar-brand fw-bold"><i className="bi bi-bag-fill me-2" />Dell's Bag &amp; Co. Admin</span>
          <div className="d-flex align-items-center gap-2 text-white small">
            <span className="d-none d-md-inline">{currentUser.fullName || currentUser.displayName || currentUser.email}</span>
            <button className="btn btn-outline-light btn-sm" onClick={logout}><i className="bi bi-box-arrow-right me-1" />Logout</button>
          </div>
        </div>
      </nav>

      <main className="container-fluid py-3">
        {loadError && <div className="alert alert-danger py-2">{loadError}</div>}
        {message && <div className="alert alert-success py-2">{message}</div>}

        <div className="d-flex gap-2 overflow-auto mb-3">
          {TABS.map((item) => <button key={item} className={`btn btn-sm flex-shrink-0 ${tab === item ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setTab(item)}>{item}</button>)}
          <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={() => window.location.reload()} disabled={loading}>
            <i className="bi bi-arrow-clockwise me-1" />{loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loading && <div className="text-muted small mb-3">Loading live Firestore data...</div>}

        {tab === 'Overview' && <div className="row g-3">
          {[
            ['Products', stats.products, 'bi-bag'],
            ['Users', stats.users, 'bi-people'],
            ['Orders', stats.orders, 'bi-receipt'],
            ['Revenue', money(stats.revenue), 'bi-cash-stack'],
          ].map(([label, value, icon]) => <div className="col-6 col-lg-3" key={label}>
            <div className="card shadow-sm h-100"><div className="card-body">
              <i className={`bi ${icon} fs-3`} /><div className="text-muted small mt-2">{label}</div>
              <div className="h4 fw-bold mb-0">{value}</div>
            </div></div>
          </div>)}
        </div>}

        {tab === 'Products' && <section className="card shadow-sm"><div className="card-body">
          <h5 className="fw-bold mb-3">Products</h5>
          {editing && <div className="border rounded-3 p-3 mb-3 bg-light">
            <div className="row g-2">
              {['name', 'material', 'category', 'badge', 'img'].map((key) => <div className="col-12 col-md-6" key={key}>
                <label className="form-label small text-capitalize">{key === 'img' ? 'Image URL' : key}</label>
                <input className="form-control" value={editing[key] ?? ''} onChange={(event) => setEditing((old) => ({ ...old, [key]: event.target.value }))} />
              </div>)}
              <div className="col-md-3"><label className="form-label small">Price</label><input type="number" min="0" step="0.01" className="form-control" value={editing.price ?? ''} onChange={(event) => setEditing((old) => ({ ...old, price: event.target.value }))} /></div>
              <div className="col-md-3"><label className="form-label small">Stock</label><input type="number" min="0" className="form-control" value={editing.stock ?? 0} onChange={(event) => setEditing((old) => ({ ...old, stock: event.target.value }))} /></div>
              <div className="col-12 d-flex gap-2 mt-2"><button className="btn btn-dark" disabled={busy} onClick={saveProduct}>{busy ? 'Saving...' : 'Save'}</button><button className="btn btn-outline-secondary" onClick={() => setEditing(null)}>Cancel</button></div>
            </div>
          </div>}
          <div className="table-responsive"><table className="table align-middle">
            <thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th /></tr></thead>
            <tbody>{products.map((product) => <tr key={product.id}>
              <td>{product.img ? <img src={product.img} alt={product.name || 'Product'} className="rounded" style={{ width: 52, height: 52, objectFit: 'cover' }} /> : <i className="bi bi-image fs-3 text-muted" />}</td>
              <td><div className="fw-semibold">{product.name || '—'}</div><small className="text-muted">{product.material || ''}</small></td>
              <td>{product.category || '—'}</td><td>{money(product.price)}</td><td>{product.stock ?? 0}</td>
              <td className="text-end text-nowrap"><button className="btn btn-outline-dark btn-sm me-1" onClick={() => setEditing({ ...EMPTY_PRODUCT, ...product })}>Edit</button><button className="btn btn-outline-danger btn-sm" onClick={() => removeProduct(product.id)}>Delete</button></td>
            </tr>)}
            {!products.length && <tr><td colSpan="6" className="text-center text-muted py-4">No products found.</td></tr>}</tbody>
          </table></div>
        </div></section>}

        {tab === 'Users' && <section className="card shadow-sm"><div className="card-body">
          <h5 className="fw-bold mb-3">Users</h5><div className="table-responsive"><table className="table align-middle">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th></tr></thead>
            <tbody>{users.map((user) => <tr key={user.id}>
              <td>{user.fullName || user.displayName || user.username || '—'}</td><td>{user.email || '—'}</td><td>{user.phone || '—'}</td>
              <td><select className="form-select form-select-sm" value={user.role || 'user'} disabled={user.id === currentUser.uid} onChange={(event) => updateUser(user.id, event.target.value)}><option value="user">user</option><option value="seller">seller</option><option value="admin">admin</option></select></td>
            </tr>)}
            {!users.length && <tr><td colSpan="4" className="text-center text-muted py-4">No users found.</td></tr>}</tbody>
          </table></div>
        </div></section>}

        {tab === 'Orders' && <section className="card shadow-sm"><div className="card-body">
          <h5 className="fw-bold mb-3">Orders</h5><div className="table-responsive"><table className="table align-middle">
            <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Items</th></tr></thead>
            <tbody>{orders.map((order) => {
              const date = dateValue(order.placedAt || order.createdAt || order.orderDate)
              return <tr key={order.id}>
                <td><span className="small">{order.id}</span><div className="text-muted small">{date ? date.toLocaleString() : '—'}</div></td>
                <td>{order.buyer?.name || '—'}<div className="text-muted small">{order.buyer?.contactNumber || ''}</div></td>
                <td>{money(orderTotal(order))}</td>
                <td><select className="form-select form-select-sm" value={order.status || 'To Ship'} onChange={(event) => updateOrder(order.id, event.target.value)}><option>To Ship</option><option>Processing</option><option>Shipped</option><option>Delivered</option><option>Cancelled</option></select></td>
                <td><span className="small text-muted">{order.items?.length || 0} item(s)</span></td>
              </tr>
            })}
            {!orders.length && <tr><td colSpan="5" className="text-center text-muted py-4">No orders found.</td></tr>}</tbody>
          </table></div>
        </div></section>}
      </main>
    </div>
  )
}
