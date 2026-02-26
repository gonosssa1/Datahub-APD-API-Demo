/* ─── APD Warranty Management UI ─────────────────────────────────── */

const API = '';  // relative base URL

// ─── Navigation ──────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    const sectionId = 'section-' + btn.dataset.section;
    document.getElementById(sectionId).classList.add('active');
    // Load section data
    switch (btn.dataset.section) {
      case 'dashboard':      loadDashboard(); break;
      case 'customers':      loadCustomers(); break;
      case 'warranties':     loadWarranties(); break;
      case 'claims':         loadClaims(); break;
      case 'repair-orders':  loadRepairOrders(); break;
      case 'service-centers':loadServiceCenters(); break;
    }
  });
});

// ─── API Helper ──────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  setTimeout(() => el.classList.add('hidden'), 3000);
}

// ─── Modal helpers ────────────────────────────────────────────────────────────
function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id).classList.add('hidden'); }
function closeDetail(id) { document.getElementById(id).classList.add('hidden'); }

// ─── Formatting ───────────────────────────────────────────────────────────────
const fmt$ = n => n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const badge = (val, label) => `<span class="badge badge-${val}">${label || val.replace(/_/g, ' ')}</span>`;
const stars = r => '<span class="stars">' + '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r)) + '</span> ' + r;

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

