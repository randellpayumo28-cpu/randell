const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const app = express()

app.use(express.json())
app.use(cors())

// ---------- Image upload setup ----------
const uploadDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir)
}

// para makita ng browser ang images: http://localhost:8080/uploads/<filename>
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
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true)
        } else {
            cb(new Error('Only image files are allowed'))
        }
    }
})

function removeImageFile(imagePath) {
    if (!imagePath) return
    const filePath = path.join(uploadDir, path.basename(imagePath))
    fs.unlink(filePath, () => {})
}

// ---------- Products (Bags) ----------
let products = [
    {
        id: 1,
        product: 'Classic Backpack',
        category: 'Backpack',
        buy: '94',
        sell: '799',
        stock: '15',
        image: ''
    },
    {
        id: 2,
        product: 'Rover Backpack',
        category: 'Handbag',
        buy: '138',
        sell: '1499',
        stock: '8',
        image: ''
    },
    {
        id: 3,
        product: 'The Field Tote',
        category: 'Tote Bag',
        buy: '68',
        sell: '299',
        stock: '30',
        image: ''
    }
]

let nextID = 4

app.get('/api/product', (req, res) => {
    res.json(products)
})

app.post('/api/product', upload.single('image'), (req, res) => {
    const newProduct = {
        id: nextID,
        product: req.body.product,
        category: req.body.category,
        buy: req.body.buy,
        sell: req.body.sell,
        stock: req.body.stock,
        image: req.file ? `/uploads/${req.file.filename}` : ''
    }

    nextID++
    products.push(newProduct)

    console.log('Added product:', newProduct)
    res.status(201).json(newProduct)
})

app.put('/api/product/:id', upload.single('image'), (req, res) => {
    const id = Number(req.params.id)
    const productIndex = products.findIndex((item) => item.id === id)

    if (productIndex === -1) {
        if (req.file) removeImageFile(req.file.filename)
        return res.status(404).json({ message: 'Product not found' })
    }

    const oldProduct = products[productIndex]
    let image = oldProduct.image

    // kung may bagong image, palitan at burahin ang luma
    if (req.file) {
        removeImageFile(oldProduct.image)
        image = `/uploads/${req.file.filename}`
    }

    products[productIndex] = {
        id,
        product: req.body.product,
        category: req.body.category,
        buy: req.body.buy,
        sell: req.body.sell,
        stock: req.body.stock,
        image
    }

    console.log('Updated product:', products[productIndex])
    res.json(products[productIndex])
})

app.delete('/api/product/:id', (req, res) => {
    const id = Number(req.params.id)
    const productIndex = products.findIndex((item) => item.id === id)

    if (productIndex === -1) {
        return res.status(404).json({ message: 'Product not found' })
    }

    const deletedProduct = products[productIndex]
    removeImageFile(deletedProduct.image)
    products.splice(productIndex, 1)

    console.log('Deleted product:', deletedProduct)
    res.json({
        message: 'Product deleted successfully',
        product: deletedProduct
    })
})

// ... dito mo na iwan ang stock-in, sales, damaged routes mo (walang pagbabago)

// error handler para sa multer (dapat nasa baba ng lahat ng routes, bago app.listen)
app.use((err, req, res, next) => {
    res.status(400).json({ message: err.message || 'Something went wrong' })
})

app.listen(8080, () => {
    console.log('Server running on port 8080')
})