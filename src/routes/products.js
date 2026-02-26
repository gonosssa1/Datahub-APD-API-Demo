const express = require('express');
const router = express.Router();
const db = require('../dataStore');

// GET /api/products - List all products with optional filters
router.get('/', (req, res) => {
  let results = db.products.getAll();
  if (req.query.category) results = results.filter(p => p.category === req.query.category);
  if (req.query.brand) results = results.filter(p => p.brand.toLowerCase() === req.query.brand.toLowerCase());
  if (req.query.active !== undefined) results = results.filter(p => p.active === (req.query.active !== 'false'));
  res.json({ success: true, count: results.length, data: results });
});

// GET /api/products/:id - Get product by ID with claim history stats
router.get('/:id', (req, res) => {
  const product = db.products.getById(req.params.id);
  if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

  const warranties = db.warranties.getByProduct(req.params.id);
  const allClaims = warranties.flatMap(w => db.claims.getByWarranty(w.warrantyId));
  const claimsByIssue = allClaims.reduce((acc, c) => {
    acc[c.issueType] = (acc[c.issueType] || 0) + 1;
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      ...product,
      stats: {
        totalWarrantiesRegistered: warranties.length,
        totalClaims: allClaims.length,
        claimsByIssueType: claimsByIssue,
        claimRate: warranties.length ? Math.round(allClaims.length / warranties.length * 100) / 100 : 0
      }
    }
  });
});

// POST /api/products - Add a new product to the catalog
router.post('/', (req, res) => {
  const { sku, name, category, brand, modelNumber, msrp } = req.body;
  if (!sku || !name || !category || !brand || !modelNumber) {
    return res.status(400).json({
      success: false,
      error: 'sku, name, category, brand, and modelNumber are required'
    });
  }
  const product = db.products.create({
    sku, name, category, brand, modelNumber,
    msrp: msrp || 0,
    standardWarrantyMonths: req.body.standardWarrantyMonths || 12,
    partsWarrantyMonths: req.body.partsWarrantyMonths || 12,
    laborWarrantyMonths: req.body.laborWarrantyMonths || 12,
    replacementCostThreshold: req.body.replacementCostThreshold || 0.70,
    maxClaimsPerYear: req.body.maxClaimsPerYear || 2,
    commonFailures: req.body.commonFailures || [],
    averageRepairCost: req.body.averageRepairCost || 0
  });
  res.status(201).json({ success: true, data: product });
});

// PUT /api/products/:id - Update product
router.put('/:id', (req, res) => {
  const product = db.products.getById(req.params.id);
  if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
  const updated = db.products.update(req.params.id, req.body);
  res.json({ success: true, data: updated });
});

// GET /api/products/categories/list - Get distinct categories
router.get('/categories/list', (req, res) => {
  const categories = [...new Set(db.products.getAll().map(p => p.category))].sort();
  res.json({ success: true, data: categories });
});

module.exports = router;
