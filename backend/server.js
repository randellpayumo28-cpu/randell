require('dotenv').config()

const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const mysql = require('mysql2/promise')
const fs = require('fs')

// Firebase Admin is used ONLY to verify Firebase login tokens.
// Application data is stored in MySQL.
const { initializeApp, cert, getApps } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')

// ---------- Server setup ----------

const PORT = process.env.PORT || 8080
const app = express()

app.use(express.json({ limit: '10mb' }))
app.use(cors({
  origin: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(value => value.trim())
    : true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// ---------- MySQL connection (XAMPP) ----------

const db = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'randell_bagcommerce',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

// ---------- Firebase Admin initialization ----------

let firebaseAuth = null
const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON

if (rawServiceAccount) {
  try {
    const serviceAccount = JSON.parse(rawServiceAccount)
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
    }

    const firebaseApp = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID
        })

    firebaseAuth = getAuth(firebaseApp)
    console.log('Firebase Admin initialized')
  } catch (error) {
    console.error('Firebase Admin initialization failed:', error.message)
    process.exit(1)
  }
} else {
  console.warn('FIREBASE_SERVICE_ACCOUNT_JSON is missing. Protected routes will reject requests.')
}

// ---------- Image upload setup ----------

const uploadDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}
app.use('/uploads', express.static(uploadDir))

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed.'))
  }
})

// ---------- Helper functions ----------

function removeImageFile(imagePath) {
  if (!imagePath) return
  const filePath = path.join(uploadDir, path.basename(imagePath))
  fs.unlink(filePath, error => {
    if (error && error.code !== 'ENOENT') {
      console.error('Image removal failed:', error.message)
    }
  })
}

function validNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function productResponse(row) {
  return {
    ...row,
    id: row.product_id,
    name: row.product_name,
    product: row.product_name,
    buy: Number(row.buy_price || 0),
    sell: Number(row.sell_price || 0),
    price: Number(row.sell_price || 0),
    img: row.image || '',
    sellerId: row.seller_id,
    sellerName: row.seller_name
  }
}

function orderResponse(row, items = []) {
  return {
    ...row,
    id: row.firebase_order_id || String(row.order_id),
    total: Number(row.total || 0),
    items
  }
}

// ---------- Admin authentication ----------

async function requireAdmin(req, res, next) {
  try {
    if (!firebaseAuth) {
      return res.status(503).json({ message: 'Firebase Admin is not configured on the server.' })
    }

    const header = req.headers.authorization || ''
    const match = header.match(/^Bearer\s+(.+)$/i)

    if (!match) {
      return res.status(401).json({ message: 'Missing Firebase authentication token.' })
    }

    const decoded = await firebaseAuth.verifyIdToken(match[1])
    const [users] = await db.query(
      'SELECT user_id, firebase_uid, name, email, role FROM users WHERE firebase_uid = ? LIMIT 1',
      [decoded.uid]
    )

    if (!users.length) {
      return res.status(403).json({ message: 'User profile not found in MySQL database.' })
    }

    const role = String(users[0].role || '').trim().toLowerCase()
    if (role !== 'admin') {
      return res.status(403).json({ message: 'Admin access is required.' })
    }

    req.adminUid = decoded.uid
    req.adminUser = users[0]
    next()
  } catch (error) {
    console.error('Admin authentication failed:', error.message)
    res.status(401).json({ message: 'Invalid or expired authentication token.' })
  }
}

// ---------- Public health endpoint ----------

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1')
    res.json({ success: true, database: 'connected', message: "Dell's Bag & Co API is running." })
  } catch (error) {
    console.error('Health check failed:', error.message)
    res.status(500).json({ success: false, database: 'disconnected' })
  }
})

