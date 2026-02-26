const express = require('express');
const router = express.Router();
const db = require('../dataStore');

// GET /api/technicians - List all technicians with optional filters
router.get('/', (req, res) => {
  let results = db.technicians.getAll();
  if (req.query.serviceCenterId) results = results.filter(t => t.serviceCenterId === req.query.serviceCenterId);
  if (req.query.specialization) results = results.filter(t => t.specializations.includes(req.query.specialization));
  if (req.query.available === 'true') results = results.filter(t => t.available);
  if (req.query.brand) results = results.filter(t => t.certifiedBrands.includes(req.query.brand));
  results.sort((a, b) => b.rating - a.rating);
  res.json({ success: true, count: results.length, data: results });
});

// GET /api/technicians/:id - Get technician detail with active orders
router.get('/:id', (req, res) => {
  const tech = db.technicians.getById(req.params.id);
  if (!tech) return res.status(404).json({ success: false, error: 'Technician not found' });
  const activeOrders = db.repairOrders.getByTechnician(req.params.id).filter(r => r.status !== 'completed' && r.status !== 'cancelled');
  const center = db.serviceCenters.getById(tech.serviceCenterId);
  res.json({ success: true, data: { ...tech, center, activeOrders } });
});

// POST /api/technicians - Add a new technician
router.post('/', (req, res) => {
  const { firstName, lastName, serviceCenterId, specializations, certifiedBrands, yearsExperience } = req.body;
  if (!firstName || !lastName || !serviceCenterId) {
    return res.status(400).json({ success: false, error: 'firstName, lastName, and serviceCenterId are required' });
  }
  if (!db.serviceCenters.getById(serviceCenterId)) {
    return res.status(404).json({ success: false, error: 'Service center not found' });
  }
  const tech = db.technicians.create({
    firstName, lastName, serviceCenterId,
    employeeId: req.body.employeeId || '',
    phone: req.body.phone || '', email: req.body.email || '',
    specializations: specializations || [],
    certifiedBrands: certifiedBrands || [],
    yearsExperience: yearsExperience || 0,
    rating: 0
  });
  res.status(201).json({ success: true, data: tech });
});

// PUT /api/technicians/:id - Update technician
router.put('/:id', (req, res) => {
  const tech = db.technicians.getById(req.params.id);
  if (!tech) return res.status(404).json({ success: false, error: 'Technician not found' });
  const updated = db.technicians.update(req.params.id, req.body);
  res.json({ success: true, data: updated });
});

// PUT /api/technicians/:id/availability - Toggle availability
router.put('/:id/availability', (req, res) => {
  const tech = db.technicians.getById(req.params.id);
  if (!tech) return res.status(404).json({ success: false, error: 'Technician not found' });
  const available = req.body.available !== undefined ? req.body.available : !tech.available;
  const updated = db.technicians.update(req.params.id, { available });
  res.json({ success: true, data: updated, message: `Technician marked as ${available ? 'available' : 'unavailable'}` });
});

module.exports = router;
