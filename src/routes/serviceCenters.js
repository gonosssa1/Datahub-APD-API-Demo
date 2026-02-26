const express = require('express');
const router = express.Router();
const db = require('../dataStore');

// GET /api/service-centers - List service centers with optional filters
router.get('/', (req, res) => {
  let results = db.serviceCenters.getAll();
  if (req.query.state) results = results.filter(s => s.address.state === req.query.state);
  if (req.query.specialization) results = results.filter(s => s.specializations.includes(req.query.specialization));
  if (req.query.brand) results = results.filter(s => s.brands.includes(req.query.brand));
  if (req.query.active !== undefined) results = results.filter(s => s.active === (req.query.active !== 'false'));
  // Sort by rating descending
  results.sort((a, b) => b.rating - a.rating);
  res.json({ success: true, count: results.length, data: results });
});

// GET /api/service-centers/:id - Get service center details with technicians and active orders
router.get('/:id', (req, res) => {
  const center = db.serviceCenters.getById(req.params.id);
  if (!center) return res.status(404).json({ success: false, error: 'Service center not found' });
  const technicians = db.technicians.getByCenter(req.params.id);
  const activeOrders = db.repairOrders.getByCenter(req.params.id).filter(r => r.status !== 'completed' && r.status !== 'cancelled');
  res.json({ success: true, data: { ...center, technicians, activeOrders } });
});

// POST /api/service-centers - Register a new service center
router.post('/', (req, res) => {
  const { name, type, contactName, phone, email, address, specializations, brands, laborRate } = req.body;
  if (!name || !contactName || !phone || !address) {
    return res.status(400).json({ success: false, error: 'name, contactName, phone, and address are required' });
  }
  const center = db.serviceCenters.create({
    name, type: type || 'authorized', contactName, phone, email: email || '',
    address, specializations: specializations || [], brands: brands || [],
    technicianCount: 0, rating: 0, avgResponseDays: 0, avgCompletionDays: 0,
    activeOrders: 0, totalCompleted: 0, laborRate: laborRate || 85.00,
    coverageRadius: req.body.coverageRadius || 50,
    certifications: req.body.certifications || []
  });
  res.status(201).json({ success: true, data: center });
});

// PUT /api/service-centers/:id - Update service center
router.put('/:id', (req, res) => {
  const center = db.serviceCenters.getById(req.params.id);
  if (!center) return res.status(404).json({ success: false, error: 'Service center not found' });
  const updated = db.serviceCenters.update(req.params.id, req.body);
  res.json({ success: true, data: updated });
});

// GET /api/service-centers/:id/technicians - List technicians at a center
router.get('/:id/technicians', (req, res) => {
  const center = db.serviceCenters.getById(req.params.id);
  if (!center) return res.status(404).json({ success: false, error: 'Service center not found' });
  let techs = db.technicians.getByCenter(req.params.id);
  if (req.query.available === 'true') techs = techs.filter(t => t.available);
  res.json({ success: true, count: techs.length, data: techs });
});

// GET /api/service-centers/dispatch/recommend - Recommend best service center for a job
router.get('/dispatch/recommend', (req, res) => {
  const { productCategory, brand, state } = req.query;
  if (!productCategory) return res.status(400).json({ success: false, error: 'productCategory is required' });

  let centers = db.serviceCenters.getActive();
  if (productCategory) centers = centers.filter(s => s.specializations.includes(productCategory));
  if (brand) centers = centers.filter(s => s.brands.includes(brand));
  if (state) centers = centers.filter(s => s.address.state === state);

  // Score: 40% rating, 30% response time (inverse), 30% availability
  centers = centers.map(c => {
    const availableTechs = db.technicians.getByCenter(c.serviceCenterId).filter(t => t.available).length;
    const score = (c.rating / 5 * 40) + ((1 / Math.max(c.avgResponseDays, 1)) * 30) + (availableTechs > 0 ? 30 : 0);
    return { ...c, dispatchScore: Math.round(score * 10) / 10, availableTechnicians: availableTechs };
  }).sort((a, b) => b.dispatchScore - a.dispatchScore);

  res.json({ success: true, count: centers.length, data: centers });
});

module.exports = router;
