-- ============================================================================
-- Package Order System - Database Schema
-- MySQL Database Setup Script
-- ============================================================================

-- Create database
CREATE DATABASE IF NOT EXISTS package_order_system
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE package_order_system;

-- ============================================================================
-- Products Table
-- Stores product catalog with pricing and weight information
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  weight INT NOT NULL CHECK (weight > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_price (price),
  INDEX idx_weight (weight)
) ENGINE=InnoDB;

-- ============================================================================
-- Courier Charges Table
-- Defines shipping cost based on weight ranges
-- ============================================================================
CREATE TABLE IF NOT EXISTS courier_charges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  min_weight INT NOT NULL CHECK (min_weight >= 0),
  max_weight INT NOT NULL CHECK (max_weight > min_weight),
  charge DECIMAL(10, 2) NOT NULL CHECK (charge >= 0),
  
  UNIQUE INDEX idx_weight_range (min_weight, max_weight)
) ENGINE=InnoDB;

-- ============================================================================
-- Orders Table
-- Stores order history and package information
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  total_price DECIMAL(10, 2) NOT NULL,
  total_weight INT NOT NULL,
  package_count INT NOT NULL,
  total_courier_charge DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_created_at (created_at),
  INDEX idx_total_price (total_price)
) ENGINE=InnoDB;

-- ============================================================================
-- Order Items Table (Junction Table)
-- Links orders to specific products
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  package_number INT NOT NULL,
  
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  
  INDEX idx_order (order_id),
  INDEX idx_product (product_id)
) ENGINE=InnoDB;

-- ============================================================================
-- Seed Data - Products
-- ============================================================================
INSERT INTO products (name, price, weight) VALUES
('Item 1', 10, 200),
('Item 2', 100, 20),
('Item 3', 30, 300),
('Item 4', 20, 500),
('Item 5', 30, 250),
('Item 6', 40, 10),
('Item 7', 200, 10),
('Item 8', 120, 500),
('Item 9', 130, 790),
('Item 10', 20, 100),
('Item 11', 10, 340),
('Item 12', 4, 800),
('Item 13', 5, 200),
('Item 14', 240, 20),
('Item 15', 123, 700),
('Item 16', 245, 10),
('Item 17', 230, 20),
('Item 18', 110, 200),
('Item 19', 45, 200),
('Item 20', 67, 20),
('Item 21', 88, 300),
('Item 22', 10, 500),
('Item 23', 17, 250),
('Item 24', 19, 10),
('Item 25', 89, 10),
('Item 26', 45, 500),
('Item 27', 99, 790),
('Item 28', 125, 100),
('Item 29', 198, 340),
('Item 30', 220, 800),
('Item 31', 249, 200),
('Item 32', 230, 20),
('Item 33', 190, 700),
('Item 34', 45, 10),
('Item 35', 12, 20),
('Item 36', 5, 200),
('Item 37', 2, 200),
('Item 38', 90, 20),
('Item 39', 12, 300),
('Item 40', 167, 500),
('Item 41', 12, 250),
('Item 42', 8, 10),
('Item 43', 2, 10),
('Item 44', 9, 500),
('Item 45', 210, 790),
('Item 46', 167, 100),
('Item 47', 23, 340),
('Item 48', 190, 800),
('Item 49', 199, 200),
('Item 50', 12, 20);

-- ============================================================================
-- Seed Data - Courier Charges
-- Based on weight ranges from requirements
-- ============================================================================
INSERT INTO courier_charges (min_weight, max_weight, charge) VALUES
(0, 200, 5.00),
(201, 500, 10.00),
(501, 1000, 15.00),
(1001, 999999, 20.00);

-- ============================================================================
-- Useful Queries for Testing
-- ============================================================================

-- Get all products sorted by price
-- SELECT * FROM products ORDER BY price DESC;

-- Get courier charge for specific weight
-- SELECT charge FROM courier_charges 
-- WHERE 750 BETWEEN min_weight AND max_weight;

-- Get order statistics
-- SELECT 
--   COUNT(*) as total_orders,
--   AVG(total_price) as avg_order_value,
--   AVG(package_count) as avg_packages_per_order,
--   SUM(total_courier_charge) as total_shipping_revenue
-- FROM orders;
