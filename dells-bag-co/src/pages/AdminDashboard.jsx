import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\\/$/, '')
const TABS = ['Overview', 'Products', 'Users', 'Orders']
const EMPTY_PRODUCT = { name: '', material: '', category: '', badge: '', img: '', price: '', stock: 0 }

function money(value) { return `₱${Number(value || 0).toFixed(2)}` }
function orderTotal(order) { return Number(order.total || 0) }
function dateValue(value) { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date : null }

export default function AdminDashboard() {
  const { currentUser, logout, authReady, getIdToken, isAdmin } = useAuth()
  const [tab, setTab] = useState('Overview')
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const api = useCallback(async (path, options = {}) => {
    const token = await getIdToken()
    const headers = { Authorization: `Bearer ${token}`, ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers }
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`)
    return data
  }, [getIdToken])

  const loadAll = useCallback(async () => {
    if (!currentUser || !isAdmin) return
    setLoading(true); setError('')
    try {
      const [p, u, o] = await Promise.all([api('/products'), api('/users'), api('/orders')])
      setProducts(Array.isArray(p) ? p : [])
      setUsers(Array.isArray(u) ? u : [])
      setOrders(Array.isArray(o) ? o : [])
    } catch (err) { setError(err.message || 'Could not load Admin Dashboard data.') }
    finally { setLoading(false) }
  }, [api, currentUser, isAdmin])

  useEffect(() => { if (authReady && currentUser && isAdmin) loadAll(); else if (authReady) setLoading(false) }, [authReady, currentUser, isAdmin, loadAll])

  const stats = useMemo(() => ({
    products: products.length, users: users.length, orders: orders.length,
    revenue: orders.filter(order => order.status !== 'Cancelled').reduce((sum, order) => sum + orderTotal(order), 0),
  }), [products, users, orders])

  function flash(text) { setMessage(text); window.setTimeout(() => setMessage(''), 3000) }

  async function saveProduct() {
    if (!editing?.name?.trim() || !editing?.category?.trim()) return flash('Product name and category are required.')
    setBusy(true)
    try {
      const fields = { name: editing.name.trim(), material: editing.material || '', category: editing.category.trim(), badge: editing.badge || '', img: editing.img || '', price: Number(editing.price || 0), stock: Math.max(0, Number(editing.stock || 0)) }
      await api(editing.id ? `/products/${encodeURIComponent(editing.id)}` : '/products', { method: editing.id ? 'PUT' : 'POST', body: JSON.stringify(fields) })
      setEditing(null); await loadAll(); flash('Product saved to MySQL.')
    } catch (err) { flash(err.message) } finally { setBusy(false) }
  }

  async function removeProduct(id) {
    if (!window.confirm('Delete this product?')) return
    try { await api(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadAll(); flash('Product deleted.') }
    catch (err) { flash(err.message) }
  }

  async function updateUser(id, role) {
    try { await api(`/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ role }) }); await loadAll(); flash('User role updated.') }
    catch (err) { flash(err.message) }
  }

  async function updateOrder(id, status) {
    try { await api(`/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await loadAll(); flash('Order status updated.') }
    catch (err) { flash(err.message) }
  }

  if (!authReady || loading) return <div className="container py-5 text-center"><div className="spinner-border" /><p className="mt-2">Loading MySQL Admin Dashboard...</p></div>
  if (!currentUser) return <div className="container py-5"><div className="alert alert-warning">Please sign in.</div></div>
  if (!isAdmin) return <div className="container py-5"><div className="alert alert-danger">Admin access only.</div><button className="btn btn-dark" onClick={logout}>Logout</button></div>

  return <div className="bg-bags-pattern app-page" style={{ minHeight: '100vh' }}>
    <nav className="navbar navbar-dark bg-dark sticky-top shadow-sm"><div className="container-fluid px-3">
      <span className="navbar-brand fw-bold">Dell's Bag &amp; Co. Admin</span>
      <div className="d-flex align-items-center gap-2 text-white small"><span>{currentUser.fullName || currentUser.email}</span><button className="btn btn-outline-light btn-sm" onClick={logout}>Logout</button></div>
    </div></nav>
    <main className="container-fluid py-3">
      {error && <div className="alert alert-danger">{error}</div>}{message && <div className="alert alert-success">{message}</div>}
      <div className="d-flex gap-2 overflow-auto mb-3">{TABS.map(item => <button key={item} className={`btn btn-sm ${tab === item ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setTab(item)}>{item}</button>)}<button className="btn btn-sm btn-outline-secondary ms-auto" onClick={loadAll}>Refresh</button></div>
      {tab === 'Overview' && <div className="row g-3">{[['Products', stats.products], ['Users', stats.users], ['Orders', stats.orders], ['Revenue', money(stats.revenue)]].map(([label, value]) => <div className="col-6 col-lg-3" key={label}><div className="card shadow-sm"><div className="card-body"><div className="text-muted small">{label}</div><div className="h4 fw-bold mb-0">{value}</div></div></div></div>)}</div>}
      {tab === 'Products' && <section className="card shadow-sm"><div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3"><h5 className="fw-bold mb-0">All Shop Products</h5><button className="btn btn-dark btn-sm" onClick={() => setEditing({ ...EMPTY_PRODUCT })}>Add product</button></div>
        {editing && <div className="border rounded p-3 mb-3 bg-light"><div className="row g-2">{['name', 'material', 'category', 'badge', 'img'].map(key => <div className="col-12 col-md-6" key={key}><label className="form-label small text-capitalize">{key === 'img' ? 'Image URL' : key}</label><input className="form-control" value={editing[key] ?? ''} onChange={e => setEditing(old => ({ ...old, [key]: e.target.value }))} /></div>)}<div className="col-md-3"><label className="form-label small">Price</label><input type="number" min="0" step="0.01" className="form-control" value={editing.price ?? ''} onChange={e => setEditing(old => ({ ...old, price: e.target.value }))} /></div><div className="col-md-3"><label className="form-label small">Stock</label><input type="number" min="0" className="form-control" value={editing.stock ?? 0} onChange={e => setEditing(old => ({ ...old, stock: e.target.value }))} /></div><div className="col-12 d-flex gap-2 mt-2"><button className="btn btn-dark" disabled={busy} onClick={saveProduct}>{busy ? 'Saving...' : 'Save'}</button><button className="btn btn-outline-secondary" onClick={() => setEditing(null)}>Cancel</button></div></div></div>}
        <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Product</th><th>Owner</th><th>Category</th><th>Price</th><th>Stock</th><th /></tr></thead><tbody>{products.map(p => <tr key={p.id}><td>{p.name}</td><td>{p.sellerName || p.seller_name || '—'}</td><td>{p.category}</td><td>{money(p.price)}</td><td>{p.stock}</td><td className="text-end text-nowrap"><button className="btn btn-outline-dark btn-sm me-1" onClick={() => setEditing({ ...EMPTY_PRODUCT, ...p })}>Edit</button><button className="btn btn-outline-danger btn-sm" onClick={() => removeProduct(p.id)}>Delete</button></td></tr>)}{!products.length && <tr><td colSpan="6" className="text-center text-muted">No products.</td></tr>}</tbody></table></div>
      </div></section>}
      {tab === 'Users' && <section className="card shadow-sm"><div className="card-body"><h5>Users</h5><div className="table-responsive"><table className="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>{users.map(u => <tr key={u.id}><td>{u.name || '—'}</td><td>{u.email || '—'}</td><td><select className="form-select form-select-sm" value={u.role || 'user'} disabled={u.uid === currentUser.uid || u.firebase_uid === currentUser.uid} onChange={e => updateUser(u.id, e.target.value)}><option value="user">user</option><option value="admin">admin</option></select></td></tr>)}</tbody></table></div></div></section>}
      {tab === 'Orders' && <section className="card shadow-sm"><div className="card-body"><h5>All Orders</h5><div className="table-responsive"><table className="table align-middle"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Items</th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td>{o.id}<div className="small text-muted">{dateValue(o.placed_at || o.placedAt)?.toLocaleString() || '—'}</div></td><td>{o.buyer_name || o.customer_name || '—'}<div className="small text-muted">{o.buyer_contact || ''}</div></td><td>{money(o.total)}</td><td><select className="form-select form-select-sm" value={o.status || 'To Ship'} onChange={e => updateOrder(o.id, e.target.value)}>{['To Ship', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(status => <option key={status}>{status}</option>)}</select></td><td>{o.items?.length || 0}</td></tr>)}</tbody></table></div></div></section>}
    </main>
  </div>
}