// ---------- Firebase user authentication for seller product management ----------
async function requireUser(req, res, next) {
  try {
    if (!firebaseAuth) return res.status(503).json({ message: 'Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON in backend/.env.' })
    const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)
    if (!match) return res.status(401).json({ message: 'Please sign in again.' })
    const decoded = await firebaseAuth.verifyIdToken(match[1])
    const name = decoded.name || (decoded.email || 'Seller').split('@')[0]
    await db.query(
      'INSERT INTO users (firebase_uid, name, email) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email)',
      [decoded.uid, name, decoded.email || null]
    )
    const [rows] = await db.query('SELECT user_id, firebase_uid, name, email, role FROM users WHERE firebase_uid = ? LIMIT 1', [decoded.uid])
    if (!rows.length) return res.status(403).json({ message: 'Account profile was not found in MySQL.' })
    req.authUser = rows[0]
    req.authUid = decoded.uid
    req.isAdmin = String(rows[0].role || '').toLowerCase() === 'admin'
    next()
  } catch (error) {
    console.error('User authentication failed:', error.message)
    res.status(401).json({ message: 'Invalid or expired sign-in. Please log in again.' })
  }
}

// Public catalog read: Shop and Seller Dashboard always read the same MySQL products.
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE is_deleted = 0 ORDER BY product_id DESC')
    res.json(rows.map(productResponse))
  } catch (error) {
    console.error('Public products load failed:', error)
    res.status(500).json({ message: 'Could not load products from MySQL.' })
  }
})
app.get('/api/product', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE is_deleted = 0 ORDER BY product_id DESC')
    res.json(rows.map(productResponse))
  } catch (error) {
    console.error('Products load failed:', error)
    res.status(500).json({ message: 'Could not load products from MySQL.' })
  }
})

// Seller product write operations. Admins may manage every product; sellers may
// only edit/delete products whose seller_id matches their Firebase UID.
app.post(['/api/products', '/api/product'], requireUser, async (req, res) => {
  try {
    const b = req.body || {}
    const name = String(b.name || b.product || '').trim()
    const category = String(b.category || '').trim()
    if (!name || !category) return res.status(400).json({ message: 'Product name and category are required.' })
    const [result] = await db.query(
      'INSERT INTO products (product_name, category, material, buy_price, sell_price, stock, image, badge, seller_id, seller_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, category, b.material || category, Math.max(0, validNumber(b.buy, 0)), Math.max(0, validNumber(b.sell ?? b.price, 0)), Math.max(0, Math.floor(validNumber(b.stock, 0))), b.image || b.img || '', b.badge || null, req.authUid, req.authUser.name || 'Seller']
    )
    const [rows] = await db.query('SELECT * FROM products WHERE product_id = ?', [result.insertId])
    res.status(201).json(productResponse(rows[0]))
  } catch (error) {
    console.error('Seller create product failed:', error)
    res.status(500).json({ message: 'Could not save product to MySQL.' })
  }
})

app.put(['/api/products/:id', '/api/product/:id'], requireUser, async (req, res) => {
  try {
    const [found] = await db.query('SELECT * FROM products WHERE product_id = ? AND is_deleted = 0 LIMIT 1', [req.params.id])
    if (!found.length) return res.status(404).json({ message: 'Product not found.' })
    const old = found[0]
    if (!req.isAdmin && String(old.seller_id || '') !== req.authUid) return res.status(403).json({ message: 'You can only edit products added by your account.' })
    const b = req.body || {}
    const name = String(b.name ?? b.product ?? old.product_name).trim()
    const category = String(b.category ?? old.category).trim()
    if (!name || !category) return res.status(400).json({ message: 'Product name and category are required.' })
    await db.query(
      'UPDATE products SET product_name=?, category=?, material=?, buy_price=?, sell_price=?, stock=?, image=?, badge=? WHERE product_id=?',
      [name, category, b.material ?? old.material, Math.max(0, validNumber(b.buy ?? old.buy_price, 0)), Math.max(0, validNumber(b.sell ?? b.price ?? old.sell_price, 0)), Math.max(0, Math.floor(validNumber(b.stock ?? old.stock, 0))), b.image ?? b.img ?? old.image, b.badge ?? old.badge, req.params.id]
    )
    const [rows] = await db.query('SELECT * FROM products WHERE product_id = ?', [req.params.id])
    res.json(productResponse(rows[0]))
  } catch (error) {
    console.error('Seller update product failed:', error)
    res.status(500).json({ message: 'Could not update product in MySQL.' })
  }
})

