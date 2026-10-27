# DATABASE SCHEMA: AL RAWAHI GARAGE MANAGEMENT SYSTEM

**Database Engine:** SQLite 3 (via `better-sqlite3` in Electron Main Process)  
**Configuration:**
- `PRAGMA foreign_keys = ON;`
- `PRAGMA journal_mode = WAL;`
- `PRAGMA synchronous = NORMAL;`
**Storage Location:** `%APPDATA%\AlRawahiGarage\garage.db`

---

## Financial Storage Convention (Integer Baisa)
To prevent IEEE 754 floating-point rounding errors and currency drift, **all monetary amounts in the database are stored as INTEGER Baisa** (1 OMR = 1000 Baisa).
- `10.500 OMR` is stored as `10500`
- `2.250 OMR` is stored as `2250`
- `0.125 OMR` is stored as `125`
- `125.000 OMR` is stored as `125000`

---

## Table Catalog

### 1. `schema_migrations`
Tracks sequential schema migrations applied to the database.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `version` | INTEGER | PRIMARY KEY | Sequential migration number |
| `name` | TEXT | NOT NULL | Migration identifier name |
| `applied_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | ISO-8601 timestamp |

### 2. `settings`
System and business configuration key-value storage.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `key` | TEXT | PRIMARY KEY | Unique setting key (e.g. `garage_name`, `currency_code`) |
| `value` | TEXT | NOT NULL | Setting value (text or JSON) |
| `updated_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Last update timestamp |

### 3. `customers`
Customer profiles.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `full_name` | TEXT | NOT NULL | Customer full name |
| `phone` | TEXT | NULL | Contact phone number (optional) |
| `alt_phone` | TEXT | NULL | Optional secondary phone number |
| `email` | TEXT | NULL | Optional email |
| `address` | TEXT | NULL | Physical address in Oman |
| `notes` | TEXT | NULL | Internal customer notes |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | 1 = Active, 0 = Archived |
| `created_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Registration date |
| `updated_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Modification date |

*Indexes:* `idx_customers_phone` on `phone`, `idx_customers_name` on `full_name`, `idx_customers_active` on `is_active`.

### 4. `vehicles`
Vehicle records linked to customers.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `customer_id` | TEXT | NOT NULL, FK -> `customers(id)` ON DELETE RESTRICT | Customer owning the vehicle |
| `plate_number` | TEXT | NOT NULL UNIQUE | Omani registration plate (e.g. `12345 A`) |
| `make` | TEXT | NOT NULL | Manufacturer (e.g. Toyota, Nissan) |
| `model` | TEXT | NOT NULL | Model (e.g. Land Cruiser, Patrol) |
| `year` | INTEGER | NOT NULL | Model manufacturing year |
| `vin` | TEXT | NULL | Chassis/VIN number |
| `odometer` | INTEGER | NOT NULL DEFAULT 0 | Last recorded odometer in kilometers |
| `color` | TEXT | NULL | Vehicle exterior color |
| `notes` | TEXT | NULL | Technical vehicle notes |
| `created_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Registration timestamp |

*Indexes:* `idx_vehicles_customer` on `customer_id`, `idx_vehicles_plate` on `plate_number`.

### 5. `technicians`
Garage technician staff records.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `name` | TEXT | NOT NULL | Technician name |
| `phone` | TEXT | NULL | Optional contact number |
| `specialty` | TEXT | NULL | e.g. Mechanics, Electrical, Transmission |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | 1 = Active, 0 = Inactive |
| `notes` | TEXT | NULL | Internal staff notes |
| `created_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Created timestamp |

