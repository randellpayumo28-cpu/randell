require('dotenv').config()

const express = require('express')
const cors = require('cors')
const mysql = require('mysql2/promise')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const PORT = Number(process.env.PORT) || 8080
const app = express()

// MySQL connection pool. Configure these values in backend/.env or environment variables.
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dells_bag_co',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
})

app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ---------- Image upload setup ----------
const uploadDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

app.use('/uploads', express.static(uploadDir))

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase()
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`)
    }
})

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) return cb(null, true)
        cb(new Error('Only image files are allowed'))
    }
})

function removeImageFile(imagePath) {
    if (!imagePath) return
    const filename = path.basename(String(imagePath))
    if (!filename || filename === '.') return
    fs.unlink(path.join(uploadDir, filename), () => {})
}

function productResponse(row) {
    return {
        id: row.product_id,
        product: row.product_name,
        name: row.product_name,
        category: row.category,
        buy: Number(row.buy_price),
        sell: Number(row.sell_price),
        price: Number(row.sell_price),
        stock: Number(row.stock),
        image: row.image || '',
        img: row.image || '',
        badge: row.badge || null,
        material: row.material || row.category || '',
        sellerId: row.seller_id || null,
        sellerName: row.seller_name || 'Seller',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function validateProduct(body) {
    const product = String(body.product || body.name || '').trim()
    const category = String(body.category || '').trim()
    const buy = Number(body.buy ?? body.buy_price ?? 0)
    const sell = Number(body.sell ?? body.price ?? body.sell_price ?? 0)
    const stock = Number(body.stock ?? 0)

    if (!product) return { error: 'Product name is required.' }
    if (!category) return { error: 'Product category is required.' }
    if (![buy, sell].every((n) => Number.isFinite(n) && n >= 0)) {
        return { error: 'Buy and sell prices must be valid non-negative numbers.' }
    }
    if (!Number.isInteger(stock) || stock < 0) {
        return { error: 'Stock must be a whole number of zero or more.' }
    }

    return {
        values: {
            product,
            category,
            buy,
            sell,
            stock,
            badge: String(body.badge || '').trim() || null,
            material: String(body.material || category).trim(),
            sellerId: body.sellerId || body.seller_id || null,
            sellerName: String(body.sellerName || body.seller_name || 'Seller').trim(),
        }
    }
}

// ---------- Health check ----------
app.get('/api/health', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1 AS connected')
        res.json({ status: 'ok', database: rows[0].connected === 1 ? 'connected' : 'unknown' })
    } catch (error) {
        console.error('Database health check failed:', error)
        res.status(503).json({ status: 'error', database: 'disconnected', message: 'Could not connect to MySQL.' })
    }
})

// ---------- Products (bags) ----------
app.get('/api/product', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM products WHERE is_deleted = 0 ORDER BY product_id DESC'
        )
        res.json(rows.map(productResponse))
    } catch (error) {
        console.error('Load products failed:', error)
        res.status(500).json({ message: 'Could not load products from MySQL.' })
    }
})

app.post('/api/product', upload.single('image'), async (req, res) => {
    try {
        const checked = validateProduct(req.body)
        if (checked.error) {
            if (req.file) removeImageFile(req.file.filename)
            return res.status(400).json({ message: checked.error })
        }

        const p = checked.values
        const image = req.file ? `/uploads/${req.file.filename}` : String(req.body.image || req.body.img || '')
        const [result] = await db.execute(
            `INSERT INTO products
            (product_name, category, material, buy_price, sell_price, stock, image, badge, seller_id, seller_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.product, p.category, p.material, p.buy, p.sell, p.stock, image, p.badge, p.sellerId, p.sellerName]
        )
        const [rows] = await db.execute('SELECT * FROM products WHERE product_id = ?', [result.insertId])
        res.status(201).json(productResponse(rows[0]))
    } catch (error) {
        if (req.file) removeImageFile(req.file.filename)
        console.error('Add product failed:', error)
        res.status(500).json({ message: 'Could not save product to MySQL.' })
    }
})

app.put('/api/product/:id', upload.single('image'), async (req, res) => {
    try {
        const id = Number(req.params.id)
        if (!Number.isInteger(id) || id < 1) {
            if (req.file) removeImageFile(req.file.filename)
            return res.status(400).json({ message: 'Invalid product ID.' })
        }

        const checked = validateProduct(req.body)
        if (checked.error) {
            if (req.file) removeImageFile(req.file.filename)
            return res.status(400).json({ message: checked.error })
        }

        const [existingRows] = await db.execute(
            'SELECT * FROM products WHERE product_id = ? AND is_deleted = 0',
            [id]
        )
        if (!existingRows.length) {
            if (req.file) removeImageFile(req.file.filename)
            return res.status(404).json({ message: 'Product not found.' })
        }

        const old = existingRows[0]
        const p = checked.values
        const image = req.file
            ? `/uploads/${req.file.filename}`
            : String(req.body.image || req.body.img || old.image || '')

        await db.execute(
            `UPDATE products SET
            product_name = ?, category = ?, material = ?, buy_price = ?, sell_price = ?,
            stock = ?, image = ?, badge = ?, seller_id = ?, seller_name = ?
            WHERE product_id = ?`,
            [p.product, p.category, p.material, p.buy, p.sell, p.stock, image, p.badge, p.sellerId, p.sellerName, id]
        )

        if (req.file && old.image && old.image !== image) removeImageFile(old.image)
        const [rows] = await db.execute('SELECT * FROM products WHERE product_id = ?', [id])
        res.json(productResponse(rows[0]))
    } catch (error) {
        if (req.file) removeImageFile(req.file.filename)
        console.error('Update product failed:', error)
        res.status(500).json({ message: 'Could not update product in MySQL.' })
    }
})

