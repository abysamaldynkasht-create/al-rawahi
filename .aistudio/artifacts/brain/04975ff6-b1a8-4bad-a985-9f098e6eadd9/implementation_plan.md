# AL RAWAHI GARAGE MANAGEMENT SYSTEM — WORKER MANAGEMENT & PRODUCTIVITY

A complete extension for Worker Management, Monthly Overtime-based Payroll, and Daily Labor Productivity Tracking, natively integrated into the existing Electron, React, TypeScript, and SQLite desktop architecture.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Strict Business & Accounting Separation**:
> - **Payroll (المستحقات والأجور)**: What the garage owes the worker: `Monthly Payable = Base Salary + Overtime Hours × Overtime Hourly Rate`.
> - **Labor Productivity (إنتاجية اليد والعمالة)**: The billable work performed by that worker on vehicles and repair orders.
> - **Zero Cross-Contamination**: Productivity is never treated as salary, and payroll is never derived from productivity. Spare parts costs (e.g. OMR 10 on a 100 OMR job) are strictly excluded from labor productivity.

- **Confirmed Decision 1**: Retain and evolve the existing `technicians` table into the primary `workers` entity via safe SQLite Migration 9, adding `monthly_base_salary_baisa`, `overtime_rate_baisa`, `employment_status`, and `hire_date` while preserving all existing technician IDs, relationships, and repair order history.
- **Confirmed Decision 2**: Atomic snapshots of base salary and overtime rate stored on each finalized monthly payroll and overtime record, ensuring future worker wage adjustments never retroactively corrupt past historical payrolls.
- **Confirmed Decision 3**: Multi-worker labor allocation constraint: total attributed labor value across all assigned workers for a repair order or labor task cannot exceed the invoiced labor charge. Unallocated labor is explicitly identified.

---

## 1. Overview & Core Concept

### What It Does
Empowers Al Rawahi Garage management to:
1. **Manage Workshop Workers**: Register, edit, search, and manage technicians and workshop workers with contractual monthly base salaries and hourly overtime rates in integer Baisa.
2. **Track Overtime & Generate Monthly Payroll**: Record daily/weekly overtime hours with dates and approval notes. Automatically calculate monthly payrolls (`Base Salary + (Overtime Hours × Overtime Rate)`). Review drafts, finalize payrolls, print payslips, and export PDF summaries.
3. **Track Daily Labor Productivity**: Record and allocate billable labor hours and values to workers on repair orders and invoices. Supports solo or team labor distribution. Isolates labor charges from spare parts costs.
4. **Independent Analytics**: Provide side-by-side yet strictly separated reporting on workshop labor revenue generated vs. payroll expenses paid.

### Target Audience & Persona
Garage owner, workshop manager, and administrative accountant overseeing workshop floor productivity, technician compensation, and monthly financial disbursements in Oman.

---

## 2. User Experience & Visual Design

### Unified Navigation & View Architecture
The existing `technicians` route (`Wrench` icon) in `AppShell.tsx` expands into a full-featured **Worker & Productivity Management Center** with 4 tabs:

```
┌────────────────────────────────────────────────────────────────────────┐
│ [عمال الورشة والفنيون]  [سجل العمل الإضافي]  [مسير الرواتب الشهري]  [إنتاجية العمالة] │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Tab 1: عمال الورشة والفنيون (Workers & Technicians)**
   - High-density card & table view showing name, specialty, phone, monthly base salary (OMR), overtime rate/hr (OMR), active status, and action buttons (تعديل, كشف حساب, أرشفة).
   - Modal for Worker Intake & Salary Configuration with integer Baisa validation.

2. **Tab 2: سجل الساعات الإضافية (Overtime Records)**
   - Daily/weekly overtime logging form: Worker selector, date picker, overtime hours (e.g., 2.5 hrs), snapshot overtime rate, calculated amount in OMR, status (`PENDING` / `APPROVED`), and supervisor notes.
   - Monthly filter and bulk approval actions.

3. **Tab 3: مسير الرواتب الشهري (Monthly Payroll Ledger)**
   - Month selector (`YYYY-MM`).
   - Summary KPIs: Total Base Salaries, Total Overtime Paid, Net Monthly Payroll Disbursed.
   - Table: Worker, Base Salary, Total Overtime Hours, Overtime Total, Grand Payable.
   - Status badge: `مسودة (DRAFT)` / `معتمد (FINALIZED)` / `مصروف (PAID)`.
   - Actions: **اعتماد المسير (Finalize Payroll)**, **طباعة كشف الرواتب (Print Payroll Sheet)**, **تصدير كشف PDF**.

4. **Tab 4: إنتاجية العمالة اليومية (Labor Productivity)**
   - Filters: Date range, specific worker, repair order status.
   - KPI cards: Total Billed Labor Revenue, Total Allocated Labor Value, Total Unallocated Labor.
   - Labor allocation drawer: Inspects RO/Invoice, displays itemized labor tasks (parts excluded), allows assigning 100% to one technician or distributing custom values/percentages across multiple workers with client-side and server-side validation against total labor charges.
   - Worker productivity summary cards showing billed hours, generated labor revenue, and average efficiency.

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Why |
| :--- | :--- | :--- |
| **Worker Data Architecture** | Extend existing `technicians` table in Migration 9 | Preserves referential integrity with `repair_orders.assigned_technician_id` and `labor_tasks.technician_id` without breaking past data. |
| **Historical Rate Integrity** | Store snapshots of `base_salary_baisa` and `overtime_rate_baisa` in each payroll/overtime row | Modifying a worker's salary in November must never recalculate or corrupt September's finalized payroll. |
| **Currency Arithmetic** | Integer Baisa (1 OMR = 1,000 Baisa) | Eliminates IEEE-754 floating-point inaccuracies in overtime and payroll sums. |
| **Labor Allocation Validation** | Database triggers and IPC schema validation | Ensures $\sum(\text{Allocated Labor}) \le \text{Total Labor Charge}$. Prevents duplicate counting of the same labor. |
| **Accidental Deletion Prevention** | Foreign keys with `ON DELETE RESTRICT` and soft-delete (`is_active = 0`) | Prevents data loss for any worker with historical repair orders, overtime, or payroll records. |

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React Renderer Layer                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │   WorkersView.tsx (Tabs: Workers | Overtime | Payroll | Product)  │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    │ Type-safe IPC Calls               │
├────────────────────────────────────┼───────────────────────────────────┤
│                        Electron Main Process                           │
│  ┌─────────────────────────────────▼────────────────────────────────┐  │
│  │   IPC Handlers (workers:*, overtime:*, payroll:*, productivity:*) │  │
│  │   Zod Schemas & Timing-Safe Admin Authorization                  │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    │ Database Transactions             │
├────────────────────────────────────┼───────────────────────────────────┤
│                        SQLite Database Layer                           │
│  ┌─────────────────────────────────▼────────────────────────────────┐  │
│  │  Migration 9:                                                    │  │
│  │  - technicians (enhanced: base_salary, overtime_rate, status)    │  │
│  │  - worker_overtime_entries (date, hours, rate_baisa, status)     │  │
│  │  - worker_monthly_payrolls (month, worker_id, total_baisa)       │  │
│  │  - worker_labor_productivity (ro_id, worker_id, labor_baisa)     │  │
│  │  - Unique Indexes & Audit Triggers                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Proposed Database Schema (Migration 9)

```sql
-- 1. Enhance technicians table with contractual compensation fields
ALTER TABLE technicians ADD COLUMN monthly_base_salary_baisa INTEGER NOT NULL DEFAULT 0;
ALTER TABLE technicians ADD COLUMN overtime_rate_baisa INTEGER NOT NULL DEFAULT 0;
ALTER TABLE technicians ADD COLUMN national_id TEXT;
ALTER TABLE technicians ADD COLUMN hire_date TEXT DEFAULT (date('now'));
ALTER TABLE technicians ADD COLUMN employment_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(employment_status IN ('ACTIVE', 'ON_LEAVE', 'TERMINATED'));