app.delete(['/api/products/:id', '/api/product/:id'], requireUser, async (req, res) => {
  try {
    const [found] = await db.query('SELECT seller_id FROM products WHERE product_id = ? AND is_deleted = 0 LIMIT 1', [req.params.id])
    if (!found.length) return res.status(404).json({ message: 'Product not found.' })
    if (!req.isAdmin && String(found[0].seller_id || '') !== req.authUid) return res.status(403).json({ message: 'You can only delete products added by your account.' })
    await db.query('UPDATE products SET is_deleted = 1 WHERE product_id = ?', [req.params.id])
    res.json({ message: 'Product deleted successfully.' })
  } catch (error) {
    console.error('Seller delete product failed:', error)
    res.status(500).json({ message: 'Could not delete product from MySQL.' })
  }
})

// Upgrade legacy TEXT image columns so compressed image data URLs fit.
async function ensureProductImageColumn() {
  try {
    const [columns] = await db.query("SHOW COLUMNS FROM products LIKE 'image'")
    if (columns.length && !/mediumtext|longtext/i.test(String(columns[0].Type))) {
      await db.query('ALTER TABLE products MODIFY image MEDIUMTEXT NULL')
      console.log('Products image column upgraded to MEDIUMTEXT')
    }
  } catch (error) {
    console.warn('Could not check/upgrade products.image column:', error.message)
  }
}

// Protect admin-only management endpoints below this line.
app.use('/api', requireAdmin)

// ==================================================
// PRODUCTS
// ==================================================

async function getProducts(req, res) {
  try {
    const [rows] = await db.query(
      'SELECT * FROM products WHERE is_deleted = 0 ORDER BY product_id DESC'
    )
    res.json(rows.map(productResponse))
  } catch (error) {
    console.error('Load products failed:', error)
    res.status(500).json({ message: 'Could not load products.' })
  }
}

app.get('/api/products', getProducts)
app.get('/api/product', getProducts)

async function createProduct(req, res) {
  try {
    const body = req.body || {}
    const name = String(body.name || body.product || '').trim()
    const category = String(body.category || '').trim()
    const image = body.img || body.image || (req.file ? `/uploads/${req.file.filename}` : '')

    if (!name || !category) {
      if (req.file) removeImageFile(req.file.filename)
      return res.status(400).json({ message: 'Product name and category are required.' })
    }

    const [result] = await db.query(
      'INSERT INTO products (product_name, category, material, buy_price, sell_price, stock, image, badge, seller_id, seller_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        name, category, body.material || null,
        Math.max(0, validNumber(body.buy, 0)),
        Math.max(0, validNumber(body.price ?? body.sell, 0)),
        Math.max(0, Math.floor(validNumber(body.stock, 0))),
        image, body.badge || null,
        body.sellerId || req.adminUid,
        body.sellerName || req.adminUser.name || 'Seller'
      ]
    )

    const [rows] = await db.query('SELECT * FROM products WHERE product_id = ?', [result.insertId])
    res.status(201).json(productResponse(rows[0]))
  } catch (error) {
    console.error('Create product failed:', error)
    if (req.file) removeImageFile(req.file.filename)
    res.status(500).json({ message: 'Could not create product.' })
  }
}

app.post('/api/products', upload.single('image'), createProduct)
app.post('/api/product', upload.single('image'), createProduct)