app.delete('/api/product/:id', async (req, res) => {
    try {
        const id = Number(req.params.id)
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid product ID.' })

        const [rows] = await db.execute(
            'SELECT * FROM products WHERE product_id = ? AND is_deleted = 0',
            [id]
        )
        if (!rows.length) return res.status(404).json({ message: 'Product not found.' })

        await db.execute('UPDATE products SET is_deleted = 1 WHERE product_id = ?', [id])
        res.json({ message: 'Product deleted successfully.', product: productResponse(rows[0]) })
    } catch (error) {
        console.error('Delete product failed:', error)
        res.status(500).json({ message: 'Could not delete product from MySQL.' })
    }
})

// ---------- Basic users API (Firebase remains the authentication provider) ----------
app.get('/api/user', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT user_id, firebase_uid, name, email, role, created_at FROM users ORDER BY user_id DESC'
        )
        res.json(rows)
    } catch (error) {
        console.error('Load users failed:', error)
        res.status(500).json({ message: 'Could not load users from MySQL.' })
    }
})

app.post('/api/user', async (req, res) => {
    try {
        const name = String(req.body.name || '').trim()
        const role = String(req.body.role || 'user').trim()
        const firebaseUid = req.body.firebase_uid || null
        const email = req.body.email || null
        if (!name) return res.status(400).json({ message: 'Name is required.' })

        const [result] = await db.execute(
            'INSERT INTO users (firebase_uid, name, email, role) VALUES (?, ?, ?, ?)',
            [firebaseUid, name, email, role]
        )
        res.status(201).json({ user_id: result.insertId, name, email, role, firebase_uid: firebaseUid })
    } catch (error) {
        console.error('Add user failed:', error)
        res.status(500).json({ message: 'Could not save user to MySQL.' })
    }
})

app.put('/api/user/:id', async (req, res) => {
    try {
        const id = Number(req.params.id)
        const name = String(req.body.name || '').trim()
        const role = String(req.body.role || 'user').trim()
        if (!Number.isInteger(id) || id < 1 || !name) {
            return res.status(400).json({ message: 'A valid user ID and name are required.' })
        }
        const [result] = await db.execute(
            'UPDATE users SET name = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
            [name, role, id]
        )
        if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' })
        res.json({ message: 'User updated successfully.' })
    } catch (error) {
        console.error('Update user failed:', error)
        res.status(500).json({ message: 'Could not update user.' })
    }
})

app.delete('/api/user/:id', async (req, res) => {
    try {
        const id = Number(req.params.id)
        if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid user ID.' })
        const [result] = await db.execute('DELETE FROM users WHERE user_id = ?', [id])
        if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' })
        res.json({ message: 'User deleted successfully.' })
    } catch (error) {
        console.error('Delete user failed:', error)
        res.status(500).json({ message: 'Could not delete user.' })
    }
})

// ---------- Seller order notifications ----------
app.post('/api/notifications', async (req, res) => {
    try {
        const { sellerId, orderId, buyer, paymentMethod, status, items, placedAt } = req.body
        if (!sellerId || !orderId) return res.status(400).json({ message: 'sellerId and orderId are required.' })
        await db.execute(
            `INSERT INTO notifications
            (seller_id, order_id, buyer_name, buyer_address, buyer_contact, payment_method, status, items_json, placed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sellerId, String(orderId), buyer?.name || '', buyer?.address || '', buyer?.contactNumber || '', paymentMethod || 'COD', status || 'To Ship', JSON.stringify(items || []), placedAt ? new Date(placedAt) : new Date()]
        )
        res.status(201).json({ message: 'Seller notification saved.' })
    } catch (error) {
        console.error('Save seller notification failed:', error)
        res.status(500).json({ message: 'Could not save seller notification.' })
    }
})

app.patch('/api/notifications/order/:orderId', async (req, res) => {
    try {
        const status = String(req.body.status || '').trim()
        if (!status) return res.status(400).json({ message: 'Status is required.' })
        const [result] = await db.execute(
            'UPDATE notifications SET status = ? WHERE order_id = ?',
            [status, req.params.orderId]
        )
        res.json({ message: 'Seller notification updated.', affectedRows: result.affectedRows })
    } catch (error) {
        console.error('Update seller notification failed:', error)
        res.status(500).json({ message: 'Could not update seller notification.' })
    }
})

// ---------- Error handler ----------
app.use((err, req, res, next) => {
    console.error('API error:', err)
    res.status(400).json({ message: err.message || 'Something went wrong.' })
})

async function startServer() {
    try {
        const connection = await db.getConnection()
        await connection.ping()
        connection.release()
        console.log('✅ MySQL database connected.')
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`))
    } catch (error) {
        console.error('❌ MySQL connection failed:', error.message)
        console.error('Check that XAMPP MySQL is running and the dells_bag_co database/tables have been created.')
        process.exit(1)
    }
}

startServer()
