# APD Warranty Management API Demo

A full-stack Node.js application for an **Asset Protection Division (APD)** managing warranty business on consumer appliances. The system exposes a REST API with 32 endpoints covering the complete warranty lifecycle — from customer registration and warranty enrollment through claim adjudication, service dispatch, repair order management, and executive reporting.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Data Model](#data-model)
- [API Reference](#api-reference)
  - [Customers](#customers)
  - [Products](#products)
  - [Warranties](#warranties)
  - [Claims](#claims)
  - [Service Centers](#service-centers)
  - [Technicians](#technicians)
  - [Repair Orders](#repair-orders)
  - [Reports](#reports)
- [Sample Data](#sample-data)
- [UI Guide](#ui-guide)
- [Request & Response Examples](#request--response-examples)

---

## Overview

This demo models the core operational workflows of a warranty administration program for consumer appliances (refrigerators, washers, dryers, dishwashers, ranges, microwaves, etc.). It is designed as a self-contained demonstration that requires no external database — all data is persisted in local JSON files that update in real time as API calls flow through.

**Business domain covered:**

| Domain | Description |
|---|---|
| Customer Management | Register and track warranty purchasers |
| Product Catalog | Appliance SKUs, brands, failure profiles |
| Warranty Registration | Standard, extended, and premium plans |
| Coverage Verification | Pre-claim eligibility and issue-type checks |
| Claim Adjudication | Full claim lifecycle from filing to close |
| Service Dispatch | Recommend authorized service centers by scoring algorithm |
| Repair Order Management | Parts, labor, completion, and cost tracking |
| Reporting & Analytics | Dashboard KPIs, expiration forecasting, replacement candidates |

---

## Features

- **32 REST API endpoints** spanning 8 resource domains
- **JSON file persistence** — no database setup required; all mutations immediately flushed to disk
- **In-memory cache** with write-through to disk for fast reads
- **Coverage verification** engine that checks warranty status, expiration, issue-type eligibility, and annual claim limits
- **Dispatch recommendation** algorithm scoring service centers by rating, response time, and technician availability
- **Replacement candidate detection** — flags claims where estimated repair cost exceeds the product's replacement cost threshold
- **Enriched responses** — nested customer, product, warranty, technician, and service center data returned in a single call
- **Interactive browser UI** with dashboard, filterable tables, detail drill-down, and a live API explorer
- **Seeded sample data** across all 7 collections for immediate demonstration

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser UI                           │
│          (public/index.html + style.css + app.js)           │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / fetch()
┌────────────────────────▼────────────────────────────────────┐
│                    Express Server                           │
│                      server.js                              │
│                                                             │
│  /api/customers      → src/routes/customers.js             │
│  /api/products       → src/routes/products.js              │
│  /api/warranties     → src/routes/warranties.js            │
│  /api/claims         → src/routes/claims.js                │
│  /api/service-centers→ src/routes/serviceCenters.js        │
│  /api/technicians    → src/routes/technicians.js           │
│  /api/repair-orders  → src/routes/repairOrders.js          │
│  /api/reports        → src/routes/reports.js               │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  DataStore Layer                             │
│               src/dataStore.js                              │
│                                                             │
│  In-memory cache  ←──────────────────────►  data/*.json    │
│  (fast reads)                               (persistence)   │
└─────────────────────────────────────────────────────────────┘
```

**Stack:**

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Web framework | Express 4 |
| Persistence | JSON files (via Node.js `fs` module) |
| Frontend | Vanilla HTML / CSS / JavaScript |
| Dev server | nodemon |

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd Datahub-APD-API-Demo

# Install dependencies
npm install

# Start the server
npm start
```

The server starts on **http://localhost:3000** by default.

To use a different port:

```bash
PORT=8080 npm start
```

### Development mode (auto-restart on file changes)

```bash
npm run dev
```

### Verify it's running

```bash
# API index — lists all 32 endpoints
curl http://localhost:3000/api

# Executive dashboard
curl http://localhost:3000/api/reports/dashboard
```

Open **http://localhost:3000** in a browser to access the full UI.

---

## Project Structure

```
Datahub-APD-API-Demo/
│
├── server.js                    # Express application entry point
├── package.json
├── .gitignore
│
├── src/
│   ├── dataStore.js             # Data access layer — all CRUD and analytics
│   └── routes/
│       ├── customers.js         # Customer registration and lookup
│       ├── products.js          # Appliance product catalog
│       ├── warranties.js        # Warranty registration and coverage verification
│       ├── claims.js            # Claim filing, adjudication, and lifecycle
│       ├── serviceCenters.js    # Authorized repair centers and dispatch
│       ├── technicians.js       # Technician management and availability
│       ├── repairOrders.js      # Repair order creation and completion
│       └── reports.js           # KPI reports and analytics
│
├── data/                        # Persistent JSON data store (auto-updated by API)
│   ├── customers.json
│   ├── products.json
│   ├── warranties.json
│   ├── claims.json
│   ├── service-centers.json
│   ├── technicians.json
│   └── repair-orders.json
│
└── public/                      # Static browser UI
    ├── index.html               # Single-page application shell
    ├── style.css                # Styles
    └── app.js                   # UI logic and API calls
```

### Key module: `src/dataStore.js`

The data store module provides:

- **In-memory cache** seeded from JSON files on startup
- **Write-through persistence** — every mutation immediately writes back to the corresponding `.json` file
- **Domain-specific helpers** for each collection (e.g., `warranties.verify()`, `repairOrders.complete()`)
- **Cross-collection side effects** — filing a claim increments `warranty.claimCount` and `customer.totalClaims`; completing a repair order updates the linked claim to `completed`
- **Analytics functions** — `getClaimsSummary()` and `getWarrantySummary()` used by the reports routes

---

## Data Model

### Customer

| Field | Type | Description |
|---|---|---|
| `customerId` | string | Auto-generated (e.g., `CUST-0007`) |
| `firstName` / `lastName` | string | |
| `email` | string | Unique — enforced on creation |
| `phone` | string | |
| `address` | object | `{ street, city, state, zip, country }` |
| `preferredContact` | string | `email` or `phone` |
| `customerTier` | string | `standard`, `premium`, or `elite` |
| `totalWarranties` | integer | Auto-incremented on warranty registration |
| `totalClaims` | integer | Auto-incremented on claim filing |
| `active` | boolean | |

### Product

| Field | Type | Description |
|---|---|---|
| `productId` | string | Auto-generated (e.g., `PRD-009`) |
| `sku` | string | Retailer SKU |
| `name` | string | Display name |
| `category` | string | `refrigerator`, `washer`, `dryer`, `dishwasher`, `range`, `microwave` |
| `brand` | string | LG, Whirlpool, Bosch, GE, Samsung, etc. |
| `modelNumber` | string | |
| `msrp` | number | Manufacturer suggested retail price |
| `standardWarrantyMonths` | integer | |
| `partsWarrantyMonths` | integer | |
| `laborWarrantyMonths` | integer | |
| `replacementCostThreshold` | float | Repair-to-purchase ratio above which replacement is considered (e.g., `0.70` = 70%) |
| `maxClaimsPerYear` | integer | Annual claim limit |
| `commonFailures` | string[] | Known failure modes for the model |
| `averageRepairCost` | number | Historical average used in replacement analysis |

### Warranty

| Field | Type | Description |
|---|---|---|
| `warrantyId` | string | Auto-generated (e.g., `WRN-10009`) |
| `customerId` | string | |
| `productId` | string | |
| `serialNumber` | string | Appliance serial number |
| `purchaseDate` | date | |
| `purchasePrice` | number | |
| `retailer` | string | |
| `warrantyType` | string | `standard`, `extended`, or `premium` |
| `coverageStartDate` | date | |
| `coverageEndDate` | date | |
| `deductible` | number | Per-claim deductible |
| `maxCoverageAmount` | number | Policy maximum |
| `coverageDetails` | object | Boolean flags: `mechanicalFailure`, `electricalFailure`, `accidentalDamage`, `cosmeticDamage`, `foodSpoilage`, `powerSurge` |
| `status` | string | `active`, `expired`, or `cancelled` |
| `claimCount` | integer | Auto-incremented on each claim |
| `premiumPaid` | number | Amount paid for the extended plan |

### Claim

| Field | Type | Description |
|---|---|---|
| `claimId` | string | Auto-generated (e.g., `CLM-20007`) |
| `warrantyId` | string | |
| `customerId` | string | |
| `productId` | string | |
| `claimDate` | date | |
| `issueType` | string | `mechanical_failure`, `electrical_failure`, `accidental_damage`, `cosmetic_damage`, `food_spoilage`, `power_surge`, `other` |
| `issueCategory` | string | Specific component (e.g., `ice_maker`, `control_board`) |
| `description` | string | Customer-provided description |
| `status` | string | `pending_approval` → `approved` → `in_repair` / `parts_ordered` → `completed` → `closed` (or `denied`) |
| `priority` | string | `standard`, `high`, or `urgent` |
| `deductibleCollected` | number | |
| `estimatedRepairCost` | number | Set at approval |
| `actualRepairCost` | number | Set on repair order completion |
| `resolution` | string | `repair`, `replacement`, `refund`, or `denied` |
| `serviceCenterId` / `technicianId` / `repairOrderId` | string | Assigned during workflow |
| `customerSatisfactionScore` | integer | 1–5, collected at close |

### Service Center

| Field | Type | Description |
|---|---|---|
| `serviceCenterId` | string | Auto-generated (e.g., `SVC-006`) |
| `name` | string | |
| `type` | string | `authorized` |
| `address` | object | `{ street, city, state, zip }` |
| `specializations` | string[] | Product categories serviced |
| `brands` | string[] | Brands the center is certified for |
| `technicianCount` | integer | |
| `rating` | float | 0–5 |
| `avgResponseDays` | integer | Days from claim assignment to first visit |
| `avgCompletionDays` | integer | Average repair duration |
| `laborRate` | number | Hourly rate in USD |
| `coverageRadius` | integer | Service area in miles |
| `certifications` | string[] | e.g., `NATEF`, `EPA-608`, `Bosch-Certified` |

### Repair Order

| Field | Type | Description |
|---|---|---|
| `repairOrderId` | string | Auto-generated (e.g., `RPR-30005`) |
| `claimId` | string | |
| `serviceCenterId` | string | |
| `technicianId` | string | |
| `scheduledDate` | date | |
| `completionDate` | date | Set on completion |
| `status` | string | `scheduled`, `in_progress`, `parts_ordered`, `completed`, `cancelled` |
| `diagnosis` | string | Technician findings |
| `workPerformed` | string | Description of repair |
| `partsUsed` | object[] | `[{ partNumber, description, quantity, unitCost, totalCost }]` |
| `partsCost` | number | Sum of parts |
| `laborHours` | float | |
| `laborRate` | number | Pulled from service center |
| `laborCost` | number | `laborHours × laborRate` |
| `totalCost` | number | `partsCost + laborCost + travelFee` |
| `coveredAmount` | number | `totalCost − deductible` |
| `warrantyOnRepair` | integer | Days of warranty on the repair work (default: 90) |

---

## API Reference

All endpoints return JSON in the format:

```json
{
  "success": true,
  "data": { ... }
}
```

Errors return:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

---

### Customers

#### `GET /api/customers`

List all customers. Supports query filters.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `tier` | string | Filter by `standard`, `premium`, or `elite` |
| `state` | string | Filter by US state code (e.g., `OH`) |
| `active` | boolean | Filter by active status |

---

#### `GET /api/customers/:id`

Get a single customer, with their full warranty and claim history embedded in the response.

---

#### `POST /api/customers`

Register a new customer.

**Request body:**

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane.doe@example.com",
  "phone": "555-100-2000",
  "address": {
    "street": "100 Main St",
    "city": "Columbus",
    "state": "OH",
    "zip": "43215",
    "country": "USA"
  },
  "preferredContact": "email",
  "customerTier": "standard"
}
```

**Required:** `firstName`, `lastName`, `email`

Returns `409 Conflict` if the email is already registered.

---

#### `PUT /api/customers/:id`

Update any fields on an existing customer record.

---

#### `GET /api/customers/:id/warranties`

List all warranties registered to a customer.

---

#### `GET /api/customers/:id/claims`

List all claims filed by a customer.

---

### Products

#### `GET /api/products`

List the appliance product catalog.

**Query parameters:**

| Parameter | Description |
|---|---|
| `category` | e.g., `refrigerator`, `washer`, `dryer`, `dishwasher`, `range`, `microwave` |
| `brand` | e.g., `LG`, `Whirlpool`, `Bosch` |
| `active` | `true` or `false` |

---

#### `GET /api/products/:id`

Get a product, enriched with warranty registration count and claim rate statistics.

---

#### `POST /api/products`

Add a new appliance to the catalog.

**Request body:**

```json
{
  "sku": "LG-WA-WT7305CW",
  "name": "LG 5.0 cu. ft. Top Load Washer",
  "category": "washer",
  "brand": "LG",
  "modelNumber": "WT7305CW",
  "msrp": 899.99,
  "standardWarrantyMonths": 12,
  "partsWarrantyMonths": 24,
  "laborWarrantyMonths": 12,
  "replacementCostThreshold": 0.70,
  "maxClaimsPerYear": 2,
  "commonFailures": ["motor", "pump", "control board"],
  "averageRepairCost": 230.00
}
```

**Required:** `sku`, `name`, `category`, `brand`, `modelNumber`

---

#### `GET /api/products/categories/list`

Returns a sorted array of distinct product categories currently in the catalog.

---

### Warranties

#### `GET /api/warranties`

List warranties with optional filtering.

**Query parameters:**

| Parameter | Description |
|---|---|
| `status` | `active`, `expired`, or `cancelled` |
| `customerId` | Filter to one customer |
| `productId` | Filter to one product |
| `type` | `standard`, `extended`, or `premium` |
| `expiringSoon` | Integer (days). Returns active warranties expiring within N days |

---

#### `GET /api/warranties/:id`

Get a warranty enriched with the linked customer record, product record, and full claim history.

---

#### `POST /api/warranties`

Register a new warranty. Auto-increments `customer.totalWarranties`.

**Request body:**

```json
{
  "customerId": "CUST-0001",
  "productId": "PRD-002",
  "serialNumber": "WP2024WA113344",
  "purchaseDate": "2024-03-01",
  "purchasePrice": 749.99,
  "retailer": "Home Depot",
  "warrantyType": "extended",
  "coverageStartDate": "2024-03-01",
  "coverageEndDate": "2029-03-01",
  "deductible": 75.00,
  "maxCoverageAmount": 749.99,
  "premiumPaid": 189.99,
  "coverageDetails": {
    "mechanicalFailure": true,
    "electricalFailure": true,
    "accidentalDamage": false,
    "cosmeticDamage": false,
    "foodSpoilage": false,
    "powerSurge": true
  }
}
```

**Required:** `customerId`, `productId`, `serialNumber`, `purchaseDate`, `warrantyType`

---

#### `POST /api/warranties/verify`

**The primary pre-claim check.** Validates that a warranty is active, not expired, covers the stated issue type, and has not exceeded its annual claim limit.

**Request body:**

```json
{
  "warrantyId": "WRN-10001",
  "claimDate": "2026-02-26",
  "issueType": "mechanical_failure"
}
```

**Response (covered):**

```json
{
  "success": true,
  "covered": true,
  "reason": "Coverage confirmed",
  "warranty": {
    "warrantyId": "WRN-10001",
    "warrantyType": "extended",
    "coverageEndDate": "2027-03-12",
    "deductible": 75.00,
    "maxCoverageAmount": 1849.99,
    "claimsThisYear": 0,
    "maxClaimsPerYear": 2
  }
}
```

**Response (not covered):**

```json
{
  "success": true,
  "covered": false,
  "reason": "Coverage for 'accidental_damage' is not included in this warranty plan"
}
```

---

#### `PUT /api/warranties/:id/cancel`

Cancel an active warranty.

**Request body:**

```json
{ "reason": "Customer sold appliance" }
```

---

### Claims

Claims follow this status lifecycle:

```
pending_approval → approved → in_repair / parts_ordered → completed → closed
                ↘ denied
```

---

#### `GET /api/claims`

List claims with filtering.

**Query parameters:**

| Parameter | Description |
|---|---|
| `status` | Any valid claim status |
| `customerId` | Filter by customer |
| `warrantyId` | Filter by warranty |
| `open` | `true` — excludes `completed`, `denied`, `closed` |
| `issueType` | Filter by issue type |

Results are sorted newest first.

---

#### `GET /api/claims/:id`

Get a claim enriched with customer, product, warranty, and linked repair order.

---

#### `POST /api/claims`

File a new warranty claim. Automatically verifies the warranty is active and eligible before creating the record. Sets initial status to `pending_approval`.

**Request body:**

```json
{
  "warrantyId": "WRN-10001",
  "customerId": "CUST-0001",
  "issueType": "mechanical_failure",
  "issueCategory": "compressor",
  "description": "Refrigerator no longer cooling. Compressor runs continuously but temperature does not drop below 55°F.",
  "priority": "high",
  "claimDate": "2026-02-26"
}
```

**Required:** `warrantyId`, `customerId`, `issueType`, `description`

Returns `422` if warranty verification fails.

---

#### `PUT /api/claims/:id/approve`

Approve a pending claim and optionally assign a service center and technician.

**Request body:**

```json
{
  "estimatedRepairCost": 385.00,
  "serviceCenterId": "SVC-001",
  "technicianId": "TECH-003",
  "deductibleCollected": 75.00
}
```

---

#### `PUT /api/claims/:id/deny`

Deny a claim with a required reason.

**Request body:**

```json
{ "reason": "Damage caused by improper installation — not covered under mechanical failure clause" }
```

---

#### `PUT /api/claims/:id/status`

General-purpose status update. Valid statuses: `pending_approval`, `approved`, `denied`, `in_repair`, `parts_ordered`, `completed`, `closed`.

---

#### `PUT /api/claims/:id/close`

Close a completed claim and record customer satisfaction.

**Request body:**

```json
{ "customerSatisfactionScore": 5 }
```

---

### Service Centers

#### `GET /api/service-centers`

List authorized service centers.

**Query parameters:**

| Parameter | Description |
|---|---|
| `state` | US state code |
| `specialization` | Product category (e.g., `refrigerator`) |
| `brand` | Certified brand (e.g., `Bosch`) |
| `active` | `true` or `false` |

Results are sorted by rating descending.

---

#### `GET /api/service-centers/:id`

Get a service center with embedded technician roster and active repair orders.

---

#### `GET /api/service-centers/dispatch/recommend`

**Dispatch scoring engine.** Recommends authorized service centers for a given job, scored by a weighted algorithm:

- **40%** — Customer rating (0–5 scale)
- **30%** — Response time (inverse of `avgResponseDays`)
- **30%** — Technician availability (binary: available technicians exist)

**Query parameters (all optional except `productCategory`):**

| Parameter | Required | Description |
|---|---|---|
| `productCategory` | Yes | Product category to match |
| `brand` | No | Filter to centers certified for this brand |
| `state` | No | Filter to a specific state |

**Response:**

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "serviceCenterId": "SVC-001",
      "name": "Midwest Appliance Repair Specialists",
      "rating": 4.6,
      "avgResponseDays": 2,
      "availableTechnicians": 3,
      "dispatchScore": 81.8
    }
  ]
}
```

---

#### `GET /api/service-centers/:id/technicians`

List technicians at a center. Append `?available=true` to filter to only available technicians.

---

### Technicians

#### `GET /api/technicians`

List technicians.

**Query parameters:**

| Parameter | Description |
|---|---|
| `serviceCenterId` | Filter to one center |
| `specialization` | Product category |
| `available` | `true` — available technicians only |
| `brand` | Certified for a specific brand |

---

#### `GET /api/technicians/:id`

Get a technician with their service center and active repair orders.

---

#### `PUT /api/technicians/:id/availability`

Toggle or set availability.

**Request body:**

```json
{ "available": false }
```

If `available` is omitted, the current value is toggled.

---

### Repair Orders

#### `GET /api/repair-orders`

List repair orders.

**Query parameters:**

| Parameter | Description |
|---|---|
| `status` | `scheduled`, `in_progress`, `parts_ordered`, `completed`, `cancelled` |
| `serviceCenterId` | Filter by center |
| `technicianId` | Filter by technician |
| `customerId` | Filter by customer |
| `open` | `true` — excludes `completed` and `cancelled` |

---

#### `POST /api/repair-orders`

Create a repair order from an approved claim. Automatically updates the linked claim status to `in_repair`.

**Request body:**

```json
{
  "claimId": "CLM-20005",
  "serviceCenterId": "SVC-004",
  "technicianId": "TECH-006",
  "scheduledDate": "2026-03-05",
  "diagnosis": "Magnetron confirmed failed — no output on RF meter",
  "deductibleCollected": 50.00
}
```

**Required:** `claimId`, `serviceCenterId`, `scheduledDate`

---

#### `PUT /api/repair-orders/:id/complete`

Complete a repair order. Calculates `partsCost`, `laborCost`, and `totalCost` automatically. Updates the linked claim to `completed` with the final cost.

**Request body:**

```json
{
  "workPerformed": "Replaced magnetron (DE92-02539G). Tested all power levels. Unit heating normally.",
  "partsUsed": [
    {
      "partNumber": "DE92-02539G",
      "description": "Magnetron Assembly",
      "quantity": 1,
      "unitCost": 89.99,
      "totalCost": 89.99
    }
  ],
  "laborHours": 1.5,
  "technicianNotes": "Advised customer on safe microwave use. No other defects found.",
  "resolution": "repair",
  "customerSatisfactionScore": 5
}
```

**Required:** `workPerformed`

---

### Reports

#### `GET /api/reports/dashboard`

Executive summary of the full APD portfolio.

**Response includes:**
- Claim totals by status and issue type, average repair cost
- Warranty totals by status and type, total premium revenue collected
- Active alerts (open claims, pending approvals, expiring warranties, open repair orders)
- Customer and service center counts

---

#### `GET /api/reports/claims-summary`

Detailed claims analysis with optional date range.

**Query parameters:**

| Parameter | Description |
|---|---|
| `from` | Start date (YYYY-MM-DD) |
| `to` | End date (YYYY-MM-DD) |

**Response includes:** breakdown by status, issue type, issue category, month, and product; financial summary (total repair cost, deductibles collected, net claim cost, average repair cost); customer satisfaction metrics.

---

#### `GET /api/reports/warranty-expiration`

Forecast of warranties approaching expiration, sorted by urgency.

**Query parameters:**

| Parameter | Default | Description |
|---|---|---|
| `days` | 30 | Look-ahead window in days |

---

#### `GET /api/reports/service-center-performance`

KPI scorecard for all active service centers.

**Response includes per center:** total orders, completed orders, active orders, average completion days, total revenue generated, technician headcount and availability.

---

#### `GET /api/reports/replacement-candidates`

Identifies open claims where the estimated repair cost meets or exceeds the product's `replacementCostThreshold` (configured per product as a ratio of purchase price).

**Response includes:** claim ID, customer, product, purchase price, repair estimate, repair-to-purchase ratio, and a recommendation of `replace` (≥ 90%) or `evaluate` (≥ threshold but < 90%).

---

## Sample Data

The `data/` directory contains seeded records across all 7 collections.

### Summary

| Collection | Records | Notes |
|---|---|---|
| Customers | 6 | Mix of standard, premium, elite tiers across 6 states |
| Products | 8 | Covers 6 appliance categories from 6 brands |
| Warranties | 8 | 7 active, 1 expired; standard, extended, and premium types |
| Claims | 6 | All statuses represented: pending, approved, in_repair, completed, denied |
| Service Centers | 5 | Covering OH, AZ, IL, WA, TX |
| Technicians | 7 | Distributed across 4 service centers |
| Repair Orders | 4 | Mix of completed and in-progress orders |

### Key IDs for exploration

| Entity | Sample IDs |
|---|---|
| Customers | `CUST-0001` through `CUST-0006` |
| Products | `PRD-001` (LG Refrigerator) through `PRD-008` (Frigidaire Washer) |
| Warranties | `WRN-10001` through `WRN-10008` |
| Claims | `CLM-20001` through `CLM-20006` |
| Service Centers | `SVC-001` through `SVC-005` |
| Technicians | `TECH-001` through `TECH-007` |
| Repair Orders | `RPR-30001` through `RPR-30004` |

> **Note:** All JSON files in `data/` are live — API writes (POST, PUT) are immediately persisted. To reset the data to its original state, restore the files from version control: `git checkout -- data/`.

---

## UI Guide

The browser UI at **http://localhost:3000** provides six operational views and an API explorer.

| Section | What you can do |
|---|---|
| **Dashboard** | View KPI stat cards, alert chips, claims-by-status bar chart, warranties-by-type chart, expiration alerts, replacement candidates |
| **Customers** | Search by name/email, filter by tier, view full customer history with embedded warranties and claims, register new customers |
| **Warranties** | Filter by status, type, or expiration window; view coverage detail with issue-type eligibility matrix; verify coverage; register new warranties; cancel active warranties |
| **Claims** | Filter by status, issue type, or open-only; approve/deny/close claims directly from the detail panel; file new claims |
| **Repair Orders** | Filter by status or open-only; create repair orders from claims; mark orders complete with parts, labor hours, and work description; cancel orders |
| **Service Centers** | Rating-sorted grid view with specialization tags, technician count, active order load, and average response times; dispatch recommendation modal |
| **API Explorer** | Free-form API request sender — choose method, enter any endpoint, paste a JSON body, send, and view the formatted response; quick-link chips for common queries |

---

## Request & Response Examples

### Verify coverage before filing a claim

```bash
curl -X POST http://localhost:3000/api/warranties/verify \
  -H "Content-Type: application/json" \
  -d '{
    "warrantyId": "WRN-10001",
    "claimDate": "2026-02-26",
    "issueType": "mechanical_failure"
  }'
```

### File a warranty claim

```bash
curl -X POST http://localhost:3000/api/claims \
  -H "Content-Type: application/json" \
  -d '{
    "warrantyId": "WRN-10001",
    "customerId": "CUST-0001",
    "issueType": "mechanical_failure",
    "issueCategory": "compressor",
    "description": "Unit stopped cooling completely. Compressor is running but no temperature drop.",
    "priority": "high"
  }'
```

### Approve the claim with a cost estimate

```bash
curl -X PUT http://localhost:3000/api/claims/CLM-20007/approve \
  -H "Content-Type: application/json" \
  -d '{
    "estimatedRepairCost": 385.00,
    "serviceCenterId": "SVC-001",
    "technicianId": "TECH-003",
    "deductibleCollected": 75.00
  }'
```

### Create a repair order

```bash
curl -X POST http://localhost:3000/api/repair-orders \
  -H "Content-Type: application/json" \
  -d '{
    "claimId": "CLM-20007",
    "serviceCenterId": "SVC-001",
    "technicianId": "TECH-003",
    "scheduledDate": "2026-03-05",
    "diagnosis": "Compressor capacitor failed. Compressor itself intact.",
    "deductibleCollected": 75.00
  }'
```

### Complete the repair order

```bash
curl -X PUT http://localhost:3000/api/repair-orders/RPR-30005/complete \
  -H "Content-Type: application/json" \
  -d '{
    "workPerformed": "Replaced start capacitor. Tested cooling cycle over 4 hours. Unit holding 37°F.",
    "partsUsed": [
      {
        "partNumber": "EAE36286401",
        "description": "Compressor Start Capacitor",
        "quantity": 1,
        "unitCost": 68.00,
        "totalCost": 68.00
      }
    ],
    "laborHours": 1.5,
    "resolution": "repair"
  }'
```

### Recommend a service center for a refrigerator job in Ohio

```bash
curl "http://localhost:3000/api/service-centers/dispatch/recommend?productCategory=refrigerator&brand=LG&state=OH"
```

### Pull the executive dashboard

```bash
curl http://localhost:3000/api/reports/dashboard
```

### Find warranties expiring in the next 60 days

```bash
curl "http://localhost:3000/api/reports/warranty-expiration?days=60"
```

### Get claims filed in Q1 2024

```bash
curl "http://localhost:3000/api/reports/claims-summary?from=2024-01-01&to=2024-03-31"
```
