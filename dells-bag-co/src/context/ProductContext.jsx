import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { PRODUCTS as FALLBACK_PRODUCTS } from '../data/products.js'

const ProductContext = createContext(null)
const API_BASE = '/api'

function normalizeProduct(product) {
  return {
    ...product,
    id: String(product.id ?? product.product_id),
    name: product.name || product.product_name || product.product || '',
    product: product.product || product.name || product.product_name || '',
    material: product.material || product.category || '',
    category: product.category || 'Uncategorized',
    price: Number(product.price ?? product.sell_price ?? product.sell ?? 0),
    sell: Number(product.sell ?? product.sell_price ?? product.price ?? 0),
    buy: Number(product.buy ?? product.buy_price ?? 0),
    stock: Number(product.stock || 0),
    // MySQL is the source of truth; accept either stored image field.
    img: product.img || product.image || product.image_path || '',
    image: product.image || product.img || product.image_path || '',
    sellerId: product.sellerId || product.seller_id || null,
    sellerName: product.sellerName || product.seller_name || 'Seller',
  }
}

export function ProductProvider({ children }) {
  const [products, setProducts] = useState(FALLBACK_PRODUCTS)
  const [productsReady, setProductsReady] = useState(false)
  const hasLoadedProducts = useRef(false)

  useEffect(() => {
    let active = true
    const loadProducts = async () => {
      try {
        const response = await fetch(`${API_BASE}/products`)
        if (!response.ok) throw new Error(`Products API returned ${response.status}`)
        const rows = await response.json()
        if (active) {
          setProducts(Array.isArray(rows) ? rows.map(normalizeProduct) : [])
          hasLoadedProducts.current = true
        }
      } catch (error) {
        console.error('Could not load products from XAMPP MySQL API:', error)
        // Keep the existing storefront usable if the local API is temporarily offline.
        if (active && !hasLoadedProducts.current) setProducts(FALLBACK_PRODUCTS)
      } finally {
        if (active) setProductsReady(true)
      }
    }

    loadProducts()
    const refresh = () => loadProducts()
    const interval = window.setInterval(loadProducts, 15000)
    window.addEventListener('focus', refresh)
    window.addEventListener('products-updated', refresh)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('products-updated', refresh)
    }
  }, [])

  const value = useMemo(() => ({ products, productsReady }), [products, productsReady])
  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
}

export function useProducts() {
  return useContext(ProductContext)
}
