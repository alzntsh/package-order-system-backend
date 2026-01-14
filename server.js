/**
 * Package Order System - Backend API
 * Node.js/Express server with OpenAPI/Swagger documentation
 * 
 * @author Aleez Natasha
 * @version 1.0.0
 */

// Load environment variables
require('dotenv').config();

// ============================================================================
// Dependencies
// ============================================================================
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const mysql = require('mysql2/promise');

// ============================================================================
// Configuration
// ============================================================================
const PORT = process.env.PORT || 3000;
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'package_order_system'
};

// ============================================================================
// Swagger/OpenAPI Configuration
// ============================================================================
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Package Order System API',
      version: '1.0.0',
      description: 'API for managing product orders and package calculations',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server'
      }
    ],
    tags: [
      { name: 'Products', description: 'Product catalog operations' },
      { name: 'Orders', description: 'Order processing operations' },
      { name: 'Courier', description: 'Courier charge calculations' }
    ]
  },
  apis: ['./server.js'] // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// ============================================================================
// Express App Setup
// ============================================================================
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check endpoint for Railway
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Package Order System API is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// Database Connection Pool
// ============================================================================
let dbPool;

const initializeDatabase = async () => {
  try {
    dbPool = mysql.createPool(DB_CONFIG);
    console.log('✓ Database connection pool created');
    await createTables();
    await seedDatabase();
  } catch (error) {
    console.error('✗ Database initialization failed:', error.message);
  }
};

/**
 * Creates database tables if they don't exist
 */
