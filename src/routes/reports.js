const express = require('express');
const router = express.Router();
const db = require('../dataStore');

// GET /api/reports/dashboard - Executive dashboard summary
router.get('/dashboard', (req, res) => {
  const claimsSummary = db.analytics.getClaimsSummary();
  const warrantySummary = db.analytics.getWarrantySummary();
  const openClaims = db.claims.getOpen();
  const expiringWarranties = db.warranties.getExpiringSoon(30);
  const openRepairOrders = db.repairOrders.getOpen();

  res.json({
    success: true,
    data: {
      asOf: new Date().toISOString(),
      claims: claimsSummary,
      warranties: warrantySummary,
      alerts: {
        openClaims: openClaims.length,
        warrantiesExpiringSoon: expiringWarranties.length,
        openRepairOrders: openRepairOrders.length,
        pendingApproval: claimsSummary.byStatus['pending_approval'] || 0
      },
      customers: {
        total: db.customers.getAll().length,
        active: db.customers.getAll().filter(c => c.active).length
      },
      serviceCenters: {
        total: db.serviceCenters.getAll().length,
        active: db.serviceCenters.getActive().length,
        availableTechnicians: db.technicians.getAvailable().length
      }
    }
  });
});

// GET /api/reports/claims-summary - Detailed claims analysis
router.get('/claims-summary', (req, res) => {
  const allClaims = db.claims.getAll();
  // Optional date range filter
  const { from, to } = req.query;
  let filtered = allClaims;
  if (from) filtered = filtered.filter(c => c.claimDate >= from);
  if (to) filtered = filtered.filter(c => c.claimDate <= to);

  const byMonth = {};
  const byProduct = {};
  const byIssueCategory = {};

  filtered.forEach(c => {
    // By month
    const month = (c.claimDate || c.createdAt || '').substring(0, 7);
    if (month) byMonth[month] = (byMonth[month] || 0) + 1;

    // By product
    byProduct[c.productId] = (byProduct[c.productId] || 0) + 1;

    // By issue category
    const cat = c.issueCategory || 'unspecified';
    byIssueCategory[cat] = (byIssueCategory[cat] || 0) + 1;
  });

  const completed = filtered.filter(c => c.status === 'completed');
  const totalCost = completed.reduce((s, c) => s + (c.actualRepairCost || 0), 0);
  const totalDeductibles = filtered.reduce((s, c) => s + (c.deductibleCollected || 0), 0);

  // Satisfaction scores
  const scores = completed.filter(c => c.customerSatisfactionScore).map(c => c.customerSatisfactionScore);
  const avgSatisfaction = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null;

  res.json({
    success: true,
    data: {
      period: { from: from || 'all', to: to || 'all' },
      total: filtered.length,
      byStatus: filtered.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {}),
      byIssueType: filtered.reduce((acc, c) => { acc[c.issueType] = (acc[c.issueType] || 0) + 1; return acc; }, {}),
      byIssueCategory,
      byMonth: Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {}),
      byProductId: byProduct,
      financials: {
        totalRepairCost: Math.round(totalCost * 100) / 100,
        totalDeductiblesCollected: Math.round(totalDeductibles * 100) / 100,
        avgRepairCost: completed.length ? Math.round(totalCost / completed.length * 100) / 100 : 0,
        netClaimCost: Math.round((totalCost - totalDeductibles) * 100) / 100
      },
      satisfaction: { avgScore: avgSatisfaction, responseCount: scores.length }
    }
  });
});

// GET /api/reports/warranty-expiration - Expiration forecast
router.get('/warranty-expiration', (req, res) => {
  const days = parseInt(req.query.days) || 90;
  const expiring = db.warranties.getExpiringSoon(days);

  const enriched = expiring.map(w => {
    const customer = db.customers.getById(w.customerId);
    const product = db.products.getById(w.productId);
    const daysLeft = Math.ceil((new Date(w.coverageEndDate) - new Date()) / 86400000);
    return {
      warrantyId: w.warrantyId,
      warrantyType: w.warrantyType,
      coverageEndDate: w.coverageEndDate,
      daysUntilExpiration: daysLeft,
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown',
      customerEmail: customer ? customer.email : '',
      productName: product ? product.name : 'Unknown',
      productCategory: product ? product.category : ''
    };
  }).sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);

  res.json({
    success: true,
    lookAheadDays: days,
    count: enriched.length,
    data: enriched
  });
});

// GET /api/reports/service-center-performance - Service center KPIs
router.get('/service-center-performance', (req, res) => {
  const centers = db.serviceCenters.getActive();
  const performance = centers.map(c => {
    const orders = db.repairOrders.getByCenter(c.serviceCenterId);
    const completed = orders.filter(o => o.status === 'completed');
    const totalRevenue = completed.reduce((s, o) => s + (o.totalCost || 0), 0);
    const avgCompletion = completed.length
      ? completed.filter(o => o.scheduledDate && o.completionDate)
          .reduce((s, o) => {
            const days = Math.ceil((new Date(o.completionDate) - new Date(o.scheduledDate)) / 86400000);
            return s + Math.max(0, days);
          }, 0) / Math.max(1, completed.filter(o => o.scheduledDate && o.completionDate).length)
      : 0;
    return {
      serviceCenterId: c.serviceCenterId,
      name: c.name,
      state: c.address.state,
      rating: c.rating,
      totalOrders: orders.length,
      completedOrders: completed.length,
      activeOrders: orders.filter(o => !['completed', 'cancelled'].includes(o.status)).length,
      avgCompletionDays: Math.round(avgCompletion * 10) / 10,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      technicianCount: db.technicians.getByCenter(c.serviceCenterId).length,
      availableTechnicians: db.technicians.getByCenter(c.serviceCenterId).filter(t => t.available).length
    };
  });
  res.json({ success: true, count: performance.length, data: performance });
});

// GET /api/reports/replacement-candidates - Claims where repair cost approaches replacement threshold
router.get('/replacement-candidates', (req, res) => {
  const activeClaims = db.claims.getAll().filter(c => ['pending_approval', 'approved', 'in_repair'].includes(c.status));
  const candidates = [];

  activeClaims.forEach(c => {
    const product = db.products.getById(c.productId);
    const warranty = db.warranties.getById(c.warrantyId);
    if (!product || !warranty) return;

    const repairEstimate = c.estimatedRepairCost || product.averageRepairCost;
    const purchasePrice = warranty.purchasePrice || product.msrp;
    const threshold = product.replacementCostThreshold || 0.70;

    if (repairEstimate / purchasePrice >= threshold) {
      const customer = db.customers.getById(c.customerId);
      candidates.push({
        claimId: c.claimId,
        status: c.status,
        customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown',
        productName: product.name,
        productCategory: product.category,
        purchasePrice,
        repairEstimate,
        replacementThresholdPct: Math.round(threshold * 100),
        repairToPurchaseRatio: Math.round(repairEstimate / purchasePrice * 100),
        recommendation: repairEstimate / purchasePrice >= 0.9 ? 'replace' : 'evaluate'
      });
    }
  });

  res.json({ success: true, count: candidates.length, data: candidates });
});

module.exports = router;
