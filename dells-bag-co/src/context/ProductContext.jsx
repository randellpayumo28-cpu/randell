import { addDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { db } from '../firebase.js'
import { PRODUCTS as FALLBACK_PRODUCTS } from '../data/products.js'

const ProductContext = createContext(null)

export function ProductProvider({ children }) {
  const [products, setProducts] = useState(FALLBACK_PRODUCTS)
  const [productsReady, setProductsReady] = useState(false)
  const firstSnapshot = useRef(true)

  useEffect(() => {
    return onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        if (snapshot.empty) {
          setProducts(firstSnapshot.current ? FALLBACK_PRODUCTS : [])
        } else {
          const next = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
          next.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
          setProducts(next)
        }
        firstSnapshot.current = false
        setProductsReady(true)
      },
      (error) => {
        console.error('Could not load products', error)
        setProducts(FALLBACK_PRODUCTS)
        setProductsReady(true)
      }
    )
  }, [])

  async function addProduct(product, seller) {
    const payload = {
      name: product.name.trim(),
      material: product.material.trim(),
      price: Number(product.price),
      badge: product.badge?.trim() || null,
      category: product.category.trim(),
      img: product.img || '',
      stock: Math.max(0, Number(product.stock || 0)),
      sellerId: seller?.uid || seller?.id || null,
      sellerName: seller?.fullName || seller?.username || seller?.email || 'Seller',
      createdAt: serverTimestamp(),
    }
    return addDoc(collection(db, 'products'), payload)
  }

  const value = useMemo(
    () => ({ products, productsReady, addProduct }),
    [products, productsReady]
  )

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
}

export function useProducts() {
  return useContext(ProductContext)
}
