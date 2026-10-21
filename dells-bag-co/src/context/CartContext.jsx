import { createContext, useContext, useEffect, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from './AuthContext.jsx'
import { useProducts } from './ProductContext.jsx'

const API_BASE = 'http://localhost:8080/api'
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

export function CartProvider({ children }) {
  const { currentUser } = useAuth()
  const { products } = useProducts()
  const [cart, setCart] = useState(loadCart)
  const [orders, setOrders] = useState([])
  const [unseenOrdersCount, setUnseenOrdersCount] = useState(() => {
    try { return JSON.parse(localStorage.getItem(UNSEEN_ORDERS_KEY)) || 0 } catch { return 0 }
  })

  useEffect(() => localStorage.setItem(CART_KEY, JSON.stringify(cart)), [cart])
  useEffect(() => localStorage.setItem(UNSEEN_ORDERS_KEY, JSON.stringify(unseenOrdersCount)), [unseenOrdersCount])

  useEffect(() => {
    if (!currentUser?.uid) { setOrders([]); return undefined }
    const q = query(collection(db, 'orders'), where('userId', '==', currentUser.uid))
    return onSnapshot(q, (snap) => {
      const next = snap.docs.map((d) => {
        const data = d.data()
        return { id: d.id, ...data, placedAt: data.placedAt?.toDate?.()?.toISOString?.() || data.placedAt || new Date().toISOString() }
      })
      next.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt))
      setOrders(next)
    }, (err) => console.error('Could not load orders', err))
  }, [currentUser?.uid])

  function markOrdersSeen() { setUnseenOrdersCount(0) }
  function addToCart(productId) { setCart((prev) => ({ ...prev, [productId]: { qty: (prev[productId]?.qty || 0) + 1, selected: prev[productId]?.selected !== false } })) }
  function changeQuantity(productId, delta) {
    setCart((prev) => {
      const existing = prev[productId]; const newQty = (existing?.qty || 0) + delta; const updated = { ...prev }
      if (newQty <= 0) delete updated[productId]
      else updated[productId] = { qty: newQty, selected: existing?.selected !== false }
      return updated
    })
  }
  function removeFromCart(productId) { setCart((prev) => { const updated = { ...prev }; delete updated[productId]; return updated }) }
  function toggleSelect(productId) { setCart((prev) => prev[productId] ? { ...prev, [productId]: { ...prev[productId], selected: !prev[productId].selected } } : prev) }
  function selectAll(selected) { setCart((prev) => Object.fromEntries(Object.entries(prev).map(([id, v]) => [id, { ...v, selected }]))) }

  const cartEntries = Object.entries(cart)
  const selectedEntries = cartEntries.filter(([, value]) => value.selected)
  const cartCount = cartEntries.reduce((sum, [, value]) => sum + value.qty, 0)
  const allSelected = cartEntries.length > 0 && selectedEntries.length === cartEntries.length
  const getProduct = (id) => products.find((p) => p.id === id)
  const cartTotal = cartEntries.reduce((sum, [id, value]) => { const p = getProduct(id); return sum + (p ? Number(p.price || 0) * value.qty : 0) }, 0)
  const selectedTotal = selectedEntries.reduce((sum, [id, value]) => { const p = getProduct(id); return sum + (p ? Number(p.price || 0) * value.qty : 0) }, 0)
  const selectedCount = selectedEntries.reduce((sum, [, value]) => sum + value.qty, 0)

  async function placeOrder(buyerInfo) {
    if (!selectedEntries.length || !currentUser?.uid) return null
    const items = selectedEntries.map(([id, value]) => {
      const product = getProduct(id)
      // Uploaded pictures are big data URLs, so only keep normal links in the order;
      // the Orders page looks the picture up from the product instead.
      const img = product?.img && !product.img.startsWith('data:') ? product.img : ''
      return { id, name: product?.name || 'Unknown item', img, price: Number(product?.price || 0), qty: value.qty, sellerId: product?.sellerId || null }
    })
    const sellerIds = [...new Set(items.map((item) => item.sellerId).filter(Boolean))]
    const order = {
      userId: currentUser.uid,
      buyer: { name: buyerInfo.name, address: buyerInfo.address, contactNumber: buyerInfo.contactNumber },
      paymentMethod: buyerInfo.paymentMethod || 'COD',
      items,
      sellerIds,
      total: items.reduce((sum, item) => sum + item.price * item.qty, 0),
      status: 'To Ship',
      placedAt: serverTimestamp(),
    }
    const ref = await addDoc(collection(db, 'orders'), order)
    // Tell each seller about the order. Never block the order if the server is off.
    sellerIds.forEach((sellerId) => {
      fetch(`${API_BASE}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerId,
          orderId: ref.id,
          buyer: order.buyer,
          paymentMethod: order.paymentMethod,
          status: order.status,
          items: items.filter((item) => item.sellerId === sellerId),
          placedAt: new Date().toISOString(),
        }),
      }).catch((err) => console.warn('Could not notify seller', err))
    })
    setUnseenOrdersCount((prev) => prev + 1)
    setCart((prev) => { const updated = { ...prev }; selectedEntries.forEach(([id]) => delete updated[id]); return updated })
    return { id: ref.id, ...order, placedAt: new Date().toISOString() }
  }

  async function cancelOrder(orderId, reason) {
    if (!currentUser?.uid) return
    await updateDoc(doc(db, 'orders', orderId), { status: 'Cancelled', cancelReason: reason, cancelledAt: serverTimestamp() })
    fetch(`${API_BASE}/notifications/order/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Cancelled' }),
    }).catch((err) => console.warn('Could not update seller notification', err))
  }

  return <CartContext.Provider value={{ cart, addToCart, changeQuantity, removeFromCart, toggleSelect, selectAll, allSelected, cartCount, cartTotal, selectedTotal, selectedCount, selectedEntries, orders, placeOrder, cancelOrder, unseenOrdersCount, markOrdersSeen }}>
    {children}
  </CartContext.Provider>
}

export function useCart() { return useContext(CartContext) }
