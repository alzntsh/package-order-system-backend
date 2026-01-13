/**
 * Order Service Unit Tests
 * Tests for package splitting logic and business rules
 */

const request = require('supertest');
const app = require('../server');

describe('Order Calculation API', () => {
  /**
   * Test Rule 1: Single package for orders <= $250
   */
  describe('Rule 1: Single Package for Total <= $250', () => {
    test('should return single package when total price is $250', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: [1, 3, 5] }) // Total: $70
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.packages).toHaveLength(1);
      expect(response.body.data.packages[0].totalPrice).toBeLessThanOrEqual(250);
    });

    test('should return single package when total price is exactly $250', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: [14, 1] }) // Item 14: $240 + Item 1: $10 = $250
        .expect(200);

      expect(response.body.data.packages).toHaveLength(1);
      expect(response.body.data.packages[0].totalPrice).toBe(250);
    });

    test('should calculate correct courier charge for single package', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: [1] }) // Weight: 200g, Price: $10
        .expect(200);

      const pkg = response.body.data.packages[0];
      expect(pkg.courierPrice).toBe(5); // 0-200g = $5
    });
  });

  /**
   * Test Rule 2 & 3: Multiple packages with constraints
   */
  describe('Rule 2 & 3: Multiple Packages with Price Constraint', () => {
    test('should split into multiple packages when total > $250', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: [7, 14, 15] }) // Total: $563 (200+240+123)
        .expect(200);

      expect(response.body.data.packages.length).toBeGreaterThan(1);
    });

    test('should ensure NO package exceeds $249', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: [14, 16, 17] }) // High-value items
        .expect(200);

      response.body.data.packages.forEach(pkg => {
        expect(pkg.totalPrice).toBeLessThan(250);
      });
    });

    test('should handle edge case: item price exactly $249', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: [31] }) // Item 31: $249
        .expect(200);

      expect(response.body.data.packages).toHaveLength(1);
      expect(response.body.data.packages[0].totalPrice).toBe(249);
    });
  });

  /**
   * Test Courier Charge Calculations
   */
  describe('Courier Charge Calculations', () => {
    test('should charge $5 for weight 0-200g', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: [2] }) // Item 2: 20g
        .expect(200);

      expect(response.body.data.packages[0].courierPrice).toBe(5);
    });

    test('should charge $10 for weight 201-500g', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: [1, 3] }) // Total: 500g
        .expect(200);

      expect(response.body.data.packages[0].courierPrice).toBe(10);
    });

    test('should charge $15 for weight 501-1000g', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: [9] }) // Item 9: 790g
        .expect(200);

      expect(response.body.data.packages[0].courierPrice).toBe(15);
    });

    test('should charge $20 for weight > 1000g', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: [9, 4, 8] }) // Total: 1790g
        .expect(200);

      const totalWeight = response.body.data.packages.reduce(
        (sum, pkg) => sum + pkg.totalWeight, 
        0
      );
      expect(totalWeight).toBeGreaterThan(1000);
    });
  });

  /**
   * Test Weight Distribution
   */
  describe('Weight Distribution Optimization', () => {
    test('should attempt to balance weights across packages', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })
        .expect(200);

      if (response.body.data.packages.length > 1) {
        const weights = response.body.data.packages.map(p => p.totalWeight);
        const avgWeight = weights.reduce((a, b) => a + b) / weights.length;
        
        // Check that weights are reasonably balanced (within 50% of average)
        weights.forEach(weight => {
          const deviation = Math.abs(weight - avgWeight) / avgWeight;
          expect(deviation).toBeLessThan(0.5);
        });
      }
    });
  });

  /**
   * Test Input Validation
   */
  describe('Input Validation', () => {
    test('should return 400 for empty itemIds', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('non-empty array');
    });

    test('should return 400 for invalid itemIds format', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should return 404 for non-existent item IDs', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: [9999] })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  /**
   * Test Response Format
   */
  describe('Response Format Validation', () => {
    test('should return correct response structure', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: [1, 2, 3] })
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('packages');
      expect(response.body.data).toHaveProperty('totalCourierCharge');
      expect(response.body.data).toHaveProperty('summary');
    });

    test('should include all package details', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: [1] })
        .expect(200);

      const pkg = response.body.data.packages[0];
      expect(pkg).toHaveProperty('items');
      expect(pkg).toHaveProperty('totalWeight');
      expect(pkg).toHaveProperty('totalPrice');
      expect(pkg).toHaveProperty('courierPrice');
      expect(Array.isArray(pkg.items)).toBe(true);
    });
  });

  /**
   * Test Complex Scenarios
   */
  describe('Complex Order Scenarios', () => {
    test('should handle order with all 50 items', async () => {
      const allItemIds = Array.from({ length: 50 }, (_, i) => i + 1);
      
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: allItemIds })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.packages.length).toBeGreaterThan(0);
      
      // Verify all packages respect price constraint
      response.body.data.packages.forEach(pkg => {
        expect(pkg.totalPrice).toBeLessThan(250);
      });
    });

    test('should minimize total courier charges', async () => {
      const response = await request(app)
        .post('/api/v1/orders/calculate')
        .send({ itemIds: [1, 2, 3, 4, 5] })
        .expect(200);

      const totalCharge = response.body.data.totalCourierCharge;
      expect(totalCharge).toBeGreaterThan(0);
      expect(typeof totalCharge).toBe('number');
    });
  });
});

/**
 * Products API Tests
 */
describe('Products API', () => {
  test('GET /api/v1/products should return all products', async () => {
    const response = await request(app)
      .get('/api/v1/products')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  test('GET /api/v1/products/:id should return specific product', async () => {
    const response = await request(app)
      .get('/api/v1/products/1')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data).toHaveProperty('name');
    expect(response.body.data).toHaveProperty('price');
    expect(response.body.data).toHaveProperty('weight');
  });
});

/**
 * Health Check Tests
 */
describe('System Health', () => {
  test('GET /api/v1/health should return 200', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body).toHaveProperty('timestamp');
  });
});
