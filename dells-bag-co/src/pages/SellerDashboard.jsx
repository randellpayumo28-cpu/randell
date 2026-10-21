import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const server_url = 'http://localhost:8080'
const api_url = `${server_url}/api/product`

const categories = ['Backpack', 'Handbag', 'Tote Bag', 'Sling Bag', 'Travel Bag', 'Wallet']

function money(value) {
    return `₱${Number(value || 0).toFixed(2)}`
}

const emptyForm = {
    product: '',
    category: 'Backpack',
    buy: '',
    sell: '',
    stock: '',
    image: null,        
    currentImage: ''    
}

// FormData ang gamit para makasama ang image file
function buildFormData(form) {
    const data = new FormData()
    data.append('product', form.product)
    data.append('category', form.category)
    data.append('buy', form.buy)
    data.append('sell', form.sell)
    data.append('stock', form.stock)
    if (form.image) {
        data.append('image', form.image)
    }
    return data
}

export default function SellerDashboard() {
    const navigate = useNavigate()
    const { currentUser, logout } = useAuth()

    const [items, setItems] = useState([])
    const [form, setForm] = useState(emptyForm)
    const [editID, setEditID] = useState('')
    const [editForm, setEditForm] = useState(emptyForm)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(api_url)
            .then((response) => response.json())
            .then((data) => {
                if (!Array.isArray(data)) {
                    throw new Error('Invalid product response')
                }
                setItems(data)
            })
            .catch((err) => {
                console.log('Fetch error:', err)
                setError('Could not load products. Please check that the server is running.')
            })
            .finally(() => setLoading(false))
    }, [])

    function handleChange(setter) {
        return (event) => {
            const { name, value, files } = event.target
            if (name === 'image') {
                setter((oldForm) => ({ ...oldForm, image: files[0] || null }))
            } else {
                setter((oldForm) => ({ ...oldForm, [name]: value }))
            }
        }
    }

    const changeForm = handleChange(setForm)
    const changeEditForm = handleChange(setEditForm)

    function openAddModal() {
        setForm(emptyForm)
        setMessage('')
        setError('')
        setIsAddModalOpen(true)
    }

    async function formSubmit(event) {
        event.preventDefault()
        setMessage('')
        setError('')

        try {
            // walang Content-Type header dito, ang browser na bahala (multipart)
            const response = await fetch(api_url, {
                method: 'POST',
                body: buildFormData(form)
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.message || 'Failed to add product')
            }

            setItems((oldItems) => [...oldItems, data])
            setForm(emptyForm)
            setIsAddModalOpen(false)
            setMessage('Product added successfully.')
        } catch (err) {
            console.log('Add error:', err)
            setError(err.message || 'Could not add the product.')
        }
    }

    function openEditModal(item) {
        setEditID(item.id)
        setEditForm({
            product: item.product || '',
            category: item.category || 'Backpack',
            buy: item.buy || '',
            sell: item.sell || '',
            stock: item.stock || '',
            image: null,
            currentImage: item.image || ''
        })
        setMessage('')
        setError('')
        setIsEditModalOpen(true)
    }

    async function handleUpdate(event) {
        event.preventDefault()
        setMessage('')
        setError('')

        try {
            const response = await fetch(`${api_url}/${editID}`, {
                method: 'PUT',
                body: buildFormData(editForm)
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update product')
            }

            setItems((oldItems) => oldItems.map((item) => {
                if (Number(item.id) === Number(editID)) {
                    return data
                }
                return item
            }))

            setEditID('')
            setEditForm(emptyForm)
            setIsEditModalOpen(false)
            setMessage('Product updated successfully.')
        } catch (err) {
            console.log('Update error:', err)
            setError(err.message || 'Could not update the product.')
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Are you sure you want to delete this product?')) {
            return
        }

        setMessage('')
        setError('')

        try {
            const response = await fetch(`${api_url}/${id}`, {
                method: 'DELETE'
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.message || 'Failed to delete product')
            }

            setItems((oldItems) => oldItems.filter((item) => Number(item.id) !== Number(id)))
            setMessage('Product deleted successfully.')
        } catch (err) {
            console.log('Delete error:', err)
            setError(err.message || 'Could not delete the product.')
        }
    }

    function closeAddModal() {
        setIsAddModalOpen(false)
        setForm(emptyForm)
        setError('')
    }

    function closeEditModal() {
        setIsEditModalOpen(false)
        setEditID('')
        setEditForm(emptyForm)
        setError('')
    }

    function logoutSeller() {
        logout()
        navigate('/')
    }

    const totalStock = items.reduce((total, item) => total + Number(item.stock || 0), 0)
    const totalValue = items.reduce((total, item) => total + Number(item.sell || 0) * Number(item.stock || 0), 0)

    return (
        <div className="bg-bags-pattern app-page">
            <div className="bg-warning-subtle bg-gradient pt-4 pb-4 px-3">
                <div className="container">
                    <div className="d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-shop-window fs-4 text-dark"></i>
                            <span className="fw-bold fs-5 text-dark">Seller Dashboard</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <button type="button" className="btn btn-outline-secondary btn-sm rounded-circle" onClick={() => navigate('/dashboard')} aria-label="Switch to shopper dashboard">
                                <i className="bi bi-person"></i>
                            </button>
                            <button type="button" className="btn btn-outline-secondary btn-sm rounded-circle" onClick={logoutSeller} aria-label="Log out">
                                <i className="bi bi-box-arrow-right"></i>
                            </button>
                        </div>
                    </div>
                    <p className="mb-0 mt-3 small text-primary-emphasis">
                        Welcome, {currentUser?.fullName || currentUser?.username || 'Seller'}! Manage your bag inventory here.
                    </p>
                </div>
            </div>

            <main className="container py-4">
                {message && <div className="alert alert-success py-2 small">{message}</div>}
                {error && !isAddModalOpen && !isEditModalOpen && <div className="alert alert-danger py-2 small">{error}</div>}

                <div className="row g-4 mb-4">
                    <div className="col-md-6 col-lg-4">
                        <section className="card border-0 shadow-sm h-100">
                            <div className="card-body p-4">
                                <p className="text-uppercase small fw-semibold text-muted mb-2">Products</p>
                                <h2 className="display-6 fw-bold mb-0">{items.length}</h2>
                            </div>
                        </section>
                    </div>
                    <div className="col-md-6 col-lg-4">
                        <section className="card border-0 shadow-sm h-100">
                            <div className="card-body p-4">
                                <p className="text-uppercase small fw-semibold text-muted mb-2">Total stock</p>
                                <h2 className="display-6 fw-bold mb-0">{totalStock}</h2>
                            </div>
                        </section>
                    </div>
                    <div className="col-md-6 col-lg-4">
                        <section className="card border-0 shadow-sm h-100">
                            <div className="card-body p-4">
                                <p className="text-uppercase small fw-semibold text-muted mb-2">Stock value</p>
                                <h2 className="display-6 fw-bold mb-0">{money(totalValue)}</h2>
                            </div>
                        </section>
                    </div>
                </div>

                <section className="card border-0 shadow-sm">
                    <div className="card-body p-4">
                        <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
                            <div>
                                <h2 className="h5 fw-bold mb-1">My bags</h2>
                                <p className="text-muted small mb-0">Bags in your inventory.</p>
                            </div>
                            <button type="button" className="btn btn-dark btn-sm" onClick={openAddModal}>
                                <i className="bi bi-plus-lg me-1"></i>Add Product
                            </button>
                        </div>

                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Image</th>
                                        <th>Product</th>
                                        <th>Category</th>
                                        <th className="text-end">Buy</th>
                                        <th className="text-end">Sell</th>
                                        <th className="text-end">Stock</th>
                                        <th className="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="8" className="text-center py-4 text-muted">Loading products...</td></tr>
                                    ) : items.length > 0 ? (
                                        items.map((item, index) => (
                                            <tr key={item.id || index}>
                                                <td>{item.id}</td>
                                                <td>
                                                    {item.image ? (
                                                        <img
                                                            src={`${server_url}${item.image}`}
                                                            alt={item.product}
                                                            className="rounded border"
                                                            style={{ width: 50, height: 50, objectFit: 'cover' }}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="rounded border bg-light d-flex align-items-center justify-content-center text-muted"
                                                            style={{ width: 50, height: 50 }}
                                                        >
                                                            <i className="bi bi-image"></i>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="fw-semibold">{item.product}</td>
                                                <td>{item.category}</td>
                                                <td className="text-end">{money(item.buy)}</td>
                                                <td className="text-end">{money(item.sell)}</td>
                                                <td className="text-end">{item.stock}</td>
                                                <td>
                                                    <div className="d-flex justify-content-center gap-2">
                                                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openEditModal(item)}>Edit</button>
                                                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(item.id)}>Delete</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="8" className="text-center py-4 text-muted">No products yet. Tap Add Product to start.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </main>

            {isAddModalOpen && (
                <ProductModal title="Add Product" form={form} onChange={changeForm} onSubmit={formSubmit} onClose={closeAddModal} error={error} submitText="Add Product" />
            )}

            {isEditModalOpen && (
                <ProductModal title="Edit Product" form={editForm} onChange={changeEditForm} onSubmit={handleUpdate} onClose={closeEditModal} error={error} submitText="Save Changes" editID={editID} />
            )}
        </div>
    )
}

function ProductModal({ title, form, onChange, onSubmit, onClose, error, submitText, editID }) {
    // preview: bagong piniling file muna, kung wala, yung existing image
    const previewUrl = useMemo(() => {
        if (form.image) {
            return URL.createObjectURL(form.image)
        }
        if (form.currentImage) {
            return `${server_url}${form.currentImage}`
        }
        return ''
    }, [form.image, form.currentImage])

    return (
        <>
            <div className="modal-backdrop fade show" style={{ zIndex: 2000 }} onClick={onClose}></div>
            <div className="modal show d-block" style={{ zIndex: 2010 }} tabIndex="-1" role="dialog" onClick={onClose}>
                <div className="modal-dialog modal-dialog-centered" role="document" onClick={(event) => event.stopPropagation()}>
                    <div className="modal-content border-0 shadow">
                        <div className="modal-header">
                            <h5 className="modal-title">{title}</h5>
                            <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
                        </div>
                        <form onSubmit={onSubmit}>
                            <div className="modal-body">
                                {error && <div className="alert alert-danger py-2 small">{error}</div>}
                                {editID !== undefined && (
                                    <div className="mb-3">
                                        <label className="form-label">ID</label>
                                        <input type="text" className="form-control" value={editID} readOnly />
                                    </div>
                                )}

                                <div className="mb-3">
                                    <label htmlFor="image" className="form-label">Image</label>
                                    {previewUrl && (
                                        <div className="mb-2">
                                            <img
                                                src={previewUrl}
                                                alt="Preview"
                                                className="rounded border"
                                                style={{ width: 120, height: 120, objectFit: 'cover' }}
                                            />
                                        </div>
                                    )}
                                    <input id="image" name="image" type="file" accept="image/*" className="form-control" onChange={onChange} />
                                </div>

                                <div className="mb-3">
                                    <label htmlFor="product" className="form-label">Product</label>
                                    <input id="product" name="product" type="text" className="form-control" value={form.product} onChange={onChange} required />
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="category" className="form-label">Category</label>
                                    <select id="category" name="category" className="form-select" value={form.category} onChange={onChange} required>
                                        {categories.map((cat) => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="row g-3">
                                    <div className="col-md-4">
                                        <label htmlFor="buy" className="form-label">Buy</label>
                                        <input id="buy" name="buy" type="number" min="0" step="0.01" className="form-control" value={form.buy} onChange={onChange} required />
                                    </div>
                                    <div className="col-md-4">
                                        <label htmlFor="sell" className="form-label">Sell</label>
                                        <input id="sell" name="sell" type="number" min="0" step="0.01" className="form-control" value={form.sell} onChange={onChange} required />
                                    </div>
                                    <div className="col-md-4">
                                        <label htmlFor="stock" className="form-label">Stock</label>
                                        <input id="stock" name="stock" type="number" min="0" className="form-control" value={form.stock} onChange={onChange} required />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                                <button type="submit" className="btn btn-dark">{submitText}</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </>
    )
}