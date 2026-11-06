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
  database: process.env.DB_NAME || 'dells_bag_co_db',
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
    img: row.image || row.image_path || '',
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
    const [rows] = await db.query('SELECT DATABASE() AS database_name')
    res.json({
      success: true,
      database: 'connected',
      database_name: rows[0]?.database_name || null,
      message: "Dell's Bag & Co API is running."
    })
  } catch (error) {
    console.error('Health check failed:', error.message)
    res.status(500).json({ success: false, database: 'disconnected', message: error.message })
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
    // Every newly seen Firebase account starts as a normal user. On duplicate,
    // update profile details only; never overwrite the role manually set in MySQL.
    await db.query(
      "INSERT INTO users (firebase_uid, name, email, role) VALUES (?, ?, ?, 'user') ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email)",
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

// Only admin accounts may create, edit, or delete catalog products.
function requireAdminRole(req, res, next) {
  const role = String(req.authUser?.role || '').trim().toLowerCase()
  if (role !== 'admin') {
    return res.status(403).json({
      message: 'Admin access is required. Regular user accounts cannot manage products.'
    })
  }
  req.isAdmin = true
  next()
}

// Return the authoritative account role from MySQL after Firebase verifies identity.
// This endpoint also creates a missing profile with role='user'.
app.get('/api/auth/me', requireUser, (req, res) => {
  res.json({
    id: req.authUser.firebase_uid || String(req.authUser.user_id),
    uid: req.authUser.firebase_uid,
    name: req.authUser.name,
    email: req.authUser.email,
    role: String(req.authUser.role || 'user').trim().toLowerCase()
  })
})

// Public catalog read: Shop and Seller Dashboard always read the same MySQL products.
async function getPublicProducts(req, res) {
  try {
    const [rows] = await db.query(
      'SELECT * FROM products WHERE COALESCE(is_deleted, 0) = 0 ORDER BY product_id DESC'
    )
    res.json(rows.map(productResponse))
  } catch (error) {
    console.error('Public products load failed:', error)
    res.status(500).json({ message: 'Could not load products from MySQL.', error: error.message })
  }
}
app.get(['/api/products', '/api/product'], getPublicProducts)

// Product write operations are restricted to admin accounts only.
app.post(['/api/products', '/api/product'], requireUser, requireAdminRole, upload.single('image'), async (req, res) => {
  try {
    const b = req.body || {}
    const name = String(b.name || b.product || '').trim()
    const category = String(b.category || '').trim()
    if (!name || !category) {
      if (req.file) removeImageFile(req.file.filename)
      return res.status(400).json({ message: 'Product name and category are required.' })
    }
    const image = req.file ? `/uploads/${req.file.filename}` : (b.image || b.img || '')
    const [result] = await db.query(
      'INSERT INTO products (product_name, category, material, buy_price, sell_price, stock, image, badge, seller_id, seller_name, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
      [name, category, b.material || category, Math.max(0, validNumber(b.buy, 0)), Math.max(0, validNumber(b.sell ?? b.price, 0)), Math.max(0, Math.floor(validNumber(b.stock, 0))), image, b.badge || null, req.authUid, req.authUser.name || 'Seller']
    )
    const [rows] = await db.query('SELECT * FROM products WHERE product_id = ?', [result.insertId])
    res.status(201).json(productResponse(rows[0]))
  } catch (error) {
    console.error('Admin create product failed:', error)
    if (req.file) removeImageFile(req.file.filename)
    res.status(500).json({ message: 'Could not save product to MySQL.' })
  }
})

app.put(['/api/products/:id', '/api/product/:id'], requireUser, requireSellerOrAdmin, upload.single('image'), async (req, res) => {
  try {
    const [found] = await db.query('SELECT * FROM products WHERE product_id = ? AND COALESCE(is_deleted, 0) = 0 LIMIT 1', [req.params.id])
    if (!found.length) {
      if (req.file) removeImageFile(req.file.filename)
      return res.status(404).json({ message: 'Product not found.' })
    }
    const old = found[0]
    const b = req.body || {}
    const name = String(b.name ?? b.product ?? old.product_name).trim()
    const category = String(b.category ?? old.category).trim()
    if (!name || !category) {
      if (req.file) removeImageFile(req.file.filename)
      return res.status(400).json({ message: 'Product name and category are required.' })
    }
    const image = req.file ? `/uploads/${req.file.filename}` : (b.image ?? b.img ?? old.image)
    await db.query(
      'UPDATE products SET product_name=?, category=?, material=?, buy_price=?, sell_price=?, stock=?, image=?, badge=? WHERE product_id=?',
      [name, category, b.material ?? old.material, Math.max(0, validNumber(b.buy ?? old.buy_price, 0)), Math.max(0, validNumber(b.sell ?? b.price ?? old.sell_price, 0)), Math.max(0, Math.floor(validNumber(b.stock ?? old.stock, 0))), image, b.badge ?? old.badge, req.params.id]
    )
    if (req.file && old.image && old.image !== image) removeImageFile(old.image)
    const [rows] = await db.query('SELECT * FROM products WHERE product_id = ?', [req.params.id])
    res.json(productResponse(rows[0]))
  } catch (error) {
    console.error('Admin update product failed:', error)
    if (req.file) removeImageFile(req.file.filename)
    res.status(500).json({ message: 'Could not update product in MySQL.' })
  }
})

app.delete(['/api/products/:id', '/api/product/:id'], requireUser, requireAdminRole, async (req, res) => {
  try {
    const [found] = await db.query('SELECT seller_id, image FROM products WHERE product_id = ? AND COALESCE(is_deleted, 0) = 0 LIMIT 1', [req.params.id])
    if (!found.length) return res.status(404).json({ message: 'Product not found.' })
    await db.query('UPDATE products SET is_deleted = 1 WHERE product_id = ?', [req.params.id])
    if (String(found[0].image || '').startsWith('/uploads/')) removeImageFile(found[0].image)
    res.json({ message: 'Product deleted successfully.' })
  } catch (error) {
    console.error('Admin delete product failed:', error)
    res.status(500).json({ message: 'Could not delete product from MySQL.' })
  }
})

// Safe additive compatibility for older phpMyAdmin product tables.
// Existing product rows and values are retained; only missing support columns are added.
async function ensureProductImageColumn() {
  const [columns] = await db.query('SHOW COLUMNS FROM products')
  const existing = new Set(columns.map(column => column.Field))
  const additions = [
    ['material', 'ALTER TABLE products ADD COLUMN material VARCHAR(150) NULL'],
    ['image', 'ALTER TABLE products ADD COLUMN image MEDIUMTEXT NULL'],
    ['badge', 'ALTER TABLE products ADD COLUMN badge VARCHAR(80) NULL'],
    ['seller_id', 'ALTER TABLE products ADD COLUMN seller_id VARCHAR(128) NULL'],
    ['seller_name', "ALTER TABLE products ADD COLUMN seller_name VARCHAR(150) NOT NULL DEFAULT 'Seller'"],
    ['is_deleted', 'ALTER TABLE products ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0']
  ]
  for (const [field, sql] of additions) {
    if (!existing.has(field)) {
      await db.query(sql)
      console.log(`Added missing products.${field} column`)
    }
  }
  await db.query("UPDATE products SET image = image_path WHERE (image IS NULL OR image = '') AND image_path IS NOT NULL AND image_path <> ''")
  const [imageColumn] = await db.query("SHOW COLUMNS FROM products LIKE 'image'")
  if (imageColumn.length && !/mediumtext|longtext/i.test(String(imageColumn[0].Type))) {
    await db.query('ALTER TABLE products MODIFY image MEDIUMTEXT NULL')
    console.log('Products image column upgraded to MEDIUMTEXT')
  }
  await db.query('UPDATE products SET is_deleted = 0 WHERE is_deleted IS NULL')
}

// Protect admin-only management endpoints below this line.
app.use('/api', requireAdmin)

// Product CRUD is registered above; admin-only routes continue below.

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
      if (!['user', 'admin'].includes(updates.role)) {
        return res.status(400).json({ message: 'Role must be user or admin.' })
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