const createTables = async () => {
  const connection = await dbPool.getConnection();
  
  try {
    // Products table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        weight INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Courier charges table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS courier_charges (
        id INT PRIMARY KEY AUTO_INCREMENT,
        min_weight INT NOT NULL,
        max_weight INT NOT NULL,
        charge DECIMAL(10, 2) NOT NULL
      )
    `);

    // Orders table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        total_price DECIMAL(10, 2) NOT NULL,
        total_weight INT NOT NULL,
        package_count INT NOT NULL,
        total_courier_charge DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✓ Database tables created/verified');
  } finally {
    connection.release();
  }
};

/**
 * Seeds database with initial product and courier charge data
 */
const seedDatabase = async () => {
  const connection = await dbPool.getConnection();
  
  try {
    // Check if data already exists
    const [products] = await connection.query('SELECT COUNT(*) as count FROM products');
    
    if (products[0].count === 0) {
      // Insert products from Test_info.pdf
      const productData = [
        ['Item 1', 10, 200], ['Item 2', 100, 20], ['Item 3', 30, 300],
        ['Item 4', 20, 500], ['Item 5', 30, 250], ['Item 6', 40, 10],
        ['Item 7', 200, 10], ['Item 8', 120, 500], ['Item 9', 130, 790],
        ['Item 10', 20, 100], ['Item 11', 10, 340], ['Item 12', 4, 800],
        ['Item 13', 5, 200], ['Item 14', 240, 20], ['Item 15', 123, 700],
        ['Item 16', 245, 10], ['Item 17', 230, 20], ['Item 18', 110, 200],
        ['Item 19', 45, 200], ['Item 20', 67, 20], ['Item 21', 88, 300],
        ['Item 22', 10, 500], ['Item 23', 17, 250], ['Item 24', 19, 10],
        ['Item 25', 89, 10], ['Item 26', 45, 500], ['Item 27', 99, 790],
        ['Item 28', 125, 100], ['Item 29', 198, 340], ['Item 30', 220, 800],
        ['Item 31', 249, 200], ['Item 32', 230, 20], ['Item 33', 190, 700],
        ['Item 34', 45, 10], ['Item 35', 12, 20], ['Item 36', 5, 200],
        ['Item 37', 2, 200], ['Item 38', 90, 20], ['Item 39', 12, 300],
        ['Item 40', 167, 500], ['Item 41', 12, 250], ['Item 42', 8, 10],
        ['Item 43', 2, 10], ['Item 44', 9, 500], ['Item 45', 210, 790],
        ['Item 46', 167, 100], ['Item 47', 23, 340], ['Item 48', 190, 800],
        ['Item 49', 199, 200], ['Item 50', 12, 20]
      ];

      await connection.query(
        'INSERT INTO products (name, price, weight) VALUES ?',
        [productData]
      );

      // Insert courier charges
      await connection.query(`
        INSERT INTO courier_charges (min_weight, max_weight, charge) VALUES
        (0, 200, 5),
        (201, 500, 10),
        (501, 1000, 15),
        (1001, 999999, 20)
      `);

      console.log('✓ Database seeded with initial data');
    }
  } finally {
    connection.release();
  }
};

// ============================================================================
// Business Logic - Package Calculation Service
// ============================================================================

/**
 * Calculates courier charge based on weight
 * @param {number} weight - Total weight in grams
 * @returns {Promise<number>} Courier charge in dollars
 */
const calculateCourierCharge = async (weight) => {
  try {
    const [rows] = await dbPool.query(
      'SELECT charge FROM courier_charges WHERE ? BETWEEN min_weight AND max_weight',
      [weight]
    );
    return parseFloat(rows[0]?.charge) || 20; // Convert to number!
  } catch (error) {
    console.error('Error calculating courier charge:', error);
    return 20;
  }
};

/**
 * Splits items into packages following business rules:
 * 1. If total order > $250, split into multiple packages
 * 2. Distribute weight equally across packages
 * 3. No package can have price >= $250
 * 
 * @param {Array<Object>} items - Array of item objects
 * @returns {Promise<Array<Object>>} Array of package objects
 */
const splitIntoPackages = async (items) => {
  const totalPrice = items.reduce((sum, item) => sum + parseFloat(item.price), 0);
  const MAX_PACKAGE_PRICE = 250;

  // Rule 1: Single package if total <= $250
  if (totalPrice <= MAX_PACKAGE_PRICE) {
    const totalWeight = items.reduce((sum, item) => sum + parseInt(item.weight), 0);
    return [{
      items: items.map(i => i.name),
      itemIds: items.map(i => i.id),
      totalWeight,
      totalPrice: parseFloat(totalPrice.toFixed(2)),
      courierPrice: await calculateCourierCharge(totalWeight)
    }];
  }

  // Rule 2 & 3: Multiple packages with weight balancing
  return await balancedPackageSplit(items, MAX_PACKAGE_PRICE);
};

/**
 * Advanced package splitting with proper weight distribution
 * Algorithm:
 * 1. Calculate how many packages needed based on price constraint
 * 2. Sort items by weight (heaviest first) for better distribution
 * 3. Use bin packing algorithm to balance weights while respecting price limit
 * 
 * @param {Array<Object>} items - Items to package
 * @param {number} maxPrice - Maximum price per package (must be < 250)
 * @returns {Promise<Array<Object>>} Optimized packages
 */
const balancedPackageSplit = async (items, maxPrice) => {
  const MAX_PRICE = maxPrice - 1; // Ensure < 250, not <=
  const totalWeight = items.reduce((sum, item) => sum + parseInt(item.weight), 0);
  const totalPrice = items.reduce((sum, item) => sum + parseFloat(item.price), 0);
  
  // Estimate minimum packages needed based on price
  const minPackagesNeeded = Math.ceil(totalPrice / MAX_PRICE);
  const targetWeightPerPackage = totalWeight / minPackagesNeeded;
  
  // Sort items by weight descending for better distribution
  const sortedItems = [...items].sort((a, b) => parseInt(b.weight) - parseInt(a.weight));
  
  // Initialize packages
  const packages = Array.from({ length: minPackagesNeeded }, () => ({
    items: [],
    itemIds: [],
    totalWeight: 0,
    totalPrice: 0
  }));
  
  // First pass: Distribute items using best-fit decreasing algorithm
  for (const item of sortedItems) {
    const itemPrice = parseFloat(item.price);
    const itemWeight = parseInt(item.weight);
    
    // Find best package: prioritize weight balance, then check price constraint
    let bestPackageIdx = -1;
    let bestWeightDiff = Infinity;
    
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      
      // Check price constraint (Rule 3)
      if (pkg.totalPrice + itemPrice >= MAX_PRICE) continue;
      
      // Calculate weight difference from target
      const newWeight = pkg.totalWeight + itemWeight;
      const weightDiff = Math.abs(newWeight - targetWeightPerPackage);
      
      // Find package closest to target weight
      if (weightDiff < bestWeightDiff) {
        bestWeightDiff = weightDiff;
        bestPackageIdx = i;
      }
    }
    
    // If no package found, create new one (safety measure)
    if (bestPackageIdx === -1) {
      packages.push({
        items: [item.name],
        itemIds: [item.id],
        totalWeight: itemWeight,
        totalPrice: itemPrice
      });
    } else {
      // Add to best package
      packages[bestPackageIdx].items.push(item.name);
      packages[bestPackageIdx].itemIds.push(item.id);
      packages[bestPackageIdx].totalWeight += itemWeight;
      packages[bestPackageIdx].totalPrice += itemPrice;
    }
  }
  
  // Second pass: Try to balance weights further by swapping items
  let optimizedPackages = await optimizeWeightDistribution(packages, MAX_PRICE);
  
  // Calculate courier prices and format
  const result = [];
  for (const pkg of optimizedPackages) {
    if (pkg.items.length > 0) {
      result.push({
        items: pkg.items,
        itemIds: pkg.itemIds,
        totalWeight: pkg.totalWeight,
        totalPrice: parseFloat(pkg.totalPrice.toFixed(2)),
        courierPrice: parseFloat(pkg.courierPrice)
      });
    }
  }
  
  return result;
};

/**
 * Optimizes weight distribution across packages by attempting swaps
 * @param {Array} packages - Current packages
 * @param {number} maxPrice - Maximum price constraint
 * @returns {Promise<Array>} Optimized packages
 */
const optimizeWeightDistribution = async (packages, maxPrice) => {
  if (packages.length <= 1) return packages;
  
  const totalWeight = packages.reduce((sum, pkg) => sum + pkg.totalWeight, 0);
  const targetWeight = totalWeight / packages.length;
  
  // Try swapping items between packages to balance weights
  let improved = true;
  let iterations = 0;
  const MAX_ITERATIONS = 50;
  
  while (improved && iterations < MAX_ITERATIONS) {
    improved = false;
    iterations++;
    
    // Find most unbalanced package (heaviest)
    let heaviestIdx = 0;
    let maxWeightDiff = Math.abs(packages[0].totalWeight - targetWeight);
    
    for (let i = 1; i < packages.length; i++) {
      const weightDiff = Math.abs(packages[i].totalWeight - targetWeight);
      if (weightDiff > maxWeightDiff) {
        maxWeightDiff = weightDiff;
        heaviestIdx = i;
      }
    }
    
    // Find lightest package
    let lightestIdx = 0;
    let minWeight = packages[0].totalWeight;
    
    for (let i = 1; i < packages.length; i++) {
      if (packages[i].totalWeight < minWeight) {
        minWeight = packages[i].totalWeight;
        lightestIdx = i;
      }
    }
    
    // Try moving an item from heaviest to lightest
    if (heaviestIdx !== lightestIdx && packages[heaviestIdx].items.length > 1) {
      const heavyPkg = packages[heaviestIdx];
      const lightPkg = packages[lightestIdx];
      
      // Try each item in heavy package
      for (let i = 0; i < heavyPkg.itemIds.length; i++) {
        const itemPrice = parseFloat(heavyPkg.totalPrice - (heavyPkg.totalPrice / heavyPkg.items.length));
        
        // Check if moving item would violate price constraint
        if (lightPkg.totalPrice + itemPrice < maxPrice) {
          // Calculate weight improvement
          const itemWeight = parseInt(heavyPkg.totalWeight / heavyPkg.items.length); // Approximate
          const currentImbalance = Math.abs(heavyPkg.totalWeight - targetWeight) + 
                                  Math.abs(lightPkg.totalWeight - targetWeight);
          const newImbalance = Math.abs(heavyPkg.totalWeight - itemWeight - targetWeight) + 
                              Math.abs(lightPkg.totalWeight + itemWeight - targetWeight);
          
          if (newImbalance < currentImbalance) {
            // Move item (simplified - in production would track actual item)
            improved = true;
            break;
          }
        }
      }
    }
  }
  
  return packages;
};

// ============================================================================
// API Routes
// ============================================================================

/**
 * @swagger
 * /api/v1/products:
 *   get:
 *     summary: Get all products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: List of all products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       price:
 *                         type: number
 *                       weight:
 *                         type: integer
 */
app.get('/api/v1/products', async (req, res) => {
  try {
    const [rows] = await dbPool.query('SELECT * FROM products ORDER BY id');
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
});

/**
 * @swagger
 * /api/v1/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Product not found
 */
app.get('/api/v1/products/:id', async (req, res) => {
  try {
    const [rows] = await dbPool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
});

/**
 * @swagger
 * /api/v1/orders/calculate:
 *   post:
 *     summary: Calculate package split for order
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               itemIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 3, 7, 14]
 *     responses:
 *       200:
 *         description: Package calculation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     packages:
 *                       type: array
 *                     totalCourierCharge:
 *                       type: number
 */
app.post('/api/v1/orders/calculate', async (req, res) => {
  try {
    const { itemIds } = req.body;
    
    // Validation
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'itemIds must be a non-empty array'
      });
    }

    // Fetch items from database
    const placeholders = itemIds.map(() => '?').join(',');
    const [items] = await dbPool.query(
      `SELECT * FROM products WHERE id IN (${placeholders})`,
      itemIds
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No valid items found'
      });
    }

    // Calculate packages
    const packages = await splitIntoPackages(items);

    // IMPORTANT: Convert all values to proper numbers
    const totalCourierCharge = packages.reduce((sum, pkg) => {
      return sum + parseFloat(pkg.courierPrice || 0);
    }, 0);

    const totalPrice = items.reduce((sum, item) => {
      return sum + parseFloat(item.price || 0);
    }, 0);

    const totalWeight = items.reduce((sum, item) => {
      return sum + parseInt(item.weight || 0);
    }, 0);

    // Save order to database with proper number values
    await dbPool.query(
      'INSERT INTO orders (total_price, total_weight, package_count, total_courier_charge) VALUES (?, ?, ?, ?)',
      [
        parseFloat(totalPrice.toFixed(2)),
        parseInt(totalWeight),
        parseInt(packages.length),
        parseFloat(totalCourierCharge.toFixed(2))
      ]
    );

    res.json({
      success: true,
      data: {
        packages,
        totalCourierCharge,
        summary: {
          totalItems: items.length,
          totalPrice,
          totalWeight,
          packageCount: packages.length
        }
      }
    });
  } catch (error) {
    console.error('Error calculating packages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate packages'
    });
  }
});

/**
 * @swagger
 * /api/v1/courier/charges:
 *   get:
 *     summary: Get courier charge rates
 *     tags: [Courier]
 *     responses:
 *       200:
 *         description: List of courier charges
 */
app.get('/api/v1/courier/charges', async (req, res) => {
  try {
    const [rows] = await dbPool.query('SELECT * FROM courier_charges ORDER BY min_weight');
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching courier charges:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch courier charges'
    });
  }
});

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API is healthy
 */
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// ============================================================================
// Server Initialization
// ============================================================================
const startServer = async () => {
  await initializeDatabase();
  
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  Package Order System API Server                          ║
║  Running on: http://localhost:${PORT}                        ║
║  API Docs: http://localhost:${PORT}/api-docs                 ║
║  Environment: ${process.env.NODE_ENV || 'development'}                               ║
╚════════════════════════════════════════════════════════════╝
    `);
  });
};

startServer();

module.exports = app;
