import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { fileToCompressedDataUrl } from '../services/imageUpload.js'

const categories = ['Backpack', 'Handbag', 'Tote Bag', 'Sling Bag', 'Travel Bag', 'Wallet']
const blank = { product: '', category: 'Backpack', buy: '', sell: '', stock: '', image: null, currentImage: '' }
const peso = (n) => '₱' + Number(n || 0).toFixed(2)
const API = '/api'

function normalize(p) {
  return {
    ...p,
    id: String(p.id ?? p.product_id),
    product: p.product || p.name || p.product_name || '',
    category: p.category || 'Backpack',
    buy: Number(p.buy ?? p.buy_price ?? 0),
    sell: Number(p.sell ?? p.sell_price ?? p.price ?? 0),
    price: Number(p.price ?? p.sell_price ?? p.sell ?? 0),
    image: p.image || p.img || '',
    stock: Number(p.stock || 0),
  }
}

export default function SellerDashboard() {
  const navigate = useNavigate()
  const { currentUser, logout, getIdToken } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState(null)
  const [modal, setModal] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  async function api(path, options = {}) {
    const token = await getIdToken()
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.message || `Request failed (${response.status})`)
    return result
  }

  async function loadProducts() {
    try {
      const response = await fetch(`${API}/products`)
      if (!response.ok) throw new Error(`Products API returned ${response.status}`)
      const rows = await response.json()
      const visible = (Array.isArray(rows) ? rows : [])
        .map(normalize)
        .filter(p => !p.is_deleted && (p.sellerId === currentUser?.uid || p.seller_id === currentUser?.uid || currentUser?.role === 'admin'))
        .sort((a, b) => a.product.localeCompare(b.product))
      setItems(visible)
      setError('')
    } catch (e) {
      console.error('Load seller products failed:', e)
      setError(e.message || 'Could not load products from XAMPP MySQL.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!currentUser?.uid) { setItems([]); setLoading(false); return }
    loadProducts()
  }, [currentUser?.uid])

  const totalStock = useMemo(() => items.reduce((n, p) => n + Number(p.stock || 0), 0), [items])
  const totalValue = useMemo(() => items.reduce((n, p) => n + Number(p.sell || p.price || 0) * Number(p.stock || 0), 0), [items])

  function change(e) {
    const { name, value, files } = e.target
    setForm(old => ({ ...old, [name]: name === 'image' ? files?.[0] || null : value }))
  }

  async function save(e) {
    e.preventDefault()
    if (!currentUser?.uid) { setError('Please sign in again.'); return }
    setSaving(true); setError(''); setNotice('')
    try {
      const name = form.product.trim()
      const buy = Number(form.buy), sell = Number(form.sell), stock = Number(form.stock)
      if (!name) throw new Error('Enter a product name.')
      if (![buy, sell].every(n => Number.isFinite(n) && n >= 0)) throw new Error('Enter valid prices.')
      if (!Number.isInteger(stock) || stock < 0) throw new Error('Stock must be a whole number of zero or more.')
      const image = form.image ? await fileToCompressedDataUrl(form.image) : form.currentImage
      const payload = { name, product: name, category: form.category, material: form.category, buy, sell, price: sell, stock, image, img: image, badge: null }
      const result = await api(editing ? `/products/${encodeURIComponent(editing)}` : '/products', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      setModal(''); setEditing(null); setForm(blank)
      setNotice(editing ? 'Product updated in MySQL.' : 'Product saved to MySQL.')
      await loadProducts()
      window.dispatchEvent(new Event('products-updated'))
    } catch (e) {
      console.error('Save product failed:', e)
      setError(e.message || 'Could not save product to MySQL.')
    } finally { setSaving(false) }
  }

  function startEdit(p) {
    setEditing(p.id)
    setForm({ product: p.product, category: p.category || 'Backpack', buy: p.buy ?? '', sell: p.sell ?? p.price ?? '', stock: p.stock ?? 0, image: null, currentImage: p.image || p.img || '' })
    setModal('edit'); setError(''); setNotice('')
  }

  async function remove() {
    if (!deleteTarget) return
    setSaving(true); setError('')
    try {
      await api(`/products/${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE' })
      setNotice(`${deleteTarget.product} was deleted from MySQL and the Shop.`)
      setDeleteTarget(null); setModal('')
      await loadProducts()
      window.dispatchEvent(new Event('products-updated'))
    } catch (e) {
      setError(e.message || 'Could not delete product.')
    } finally { setSaving(false) }
  }

  async function signOutUser() { await logout(); navigate('/') }

  return <div className="bg-bags-pattern app-page">
    <header className="bg-warning-subtle bg-gradient py-4 px-3"><div className="container">
      <div className="d-flex justify-content-between align-items-center"><strong className="fs-5">My Selling Dashboard</strong>
        <div className="d-flex gap-2"><button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/dashboard')}>Shop</button><button className="btn btn-outline-secondary btn-sm" onClick={signOutUser}>Log out</button></div>
      </div><p className="small mt-3 mb-0">Welcome, {currentUser?.fullName || currentUser?.username || 'User'}! List and manage your own products here.</p>
    </div></header>
    <main className="container py-4">
      {error && <div className="alert alert-danger">{error}</div>}{notice && <div className="alert alert-success">{notice}</div>}
      <div className="row g-4 mb-4">
        {[['Products', items.length], ['Total stock', totalStock], ['Stock value', peso(totalValue)]].map(([label, value]) => <div className="col-md-4" key={label}><div className="card border-0 shadow-sm"><div className="card-body p-4"><div className="text-uppercase small text-muted">{label}</div><h2 className="display-6 fw-bold mb-0">{value}</h2></div></div></div>)}
      </div>
      <section className="card border-0 shadow-sm"><div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-center mb-3"><div><h2 className="h5 mb-1">My bags</h2><p className="small text-muted mb-0">Your listings are saved in MySQL and appear immediately in the User Shop.</p></div><button className="btn btn-dark btn-sm" onClick={() => { setEditing(null); setForm(blank); setModal('add'); setError('') }}>+ Add Product</button></div>
        <div className="table-responsive"><table className="table table-hover align-middle"><thead><tr><th>ID</th><th>Image</th><th>Product</th><th>Category</th><th>Buy</th><th>Sell</th><th>Stock</th><th>Actions</th></tr></thead><tbody>
          {loading ? <tr><td colSpan="8" className="text-center py-4">Loading MySQL products...</td></tr> : items.length ? items.map(p => <tr key={p.id}><td>{p.id.slice(0, 8)}</td><td>{p.image ? <img src={p.image} alt={p.product} style={{ width: 48, height: 48, objectFit: 'cover' }} /> : '—'}</td><td>{p.product}</td><td>{p.category}</td><td>{peso(p.buy)}</td><td>{peso(p.sell)}</td><td>{p.stock}</td><td><button className="btn btn-sm btn-outline-primary me-1" onClick={() => startEdit(p)}>Edit</button><button className="btn btn-sm btn-outline-danger" onClick={() => { setDeleteTarget(p); setModal('delete'); setError('') }}>Delete</button></td></tr>) : <tr><td colSpan="8" className="text-center py-4">No products yet. Tap Add Product to start.</td></tr>}
        </tbody></table></div>
      </div></section>
    </main>
    {modal && <div className="modal-backdrop fade show" style={{ zIndex: 2000, backgroundColor: 'rgba(0,0,0,.55)', opacity: 1 }}><div className="modal d-block" tabIndex="-1" role="dialog" style={{ zIndex: 2001, backgroundColor: 'transparent' }}><div className="modal-dialog modal-dialog-centered"><div className="modal-content" style={{ backgroundColor: '#fff', opacity: 1, color: '#212529', border: '1px solid rgba(0,0,0,.12)', boxShadow: '0 1rem 3rem rgba(0,0,0,.25)' }}>
      {modal === 'delete' ? <><div className="modal-header"><h5 className="modal-title">Delete Product</h5><button type="button" className="btn-close" disabled={saving} onClick={() => { setModal(''); setDeleteTarget(null) }} /></div><div className="modal-body">{error && <div className="alert alert-danger">{error}</div>}Are you sure you want to delete <strong>{deleteTarget?.product}</strong>? This removes it from the Shop.</div><div className="modal-footer"><button type="button" className="btn btn-secondary" disabled={saving} onClick={() => { setModal(''); setDeleteTarget(null) }}>Cancel</button><button type="button" className="btn btn-danger" disabled={saving} onClick={remove}>{saving ? 'Deleting...' : 'Delete Product'}</button></div></> : <form onSubmit={save}><div className="modal-header"><h5 className="modal-title">{editing ? 'Edit Product' : 'Add Product'}</h5><button type="button" className="btn-close" disabled={saving} onClick={() => setModal('')} /></div><div className="modal-body">
        {error && <div className="alert alert-danger">{error}</div>}
        {form.currentImage && !form.image && <img src={form.currentImage} alt="Current product" style={{ width: 90, height: 90, objectFit: 'cover' }} className="mb-2" />}
        <label className="form-label">Product image</label><input className="form-control mb-3" type="file" name="image" accept="image/*" onChange={change} />
        <label className="form-label">Product name</label><input className="form-control mb-3" name="product" value={form.product} onChange={change} required />
        <label className="form-label">Category</label><select className="form-select mb-3" name="category" value={form.category} onChange={change}>{categories.map(c => <option key={c}>{c}</option>)}</select>
        <div className="row"><div className="col"><label className="form-label">Buy price</label><input className="form-control" type="number" min="0" step="0.01" name="buy" value={form.buy} onChange={change} required /></div><div className="col"><label className="form-label">Sell price</label><input className="form-control" type="number" min="0" step="0.01" name="sell" value={form.sell} onChange={change} required /></div><div className="col"><label className="form-label">Stock</label><input className="form-control" type="number" min="0" step="1" name="stock" value={form.stock} onChange={change} required /></div></div>
      </div><div className="modal-footer"><button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setModal('')}>Cancel</button><button className="btn btn-dark" disabled={saving}>{saving ? 'Saving...' : 'Save Product'}</button></div></form>}
    </div></div></div></div>}
  </div>
}
