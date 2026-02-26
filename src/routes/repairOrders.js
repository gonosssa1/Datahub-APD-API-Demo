const express = require('express');
const router = express.Router();
const db = require('../dataStore');

// GET /api/repair-orders - List repair orders with optional filters
router.get('/', (req, res) => {
  let results = db.repairOrders.getAll();
  if (req.query.status) results = results.filter(r => r.status === req.query.status);
  if (req.query.serviceCenterId) results = results.filter(r => r.serviceCenterId === req.query.serviceCenterId);
  if (req.query.technicianId) results = results.filter(r => r.technicianId === req.query.technicianId);
  if (req.query.customerId) results = results.filter(r => r.customerId === req.query.customerId);
  if (req.query.open === 'true') results = results.filter(r => !['completed', 'cancelled'].includes(r.status));
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, count: results.length, data: results });
});

// GET /api/repair-orders/:id - Get repair order with full enrichment
router.get('/:id', (req, res) => {
  const order = db.repairOrders.getById(req.params.id);
  if (!order) return res.status(404).json({ success: false, error: 'Repair order not found' });
  const claim = db.claims.getById(order.claimId);
  const customer = db.customers.getById(order.customerId);
  const product = db.products.getById(order.productId);
  const serviceCenter = order.serviceCenterId ? db.serviceCenters.getById(order.serviceCenterId) : null;
  const technician = order.technicianId ? db.technicians.getById(order.technicianId) : null;
  res.json({ success: true, data: { ...order, claim, customer, product, serviceCenter, technician } });
});

// POST /api/repair-orders - Create a repair order from an approved claim
router.post('/', (req, res) => {
  const { claimId, serviceCenterId, technicianId, scheduledDate, type } = req.body;
  if (!claimId || !serviceCenterId || !scheduledDate) {
    return res.status(400).json({ success: false, error: 'claimId, serviceCenterId, and scheduledDate are required' });
  }
  const claim = db.claims.getById(claimId);
  if (!claim) return res.status(404).json({ success: false, error: 'Claim not found' });
  if (!['approved', 'pending_approval'].includes(claim.status)) {
    return res.status(400).json({ success: false, error: `Claim status '${claim.status}' does not allow repair order creation` });
  }
  const center = db.serviceCenters.getById(serviceCenterId);
  if (!center) return res.status(404).json({ success: false, error: 'Service center not found' });

  const order = db.repairOrders.create({
    claimId,
    warrantyId: claim.warrantyId,
    customerId: claim.customerId,
    productId: claim.productId,
    serviceCenterId,
    technicianId: technicianId || null,
    scheduledDate,
    type: type || 'repair',
    diagnosis: req.body.diagnosis || '',
    workPerformed: null,
    partsUsed: [],
    partsCost: 0,
    laborHours: null,
    laborRate: center.laborRate || 85.00,
    laborCost: 0,
    travelFee: req.body.travelFee || 0,
    totalCost: 0,
    coveredAmount: 0,
    deductibleCollected: req.body.deductibleCollected || 0,
    customerSignature: false,
    followUpRequired: false,
    warrantyOnRepair: 90,
    technicianNotes: ''
  });
  res.status(201).json({ success: true, data: order });
});

// PUT /api/repair-orders/:id - Update repair order
router.put('/:id', (req, res) => {
  const order = db.repairOrders.getById(req.params.id);
  if (!order) return res.status(404).json({ success: false, error: 'Repair order not found' });
  const updated = db.repairOrders.update(req.params.id, req.body);
  res.json({ success: true, data: updated });
});

// PUT /api/repair-orders/:id/complete - Complete a repair order
router.put('/:id/complete', (req, res) => {
  const order = db.repairOrders.getById(req.params.id);
  if (!order) return res.status(404).json({ success: false, error: 'Repair order not found' });
  if (order.status === 'completed') {
    return res.status(400).json({ success: false, error: 'Repair order is already completed' });
  }

  const { workPerformed, partsUsed, laborHours, technicianNotes, resolution, customerSatisfactionScore } = req.body;
  if (!workPerformed) {
    return res.status(400).json({ success: false, error: 'workPerformed description is required to complete the order' });
  }

  const parts = partsUsed || [];
  const partsCost = parts.reduce((sum, p) => sum + (p.totalCost || p.unitCost * (p.quantity || 1)), 0);
  const hours = laborHours || order.laborHours || 1;
  const laborCost = hours * order.laborRate;
  const totalCost = Math.round((partsCost + laborCost + (order.travelFee || 0)) * 100) / 100;
  const warranty = db.warranties.getById(order.warrantyId);
  const deductible = order.deductibleCollected || 0;
  const coveredAmount = Math.max(0, totalCost - deductible);

  const completionData = {
    workPerformed, partsUsed: parts, partsCost,
    laborHours: hours, laborCost, totalCost, coveredAmount,
    resolution: resolution || 'repair',
    technicianNotes: technicianNotes || '',
    customerSignature: true,
    completionDate: req.body.completionDate || new Date().toISOString().split('T')[0]
  };

  if (customerSatisfactionScore) {
    completionData.customerSatisfactionScore = parseInt(customerSatisfactionScore);
  }

  const completed = db.repairOrders.complete(req.params.id, completionData);
  res.json({ success: true, data: completed, message: 'Repair order completed. Associated claim updated.' });
});

// PUT /api/repair-orders/:id/cancel - Cancel a repair order
router.put('/:id/cancel', (req, res) => {
  const order = db.repairOrders.getById(req.params.id);
  if (!order) return res.status(404).json({ success: false, error: 'Repair order not found' });
  const updated = db.repairOrders.update(req.params.id, {
    status: 'cancelled',
    cancellationReason: req.body.reason || 'Cancelled'
  });
  res.json({ success: true, data: updated });
});

module.exports = router;
