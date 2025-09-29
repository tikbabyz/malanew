-- MySQL schema for Laragon (converted from PostgreSQL 'mala2.sql')
-- Charset & engine defaults
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- Create database (optional; comment out if you already created it)
CREATE DATABASE IF NOT EXISTS mala_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE mala_db;

-- ===== TABLE: users =====
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(255) NOT NULL UNIQUE,
  password TEXT,
  role VARCHAR(100) NOT NULL,
  name TEXT,
  active TINYINT(1) NOT NULL,
  phone TEXT,
  email TEXT,
  perms JSON
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== TABLE: products =====
CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  category VARCHAR(100) NOT NULL,
  stock INT NOT NULL,
  active TINYINT(1) NOT NULL,
  color VARCHAR(50),
  image TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== TABLE: color_prices =====
CREATE TABLE IF NOT EXISTS color_prices (
  color VARCHAR(50) PRIMARY KEY,
  price DECIMAL(12,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== TABLE: orders =====
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  created_at DATETIME NOT NULL,
  items JSON NOT NULL,
  persons INT NOT NULL,
  split_mode VARCHAR(50) NOT NULL,
  payments JSON NOT NULL,
  paid TINYINT(1) NOT NULL,
  paid_at DATETIME NULL,
  channel VARCHAR(50),
  store JSON,
  subtotal DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) NOT NULL,
  service DECIMAL(12,2) NOT NULL,
  vat DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== TABLE: payments =====
-- Note: column names `change` and `time` are reserved, so we quote with backticks.
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  method VARCHAR(50) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  received DECIMAL(12,2) NOT NULL,
  `change` DECIMAL(12,2) NOT NULL,
  `time` DATETIME NOT NULL,
  ref TEXT,
  CONSTRAINT fk_payments_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== TABLE: transfer_slips =====
CREATE TABLE IF NOT EXISTS transfer_slips (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  payment_id BIGINT NULL,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INT NOT NULL,
  mime_type TEXT NOT NULL,
  upload_time DATETIME NOT NULL,
  CONSTRAINT fk_slips_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_slips_payment
    FOREIGN KEY (payment_id) REFERENCES payments(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- (ไม่ต้อง DROP/CREATE INDEX เพิ่ม เพราะ FK มี index ให้อยู่แล้ว)

-- ===== TABLE: announcements =====
CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title TEXT NOT NULL,
  body TEXT,
  image TEXT,
  created_at DATETIME NOT NULL,
  published_at DATETIME NULL,
  active TINYINT(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== TABLE: payment_settings =====
CREATE TABLE IF NOT EXISTS payment_settings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  qr_image TEXT,
  qr_label TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS=1;
