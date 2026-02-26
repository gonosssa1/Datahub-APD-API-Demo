const express = require('express');
const router = express.Router();
const db = require('../dataStore');

// GET /api/warranties - List warranties with optional filters
router.get('/', (req, res) => {
  let results = db.warranties.getAll();
  if (req.query.status) results = results.filter(w => w.status === req.query.status);
  if (req.query.customerId) results = results.filter(w => w.customerId === req.query.customerId);
  if (req.query.productId) results = results.filter(w => w.productId === req.query.productId);
  if (req.query.type) results = results.filter(w => w.warrantyType === req.query.type);
  if (req.query.expiringSoon) {
    const days = parseInt(req.query.expiringSoon) || 30;
    const cutoff = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
    results = results.filter(w => w.status === 'active' && w.coverageEndDate <= cutoff);
  }
  res.json({ success: true, count: results.length, data: results });
});

// GET /api/warranties/:id - Get warranty detail with enrichment
router.get('/:id', (req, res) => {
  const warranty = db.warranties.getById(req.params.id);
  if (!warranty) return res.status(404).json({ success: false, error: 'Warranty not found' });
  const customer = db.customers.getById(warranty.customerId);
  const product = db.products.getById(warranty.productId);
  const claims = db.claims.getByWarranty(req.params.id);
  res.json({ success: true, data: { ...warranty, customer, product, claims } });
});

// POST /api/warranties - Register a new warranty
router.post('/', (req, res) => {
  const {
    customerId, productId, serialNumber, purchaseDate,
    purchasePrice, retailer, retailerStoreId,
    warrantyType, coverageStartDate, coverageEndDate,
    deductible, maxCoverageAmount, coverageDetails, premiumPaid
  } = req.body;

  if (!customerId || !productId || !serialNumber || !purchaseDate || !warrantyType) {
    return res.status(400).json({
      success: false,
      error: 'customerId, productId, serialNumber, purchaseDate, and warrantyType are required'
    });
  }
  if (!db.customers.getById(customerId)) {
    return res.status(404).json({ success: false, error: 'Customer not found' });
  }
  if (!db.products.getById(productId)) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  const warranty = db.warranties.create({
    customerId, productId, serialNumber, purchaseDate,
    purchasePrice: purchasePrice || 0,
    retailer: retailer || '',
    retailerStoreId: retailerStoreId || '',
    warrantyType,
    coverageStartDate: coverageStartDate || purchaseDate,
    coverageEndDate: coverageEndDate || '',
    deductible: deductible || 0,
    maxCoverageAmount: maxCoverageAmount || purchasePrice || 0,
    coverageDetails: coverageDetails || {
      mechanicalFailure: true, electricalFailure: true,
      accidentalDamage: false, cosmeticDamage: false,
      foodSpoilage: false, powerSurge: false
    },
    premiumPaid: premiumPaid || 0
  });
  res.status(201).json({ success: true, data: warranty });
});

// PUT /api/warranties/:id - Update warranty
router.put('/:id', (req, res) => {
  const warranty = db.warranties.getById(req.params.id);
  if (!warranty) return res.status(404).json({ success: false, error: 'Warranty not found' });
  const updated = db.warranties.update(req.params.id, req.body);
  res.json({ success: true, data: updated });
});

// PUT /api/warranties/:id/cancel - Cancel a warranty
router.put('/:id/cancel', (req, res) => {
  const warranty = db.warranties.getById(req.params.id);
  if (!warranty) return res.status(404).json({ success: false, error: 'Warranty not found' });
  if (warranty.status !== 'active') {
    return res.status(400).json({ success: false, error: `Warranty is not active (current status: ${warranty.status})` });
  }
  const updated = db.warranties.update(req.params.id, {
    status: 'cancelled',
    cancellationDate: new Date().toISOString().split('T')[0],
    cancellationReason: req.body.reason || 'Customer request'
  });
  res.json({ success: true, data: updated });
});

// POST /api/warranties/verify - Verify coverage before filing a claim
router.post('/verify', (req, res) => {
  const { warrantyId, claimDate, issueType } = req.body;
  if (!warrantyId) return res.status(400).json({ success: false, error: 'warrantyId is required' });

  const result = db.warranties.verify(warrantyId, claimDate);
  if (!result.valid) {
    return res.status(200).json({ success: true, covered: false, reason: result.reason });
  }

  const { warranty } = result;
  const product = db.products.getById(warranty.productId);
  const claimsForWarranty = db.claims.getByWarranty(warrantyId);
  const yearClaims = claimsForWarranty.filter(c => {
    const year = new Date().getFullYear();
    return c.claimDate && c.claimDate.startsWith(String(year));
  });

  // Check claim limits
  if (product && yearClaims.length >= product.maxClaimsPerYear) {
    return res.json({
      success: true, covered: false,
      reason: `Maximum claims per year (${product.maxClaimsPerYear}) already reached`
    });
  }

  // Check issue type coverage
  let issueCovered = true;
  let issueNote = '';
  if (issueType && warranty.coverageDetails) {
    const typeMap = {
      mechanical_failure: 'mechanicalFailure',
      electrical_failure: 'electricalFailure',
      accidental_damage: 'accidentalDamage',
      cosmetic_damage: 'cosmeticDamage',
      food_spoilage: 'foodSpoilage',
      power_surge: 'powerSurge'
    };
    const key = typeMap[issueType];
    if (key && !warranty.coverageDetails[key]) {
      issueCovered = false;
      issueNote = `Coverage for '${issueType}' is not included in this warranty plan`;
    }
  }

  res.json({
    success: true,
    covered: issueCovered,
    reason: issueCovered ? 'Coverage confirmed' : issueNote,
    warranty: {
      warrantyId: warranty.warrantyId,
      warrantyType: warranty.warrantyType,
      coverageEndDate: warranty.coverageEndDate,
      deductible: warranty.deductible,
      maxCoverageAmount: warranty.maxCoverageAmount,
      coverageDetails: warranty.coverageDetails,
      claimsThisYear: yearClaims.length,
      maxClaimsPerYear: product ? product.maxClaimsPerYear : null
    }
  });
});

module.exports = router;
