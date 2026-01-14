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
  apis: ['./server.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// ============================================================================
// Express App Setup
// ============================================================================
const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
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
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        weight INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS courier_charges (
        id INT PRIMARY KEY AUTO_INCREMENT,
        min_weight INT NOT NULL,
        max_weight INT NOT NULL,
        charge DECIMAL(10, 2) NOT NULL
      )
    `);

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
    const [products] = await connection.query('SELECT COUNT(*) as count FROM products');
    
    if (products[0].count === 0) {
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
    // IMPORTANT: Convert to number
    return parseFloat(rows[0]?.charge) || 20;
  } catch (error) {
    console.error('Error calculating courier charge:', error);
    return 20;
  }
};

/**
 * Splits items into packages following business rules:
 * RULE 1: If total order > $250, split into multiple packages
 * RULE 2: Distribute weight equally across packages
 * RULE 3: No package can have price >= $250
 * 
 * @param {Array<Object>} items - Array of item objects
 * @returns {Promise<Array<Object>>} Array of package objects
 */
const splitIntoPackages = async (items) => {
  const totalPrice = items.reduce((sum, item) => sum + parseFloat(item.price), 0);
  const MAX_PACKAGE_PRICE = 250;

  console.log(`\n=== Package Splitting ===`);
  console.log(`Total items: ${items.length}`);
  console.log(`Total price: $${totalPrice.toFixed(2)}`);

  // RULE 1: Single package if total <= $250
  if (totalPrice <= MAX_PACKAGE_PRICE) {
    const totalWeight = items.reduce((sum, item) => sum + parseInt(item.weight), 0);
    console.log(`Rule 1: Single package (total <= $250)`);
    
    const courierCharge = await calculateCourierCharge(totalWeight);
    
    return [{
      items: items.map(i => i.name),
      itemIds: items.map(i => i.id),
      totalWeight,
      totalPrice: parseFloat(totalPrice.toFixed(2)),
      courierPrice: parseFloat(courierCharge)
    }];
  }

  // RULE 2 & 3: Multiple packages
  console.log(`Rule 1: Multiple packages needed (total > $250)`);
  return await balancedPackageSplit(items);
};

/**
 * Balanced package splitting algorithm
 * Simple greedy approach that respects price constraints
 */
const balancedPackageSplit = async (items) => {
  const MAX_PRICE = 249; // Rule 3: Must be < 250
  const packages = [];
  let currentPkg = { items: [], itemIds: [], totalWeight: 0, totalPrice: 0 };
  
  // Sort by price descending for better packing
  const sortedItems = [...items].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  
  for (const item of sortedItems) {
    const itemPrice = parseFloat(item.price);
    const itemWeight = parseInt(item.weight);
    
    // Check if item fits (Rule 3: must be < 250)
    if (currentPkg.totalPrice + itemPrice < MAX_PRICE) {
      currentPkg.items.push(item.name);
      currentPkg.itemIds.push(item.id);
      currentPkg.totalWeight += itemWeight;
      currentPkg.totalPrice += itemPrice;
    } else {
      // Save current package and start new one
      if (currentPkg.items.length > 0) {
        packages.push({...currentPkg});
      }
      currentPkg = {
        items: [item.name],
        itemIds: [item.id],
        totalWeight: itemWeight,
        totalPrice: itemPrice
      };
    }
  }
  
  // Add last package
  if (currentPkg.items.length > 0) {
    packages.push(currentPkg);
  }
  
  // Add courier charges and ensure all values are numbers
  const result = [];
  for (const pkg of packages) {
    const courierCharge = await calculateCourierCharge(pkg.totalWeight);
    
    result.push({
      items: pkg.items,
      itemIds: pkg.itemIds,
      totalWeight: parseInt(pkg.totalWeight),
      totalPrice: parseFloat(pkg.totalPrice.toFixed(2)),
      courierPrice: parseFloat(courierCharge) // IMPORTANT: Convert to number
    });
  }
  
  console.log(`\n=== Created ${result.length} packages ===`);
  result.forEach((pkg, idx) => {
    console.log(`Package ${idx + 1}: $${pkg.totalPrice} (${pkg.totalWeight}g) - Courier: $${pkg.courierPrice}`);
  });
  
  return result;
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
 */
app.post('/api/v1/orders/calculate', async (req, res) => {
  try {
    const { itemIds } = req.body;
    
    console.log('\n=== New Order Request ===');
    console.log('Item IDs:', itemIds);
    
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
    
    // IMPORTANT: Convert all values to proper numbers for database
    const totalCourierCharge = packages.reduce((sum, pkg) => {
      return sum + parseFloat(pkg.courierPrice || 0);
    }, 0);

    const totalPrice = items.reduce((sum, item) => {
      return sum + parseFloat(item.price || 0);
    }, 0);

    const totalWeight = items.reduce((sum, item) => {
      return sum + parseInt(item.weight || 0);
    }, 0);
    
    // Save to database with properly converted numbers
    await dbPool.query(
      'INSERT INTO orders (total_price, total_weight, package_count, total_courier_charge) VALUES (?, ?, ?, ?)',
      [
        parseFloat(totalPrice.toFixed(2)),
        parseInt(totalWeight),
        parseInt(packages.length),
        parseFloat(totalCourierCharge.toFixed(2))
      ]
    );

    console.log('✓ Order saved to database\n');

    res.json({
      success: true,
      data: {
        packages,
        totalCourierCharge: parseFloat(totalCourierCharge.toFixed(2)),
        summary: {
          totalItems: items.length,
          totalPrice: parseFloat(totalPrice.toFixed(2)),
          totalWeight: parseInt(totalWeight),
          packageCount: packages.length
        }
      }
    });
  } catch (error) {
    console.error('❌ Error calculating packages:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate packages: ' + error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/courier/charges:
 *   get:
 *     summary: Get courier charge rates
 *     tags: [Courier]
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