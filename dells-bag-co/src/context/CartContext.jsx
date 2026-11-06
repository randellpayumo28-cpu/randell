import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useProducts } from './ProductContext.jsx'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\\/$/, '')
const CART_KEY = 'dellsBagCoCart'
const UNSEEN_ORDERS_KEY = 'dellsBagCoUnseenOrders'
const CartContext = createContext(null)

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY)) || {}
    const migrated = {}
    for (const [id, value] of Object.entries(saved)) {
      if (typeof value === 'number') migrated[id] = { qty: value, selected: true }
      else if (value && typeof value === 'object') migrated[id] = { qty: value.qty || 0, selected: value.selected !== false }
    }
    return migrated
  } catch { return {} }
}

function normalizeOrder(order) {
  return {
    ...order,
    id: String(order.id || order.firebase_order_id || order.order_id),
    buyer: {
      name: order.buyer_name || order.customer_name || '',
      address: order.buyer_address || '',
      contactNumber: order.buyer_contact || '',
    },
    placedAt: order.placed_at || order.placedAt || order.created_at || new Date().toISOString(),
    items: (order.items || []).map(item => ({ ...item, id: String(item.product_id || item.id), price: Number(item.price || 0), qty: Number(item.qty || item.quantity || 1) })),
  }
}

export function CartProvider({ children }) {
  const { currentUser, getIdToken } = useAuth()
  const { products } = useProducts()
  const [cart, setCart] = useState(loadCart)
  const [orders, setOrders] = useState([])
  const [unseenOrdersCount, setUnseenOrdersCount] = useState(() => {
    try { return JSON.parse(localStorage.getItem(UNSEEN_ORDERS_KEY)) || 0 } catch { return 0 }
  })

  async function api(path, options = {}) {
    const token = await getIdToken()
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`)
    return body
  }

  useEffect(() => localStorage.setItem(CART_KEY, JSON.stringify(cart)), [cart])
  useEffect(() => localStorage.setItem(UNSEEN_ORDERS_KEY, JSON.stringify(unseenOrdersCount)), [unseenOrdersCount])

  useEffect(() => {
    let active = true
    if (!currentUser?.uid) { setOrders([]); return () => { active = false } }
    api('/orders/mine').then(rows => { if (active) setOrders((Array.isArray(rows) ? rows : []).map(normalizeOrder)) })
      .catch(error => console.error('Could not load MySQL orders:', error))
    return () => { active = false }
  }, [currentUser?.uid])

  function markOrdersSeen() { setUnseenOrdersCount(0) }
  function addToCart(productId) { setCart(prev => ({ ...prev, [productId]: { qty: (prev[productId]?.qty || 0) + 1, selected: prev[productId]?.selected !== false } })) }
  function changeQuantity(productId, delta) {
    setCart(prev => {
      const existing = prev[productId]; const newQty = (existing?.qty || 0) + delta; const updated = { ...prev }
      if (newQty <= 0) delete updated[productId]
      else updated[productId] = { qty: newQty, selected: existing?.selected !== false }
      return updated
    })
  }
  function removeFromCart(productId) { setCart(prev => { const updated = { ...prev }; delete updated[productId]; return updated }) }
  function toggleSelect(productId) { setCart(prev => prev[productId] ? { ...prev, [productId]: { ...prev[productId], selected: !prev[productId].selected } } : prev) }
  function selectAll(selected) { setCart(prev => Object.fromEntries(Object.entries(prev).map(([id, value]) => [id, { ...value, selected }]))) }

  const cartEntries = Object.entries(cart)
  const selectedEntries = cartEntries.filter(([, value]) => value.selected)
  const cartCount = cartEntries.reduce((sum, [, value]) => sum + value.qty, 0)
  const allSelected = cartEntries.length > 0 && selectedEntries.length === cartEntries.length
  const getProduct = id => products.find(product => String(product.id) === String(id))
  const cartTotal = cartEntries.reduce((sum, [id, value]) => { const product = getProduct(id); return sum + (product ? Number(product.price || 0) * value.qty : 0) }, 0)
  const selectedTotal = selectedEntries.reduce((sum, [id, value]) => { const product = getProduct(id); return sum + (product ? Number(product.price || 0) * value.qty : 0) }, 0)
  const selectedCount = selectedEntries.reduce((sum, [, value]) => sum + value.qty, 0)

  async function placeOrder(buyerInfo) {
    if (!selectedEntries.length || !currentUser?.uid) return null
    const items = selectedEntries.map(([id, value]) => ({ id, qty: value.qty }))
    const saved = normalizeOrder(await api('/orders', {
      method: 'POST',
      body: JSON.stringify({ buyer: { name: buyerInfo.name, address: buyerInfo.address, contactNumber: buyerInfo.contactNumber }, paymentMethod: buyerInfo.paymentMethod || 'COD', items }),
    }))
    setOrders(prev => [saved, ...prev.filter(order => order.id !== saved.id)])
    setUnseenOrdersCount(prev => prev + 1)
    setCart(prev => { const updated = { ...prev }; selectedEntries.forEach(([id]) => delete updated[id]); return updated })
    window.dispatchEvent(new Event('products-updated'))
    return saved
  }

  async function cancelOrder(orderId, reason) {
    if (!currentUser?.uid) return
    await api(`/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) })
    setOrders(prev => prev.map(order => order.id === String(orderId) ? { ...order, status: 'Cancelled', cancelReason: reason } : order))
    window.dispatchEvent(new Event('products-updated'))
  }

  return <CartContext.Provider value={{ cart, addToCart, changeQuantity, removeFromCart, toggleSelect, selectAll, allSelected, cartCount, cartTotal, selectedTotal, selectedCount, selectedEntries, orders, placeOrder, cancelOrder, unseenOrdersCount, markOrdersSeen }}>
    {children}
  </CartContext.Provider>
}

export function useCart() { return useContext(CartContext) }