async function updateProduct(req, res) {
  try {
    const [found] = await db.query(
      'SELECT * FROM products WHERE product_id = ? AND is_deleted = 0 LIMIT 1',
      [req.params.id]
    )
    if (!found.length) {
      if (req.file) removeImageFile(req.file.filename)
      return res.status(404).json({ message: 'Product not found.' })
    }

    const old = found[0]
    const body = req.body || {}
    const name = String(body.name ?? body.product ?? old.product_name).trim()
    const category = String(body.category ?? old.category).trim()
    const image = body.img ?? body.image ?? (req.file ? `/uploads/${req.file.filename}` : old.image)

    await db.query(
      'UPDATE products SET product_name = ?, category = ?, material = ?, buy_price = ?, sell_price = ?, stock = ?, image = ?, badge = ?, seller_id = ?, seller_name = ? WHERE product_id = ?',
      [
        name, category, body.material ?? old.material,
        Math.max(0, validNumber(body.buy ?? old.buy_price, 0)),
        Math.max(0, validNumber(body.price ?? body.sell ?? old.sell_price, 0)),
        Math.max(0, Math.floor(validNumber(body.stock ?? old.stock, 0))),
        image, body.badge === undefined ? old.badge : body.badge,
        body.sellerId ?? old.seller_id,
        body.sellerName ?? old.seller_name,
        req.params.id
      ]
    )

    if (req.file && old.image && old.image !== image) removeImageFile(old.image)

    const [rows] = await db.query('SELECT * FROM products WHERE product_id = ?', [req.params.id])
    res.json(productResponse(rows[0]))
  } catch (error) {
    console.error('Update product failed:', error)
    if (req.file) removeImageFile(req.file.filename)
    res.status(500).json({ message: 'Could not update product.' })
  }
}

app.put('/api/products/:id', upload.single('image'), updateProduct)
app.put('/api/product/:id', upload.single('image'), updateProduct)

async function deleteProduct(req, res) {
  try {
    const [rows] = await db.query(
      'SELECT image FROM products WHERE product_id = ? AND is_deleted = 0 LIMIT 1',
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ message: 'Product not found.' })

    await db.query('UPDATE products SET is_deleted = 1 WHERE product_id = ?', [req.params.id])
    removeImageFile(rows[0].image)
    res.json({ message: 'Product deleted successfully.', id: req.params.id })
  } catch (error) {
    console.error('Delete product failed:', error)
    res.status(500).json({ message: 'Could not delete product.' })
  }
}

app.delete('/api/products/:id', deleteProduct)
app.delete('/api/product/:id', deleteProduct)

// ==================================================
// USERS
// ==================================================

app.get('/api/users', async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT user_id, firebase_uid, name, email, role, created_at, updated_at FROM users ORDER BY user_id DESC'
    )
    res.json(users.map(user => ({ ...user, id: user.firebase_uid || String(user.user_id) })))
  } catch (error) {
    console.error('Load users failed:', error)
    res.status(500).json({ message: 'Could not load users.' })
  }
})

app.patch('/api/users/:id', async (req, res) => {
  try {
    const allowedFields = ['role', 'name', 'email']
    const updates = {}
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) updates[field] = req.body[field]
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No supported user fields were provided.' })
    }

    if (updates.role !== undefined) {
      updates.role = String(updates.role).trim().toLowerCase()
      if (!['user', 'seller', 'admin'].includes(updates.role)) {
        return res.status(400).json({ message: 'Role must be user, seller or admin.' })
      }
    }

    const [existing] = await db.query(
      'SELECT user_id, firebase_uid, role FROM users WHERE firebase_uid = ? OR user_id = ? LIMIT 1',
      [req.params.id, req.params.id]
    )
    if (!existing.length) return res.status(404).json({ message: 'User not found.' })

    if (existing[0].firebase_uid === req.adminUid && updates.role && updates.role !== 'admin') {
      return res.status(400).json({ message: 'You cannot remove your own admin role.' })
    }

    const fields = Object.keys(updates)
    const values = fields.map(field => updates[field])
    await db.query(
      `UPDATE users SET ${fields.map(field => `${field} = ?`).join(', ')} WHERE user_id = ?`,
      [...values, existing[0].user_id]
    )
    res.json({ message: 'User updated successfully.' })
  } catch (error) {
    console.error('Update user failed:', error)
    res.status(500).json({ message: 'Could not update user.' })
  }
})

