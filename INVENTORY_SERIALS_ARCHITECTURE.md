# INVENTORY PART SERIAL NUMBERS ARCHITECTURE & DESIGN NOTES
**System:** AL RAWAHI GARAGE MANAGEMENT SYSTEM  
**Developer:** AKASHA AI  
**Status:** Minimal Schema & Architectural Preparation (Phase 3 Foundation for Phase 5 Implementation)

---

## 1. Executive Summary & Roadmap Placement
Inventory and Spare Parts Management is designated as **Phase 5** in the Al Rawahi Garage Management System roadmap. In accordance with the Phase 3 Workflow Corrections specification, this document and its accompanying database schema provide the essential architectural preparation for serialized part tracking without prematurely implementing the entire Phase 5 user interface.

Barcode and QR scanner hardware integration is intentionally excluded from the current offline Windows desktop release and is preserved as a clearly documented future enhancement.

---

## 2. Business Rules for Serial-Number Tracking

1. **Individual Serialized Parts:**
   - Any physical part marked as serialized (`inventory_items.is_serialized = 1`, e.g., alternators, turbochargers, transmission control modules, high-value steering racks) must possess an individual, unique serial number.
   - Bulk consumables (e.g., motor oil, brake fluid, standard gaskets, fuses) use ordinary item codes (`part_code`) and fractional/integer quantities (`quantity_in_stock`) without requiring serial numbers.

2. **Manual Serial Entry:**
   - The garage operator inputs serial numbers manually via desktop keyboard input.
   - No barcode, QR, or 2D scanner hardware is required or assumed.

3. **Intake / Receipt Tracking:**
   - When a serialized part is received into workshop inventory (via purchase invoice or manual intake), its exact serial number is recorded into `inventory_serials` with status `IN_STOCK`.
   - The corresponding ledger entry in `inventory_movements` logs the intake event (`movement_type = 'PURCHASE_RECEIPT'`) with the `serial_number`.

4. **Issuance / Workshop Usage Tracking:**
   - When that exact part is issued to a technician or installed on a customer vehicle under a Repair Order (Phase 4) or billed on an Invoice (Phase 6), the serial number transitions to status `ISSUED`.
   - The linked `repair_order_id` and/or `invoice_id` are permanently attached.
   - The double-entry audit ledger in `inventory_movements` records the deduction (`movement_type = 'RO_ISSUE'`, `quantity_delta = -1`) along with the exact `serial_number`.

5. **Active Uniqueness Enforcement:**
   - Database-level partial index constraint:
     ```sql
     CREATE UNIQUE INDEX idx_unique_active_serial 
       ON inventory_serials(serial_number) 
       WHERE status = 'IN_STOCK';
     ```
   - Prevents the same active serial number from ever being assigned to two different physical parts currently in stock.
   - Preserves historical audit records: even after a part has been issued or billed, its serial number remains recorded in historical movements and serial records.

---

## 3. Relational Database Schema (Migration 003)

### Table: `inventory_serials`
| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | TEXT | PRIMARY KEY (UUID) | Unique record identifier |
| `item_id` | TEXT | NOT NULL, FK -> `inventory_items(id)` ON DELETE RESTRICT | Master SKU / Part Catalog reference |
| `serial_number` | TEXT | NOT NULL | Physical serial number entered manually |
| `status` | TEXT | NOT NULL CHECK (`IN_STOCK`, `ISSUED`, `RETURNED`, `DAMAGED`) | Current lifecycle state |
| `repair_order_id` | TEXT | NULL, FK -> `repair_orders(id)` | Vehicle repair order where installed |
| `invoice_id` | TEXT | NULL, FK -> `invoices(id)` | Final customer billing document |
| `notes` | TEXT | NULL | Intake / condition inspection notes |
| `received_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Date/time entered inventory |
| `issued_at` | TEXT | NULL | Date/time issued from inventory |
| `created_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Audit creation timestamp |
| `updated_at` | TEXT | NOT NULL DEFAULT (datetime('now')) | Audit modification timestamp |

### Table Enhancements:
- `inventory_items.is_serialized INTEGER NOT NULL DEFAULT 0`
- `inventory_movements.serial_number TEXT`

---

## 4. Hardware Scanner Future Integration Path
When physical barcode/QR scanning hardware is introduced in future hardware deployments:
1. **USB Keyboard-Wedge / HID Emulation:**
   - Most industrial 1D/2D scanners operate in standard USB HID Keyboard-Wedge mode, typing the scanned string and sending an `Enter` keypress (`\n` or `\r`).
   - The current text-input design natively accepts this without code changes.
2. **Dedicated Serial/WebHID Protocol:**
   - Electron Main process can listen to WebHID / Serial Port events when scanner vendor SDKs are supplied in later releases.
