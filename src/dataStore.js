/**
 * DataStore - JSON file-based persistence layer for APD Warranty Management
 * Reads from and writes to JSON files in the /data directory.
 * All mutations are immediately flushed to disk.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const COLLECTIONS = {
  customers: 'customers.json',
  products: 'products.json',
  warranties: 'warranties.json',
  claims: 'claims.json',
  serviceCenters: 'service-centers.json',
  technicians: 'technicians.json',
  repairOrders: 'repair-orders.json'
};

// In-memory cache
const cache = {};

function filePath(collection) {
  return path.join(DATA_DIR, COLLECTIONS[collection]);
}

function load(collection) {
  if (cache[collection]) return cache[collection];
  try {
    const raw = fs.readFileSync(filePath(collection), 'utf8');
    cache[collection] = JSON.parse(raw);
  } catch {
    cache[collection] = [];
  }
  return cache[collection];
}

function save(collection) {
  fs.writeFileSync(filePath(collection), JSON.stringify(cache[collection], null, 2), 'utf8');
}

// Initialize all collections into cache on startup
function init() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  Object.keys(COLLECTIONS).forEach(col => load(col));
  console.log('[DataStore] Initialized collections:', Object.keys(COLLECTIONS).join(', '));
}

// ─── Generic CRUD ────────────────────────────────────────────────────────────

function getAll(collection) {
  return load(collection);
}

function getById(collection, idField, id) {
  return load(collection).find(item => item[idField] === id) || null;
}

function query(collection, filterFn) {
  return load(collection).filter(filterFn);
}

function insert(collection, record) {
  load(collection).push(record);
  save(collection);
  return record;
}

function update(collection, idField, id, changes) {
  const items = load(collection);
  const idx = items.findIndex(item => item[idField] === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...changes, updatedAt: new Date().toISOString() };
  save(collection);
  return items[idx];
}

function remove(collection, idField, id) {
  const items = load(collection);
  const idx = items.findIndex(item => item[idField] === id);
  if (idx === -1) return false;
  items.splice(idx, 1);
  save(collection);
  return true;
}

// ─── ID Generation ────────────────────────────────────────────────────────────

function nextId(collection, idField, prefix) {
  const items = load(collection);
  if (items.length === 0) {
    const parts = prefix.split('-');
    const base = parts.slice(0, -1).join('-') + '-';
    const start = parseInt(parts[parts.length - 1], 10) || 10000;
    return `${base}${start + 1}`;
  }
  const nums = items
    .map(i => parseInt((i[idField] || '').split('-').pop(), 10))
    .filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  const parts = prefix.split('-');
  const base = parts.slice(0, -1).join('-') + '-';
  return `${base}${(max + 1).toString().padStart(parts[parts.length - 1].length, '0')}`;
}

// ─── Domain-specific helpers ─────────────────────────────────────────────────

const customers = {
  getAll: () => getAll('customers'),
  getById: id => getById('customers', 'customerId', id),
  getByEmail: email => query('customers', c => c.email === email)[0] || null,
  create: record => {
    record.customerId = nextId('customers', 'customerId', 'CUST-0001');
    record.registrationDate = record.registrationDate || new Date().toISOString().split('T')[0];
    record.totalWarranties = 0;
    record.totalClaims = 0;
    record.active = true;
    return insert('customers', record);
  },
  update: (id, changes) => update('customers', 'customerId', id, changes),
  delete: id => remove('customers', 'customerId', id)
};

const products = {
  getAll: () => getAll('products'),
  getById: id => getById('products', 'productId', id),
  getByCategory: cat => query('products', p => p.category === cat),
  getByBrand: brand => query('products', p => p.brand.toLowerCase() === brand.toLowerCase()),
  create: record => {
    record.productId = nextId('products', 'productId', 'PRD-001');
    record.active = true;
    return insert('products', record);
  },
  update: (id, changes) => update('products', 'productId', id, changes)
};

const warranties = {
  getAll: () => getAll('warranties'),
  getById: id => getById('warranties', 'warrantyId', id),
  getByCustomer: customerId => query('warranties', w => w.customerId === customerId),
  getByProduct: productId => query('warranties', w => w.productId === productId),
  getActive: () => query('warranties', w => w.status === 'active'),
  getExpiringSoon: (days = 30) => {
    const cutoff = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
    return query('warranties', w => w.status === 'active' && w.coverageEndDate <= cutoff);
  },
  create: record => {
    record.warrantyId = nextId('warranties', 'warrantyId', 'WRN-10001');
    record.status = record.status || 'active';
    record.claimCount = 0;
    record.createdAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    // Bump customer warranty count
    const cust = customers.getById(record.customerId);
    if (cust) customers.update(record.customerId, { totalWarranties: (cust.totalWarranties || 0) + 1 });
    return insert('warranties', record);
  },
  update: (id, changes) => update('warranties', 'warrantyId', id, changes),
  verify: (warrantyId, claimDate) => {
    const w = getById('warranties', 'warrantyId', warrantyId);
    if (!w) return { valid: false, reason: 'Warranty not found' };
    const date = claimDate || new Date().toISOString().split('T')[0];
    if (w.status !== 'active') return { valid: false, reason: `Warranty status is '${w.status}'` };
    if (date < w.coverageStartDate) return { valid: false, reason: 'Claim date before coverage start' };
    if (date > w.coverageEndDate) return { valid: false, reason: 'Warranty has expired' };
    return { valid: true, warranty: w };
  }
};

const claims = {
  getAll: () => getAll('claims'),
  getById: id => getById('claims', 'claimId', id),
  getByCustomer: customerId => query('claims', c => c.customerId === customerId),
  getByWarranty: warrantyId => query('claims', c => c.warrantyId === warrantyId),
  getByStatus: status => query('claims', c => c.status === status),
  getOpen: () => query('claims', c => !['completed', 'denied', 'closed'].includes(c.status)),
  create: record => {
    record.claimId = nextId('claims', 'claimId', 'CLM-20001');
    record.claimDate = record.claimDate || new Date().toISOString().split('T')[0];
    record.status = 'pending_approval';
    record.createdAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    // Increment warranty claim count
    const w = warranties.getById(record.warrantyId);
    if (w) warranties.update(record.warrantyId, { claimCount: (w.claimCount || 0) + 1 });
    // Increment customer claim count
    const cust = customers.getById(record.customerId);
    if (cust) customers.update(record.customerId, { totalClaims: (cust.totalClaims || 0) + 1 });
    return insert('claims', record);
  },
  update: (id, changes) => update('claims', 'claimId', id, changes),
  updateStatus: (id, status, notes) => {
    const changes = { status };
    if (notes) changes.notes = notes;
    if (status === 'completed' || status === 'denied') changes.resolutionDate = new Date().toISOString().split('T')[0];
    return update('claims', 'claimId', id, changes);
  }
};

const serviceCenters = {
  getAll: () => getAll('serviceCenters'),
  getById: id => getById('serviceCenters', 'serviceCenterId', id),
  getActive: () => query('serviceCenters', s => s.active),
  getBySpecialization: cat => query('serviceCenters', s => s.active && s.specializations.includes(cat)),
  getByState: state => query('serviceCenters', s => s.address.state === state),
  create: record => {
    record.serviceCenterId = nextId('serviceCenters', 'serviceCenterId', 'SVC-001');
    record.active = true;
    record.createdAt = new Date().toISOString();
    return insert('serviceCenters', record);
  },
  update: (id, changes) => update('serviceCenters', 'serviceCenterId', id, changes)
};

const technicians = {
  getAll: () => getAll('technicians'),
  getById: id => getById('technicians', 'technicianId', id),
  getByCenter: centerId => query('technicians', t => t.serviceCenterId === centerId),
  getAvailable: () => query('technicians', t => t.available),
  getBySpecialization: cat => query('technicians', t => t.specializations.includes(cat) && t.available),
  create: record => {
    record.technicianId = nextId('technicians', 'technicianId', 'TECH-001');
    record.activeOrders = 0;
    record.totalCompleted = 0;
    record.available = true;
    return insert('technicians', record);
  },
  update: (id, changes) => update('technicians', 'technicianId', id, changes)
};

const repairOrders = {
  getAll: () => getAll('repairOrders'),
  getById: id => getById('repairOrders', 'repairOrderId', id),
  getByClaim: claimId => query('repairOrders', r => r.claimId === claimId),
  getByCenter: centerId => query('repairOrders', r => r.serviceCenterId === centerId),
  getByTechnician: techId => query('repairOrders', r => r.technicianId === techId),
  getOpen: () => query('repairOrders', r => !['completed', 'cancelled'].includes(r.status)),
  create: record => {
    record.repairOrderId = nextId('repairOrders', 'repairOrderId', 'RPR-30001');
    record.status = record.status || 'scheduled';
    record.createdAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    // Update claim with repair order reference
    if (record.claimId) claims.update(record.claimId, { repairOrderId: record.repairOrderId, status: 'in_repair' });
    return insert('repairOrders', record);
  },
  update: (id, changes) => update('repairOrders', 'repairOrderId', id, changes),
  complete: (id, completionData) => {
    const changes = {
      ...completionData,
      status: 'completed',
      completionDate: completionData.completionDate || new Date().toISOString().split('T')[0]
    };
    const order = repairOrders.update(id, changes);
    if (order && order.claimId) {
      claims.update(order.claimId, {
        status: 'completed',
        actualRepairCost: completionData.totalCost,
        resolution: completionData.resolution || 'repair',
        resolutionDate: changes.completionDate
      });
    }
    return order;
  }
};

// ─── Analytics / Reporting ───────────────────────────────────────────────────

function getClaimsSummary() {
  const allClaims = claims.getAll();
  const summary = {
    total: allClaims.length,
    byStatus: {},
    byIssueType: {},
    byResolution: {},
    avgRepairCost: 0,
    totalRepairCost: 0
  };
  let costCount = 0;
  allClaims.forEach(c => {
    summary.byStatus[c.status] = (summary.byStatus[c.status] || 0) + 1;
    summary.byIssueType[c.issueType] = (summary.byIssueType[c.issueType] || 0) + 1;
    if (c.resolution) summary.byResolution[c.resolution] = (summary.byResolution[c.resolution] || 0) + 1;
    if (c.actualRepairCost != null) {
      summary.totalRepairCost += c.actualRepairCost;
      costCount++;
    }
  });
  summary.avgRepairCost = costCount ? Math.round(summary.totalRepairCost / costCount * 100) / 100 : 0;
  return summary;
}

function getWarrantySummary() {
  const allWarranties = warranties.getAll();
  return {
    total: allWarranties.length,
    byStatus: allWarranties.reduce((acc, w) => {
      acc[w.status] = (acc[w.status] || 0) + 1;
      return acc;
    }, {}),
    byType: allWarranties.reduce((acc, w) => {
      acc[w.warrantyType] = (acc[w.warrantyType] || 0) + 1;
      return acc;
    }, {}),
    totalPremiumRevenue: Math.round(allWarranties.reduce((s, w) => s + (w.premiumPaid || 0), 0) * 100) / 100
  };
}

module.exports = {
  init,
  customers,
  products,
  warranties,
  claims,
  serviceCenters,
  technicians,
  repairOrders,
  analytics: { getClaimsSummary, getWarrantySummary }
};