### 6. `repair_orders`
Vehicle repair orders tracking the 10-stage workshop workflow.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `ro_number` | TEXT | NOT NULL UNIQUE | Sequential format: `RO-YYYYMM-XXXX` |
| `customer_id` | TEXT | NOT NULL, FK -> `customers(id)` ON DELETE RESTRICT | Customer |
| `vehicle_id` | TEXT | NOT NULL, FK -> `vehicles(id)` ON DELETE RESTRICT | Serviced vehicle |
| `status` | TEXT | NOT NULL CHECK (10 stages) | `RECEIVED`, `UNDER_INSPECTION`, `AWAITING_APPROVAL`, `AWAITING_PARTS`, `UNDER_REPAIR`, `QUALITY_CHECK`, `COMPLETED`, `READY_FOR_COLLECTION`, `DELIVERED`, `CANCELLED` |
| `odometer_in` | INTEGER | NOT NULL | Odometer reading upon intake |
| `reported_problem` | TEXT | NOT NULL | Customer complaint / requested inspection |
| `inspection_notes` | TEXT | NULL | Diagnostic inspection findings |
| `requested_work` | TEXT | NULL | Authorized repair instructions |
| `estimated_cost_baisa` | INTEGER | NOT NULL DEFAULT 0 | Estimated total cost in Baisa |
| `customer_approved` | INTEGER | NOT NULL DEFAULT 0 | 1 = Approved, 0 = Pending |
| `warranty_period_months` | INTEGER | DEFAULT 0 | Optional warranty period |
| `warranty_terms` | TEXT | NULL | Specific warranty conditions |
| `received_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Intake timestamp |
| `expected_at` | TEXT | NULL | Expected delivery date |
| `completed_at` | TEXT | NULL | Repair completion timestamp |
| `delivered_at` | TEXT | NULL | Customer handover timestamp |
| `created_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Created timestamp |

*Indexes:* `idx_ro_status`, `idx_ro_vehicle`, `idx_ro_customer`.

### 7. `repair_order_status_history`
Immutable status change audit trail.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `repair_order_id` | TEXT | NOT NULL, FK -> `repair_orders(id)` ON DELETE CASCADE | Target RO |
| `old_status` | TEXT | NOT NULL | Previous status |
| `new_status` | TEXT | NOT NULL | Updated status |
| `changed_by` | TEXT | NOT NULL | Operator username |
| `remarks` | TEXT | NULL | Reason for status transition |
| `changed_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Transition timestamp |

### 8. `labor_tasks`
Specific labor line items assigned to technicians.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `repair_order_id` | TEXT | NOT NULL, FK -> `repair_orders(id)` ON DELETE CASCADE | Associated RO |
| `technician_id` | TEXT | NULL, FK -> `technicians(id)` ON DELETE SET NULL | Assigned technician |
| `description` | TEXT | NOT NULL | Labor task description |
| `labor_charge_baisa` | INTEGER | NOT NULL | Customer billed charge in Baisa |
| `internal_cost_baisa`| INTEGER | NOT NULL DEFAULT 0 | Internal technician labor cost in Baisa |
| `status` | TEXT | NOT NULL DEFAULT 'PENDING' | `PENDING`, `IN_PROGRESS`, `COMPLETED` |
| `work_date` | TEXT | NOT NULL DEFAULT (datetime('now')) | Performance date |
| `notes` | TEXT | NULL | Operational notes |

### 9. `inventory_items`
Spare parts and consumables catalog.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `part_code` | TEXT | NOT NULL UNIQUE | SKU / OEM Part Number |
| `name` | TEXT | NOT NULL | Item name |
| `category` | TEXT | NOT NULL | e.g. Brakes, Suspension, Electrical, Oils |
| `description` | TEXT | NULL | Specification |
| `quantity_in_stock` | REAL | NOT NULL DEFAULT 0 | Current on-hand quantity |
| `purchase_cost_baisa`| INTEGER | NOT NULL DEFAULT 0 | Last purchase cost in Baisa |
| `selling_price_baisa`| INTEGER | NOT NULL DEFAULT 0 | Customer selling price in Baisa |
| `min_stock_level` | REAL | NOT NULL DEFAULT 1 | Low-stock threshold |
| `supplier_id` | TEXT | NULL, FK -> `suppliers(id)` | Preferred supplier |
| `location` | TEXT | NULL | Shelf / Bin location (e.g. `A-03`) |
| `is_serialized` | INTEGER | NOT NULL DEFAULT 0 | 1 = Track individual serial numbers, 0 = Non-serialized bulk consumable |
| `is_active` | INTEGER | NOT NULL DEFAULT 1 | 1 = Active, 0 = Inactive |
| `created_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Creation timestamp |

*Indexes:* `idx_inventory_code` on `part_code`, `idx_inventory_category` on `category`.