-- 2. Worker Overtime Entries
CREATE TABLE IF NOT EXISTS worker_overtime_entries (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  work_date TEXT NOT NULL,
  hours REAL NOT NULL CHECK(hours > 0 AND hours <= 24),
  hourly_rate_baisa INTEGER NOT NULL CHECK(hourly_rate_baisa >= 0),
  total_amount_baisa INTEGER NOT NULL CHECK(total_amount_baisa >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approved_by TEXT,
  approved_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (worker_id) REFERENCES technicians(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_overtime_worker_date ON worker_overtime_entries(worker_id, work_date);
CREATE INDEX IF NOT EXISTS idx_overtime_status ON worker_overtime_entries(status);

-- 3. Monthly Payroll Records
CREATE TABLE IF NOT EXISTS worker_monthly_payrolls (
  id TEXT PRIMARY KEY,
  payroll_month TEXT NOT NULL, -- Format: YYYY-MM
  worker_id TEXT NOT NULL,
  base_salary_baisa INTEGER NOT NULL CHECK(base_salary_baisa >= 0),
  overtime_hours REAL NOT NULL DEFAULT 0.0 CHECK(overtime_hours >= 0),
  overtime_amount_baisa INTEGER NOT NULL DEFAULT 0 CHECK(overtime_amount_baisa >= 0),
  total_payable_baisa INTEGER NOT NULL CHECK(total_payable_baisa >= 0),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'FINALIZED', 'PAID')),
  paid_at TEXT,
  payment_method TEXT CHECK(payment_method IN ('CASH', 'BANK_TRANSFER', 'CARD', 'OTHER')),
  payment_reference TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (worker_id) REFERENCES technicians(id) ON DELETE RESTRICT,
  UNIQUE(worker_id, payroll_month)
);
CREATE INDEX IF NOT EXISTS idx_payroll_month ON worker_monthly_payrolls(payroll_month);
CREATE INDEX IF NOT EXISTS idx_payroll_worker ON worker_monthly_payrolls(worker_id);

-- 4. Daily Labor Productivity Tracking
CREATE TABLE IF NOT EXISTS worker_labor_productivity (
  id TEXT PRIMARY KEY,
  work_date TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  repair_order_id TEXT,
  invoice_id TEXT,
  labor_task_id TEXT,
  vehicle_id TEXT,
  work_description TEXT NOT NULL,
  labor_value_baisa INTEGER NOT NULL CHECK(labor_value_baisa >= 0),
  hours_spent REAL DEFAULT 1.0 CHECK(hours_spent >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (worker_id) REFERENCES technicians(id) ON DELETE RESTRICT,
  FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (labor_task_id) REFERENCES labor_tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_productivity_worker_date ON worker_labor_productivity(worker_id, work_date);
CREATE INDEX IF NOT EXISTS idx_productivity_ro ON worker_labor_productivity(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_productivity_invoice ON worker_labor_productivity(invoice_id);
```

---

## 5. Verification & Rollback Plan

- **Step 1**: Pre-migration SQLite online backup stored with SHA-256 validation.
- **Step 2**: Migration 9 applied inside an atomic transaction. If any schema migration fails, SQLite rolls back completely to Migration 8 state.
- **Step 3**: Dedicated test suite in `tests/workerPayrollAndProductivity.test.ts` validating:
  - Overtime rate snapshotting.
  - Monthly payroll calculation formula (`Base + OT`).
  - Idempotency and `UNIQUE(worker_id, payroll_month)` constraint.
  - Multi-worker labor split where $\sum(\text{Allocated}) \le \text{Total Labor Charge}$.
  - Strict exclusion of spare parts costs from productivity.
  - Accidental worker deletion prevention.
- **Step 4**: Full regression suite running `npm test`, `npm run lint`, `compile_applet`, and production builds.
