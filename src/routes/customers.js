const express = require('express');
const router = express.Router();
const db = require('../dataStore');

// GET /api/customers - List all customers (with optional filters)
router.get('/', (req, res) => {
  let results = db.customers.getAll();
  if (req.query.tier) results = results.filter(c => c.customerTier === req.query.tier);
  if (req.query.state) results = results.filter(c => c.address.state === req.query.state);
  if (req.query.active !== undefined) results = results.filter(c => c.active === (req.query.active !== 'false'));
  res.json({ success: true, count: results.length, data: results });
});

// GET /api/customers/:id - Get customer by ID
router.get('/:id', (req, res) => {
  const customer = db.customers.getById(req.params.id);
  if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

  // Enrich with warranties and claims
  const warranties = db.warranties.getByCustomer(req.params.id);
  const claims = db.claims.getByCustomer(req.params.id);
  res.json({ success: true, data: { ...customer, warranties, claims } });
});

// POST /api/customers - Register a new customer
router.post('/', (req, res) => {
  const { firstName, lastName, email, phone, address, preferredContact, customerTier } = req.body;
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ success: false, error: 'firstName, lastName, and email are required' });
  }
  if (db.customers.getByEmail(email)) {
    return res.status(409).json({ success: false, error: 'A customer with this email already exists' });
  }
  const customer = db.customers.create({
    firstName, lastName, email, phone, address,
    preferredContact: preferredContact || 'email',
    customerTier: customerTier || 'standard',
    notes: req.body.notes || ''
  });
  res.status(201).json({ success: true, data: customer });
});

// PUT /api/customers/:id - Update customer record
router.put('/:id', (req, res) => {
  const customer = db.customers.getById(req.params.id);
  if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
  const updated = db.customers.update(req.params.id, req.body);
  res.json({ success: true, data: updated });
});

// GET /api/customers/:id/warranties - Get all warranties for a customer
router.get('/:id/warranties', (req, res) => {
  const customer = db.customers.getById(req.params.id);
  if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
  const warranties = db.warranties.getByCustomer(req.params.id);
  res.json({ success: true, count: warranties.length, data: warranties });
});

// GET /api/customers/:id/claims - Get all claims for a customer
router.get('/:id/claims', (req, res) => {
  const customer = db.customers.getById(req.params.id);
  if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
  const claims = db.claims.getByCustomer(req.params.id);
  res.json({ success: true, count: claims.length, data: claims });
});

module.exports = router;