### 10. `inventory_movements`
Double-entry inventory audit ledger.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `item_id` | TEXT | NOT NULL, FK -> `inventory_items(id)` ON DELETE RESTRICT | Target part |
| `movement_type` | TEXT | NOT NULL CHECK (in 4 types) | `PURCHASE_RECEIPT`, `RO_ISSUE`, `RETURN_TO_STOCK`, `MANUAL_ADJUSTMENT` |
| `quantity_delta` | REAL | NOT NULL | Positive (inbound) or negative (outbound) |
| `unit_cost_baisa` | INTEGER | NOT NULL | Unit cost in Baisa |
| `serial_number` | TEXT | NULL | Serial number for tracked serialized parts |
| `reference_type` | TEXT | NULL | `PURCHASE`, `REPAIR_ORDER`, `ADJUSTMENT` |
| `reference_id` | TEXT | NULL | ID of linked purchase or repair order |
| `reason` | TEXT | NULL | Justification for adjustment |
| `created_by` | TEXT | NOT NULL | Operator |
| `created_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Movement timestamp |

*Indexes:* `idx_movements_item` on `item_id`.

### 11. `inventory_serials` (Phase 3 Preparation / Phase 5 Engine)
Tracks physical serialized parts with manual serial number entry.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `item_id` | TEXT | NOT NULL, FK -> `inventory_items(id)` ON DELETE RESTRICT | Master inventory part definition |
| `serial_number` | TEXT | NOT NULL | Unique physical serial number entered manually |
| `status` | TEXT | NOT NULL CHECK (4 states) | `IN_STOCK`, `ISSUED`, `RETURNED`, `DAMAGED` |
| `repair_order_id`| TEXT | NULL | Linked RO where part was installed |
| `invoice_id` | TEXT | NULL | Linked invoice where part was billed |
| `notes` | TEXT | NULL | Technical / intake notes |
| `received_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Date and time received into stock |
| `issued_at` | TEXT | NULL | Date and time issued to workshop |
| `created_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Record creation timestamp |
| `updated_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Record modification timestamp |

*Indexes:* `idx_unique_active_serial` ON `inventory_serials(serial_number) WHERE status = 'IN_STOCK'`, `idx_serials_number` on `serial_number`, `idx_serials_item` on `item_id`.

### 12. `invoices`
Customer repair invoices.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY | UUID |
| `invoice_number` | TEXT | NOT NULL UNIQUE | Format: `INV-YYYY-XXXXX` |
| `repair_order_id`| TEXT | NULL, FK -> `repair_orders(id)` | Optional linked repair order |
| `customer_id` | TEXT | NOT NULL, FK -> `customers(id)` | Customer billed |
| `vehicle_id` | TEXT | NULL, FK -> `vehicles(id)` | Vehicle serviced |
| `invoice_date` | TEXT | NOT NULL DEFAULT (date('now')) | Date of issuance |
| `status` | TEXT | NOT NULL DEFAULT 'ISSUED' | `DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `CANCELLED` |
| `subtotal_parts_baisa`| INTEGER | NOT NULL DEFAULT 0 | Parts sum in Baisa |
| `subtotal_labor_baisa`| INTEGER | NOT NULL DEFAULT 0 | Labor sum in Baisa |
| `discount_baisa` | INTEGER | NOT NULL DEFAULT 0 | Discount in Baisa |
| `tax_rate_percent` | REAL | NOT NULL DEFAULT 5.0 | VAT % (Oman: 5%) |
| `tax_amount_baisa`| INTEGER | NOT NULL DEFAULT 0 | Calculated VAT in Baisa |
| `grand_total_baisa`| INTEGER | NOT NULL DEFAULT 0 | Final payable in Baisa |
| `paid_amount_baisa`| INTEGER | NOT NULL DEFAULT 0 | Cumulative payments in Baisa |
| `balance_due_baisa`| INTEGER | NOT NULL DEFAULT 0 | Remaining debt in Baisa |
| `invoice_language`| TEXT | NOT NULL DEFAULT 'ar' | `ar` or `en` |
| `tax_rules_snapshot`| TEXT | NULL | JSON snapshot of tax settings |
| `notes` | TEXT | NULL | Notes on invoice |
| `created_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Created timestamp |

### 12. `invoice_items`, `payments`, `expenses`, `cash_transactions`, `audit_log`
- `invoice_items`: Granular parts and labor line items.
- `payments`: Partial and full customer payment receipts (`CASH`, `BANK_TRANSFER`, `CARD_RECORDED`).
- `expenses`: Operational expenses categorized across Rent, Utilities, Wages, Tools, Maintenance, Supplies.
- `cash_transactions`: Cash register running balance ledger.
- `audit_log`: Monotonic audit log tracking state diffs.
