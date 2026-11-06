-- Dell's Bag & Co local XAMPP database
-- Import this file in phpMyAdmin to create/use dells_bag_co_db.
-- Firebase Authentication remains the login provider; passwords are not stored here.

CREATE DATABASE IF NOT EXISTS dells_bag_co_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dells_bag_co_db;

CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  firebase_uid VARCHAR(128) NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(191) NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_firebase_uid (firebase_uid),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- Normalize any legacy seller accounts into regular user accounts; keep all account data.
UPDATE users SET role = 'user' WHERE role = 'seller';
ALTER TABLE users MODIFY role ENUM('user', 'admin') NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(40) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT NULL;

CREATE TABLE IF NOT EXISTS categories (
  category_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_categories_name (category_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  product_id INT(11) NOT NULL AUTO_INCREMENT,
  product_name VARCHAR(191) NOT NULL,
  category VARCHAR(100) NOT NULL,
  material VARCHAR(150) NULL,
  buy_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  sell_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  image MEDIUMTEXT NULL,
  image_path VARCHAR(255) NULL,
  badge VARCHAR(80) NULL,
  seller_id VARCHAR(128) NULL,
  seller_name VARCHAR(150) NOT NULL DEFAULT 'Seller',
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  KEY idx_products_category (category),
  KEY idx_products_seller (seller_id),
  KEY idx_products_active (is_deleted)
) ENGINE=InnoDB;

-- Includes customer_* columns queried by backend/server.js.
-- buyer_* columns are retained for compatibility with older app data.
CREATE TABLE IF NOT EXISTS orders (
  order_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  firebase_order_id VARCHAR(191) NULL,
  firebase_uid VARCHAR(128) NULL,
  customer_name VARCHAR(150) NULL,
  customer_email VARCHAR(191) NULL,
  buyer_name VARCHAR(150) NULL,
  buyer_address TEXT NULL,
  buyer_contact VARCHAR(40) NULL,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'COD',
  total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(40) NOT NULL DEFAULT 'To Ship',
  cancel_reason TEXT NULL,
  placed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  UNIQUE KEY uq_orders_firebase_id (firebase_order_id),
  KEY idx_orders_user (firebase_uid),
  KEY idx_orders_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id INT(11) NULL,
  product_name VARCHAR(191) NOT NULL,
  image TEXT NULL,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  seller_id VARCHAR(128) NULL,
  PRIMARY KEY (order_item_id),
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_product (product_id),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cart_items (
  cart_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  firebase_uid VARCHAR(128) NOT NULL,
  product_id INT(11) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  selected TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (cart_item_id),
  UNIQUE KEY uq_cart_user_product (firebase_uid, product_id),
  CONSTRAINT fk_cart_product
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  seller_id VARCHAR(128) NOT NULL,
  order_id VARCHAR(191) NOT NULL,
  buyer_name VARCHAR(150) NULL,
  buyer_address TEXT NULL,
  buyer_contact VARCHAR(40) NULL,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'COD',
  status VARCHAR(40) NOT NULL DEFAULT 'To Ship',
  items_json LONGTEXT NULL,
  placed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id),
  UNIQUE KEY uq_notification_seller_order (seller_id, order_id),
  KEY idx_notifications_seller (seller_id),
  KEY idx_notifications_order (order_id)
) ENGINE=InnoDB;

-- Safe upgrades for the original phpMyAdmin products table.
-- These ALTER statements are additive and safe to run on the existing dells_bag_co_db.
-- They do not drop tables or delete existing products/users.
ALTER TABLE products ADD COLUMN IF NOT EXISTS material VARCHAR(150) NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image MEDIUMTEXT NULL;
ALTER TABLE products MODIFY image MEDIUMTEXT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_path VARCHAR(255) NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge VARCHAR(80) NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_id VARCHAR(128) NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_name VARCHAR(150) NOT NULL DEFAULT 'Seller';
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Keep any existing image_path values visible through the API's image field.
UPDATE products
SET image = image_path
WHERE (image IS NULL OR image = '')
  AND image_path IS NOT NULL
  AND image_path <> '';

INSERT IGNORE INTO categories (category_name) VALUES
('Backpack'),
('Handbag'),
('Tote Bag'),
('Sling Bag'),
('Travel Bag'),
('Wallet');
