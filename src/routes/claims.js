const express = require('express');
const router = express.Router();
const db = require('../dataStore');

const VALID_STATUSES = ['pending_approval', 'approved', 'denied', 'in_repair', 'parts_ordered', 'completed', 'closed'];
const VALID_ISSUE_TYPES = ['mechanical_failure', 'electrical_failure', 'accidental_damage', 'cosmetic_damage', 'food_spoilage', 'power_surge', 'other'];

// GET /api/claims - List claims with optional filters
router.get('/', (req, res) => {
  let results = db.claims.getAll();
  if (req.query.status) results = results.filter(c => c.status === req.query.status);
  if (req.query.customerId) results = results.filter(c => c.customerId === req.query.customerId);
  if (req.query.warrantyId) results = results.filter(c => c.warrantyId === req.query.warrantyId);
  if (req.query.open === 'true') results = results.filter(c => !['completed', 'denied', 'closed'].includes(c.status));
  if (req.query.issueType) results = results.filter(c => c.issueType === req.query.issueType);
  // Sort newest first
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, count: results.length, data: results });
});

// GET /api/claims/:id - Get claim with full enrichment
router.get('/:id', (req, res) => {
  const claim = db.claims.getById(req.params.id);
  if (!claim) return res.status(404).json({ success: false, error: 'Claim not found' });
  const customer = db.customers.getById(claim.customerId);
  const product = db.products.getById(claim.productId);
  const warranty = db.warranties.getById(claim.warrantyId);
  const repairOrder = claim.repairOrderId ? db.repairOrders.getById(claim.repairOrderId) : null;
  res.json({ success: true, data: { ...claim, customer, product, warranty, repairOrder } });
});

// POST /api/claims - File a new warranty claim
router.post('/', (req, res) => {
  const {
    warrantyId, customerId, productId,
    issueType, issueCategory, description, priority
  } = req.body;

  if (!warrantyId || !customerId || !issueType || !description) {
    return res.status(400).json({
      success: false,
      error: 'warrantyId, customerId, issueType, and description are required'
    });
  }
  if (!VALID_ISSUE_TYPES.includes(issueType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid issueType. Must be one of: ${VALID_ISSUE_TYPES.join(', ')}`
    });
  }

  // Verify warranty coverage
  const verification = db.warranties.verify(warrantyId, req.body.claimDate);
  if (!verification.valid) {
    return res.status(422).json({
      success: false, covered: false,
      error: `Warranty verification failed: ${verification.reason}`
    });
  }

  const warranty = verification.warranty;
  // Resolve productId from warranty if not supplied
  const resolvedProductId = productId || warranty.productId;

  const claim = db.claims.create({
    warrantyId,
    customerId,
    productId: resolvedProductId,
    issueType,
    issueCategory: issueCategory || '',
    description,
    priority: priority || 'standard',
    deductibleCollected: 0,
    estimatedRepairCost: null,
    actualRepairCost: null,
    resolution: null,
    resolutionDate: null,
    serviceCenterId: null,
    technicianId: null,
    repairOrderId: null,
    partsUsed: [],
    laborHours: null,
    laborRate: 85.00,
    customerSatisfactionScore: null,
    notes: req.body.notes || ''
  });

  res.status(201).json({
    success: true,
    data: claim,
    message: 'Claim filed successfully. Status: pending_approval. A representative will contact you within 1-2 business days.'
  });
});

// PUT /api/claims/:id/status - Update claim status
router.put('/:id/status', (req, res) => {
  const { status, notes, denialReason } = req.body;
  if (!status) return res.status(400).json({ success: false, error: 'status is required' });
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
    });
  }
  const claim = db.claims.getById(req.params.id);
  if (!claim) return res.status(404).json({ success: false, error: 'Claim not found' });

  const changes = { status };
  if (notes) changes.notes = notes;
  if (status === 'denied' && denialReason) changes.denialReason = denialReason;
  if (['completed', 'denied', 'closed'].includes(status)) {
    changes.resolutionDate = new Date().toISOString().split('T')[0];
  }

  const updated = db.claims.update(req.params.id, changes);
  res.json({ success: true, data: updated });
});

// PUT /api/claims/:id/approve - Approve a claim and optionally assign service center
router.put('/:id/approve', (req, res) => {
  const claim = db.claims.getById(req.params.id);
  if (!claim) return res.status(404).json({ success: false, error: 'Claim not found' });
  if (claim.status !== 'pending_approval') {
    return res.status(400).json({ success: false, error: `Claim is not pending approval (current: ${claim.status})` });
  }

  const changes = {
    status: 'approved',
    estimatedRepairCost: req.body.estimatedRepairCost || null,
    serviceCenterId: req.body.serviceCenterId || null,
    technicianId: req.body.technicianId || null,
    deductibleCollected: req.body.deductibleCollected || 0,
    notes: req.body.notes || claim.notes
  };

  const updated = db.claims.update(req.params.id, changes);
  res.json({ success: true, data: updated, message: 'Claim approved. Customer will be contacted to schedule service.' });
});

// PUT /api/claims/:id/deny - Deny a claim
router.put('/:id/deny', (req, res) => {
  const claim = db.claims.getById(req.params.id);
  if (!claim) return res.status(404).json({ success: false, error: 'Claim not found' });

  const updated = db.claims.update(req.params.id, {
    status: 'denied',
    denialReason: req.body.reason || 'Does not meet coverage criteria',
    resolutionDate: new Date().toISOString().split('T')[0],
    notes: req.body.notes || claim.notes
  });
  res.json({ success: true, data: updated });
});

// PUT /api/claims/:id/close - Close a completed claim
router.put('/:id/close', (req, res) => {
  const claim = db.claims.getById(req.params.id);
  if (!claim) return res.status(404).json({ success: false, error: 'Claim not found' });

  const changes = { status: 'closed' };
  if (req.body.customerSatisfactionScore) {
    changes.customerSatisfactionScore = parseInt(req.body.customerSatisfactionScore);
  }
  const updated = db.claims.update(req.params.id, changes);
  res.json({ success: true, data: updated });
});

module.exports = router;