// ==================================================
// ORDERS
// ==================================================

app.get('/api/orders', async (req, res) => {
  try {
    const [orders] = await db.query('SELECT * FROM orders ORDER BY placed_at DESC')
    const result = []

    for (const order of orders) {
      const [items] = await db.query(
        'SELECT order_item_id, product_id, product_name AS name, image AS img, unit_price AS price, quantity AS qty, seller_id FROM order_items WHERE order_id = ?',
        [order.order_id]
      )
      result.push(orderResponse(order, items))
    }

    res.json(result)
  } catch (error) {
    console.error('Load orders failed:', error)
    res.status(500).json({ message: 'Could not load orders.' })
  }
})

app.patch('/api/orders/:id', async (req, res) => {
  try {
    const allowedStatuses = ['To Ship', 'Processing', 'Shipped', 'Delivered', 'Cancelled']
    const status = String(req.body?.status || '')
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid order status.' })
    }

    const [result] = await db.query(
      'UPDATE orders SET status = ? WHERE firebase_order_id = ? OR order_id = ?',
      [status, req.params.id, req.params.id]
    )
    if (!result.affectedRows) return res.status(404).json({ message: 'Order not found.' })

    const [rows] = await db.query(
      'SELECT * FROM orders WHERE firebase_order_id = ? OR order_id = ? LIMIT 1',
      [req.params.id, req.params.id]
    )
    const [items] = await db.query(
      'SELECT order_item_id, product_id, product_name AS name, image AS img, unit_price AS price, quantity AS qty, seller_id FROM order_items WHERE order_id = ?',
      [rows[0].order_id]
    )
    res.json(orderResponse(rows[0], items))
  } catch (error) {
    console.error('Update order failed:', error)
    res.status(500).json({ message: 'Could not update order.' })
  }
})

// ==================================================
// SELLER NOTIFICATIONS
// ==================================================

app.post('/api/notifications', async (req, res) => {
  try {
    const { sellerId, orderId, buyer, paymentMethod, status, items, placedAt } = req.body || {}
    if (!sellerId || !orderId) {
      return res.status(400).json({ message: 'sellerId and orderId are required.' })
    }

    await db.query(
      'INSERT INTO notifications (seller_id, order_id, buyer_name, buyer_address, buyer_contact, payment_method, status, items_json, placed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), items_json = VALUES(items_json)',
      [
        String(sellerId), String(orderId), buyer?.name || '',
        buyer?.address || '', buyer?.contactNumber || '',
        paymentMethod || 'COD', status || 'To Ship',
        JSON.stringify(items || []), placedAt ? new Date(placedAt) : new Date()
      ]
    )
    res.status(201).json({ message: 'Notification saved successfully.' })
  } catch (error) {
    console.error('Save notification failed:', error)
    res.status(500).json({ message: 'Could not save notification.' })
  }
})

app.patch('/api/notifications/order/:orderId', async (req, res) => {
  try {
    const [result] = await db.query(
      'UPDATE notifications SET status = ? WHERE order_id = ?',
      [req.body.status, req.params.orderId]
    )
    res.json({ message: 'Notification updated successfully.', affectedRows: result.affectedRows })
  } catch (error) {
    console.error('Update notification failed:', error)
    res.status(500).json({ message: 'Could not update notification.' })
  }
})

// ==================================================
// 404 AND ERROR HANDLERS
// ==================================================

app.use((req, res) => {
  res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` })
})

app.use((err, req, res, next) => {
  console.error('Request error:', err)
  res.status(400).json({ message: err.message || 'Something went wrong.' })
})

// ---------- Start server ----------

async function startServer() {
  try {
    const connection = await db.getConnection()
    console.log('Database Connected')
    connection.release()
    await ensureProductImageColumn()
    const readyConnection = await db.getConnection()
    readyConnection.release()

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Database Connection Failed:', error.message)
    process.exit(1)
  }
}

startServer()
