CREATE DATABASE IF NOT EXISTS dells_bag_co
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dells_bag_co;

-- Customer, seller and admin profiles.
-- Passwords are NOT stored here; Firebase Authentication remains the login provider.
CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  firebase_uid VARCHAR(128) NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(191) NULL,
  role ENUM('user', 'seller', 'admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_firebase_uid (firebase_uid),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  category_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_categories_name (category_name)
) ENGINE=InnoDB;

-- Product catalog used by the Node/Express API.
CREATE TABLE IF NOT EXISTS products (
  product_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_name VARCHAR(191) NOT NULL,
  category VARCHAR(100) NOT NULL,
  material VARCHAR(150) NULL,
  buy_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  sell_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  image TEXT NULL,
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

-- Orders can retain the Firebase document ID while data is gradually migrated.
CREATE TABLE IF NOT EXISTS orders (
  order_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  firebase_order_id VARCHAR(128) NULL,
  firebase_uid VARCHAR(128) NOT NULL,
  buyer_name VARCHAR(150) NOT NULL,
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
  product_id BIGINT UNSIGNED NULL,
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
  product_id BIGINT UNSIGNED NOT NULL,
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
  order_id VARCHAR(128) NOT NULL,
  buyer_name VARCHAR(150) NULL,
  buyer_address TEXT NULL,
  buyer_contact VARCHAR(40) NULL,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'COD',
  status VARCHAR(40) NOT NULL DEFAULT 'To Ship',
  items_json JSON NULL,
  placed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id),
  UNIQUE KEY uq_notification_seller_order (seller_id, order_id),
  KEY idx_notifications_seller (seller_id),
  KEY idx_notifications_order (order_id)
) ENGINE=InnoDB;

INSERT IGNORE INTO categories (category_name) VALUES
('Backpack'),
('Handbag'),
('Tote Bag'),
('Sling Bag'),
('Travel Bag'),
('Wallet');
