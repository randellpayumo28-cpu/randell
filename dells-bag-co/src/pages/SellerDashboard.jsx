import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext.jsx'
import { db } from '../firebase.js'
import { fileToCompressedDataUrl } from '../services/imageUpload.js'
import { PRODUCTS as SHOP_FALLBACK_PRODUCTS } from '../data/products.js'

const categories = ['Backpack', 'Handbag', 'Tote Bag', 'Sling Bag', 'Travel Bag', 'Wallet']
const blank = { product: '', category: 'Backpack', buy: '', sell: '', stock: '', image: null, currentImage: '' }
const peso = (n) => '₱' + Number(n || 0).toFixed(2)

export default function SellerDashboard() {
  const navigate = useNavigate()
  const { currentUser, logout } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState(null)
  const [modal, setModal] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    if (!currentUser?.uid) { setItems([]); setLoading(false); return }
    setLoading(true)
    return onSnapshot(collection(db, 'products'), (snap) => {
      const rows = snap.docs.map((d) => {
        const p = d.data()
        return { id: d.id, ...p, product: p.product || p.name || '', sell: p.sell ?? p.price ?? 0, image: p.image || p.img || '' }
      })
      // Shop displays these Firestore documents to customers. Show the same catalog here,
      // including older products that were saved before sellerId was added.
      const activeRows = rows.filter((p) => !p.isDeleted)
      const visibleRows = activeRows.length ? activeRows : rows.length ? [] : SHOP_FALLBACK_PRODUCTS.map((p) => ({
        ...p, id: p.id, product: p.name, sell: p.price, image: p.img, stock: p.stock ?? 0,
        buy: p.buy ?? 0, isShopFallback: true,
      }))
      visibleRows.sort((a, b) => a.product.localeCompare(b.product))
      setItems(visibleRows); setError(''); setLoading(false)
    }, (e) => {
      console.error('Seller products Firestore error:', e)
      setError(e.code === 'permission-denied' ? 'Firebase access denied. Check the seller account and Firestore security rules.' : e.message || 'Could not load products from Firebase.')
      setLoading(false)
    })
  }, [currentUser?.uid])

  const totalStock = useMemo(() => items.reduce((n, p) => n + Number(p.stock || 0), 0), [items])
  const totalValue = useMemo(() => items.reduce((n, p) => n + Number(p.sell || p.price || 0) * Number(p.stock || 0), 0), [items])

  function change(e) {
    const { name, value, files } = e.target
    setForm((old) => ({ ...old, [name]: name === 'image' ? files?.[0] || null : value }))
  }

  async function save(e) {
    e.preventDefault()
    if (!currentUser?.uid) { setError('Please sign in again.'); return }
    setSaving(true); setError(''); setNotice('')
    try {
      const name = form.product.trim()
      const buy = Number(form.buy), sell = Number(form.sell), stock = Number(form.stock)
      if (!name) throw new Error('Enter a product name.')
      if (![buy, sell].every((n) => Number.isFinite(n) && n >= 0)) throw new Error('Enter valid prices.')
      if (!Number.isInteger(stock) || stock < 0) throw new Error('Stock must be a whole number of zero or more.')
      const img = form.image ? await fileToCompressedDataUrl(form.image) : form.currentImage
      const data = { name, product: name, category: form.category, material: form.category, buy, sell, price: sell, stock, img, image: img, sellerId: currentUser.uid, sellerName: currentUser.fullName || currentUser.username || currentUser.email || 'Seller', updatedAt: serverTimestamp() }
      if (editing) await setDoc(doc(db, 'products', editing), { ...data, isDeleted: false }, { merge: true })
      else await addDoc(collection(db, 'products'), { ...data, isDeleted: false, createdAt: serverTimestamp() })
      setModal(''); setEditing(null); setForm(blank); setNotice(editing ? 'Product updated.' : 'Product added.')
    } catch (e) {
      console.error('Save product error:', e)
      setError(e.message || 'Could not save product.')
    } finally { setSaving(false) }
  }

  function startEdit(p) {
    setEditing(p.id)
    setForm({ product: p.product, category: p.category || 'Backpack', buy: p.buy ?? '', sell: p.sell ?? p.price ?? '', stock: p.stock ?? 0, image: null, currentImage: p.image || p.img || '' })
    setModal('edit'); setError(''); setNotice('')
  }

  async function remove() {
    if (!deleteTarget || !currentUser?.uid) return
    setSaving(true); setError('')
    try {
      await setDoc(doc(db, 'products', deleteTarget.id), { isDeleted: true, sellerId: currentUser.uid, updatedAt: serverTimestamp() }, { merge: true })
      setNotice(deleteTarget.product + ' was deleted from the Shop.')
      setDeleteTarget(null); setModal('')
    } catch (e) { setError(e.message || 'Could not delete product.') }
    finally { setSaving(false) }
  }

  async function signOutSeller() { await logout(); navigate('/') }

  return <div className="bg-bags-pattern app-page">
    <header className="bg-warning-subtle bg-gradient py-4 px-3"><div className="container">
      <div className="d-flex justify-content-between align-items-center"><strong className="fs-5">Seller Dashboard</strong>
        <div className="d-flex gap-2"><button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/dashboard')}>Shop</button><button className="btn btn-outline-secondary btn-sm" onClick={signOutSeller}>Log out</button></div>
      </div><p className="small mt-3 mb-0">Welcome, {currentUser?.fullName || currentUser?.username || 'Seller'}! Manage your bag inventory here.</p>
    </div></header>
    <main className="container py-4">
      {error && <div className="alert alert-danger">{error}</div>}{notice && <div className="alert alert-success">{notice}</div>}
      <div className="row g-4 mb-4">
        {[['Products', items.length], ['Total stock', totalStock], ['Stock value', peso(totalValue)]].map(([label, value]) => <div className="col-md-4" key={label}><div className="card border-0 shadow-sm"><div className="card-body p-4"><div className="text-uppercase small text-muted">{label}</div><h2 className="display-6 fw-bold mb-0">{value}</h2></div></div></div>)}
      </div>
      <section className="card border-0 shadow-sm"><div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-center mb-3"><div><h2 className="h5 mb-1">My bags</h2><p className="small text-muted mb-0">Manage the products displayed in the Shop. Use Edit or Delete to manage each bag.</p></div><button className="btn btn-dark btn-sm" onClick={() => { setEditing(null); setForm(blank); setModal('add'); setError('') }}>+ Add Product</button></div>
        <div className="table-responsive"><table className="table table-hover align-middle"><thead><tr><th>ID</th><th>Image</th><th>Product</th><th>Category</th><th>Buy</th><th>Sell</th><th>Stock</th><th>Actions</th></tr></thead><tbody>
          {loading ? <tr><td colSpan="8" className="text-center py-4">Loading Shop products from Firebase...</td></tr> : items.length ? items.map((p) => <tr key={p.id}><td>{p.id.slice(0, 8)}</td><td>{p.image ? <img src={p.image} alt={p.product} style={{ width: 48, height: 48, objectFit: 'cover' }} /> : '—'}</td><td>{p.product}</td><td>{p.category}</td><td>{peso(p.buy)}</td><td>{peso(p.sell)}</td><td>{p.stock}</td><td><><button className="btn btn-sm btn-outline-primary me-1" onClick={() => startEdit(p)}>Edit</button><button className="btn btn-sm btn-outline-danger" onClick={() => { setDeleteTarget(p); setModal('delete'); setError('') }}>Delete</button></></td></tr>) : <tr><td colSpan="8" className="text-center py-4">No products yet. Tap Add Product to start.</td></tr>}
        </tbody></table></div>
      </div></section>
    </main>
    {modal && <div className="modal-backdrop fade show" style={{ zIndex: 2000, backgroundColor: "rgba(0,0,0,.55)", opacity: 1 }}><div className="modal d-block" tabIndex="-1" role="dialog" style={{ zIndex: 2001, backgroundColor: "transparent" }}><div className="modal-dialog modal-dialog-centered"><div className="modal-content" style={{ backgroundColor: "#fff", opacity: 1, color: "#212529", border: "1px solid rgba(0,0,0,.12)", boxShadow: "0 1rem 3rem rgba(0,0,0,.25)" }}>
      {modal === 'delete' ? <><div className="modal-header"><h5 className="modal-title">Delete Product</h5><button type="button" className="btn-close" disabled={saving} onClick={() => { setModal(''); setDeleteTarget(null) }}></button></div><div className="modal-body">{error && <div className="alert alert-danger">{error}</div>}Are you sure you want to delete <strong>{deleteTarget?.product}</strong>? This will also remove it from the Shop.</div><div className="modal-footer"><button type="button" className="btn btn-secondary" disabled={saving} onClick={() => { setModal(''); setDeleteTarget(null) }}>Cancel</button><button type="button" className="btn btn-danger" disabled={saving} onClick={remove}>{saving ? 'Deleting...' : 'Delete Product'}</button></div></> : <form onSubmit={save}><div className="modal-header"><h5 className="modal-title">{editing ? 'Edit Product' : 'Add Product'}</h5><button type="button" className="btn-close" disabled={saving} onClick={() => setModal('')}></button></div>
        <div className="modal-body">
          {error && <div className="alert alert-danger">{error}</div>}
          {form.currentImage && !form.image && <img src={form.currentImage} alt="Current product" style={{ width: 90, height: 90, objectFit: 'cover' }} className="mb-2" />}
          <label className="form-label">Product image</label><input className="form-control mb-3" type="file" name="image" accept="image/*" onChange={change} />
          <label className="form-label">Product name</label><input className="form-control mb-3" name="product" value={form.product} onChange={change} required />
          <label className="form-label">Category</label><select className="form-select mb-3" name="category" value={form.category} onChange={change}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
          <div className="row"><div className="col"><label className="form-label">Buy price</label><input className="form-control" type="number" min="0" step="0.01" name="buy" value={form.buy} onChange={change} required /></div><div className="col"><label className="form-label">Sell price</label><input className="form-control" type="number" min="0" step="0.01" name="sell" value={form.sell} onChange={change} required /></div><div className="col"><label className="form-label">Stock</label><input className="form-control" type="number" min="0" step="1" name="stock" value={form.stock} onChange={change} required /></div></div>
        </div><div className="modal-footer"><button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setModal('')}>Cancel</button><button className="btn btn-dark" disabled={saving}>{saving ? 'Saving...' : 'Save Product'}</button></div>
      </form>}
    </div></div></div></div>}
  </div>
}
