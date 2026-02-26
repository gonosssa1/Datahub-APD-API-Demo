/**
 * APD Warranty Management API Server
 * Asset Protection Division - Consumer Appliance Warranty System
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/dataStore');

// Initialize data store from JSON files
db.init();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.url}`);
  next();
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/customers',       require('./src/routes/customers'));
app.use('/api/products',        require('./src/routes/products'));
app.use('/api/warranties',      require('./src/routes/warranties'));
app.use('/api/claims',          require('./src/routes/claims'));
app.use('/api/service-centers', require('./src/routes/serviceCenters'));
app.use('/api/technicians',     require('./src/routes/technicians'));
app.use('/api/repair-orders',   require('./src/routes/repairOrders'));
app.use('/api/reports',         require('./src/routes/reports'));

// ─── API Index - enumerate available endpoints ────────────────────────────────
app.get('/api', (req, res) => {
  res.json({
    name: 'APD Warranty Management API',
    version: '1.0.0',
    description: 'Asset Protection Division - Consumer Appliance Warranty System',
    endpoints: {
      customers: {
        'GET    /api/customers':                         'List all customers (query: tier, state, active)',
        'GET    /api/customers/:id':                     'Get customer with warranties and claims',
        'POST   /api/customers':                         'Register new customer',
        'PUT    /api/customers/:id':                     'Update customer record',
        'GET    /api/customers/:id/warranties':          'List warranties for customer',
        'GET    /api/customers/:id/claims':              'List claims for customer'
      },
      products: {
        'GET    /api/products':                          'List product catalog (query: category, brand, active)',
        'GET    /api/products/:id':                      'Get product with claim stats',
        'POST   /api/products':                          'Add product to catalog',
        'PUT    /api/products/:id':                      'Update product',
        'GET    /api/products/categories/list':          'List distinct product categories'
      },
      warranties: {
        'GET    /api/warranties':                        'List warranties (query: status, customerId, productId, type, expiringSoon)',
        'GET    /api/warranties/:id':                    'Get warranty with customer, product, and claims',
        'POST   /api/warranties':                        'Register new warranty',
        'PUT    /api/warranties/:id':                    'Update warranty',
        'PUT    /api/warranties/:id/cancel':             'Cancel a warranty',
        'POST   /api/warranties/verify':                 'Verify coverage before filing claim'
      },
      claims: {
        'GET    /api/claims':                            'List claims (query: status, customerId, warrantyId, open, issueType)',
        'GET    /api/claims/:id':                        'Get claim with full enrichment',
        'POST   /api/claims':                            'File new warranty claim',
        'PUT    /api/claims/:id/status':                 'Update claim status',
        'PUT    /api/claims/:id/approve':                'Approve a pending claim',
        'PUT    /api/claims/:id/deny':                   'Deny a claim',
        'PUT    /api/claims/:id/close':                  'Close a completed claim'
      },
      serviceCenters: {
        'GET    /api/service-centers':                   'List service centers (query: state, specialization, brand, active)',
        'GET    /api/service-centers/:id':               'Get center with technicians and active orders',
        'POST   /api/service-centers':                   'Register new service center',
        'PUT    /api/service-centers/:id':               'Update service center',
        'GET    /api/service-centers/:id/technicians':   'List technicians at a center',
        'GET    /api/service-centers/dispatch/recommend':'Recommend best center for a job (query: productCategory, brand, state)'
      },
      technicians: {
        'GET    /api/technicians':                       'List technicians (query: serviceCenterId, specialization, available, brand)',
        'GET    /api/technicians/:id':                   'Get technician with active orders',
        'POST   /api/technicians':                       'Add new technician',
        'PUT    /api/technicians/:id':                   'Update technician',
        'PUT    /api/technicians/:id/availability':      'Toggle technician availability'
      },
      repairOrders: {
        'GET    /api/repair-orders':                     'List repair orders (query: status, serviceCenterId, technicianId, customerId, open)',
        'GET    /api/repair-orders/:id':                 'Get repair order with full enrichment',
        'POST   /api/repair-orders':                     'Create repair order from approved claim',
        'PUT    /api/repair-orders/:id':                 'Update repair order',
        'PUT    /api/repair-orders/:id/complete':        'Complete a repair order',
        'PUT    /api/repair-orders/:id/cancel':          'Cancel a repair order'
      },
      reports: {
        'GET    /api/reports/dashboard':                 'Executive dashboard summary',
        'GET    /api/reports/claims-summary':            'Detailed claims analysis (query: from, to)',
        'GET    /api/reports/warranty-expiration':       'Expiration forecast (query: days)',
        'GET    /api/reports/service-center-performance':'Service center KPIs',
        'GET    /api/reports/replacement-candidates':    'Claims where repair cost approaches replacement threshold'
      }
    }
  });
});

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ success: false, error: 'Internal server error', detail: err.message });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  APD Warranty Management API`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  API Index: http://localhost:${PORT}/api`);
  console.log(`  UI: http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