// ─────────────────────────────────────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
async function loadDashboard() {
  const [dashRes, expRes, repRes] = await Promise.all([
    api('GET', '/api/reports/dashboard'),
    api('GET', '/api/reports/warranty-expiration?days=30'),
    api('GET', '/api/reports/replacement-candidates')
  ]);

  if (!dashRes.ok) return;
  const d = dashRes.data.data;

  // Alerts
  const alerts = [
    { label: `${d.alerts.pendingApproval} claims pending approval`, cls: d.alerts.pendingApproval > 0 ? 'warning' : 'success', icon: '⚠' },
    { label: `${d.alerts.openClaims} open claims`, cls: d.alerts.openClaims > 2 ? 'info' : 'success', icon: '📋' },
    { label: `${d.alerts.warrantiesExpiringSoon} warranties expiring soon`, cls: d.alerts.warrantiesExpiringSoon > 0 ? 'warning' : 'success', icon: '📅' },
    { label: `${d.alerts.openRepairOrders} open repair orders`, cls: 'info', icon: '🔧' }
  ];
  document.getElementById('dashboard-alerts').innerHTML = alerts.map(a =>
    `<div class="alert-chip ${a.cls}">${a.icon} ${a.label}</div>`
  ).join('');

  // Stat cards
  document.getElementById('dashboard-stats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Customers</div><div class="stat-value">${d.customers.total}</div><div class="stat-sub">${d.customers.active} active</div></div>
    <div class="stat-card"><div class="stat-label">Warranties</div><div class="stat-value">${d.warranties.total}</div><div class="stat-sub">${(d.warranties.byStatus.active||0)} active</div></div>
    <div class="stat-card"><div class="stat-label">Total Claims</div><div class="stat-value">${d.claims.total}</div><div class="stat-sub">${d.alerts.openClaims} open</div></div>
    <div class="stat-card"><div class="stat-label">Avg Repair Cost</div><div class="stat-value">${fmt$(d.claims.avgRepairCost)}</div><div class="stat-sub">per completed claim</div></div>
    <div class="stat-card"><div class="stat-label">Premium Revenue</div><div class="stat-value">${fmt$(d.warranties.totalPremiumRevenue)}</div><div class="stat-sub">total collected</div></div>
    <div class="stat-card"><div class="stat-label">Service Centers</div><div class="stat-value">${d.serviceCenters.active}</div><div class="stat-sub">${d.serviceCenters.availableTechnicians} techs available</div></div>
  `;

  // Claims by status bar chart
  const claimStatuses = Object.entries(d.claims.byStatus).sort((a,b) => b[1]-a[1]);
  const maxClaim = claimStatuses[0]?.[1] || 1;
  document.getElementById('claims-by-status').innerHTML = `<ul class="bar-list">${claimStatuses.map(([k,v]) =>
    `<li class="bar-item"><span class="bar-label">${k.replace(/_/g,' ')}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${v/maxClaim*100}%"><span>${v}</span></div></div></li>`
  ).join('')}</ul>`;

  // Warranties by type bar chart
  const wTypes = Object.entries(d.warranties.byType).sort((a,b) => b[1]-a[1]);
  const maxW = wTypes[0]?.[1] || 1;
  document.getElementById('warranties-by-type').innerHTML = `<ul class="bar-list">${wTypes.map(([k,v]) =>
    `<li class="bar-item"><span class="bar-label">${k}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${v/maxW*100}%"><span>${v}</span></div></div></li>`
  ).join('')}</ul>`;

  // Expiring warranties
  const expiring = expRes.ok ? expRes.data.data : [];
  document.getElementById('expiring-warranties').innerHTML = expiring.length === 0
    ? '<p class="empty">No warranties expiring within 30 days.</p>'
    : `<div class="table-wrap"><table>
      <thead><tr><th>Warranty ID</th><th>Customer</th><th>Product</th><th>Expires</th><th>Days Left</th></tr></thead>
      <tbody>${expiring.slice(0,8).map(e => `<tr>
        <td><strong>${e.warrantyId}</strong></td>
        <td>${e.customerName}</td>
        <td>${e.productName}</td>
        <td>${fmtDate(e.coverageEndDate)}</td>
        <td><span class="badge ${e.daysUntilExpiration <= 7 ? 'badge-denied' : 'badge-pending_approval'}">${e.daysUntilExpiration}d</span></td>
      </tr>`).join('')}</tbody></table></div>`;

  // Replacement candidates
  const reps = repRes.ok ? repRes.data.data : [];
  document.getElementById('replacement-candidates').innerHTML = reps.length === 0
    ? '<p class="empty">No current replacement candidates.</p>'
    : `<div class="table-wrap"><table>
      <thead><tr><th>Claim ID</th><th>Customer</th><th>Product</th><th>Purchase Price</th><th>Repair Est.</th><th>Repair/Price</th><th>Recommendation</th></tr></thead>
      <tbody>${reps.map(r => `<tr>
        <td><strong>${r.claimId}</strong></td>
        <td>${r.customerName}</td>
        <td>${r.productName}</td>
        <td>${fmt$(r.purchasePrice)}</td>
        <td>${fmt$(r.repairEstimate)}</td>
        <td><strong>${r.repairToPurchaseRatio}%</strong></td>
        <td>${r.recommendation === 'replace' ? badge('denied','Replace') : badge('warning','Evaluate')}</td>
      </tr>`).join('')}</tbody></table></div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  CUSTOMERS
// ─────────────────────────────────────────────────────────────────────────────
let allCustomers = [];

async function loadCustomers() {
  const res = await api('GET', '/api/customers');
  allCustomers = res.ok ? res.data.data : [];
  filterCustomers();
}

function filterCustomers() {
  const q = document.getElementById('customer-search').value.toLowerCase();
  const tier = document.getElementById('customer-tier-filter').value;
  let filtered = allCustomers.filter(c => {
    const name = `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase();
    return name.includes(q) && (!tier || c.customerTier === tier);
  });
  renderCustomers(filtered);
}

function renderCustomers(list) {
  const wrap = document.getElementById('customers-table-wrap');
  if (!list.length) { wrap.innerHTML = '<p class="empty">No customers found.</p>'; return; }
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>State</th><th>Tier</th><th>Warranties</th><th>Claims</th><th></th></tr></thead>
    <tbody>${list.map(c => `<tr>
      <td><code>${c.customerId}</code></td>
      <td><strong>${c.firstName} ${c.lastName}</strong></td>
      <td>${c.email}</td>
      <td>${c.phone || '—'}</td>
      <td>${c.address?.state || '—'}</td>
      <td>${badge(c.customerTier)}</td>
      <td>${c.totalWarranties}</td>
      <td>${c.totalClaims}</td>
      <td><button class="table-action" onclick="viewCustomer('${c.customerId}')">View &rsaquo;</button></td>
    </tr>`).join('')}</tbody></table></div>`;
}

async function viewCustomer(id) {
  const res = await api('GET', `/api/customers/${id}`);
  if (!res.ok) return toast('Failed to load customer', 'error');
  const c = res.data.data;
  const panel = document.getElementById('customer-detail');
  document.getElementById('customer-detail-content').innerHTML = `
    <div class="detail-header">
      <div><div class="detail-title">${c.firstName} ${c.lastName} ${badge(c.customerTier)}</div>
      <div class="detail-sub">${c.customerId} &bull; Registered ${fmtDate(c.registrationDate)}</div></div>
    </div>
    <div class="detail-grid">
      <div class="detail-field"><label>Email</label><span>${c.email}</span></div>
      <div class="detail-field"><label>Phone</label><span>${c.phone || '—'}</span></div>
      <div class="detail-field"><label>Address</label><span>${c.address ? `${c.address.street}, ${c.address.city}, ${c.address.state} ${c.address.zip}` : '—'}</span></div>
      <div class="detail-field"><label>Preferred Contact</label><span>${c.preferredContact}</span></div>
      <div class="detail-field"><label>Total Warranties</label><span>${c.totalWarranties}</span></div>
      <div class="detail-field"><label>Total Claims</label><span>${c.totalClaims}</span></div>
    </div>
    ${c.warranties?.length ? `<div class="sub-table-title">Warranties (${c.warranties.length})</div>
    <div class="table-wrap"><table><thead><tr><th>ID</th><th>Type</th><th>Coverage End</th><th>Status</th><th>Claims</th></tr></thead>
    <tbody>${c.warranties.map(w => `<tr><td>${w.warrantyId}</td><td>${w.warrantyType}</td><td>${fmtDate(w.coverageEndDate)}</td><td>${badge(w.status)}</td><td>${w.claimCount}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${c.claims?.length ? `<div class="sub-table-title">Claims (${c.claims.length})</div>
    <div class="table-wrap"><table><thead><tr><th>ID</th><th>Issue</th><th>Date</th><th>Status</th><th>Cost</th></tr></thead>
    <tbody>${c.claims.map(cl => `<tr><td>${cl.claimId}</td><td>${cl.issueType.replace(/_/g,' ')}</td><td>${fmtDate(cl.claimDate)}</td><td>${badge(cl.status)}</td><td>${fmt$(cl.actualRepairCost)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="detail-actions">
      <button class="btn btn-sm" onclick="showModal('modal-new-warranty')">+ Register Warranty</button>
      <button class="btn btn-sm" onclick="showModal('modal-new-claim')">+ File Claim</button>
    </div>`;
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth' });
}

async function submitNewCustomer() {
  const body = {
    firstName: document.getElementById('nc-firstName').value,
    lastName: document.getElementById('nc-lastName').value,
    email: document.getElementById('nc-email').value,
    phone: document.getElementById('nc-phone').value,
    address: {
      street: document.getElementById('nc-street').value,
      city: document.getElementById('nc-city').value,
      state: document.getElementById('nc-state').value,
      zip: document.getElementById('nc-zip').value,
      country: 'USA'
    },
    preferredContact: document.getElementById('nc-preferredContact').value,
    customerTier: document.getElementById('nc-tier').value
  };
  const res = await api('POST', '/api/customers', body);
  if (res.ok) { hideModal('modal-new-customer'); toast(`Customer ${res.data.data.customerId} registered!`); loadCustomers(); }
  else toast(res.data.error || 'Error registering customer', 'error');
}

// ─────────────────────────────────────────────────────────────────────────────
//  WARRANTIES
// ─────────────────────────────────────────────────────────────────────────────
async function loadWarranties() {
  const status = document.getElementById('warranty-status-filter').value;
  const type   = document.getElementById('warranty-type-filter').value;
  const expiring = document.getElementById('warranty-expiring-filter').checked;
  let qs = [];
  if (status) qs.push(`status=${status}`);
  if (type)   qs.push(`type=${type}`);
  if (expiring) qs.push('expiringSoon=30');
  const res = await api('GET', `/api/warranties?${qs.join('&')}`);
  const list = res.ok ? res.data.data : [];
  const wrap = document.getElementById('warranties-table-wrap');
  if (!list.length) { wrap.innerHTML = '<p class="empty">No warranties found.</p>'; return; }
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Warranty ID</th><th>Customer</th><th>Product</th><th>Type</th><th>Coverage End</th><th>Deductible</th><th>Status</th><th>Claims</th><th></th></tr></thead>
    <tbody>${list.map(w => `<tr>
      <td><code>${w.warrantyId}</code></td>
      <td>${w.customerId}</td>
      <td>${w.productId}</td>
      <td>${badge(w.warrantyType)}</td>
      <td>${fmtDate(w.coverageEndDate)}</td>
      <td>${fmt$(w.deductible)}</td>
      <td>${badge(w.status)}</td>
      <td>${w.claimCount}</td>
      <td><button class="table-action" onclick="viewWarranty('${w.warrantyId}')">View &rsaquo;</button></td>
    </tr>`).join('')}</tbody></table></div>`;
}

async function viewWarranty(id) {
  const res = await api('GET', `/api/warranties/${id}`);
  if (!res.ok) return toast('Failed to load warranty', 'error');
  const w = res.data.data;
  const covMap = { mechanicalFailure:'Mechanical Failure', electricalFailure:'Electrical Failure', accidentalDamage:'Accidental Damage', cosmeticDamage:'Cosmetic Damage', foodSpoilage:'Food Spoilage', powerSurge:'Power Surge' };
  const panel = document.getElementById('warranty-detail');
  document.getElementById('warranty-detail-content').innerHTML = `
    <div class="detail-header">
      <div><div class="detail-title">${w.warrantyId} ${badge(w.warrantyType)} ${badge(w.status)}</div>
      <div class="detail-sub">Serial: ${w.serialNumber} &bull; Purchased from ${w.retailer} on ${fmtDate(w.purchaseDate)}</div></div>
    </div>
    <div class="detail-grid">
      <div class="detail-field"><label>Customer</label><span>${w.customer?.firstName} ${w.customer?.lastName}</span></div>
      <div class="detail-field"><label>Product</label><span>${w.product?.name || w.productId}</span></div>
      <div class="detail-field"><label>Coverage Start</label><span>${fmtDate(w.coverageStartDate)}</span></div>
      <div class="detail-field"><label>Coverage End</label><span>${fmtDate(w.coverageEndDate)}</span></div>
      <div class="detail-field"><label>Deductible</label><span>${fmt$(w.deductible)}</span></div>
      <div class="detail-field"><label>Max Coverage</label><span>${fmt$(w.maxCoverageAmount)}</span></div>
      <div class="detail-field"><label>Premium Paid</label><span>${fmt$(w.premiumPaid)}</span></div>
      <div class="detail-field"><label>Claims Filed</label><span>${w.claimCount}</span></div>
    </div>
    <div><strong style="font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Coverage Details</strong>
    <div class="coverage-grid">${Object.entries(w.coverageDetails||{}).map(([k,v]) =>
      `<div class="coverage-item"><span class="${v?'check':'cross'}">${v?'✓':'✗'}</span>${covMap[k]||k}</div>`
    ).join('')}</div></div>
    ${w.claims?.length ? `<div class="sub-table-title">Claims (${w.claims.length})</div>
    <div class="table-wrap"><table><thead><tr><th>Claim ID</th><th>Issue</th><th>Date</th><th>Status</th><th>Cost</th></tr></thead>
    <tbody>${w.claims.map(c => `<tr><td>${c.claimId}</td><td>${c.issueType.replace(/_/g,' ')}</td><td>${fmtDate(c.claimDate)}</td><td>${badge(c.status)}</td><td>${fmt$(c.actualRepairCost)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="detail-actions">
      ${w.status==='active' ? `<button class="btn btn-sm" onclick="showModal('modal-new-claim')">+ File Claim</button>` : ''}
      ${w.status==='active' ? `<button class="btn btn-sm btn-danger" onclick="cancelWarranty('${w.warrantyId}')">Cancel Warranty</button>` : ''}
    </div>`;
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth' });
}

async function cancelWarranty(id) {
  if (!confirm('Cancel this warranty?')) return;
  const res = await api('PUT', `/api/warranties/${id}/cancel`, { reason: 'Customer request' });
  if (res.ok) { toast('Warranty cancelled'); loadWarranties(); closeDetail('warranty-detail'); }
  else toast(res.data.error || 'Error', 'error');
}

function openVerifyModal() { document.getElementById('verify-result').classList.add('hidden'); showModal('modal-verify-coverage'); }

async function submitVerify() {
  const body = { warrantyId: document.getElementById('vc-warrantyId').value };
  const date = document.getElementById('vc-claimDate').value;
  const issue = document.getElementById('vc-issueType').value;
  if (date) body.claimDate = date;
  if (issue) body.issueType = issue;
  const res = await api('POST', '/api/warranties/verify', body);
  const out = document.getElementById('verify-result');
  if (!res.ok) { out.innerHTML = `<h4>Error</h4><p>${res.data.error}</p>`; out.className='verify-result not-covered hidden'; out.classList.remove('hidden'); return; }
  const d = res.data;
  if (d.covered) {
    const w = d.warranty;
    out.className='verify-result covered'; out.classList.remove('hidden');
    out.innerHTML = `<h4>&#10003; Coverage Confirmed</h4>
      <ul><li>Warranty type: <strong>${w.warrantyType}</strong></li>
      <li>Expires: <strong>${fmtDate(w.coverageEndDate)}</strong></li>
      <li>Deductible: <strong>${fmt$(w.deductible)}</strong></li>
      <li>Claims this year: <strong>${w.claimsThisYear} / ${w.maxClaimsPerYear}</strong></li></ul>`;
  } else {
    out.className='verify-result not-covered'; out.classList.remove('hidden');
    out.innerHTML = `<h4>&#10007; Not Covered</h4><p>${d.reason}</p>`;
  }
}

async function submitNewWarranty() {
  const body = {
    customerId: document.getElementById('nw-customerId').value,
    productId: document.getElementById('nw-productId').value,
    serialNumber: document.getElementById('nw-serialNumber').value,
    purchaseDate: document.getElementById('nw-purchaseDate').value,
    purchasePrice: parseFloat(document.getElementById('nw-purchasePrice').value) || 0,
    retailer: document.getElementById('nw-retailer').value,
    warrantyType: document.getElementById('nw-warrantyType').value,
    coverageEndDate: document.getElementById('nw-coverageEndDate').value,
    deductible: parseFloat(document.getElementById('nw-deductible').value) || 0,
    premiumPaid: parseFloat(document.getElementById('nw-premiumPaid').value) || 0
  };
  const res = await api('POST', '/api/warranties', body);
  if (res.ok) { hideModal('modal-new-warranty'); toast(`Warranty ${res.data.data.warrantyId} registered!`); loadWarranties(); }
  else toast(res.data.error || 'Error', 'error');
}

// ─────────────────────────────────────────────────────────────────────────────
//  CLAIMS
// ─────────────────────────────────────────────────────────────────────────────
async function loadClaims() {
  const status = document.getElementById('claim-status-filter').value;
  const issue  = document.getElementById('claim-issue-filter').value;
  const open   = document.getElementById('claim-open-filter').checked;
  let qs = [];
  if (status) qs.push(`status=${status}`);
  if (issue)  qs.push(`issueType=${issue}`);
  if (open)   qs.push('open=true');
  const res = await api('GET', `/api/claims?${qs.join('&')}`);
  const list = res.ok ? res.data.data : [];
  const wrap = document.getElementById('claims-table-wrap');
  if (!list.length) { wrap.innerHTML = '<p class="empty">No claims found.</p>'; return; }
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Claim ID</th><th>Customer</th><th>Product</th><th>Issue</th><th>Date</th><th>Priority</th><th>Status</th><th>Cost</th><th></th></tr></thead>
    <tbody>${list.map(c => `<tr>
      <td><code>${c.claimId}</code></td>
      <td>${c.customerId}</td>
      <td>${c.productId}</td>
      <td>${c.issueType.replace(/_/g,' ')}</td>
      <td>${fmtDate(c.claimDate)}</td>
      <td><span class="badge ${c.priority==='urgent'?'badge-denied':c.priority==='high'?'badge-pending_approval':'badge-standard'}">${c.priority}</span></td>
      <td>${badge(c.status)}</td>
      <td>${fmt$(c.actualRepairCost)}</td>
      <td><button class="table-action" onclick="viewClaim('${c.claimId}')">View &rsaquo;</button></td>
    </tr>`).join('')}</tbody></table></div>`;
}

async function viewClaim(id) {
  const res = await api('GET', `/api/claims/${id}`);
  if (!res.ok) return toast('Failed to load claim', 'error');
  const c = res.data.data;
  const panel = document.getElementById('claim-detail');
  document.getElementById('claim-detail-content').innerHTML = `
    <div class="detail-header">
      <div><div class="detail-title">${c.claimId} ${badge(c.status)} <span class="badge ${c.priority==='urgent'?'badge-denied':c.priority==='high'?'badge-pending_approval':'badge-standard'}">${c.priority}</span></div>
      <div class="detail-sub">${c.issueType.replace(/_/g,' ')} &bull; Filed ${fmtDate(c.claimDate)}</div></div>
    </div>
    <div class="detail-grid">
      <div class="detail-field"><label>Customer</label><span>${c.customer?.firstName} ${c.customer?.lastName}</span></div>
      <div class="detail-field"><label>Product</label><span>${c.product?.name || c.productId}</span></div>
      <div class="detail-field"><label>Warranty</label><span>${c.warrantyId}</span></div>
      <div class="detail-field"><label>Issue Category</label><span>${c.issueCategory||'—'}</span></div>
      <div class="detail-field"><label>Deductible Collected</label><span>${fmt$(c.deductibleCollected)}</span></div>
      <div class="detail-field"><label>Est. Repair Cost</label><span>${fmt$(c.estimatedRepairCost)}</span></div>
      <div class="detail-field"><label>Actual Repair Cost</label><span>${fmt$(c.actualRepairCost)}</span></div>
      <div class="detail-field"><label>Resolution</label><span>${c.resolution||'—'}</span></div>
      <div class="detail-field"><label>Resolution Date</label><span>${fmtDate(c.resolutionDate)}</span></div>
      <div class="detail-field"><label>Service Center</label><span>${c.repairOrder?.serviceCenterId||c.serviceCenterId||'—'}</span></div>
    </div>
    <div class="detail-field" style="margin-bottom:1rem"><label>Description</label><p style="margin-top:.3rem;font-size:.9rem">${c.description}</p></div>
    ${c.notes ? `<div class="detail-field"><label>Notes</label><p style="margin-top:.3rem;font-size:.85rem;color:var(--text-muted)">${c.notes}</p></div>` : ''}
    <div class="detail-actions">
      ${c.status==='pending_approval' ? `<button class="btn btn-sm btn-success" onclick="approveClaim('${c.claimId}')">&#10003; Approve</button><button class="btn btn-sm btn-danger" onclick="denyClaim('${c.claimId}')">&#10007; Deny</button>` : ''}
      ${c.status==='approved' ? `<button class="btn btn-sm" onclick="showModal('modal-new-repair-order')">Create Repair Order</button>` : ''}
      ${c.status==='completed' ? `<button class="btn btn-sm btn-outline" onclick="closeClaim('${c.claimId}')">Close Claim</button>` : ''}
    </div>`;
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth' });
}

async function approveClaim(id) {
  const est = prompt('Estimated repair cost ($):');
  const res = await api('PUT', `/api/claims/${id}/approve`, { estimatedRepairCost: parseFloat(est)||null });
  if (res.ok) { toast('Claim approved'); loadClaims(); closeDetail('claim-detail'); }
  else toast(res.data.error||'Error','error');
}

async function denyClaim(id) {
  const reason = prompt('Denial reason:');
  if (!reason) return;
  const res = await api('PUT', `/api/claims/${id}/deny`, { reason });
  if (res.ok) { toast('Claim denied'); loadClaims(); closeDetail('claim-detail'); }
  else toast(res.data.error||'Error','error');
}

async function closeClaim(id) {
  const score = prompt('Customer satisfaction score (1-5):');
  const res = await api('PUT', `/api/claims/${id}/close`, { customerSatisfactionScore: parseInt(score)||null });
  if (res.ok) { toast('Claim closed'); loadClaims(); closeDetail('claim-detail'); }
  else toast(res.data.error||'Error','error');
}

async function submitNewClaim() {
  const body = {
    warrantyId: document.getElementById('cl-warrantyId').value,
    customerId: document.getElementById('cl-customerId').value,
    issueType: document.getElementById('cl-issueType').value,
    issueCategory: document.getElementById('cl-issueCategory').value,
    description: document.getElementById('cl-description').value,
    priority: document.getElementById('cl-priority').value,
    claimDate: document.getElementById('cl-claimDate').value || undefined
  };
  const res = await api('POST', '/api/claims', body);
  if (res.ok) { hideModal('modal-new-claim'); toast(`Claim ${res.data.data.claimId} filed!`); loadClaims(); }
  else toast(res.data.error||'Error','error');
}

// ─────────────────────────────────────────────────────────────────────────────
//  REPAIR ORDERS
// ─────────────────────────────────────────────────────────────────────────────
async function loadRepairOrders() {
  const status = document.getElementById('ro-status-filter').value;
  const open   = document.getElementById('ro-open-filter').checked;
  let qs = [];
  if (status) qs.push(`status=${status}`);
  if (open)   qs.push('open=true');
  const res = await api('GET', `/api/repair-orders?${qs.join('&')}`);
  const list = res.ok ? res.data.data : [];
  const wrap = document.getElementById('repair-orders-table-wrap');
  if (!list.length) { wrap.innerHTML = '<p class="empty">No repair orders found.</p>'; return; }
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Order ID</th><th>Claim</th><th>Customer</th><th>Service Center</th><th>Scheduled</th><th>Status</th><th>Total Cost</th><th></th></tr></thead>
    <tbody>${list.map(r => `<tr>
      <td><code>${r.repairOrderId}</code></td>
      <td>${r.claimId}</td>
      <td>${r.customerId}</td>
      <td>${r.serviceCenterId||'—'}</td>
      <td>${fmtDate(r.scheduledDate)}</td>
      <td>${badge(r.status)}</td>
      <td>${r.totalCost ? fmt$(r.totalCost) : '—'}</td>
      <td><button class="table-action" onclick="viewRepairOrder('${r.repairOrderId}')">View &rsaquo;</button></td>
    </tr>`).join('')}</tbody></table></div>`;
}

async function viewRepairOrder(id) {
  const res = await api('GET', `/api/repair-orders/${id}`);
  if (!res.ok) return toast('Failed to load repair order', 'error');
  const r = res.data.data;
  const panel = document.getElementById('ro-detail');
  document.getElementById('ro-detail-content').innerHTML = `
    <div class="detail-header">
      <div><div class="detail-title">${r.repairOrderId} ${badge(r.status)}</div>
      <div class="detail-sub">Claim: ${r.claimId} &bull; Scheduled: ${fmtDate(r.scheduledDate)}</div></div>
    </div>
    <div class="detail-grid">
      <div class="detail-field"><label>Customer</label><span>${r.customer?.firstName} ${r.customer?.lastName}</span></div>
      <div class="detail-field"><label>Product</label><span>${r.product?.name||r.productId}</span></div>
      <div class="detail-field"><label>Service Center</label><span>${r.serviceCenter?.name||r.serviceCenterId||'—'}</span></div>
      <div class="detail-field"><label>Technician</label><span>${r.technician ? `${r.technician.firstName} ${r.technician.lastName}` : '—'}</span></div>
      <div class="detail-field"><label>Completion Date</label><span>${fmtDate(r.completionDate)}</span></div>
      <div class="detail-field"><label>Labor Hours</label><span>${r.laborHours??'—'}</span></div>
      <div class="detail-field"><label>Parts Cost</label><span>${fmt$(r.partsCost)}</span></div>
      <div class="detail-field"><label>Labor Cost</label><span>${fmt$(r.laborCost)}</span></div>
      <div class="detail-field"><label>Total Cost</label><span><strong>${fmt$(r.totalCost)}</strong></span></div>
      <div class="detail-field"><label>Deductible</label><span>${fmt$(r.deductibleCollected)}</span></div>
    </div>
    ${r.diagnosis ? `<div class="detail-field" style="margin-bottom:.75rem"><label>Diagnosis</label><p style="margin-top:.3rem;font-size:.88rem">${r.diagnosis}</p></div>` : ''}
    ${r.workPerformed ? `<div class="detail-field" style="margin-bottom:.75rem"><label>Work Performed</label><p style="margin-top:.3rem;font-size:.88rem">${r.workPerformed}</p></div>` : ''}
    ${r.partsUsed?.length ? `<div class="sub-table-title">Parts Used</div>
    <div class="table-wrap"><table><thead><tr><th>Part #</th><th>Description</th><th>Qty</th><th>Cost</th></tr></thead>
    <tbody>${r.partsUsed.map(p=>`<tr><td>${p.partNumber}</td><td>${p.description}</td><td>${p.quantity||1}</td><td>${fmt$(p.totalCost||p.cost)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="detail-actions">
      ${!['completed','cancelled'].includes(r.status) ? `<button class="btn btn-sm btn-success" onclick="completeRepairOrder('${r.repairOrderId}')">Mark Complete</button><button class="btn btn-sm btn-danger" onclick="cancelRepairOrder('${r.repairOrderId}')">Cancel</button>` : ''}
    </div>`;
  panel.classList.remove('hidden');
  panel.scrollIntoView({ behavior: 'smooth' });
}

async function completeRepairOrder(id) {
  const work = prompt('Describe work performed:');
  if (!work) return;
  const hours = prompt('Labor hours:');
  const body = { workPerformed: work, laborHours: parseFloat(hours)||1, resolution: 'repair' };
  const res = await api('PUT', `/api/repair-orders/${id}/complete`, body);
  if (res.ok) { toast('Repair order completed!'); loadRepairOrders(); closeDetail('ro-detail'); }
  else toast(res.data.error||'Error','error');
}

async function cancelRepairOrder(id) {
  const reason = prompt('Cancellation reason:');
  if (!reason) return;
  const res = await api('PUT', `/api/repair-orders/${id}/cancel`, { reason });
  if (res.ok) { toast('Repair order cancelled'); loadRepairOrders(); closeDetail('ro-detail'); }
  else toast(res.data.error||'Error','error');
}

async function submitNewRepairOrder() {
  const body = {
    claimId: document.getElementById('ro-claimId').value,
    serviceCenterId: document.getElementById('ro-serviceCenterId').value,
    technicianId: document.getElementById('ro-technicianId').value || undefined,
    scheduledDate: document.getElementById('ro-scheduledDate').value,
    diagnosis: document.getElementById('ro-diagnosis').value,
    deductibleCollected: parseFloat(document.getElementById('ro-deductible').value)||0
  };
  const res = await api('POST', '/api/repair-orders', body);
  if (res.ok) { hideModal('modal-new-repair-order'); toast(`Repair order ${res.data.data.repairOrderId} created!`); loadRepairOrders(); }
  else toast(res.data.error||'Error','error');
}

// ─────────────────────────────────────────────────────────────────────────────
//  SERVICE CENTERS
// ─────────────────────────────────────────────────────────────────────────────
async function loadServiceCenters() {
  const res = await api('GET', '/api/service-centers');
  const list = res.ok ? res.data.data : [];
  document.getElementById('service-centers-grid').innerHTML = `<div class="sc-grid">${list.map(c => `
    <div class="sc-card">
      <div class="sc-name">${c.name}</div>
      <div class="sc-meta">${c.address.city}, ${c.address.state} &bull; ${c.phone}</div>
      <div style="margin-bottom:.5rem">${stars(c.rating)}</div>
      <div class="sc-stats">
        <div class="sc-stat"><div class="val">${c.technicianCount}</div><div class="lbl">Technicians</div></div>
        <div class="sc-stat"><div class="val">${c.activeOrders}</div><div class="lbl">Active Orders</div></div>
        <div class="sc-stat"><div class="val">${c.avgResponseDays}d</div><div class="lbl">Avg Response</div></div>
        <div class="sc-stat"><div class="val">${c.totalCompleted}</div><div class="lbl">Completed</div></div>
      </div>
      <div class="sc-tags">${c.specializations.map(s=>`<span class="tag">${s}</span>`).join('')}</div>
    </div>`).join('')}</div>`;
}

function openDispatchModal() { document.getElementById('dispatch-results').innerHTML=''; showModal('modal-dispatch'); }

async function submitDispatch() {
  const cat   = document.getElementById('dp-category').value;
  const brand = document.getElementById('dp-brand').value;
  const state = document.getElementById('dp-state').value;
  let qs = [`productCategory=${cat}`];
  if (brand) qs.push(`brand=${brand}`);
  if (state) qs.push(`state=${state}`);
  const res = await api('GET', `/api/service-centers/dispatch/recommend?${qs.join('&')}`);
  const list = res.ok ? res.data.data : [];
  document.getElementById('dispatch-results').innerHTML = list.length === 0
    ? '<p class="empty">No service centers found for these criteria.</p>'
    : list.slice(0,5).map(c => `
      <div class="dispatch-card">
        <div><div class="dc-name">${c.name}</div>
        <div class="dc-meta">${c.address.city}, ${c.address.state} &bull; ${c.availableTechnicians} techs available &bull; ${stars(c.rating)}</div></div>
        <div class="dc-score">${c.dispatchScore}<div style="font-size:.7rem;color:var(--text-muted)">score</div></div>
      </div>`).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
//  API EXPLORER
// ─────────────────────────────────────────────────────────────────────────────
function setApi(method, endpoint, body) {
  document.getElementById('api-method').value = method;
  document.getElementById('api-endpoint').value = endpoint;
  document.getElementById('api-body').value = body ? JSON.stringify(JSON.parse(body), null, 2) : '';
}

async function sendApiRequest() {
  const method   = document.getElementById('api-method').value;
  const endpoint = document.getElementById('api-endpoint').value;
  const bodyStr  = document.getElementById('api-body').value.trim();
  let body;
  if (bodyStr) { try { body = JSON.parse(bodyStr); } catch { toast('Invalid JSON body','error'); return; } }
  const res = await api(method, endpoint, body);
  const badge = document.getElementById('api-status-badge');
  badge.textContent = res.status;
  badge.className = `status-badge ${res.ok ? 'ok' : 'err'}`;
  document.getElementById('api-response-output').textContent = JSON.stringify(res.data, null, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────────────────────
loadDashboard();
