require('dotenv').config()

const express = require('express')
const cors = require('cors')
const mysql = require('mysql2/promise')

const PORT = process.env.PORT || 8080
const app = express()

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'dells_bag_co',
    waitForConnections: true,
    connectionLimit: 10
})

app.use(express.json())
app.use(cors())

// Test database connection
async function connectDatabase() {
    try {
        const connection = await db.getConnection()
        console.log('Database Connected')
        connection.release()
    } catch (error) {
        console.error('Database Connection Failed:', error.message)
        process.exit(1)
    }
}

// ---------------- USER API ----------------

app.get('/api/user', async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT user_id, firebase_uid, name, email, role FROM users ORDER BY user_id DESC'
        )
        res.json(users)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Failed to get users' })
    }
})

app.post('/api/user', async (req, res) => {
    try {
        const { name, role, email, firebase_uid } = req.body
        if (!name) return res.status(400).json({ message: 'Name is required' })

        const [result] = await db.query(
            'INSERT INTO users (name, role, email, firebase_uid) VALUES (?, ?, ?, ?)',
            [name, role || 'user', email || null, firebase_uid || null]
        )
        res.status(201).json({ message: 'User added successfully', user_id: result.insertId })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Failed to add user' })
    }
})

app.put('/api/user/:id', async (req, res) => {
    try {
        const { name, role } = req.body
        const [result] = await db.query(
            'UPDATE users SET name = ?, role = ? WHERE user_id = ?',
            [name, role, req.params.id]
        )
        if (!result.affectedRows) return res.status(404).json({ message: 'User not found' })
        res.json({ message: 'User updated successfully' })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Failed to update user' })
    }
})

app.delete('/api/user/:id', async (req, res) => {
    try {
        const [result] = await db.query(
            'DELETE FROM users WHERE user_id = ?',
            [req.params.id]
        )
        if (!result.affectedRows) return res.status(404).json({ message: 'User not found' })
        res.json({ message: 'User deleted successfully' })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Failed to delete user' })
    }
})

// ---------------- PRODUCT API ----------------

app.get('/api/product', async (req, res) => {
    try {
        const [products] = await db.query(
            'SELECT product_id AS id, product_name AS name, product_name AS product, category, material, buy_price AS buy, sell_price AS sell, sell_price AS price, stock, image AS img, image, badge, seller_id AS sellerId, seller_name AS sellerName FROM products WHERE is_deleted = 0 ORDER BY product_id DESC'
        )
        res.json(products)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Failed to get products' })
    }
})

app.post('/api/product', async (req, res) => {
    try {
        const { name, product, category, material, buy, sell, price, stock, img, image, badge, sellerId, sellerName } = req.body
        const productName = name || product
        const sellPrice = sell ?? price ?? 0

        if (!productName || !category) {
            return res.status(400).json({ message: 'Product name and category are required' })
        }

        const [result] = await db.query(
            'INSERT INTO products (product_name, category, material, buy_price, sell_price, stock, image, badge, seller_id, seller_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [productName, category, material || category, buy || 0, sellPrice, stock || 0, image || img || '', badge || null, sellerId || null, sellerName || 'Seller']
        )
        res.status(201).json({ message: 'Product added successfully', product_id: result.insertId })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Failed to add product' })
    }
})

app.put('/api/product/:id', async (req, res) => {
    try {
        const { name, product, category, material, buy, sell, price, stock, img, image, badge, sellerId, sellerName } = req.body
        const productName = name || product
        const sellPrice = sell ?? price ?? 0

        const [result] = await db.query(
            'UPDATE products SET product_name = ?, category = ?, material = ?, buy_price = ?, sell_price = ?, stock = ?, image = ?, badge = ?, seller_id = ?, seller_name = ? WHERE product_id = ? AND is_deleted = 0',
            [productName, category, material || category, buy || 0, sellPrice, stock || 0, image || img || '', badge || null, sellerId || null, sellerName || 'Seller', req.params.id]
        )
        if (!result.affectedRows) return res.status(404).json({ message: 'Product not found' })
        res.json({ message: 'Product updated successfully' })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Failed to update product' })
    }
})

app.delete('/api/product/:id', async (req, res) => {
    try {
        const [result] = await db.query(
            'UPDATE products SET is_deleted = 1 WHERE product_id = ?',
            [req.params.id]
        )
        if (!result.affectedRows) return res.status(404).json({ message: 'Product not found' })
        res.json({ message: 'Product deleted successfully' })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Failed to delete product' })
    }
})

// ---------------- SELLER NOTIFICATIONS API ----------------

app.post('/api/notifications', async (req, res) => {
    try {
        const { sellerId, orderId, buyer, paymentMethod, status, items, placedAt } = req.body
        if (!sellerId || !orderId) {
            return res.status(400).json({ message: 'sellerId and orderId are required' })
        }

        await db.query(
            'INSERT INTO notifications (seller_id, order_id, buyer_name, buyer_address, buyer_contact, payment_method, status, items_json, placed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), items_json = VALUES(items_json)',
            [sellerId, String(orderId), buyer?.name || '', buyer?.address || '', buyer?.contactNumber || '', paymentMethod || 'COD', status || 'To Ship', JSON.stringify(items || []), placedAt ? new Date(placedAt) : new Date()]
        )
        res.status(201).json({ message: 'Notification saved successfully' })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Failed to save notification' })
    }
})

app.patch('/api/notifications/order/:orderId', async (req, res) => {
    try {
        const [result] = await db.query(
            'UPDATE notifications SET status = ? WHERE order_id = ?',
            [req.body.status, req.params.orderId]
        )
        res.json({ message: 'Notification updated successfully', affectedRows: result.affectedRows })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: 'Failed to update notification' })
    }
})

// Check API and database status
app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1')
        res.json({ status: 'ok', database: 'connected' })
    } catch (error) {
        res.status(500).json({ status: 'error', database: 'disconnected' })
    }
})

// Start server after database connection succeeds
async function startServer() {
    await connectDatabase()
    app.listen(PORT, () => {
        console.log(`Server running ${PORT}`)
    })
}

startServer()
