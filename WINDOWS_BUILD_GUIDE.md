# WINDOWS BUILD GUIDE: AL RAWAHI GARAGE MANAGEMENT SYSTEM

**Developer:** AKASHA AI  
**Target:** Windows 10 & Windows 11 (x64 / arm64)  
**Distribution:** Standalone Offline NSIS Installer (`.exe`)

---

## 1. Prerequisites on Windows 10/11

Ensure the following tools are installed on your Windows machine:
1. **Node.js LTS (v20.x or v22.x):**  
   Download from [nodejs.org](https://nodejs.org/) (ensure "Add to PATH" is checked).
2. **Visual Studio C++ Build Tools:**  
   Required to compile the native SQLite binary (`better-sqlite3`).  
   Run in an Administrator PowerShell:
   ```powershell
   npm install --global --production windows-build-tools
   ```
   *Alternative:* Install "Desktop development with C++" via the Visual Studio Installer.
3. **Git for Windows:**  
   Download from [gitforwindows.org](https://gitforwindows.org/).

---

## 2. Step-by-Step Setup Instructions

### Step 1: Clone or Extract the Project
Extract the application files to a clean local directory:
```powershell
cd C:\Projects\AlRawahiGarage
```

### Step 2: Install Node Dependencies
Install production and development dependencies:
```powershell
npm install
```
This automatically compiles `better-sqlite3` for your local Windows Node version.

### Step 3: Run Unit Tests
Verify financial and currency precision calculations:
```powershell
npm test
```
Expected output:
```
# tests 78
# pass 78
# fail 0
```

### Step 4: Launch Electron in Development Mode
Start the desktop application connected to your local SQLite database:
```powershell
npm run electron:dev
```
On first launch:
- The database is created automatically at:  
  `C:\Users\<YourUsername>\AppData\Roaming\AlRawahiGarage\garage.db`
- WAL mode is enabled and all 17 schema tables are created.
- The window opens in dark charcoal & gold theme.

---

## 3. Creating the Production Windows Installer

To compile the standalone Windows `.exe` installer:
```powershell
npm run electron:build:win
```

### Build Artifacts:
The compiled installer is output to the `release\` directory:
- `release\AL RAWAHI GARAGE MANAGEMENT SYSTEM Setup 1.0.0.exe`

### Features of the NSIS Installer:
- Compatible with Windows 10 and Windows 11.
- Allows the operator to choose the installation folder (defaults to `C:\Program Files\AL RAWAHI GARAGE`).
- Creates desktop and Start Menu shortcuts.
- **Safety Guarantee:** Uninstallation never deletes `%APPDATA%\AlRawahiGarage\garage.db`, preserving garage customer records, invoices, and backups across updates.

---

## 4. Troubleshooting Windows Builds

| Issue | Cause | Solution |
|---|---|---|
| `node-gyp: command not found` or C++ compiler errors | Missing Visual Studio build tools | Install Visual Studio Community with "Desktop development with C++" |
| `better-sqlite3 module was compiled against different Node.js version` | ABI mismatch between Node.js and Electron | Run `npx @electron/rebuild` in project directory |
| File locked error during backup | SQLite database connection open | Use `VACUUM INTO` command for hot database snapshots |

---

## 5. Windows Desktop Manual Acceptance Checklist

Execute this 15-step checklist on the target Windows 10/11 physical machine:

1. **Install Application:** Run `AL RAWAHI GARAGE MANAGEMENT SYSTEM Setup 1.0.0.exe` without admin elevation; complete custom path NSIS setup.
2. **Launch Application:** Open from the Windows Start Menu or Desktop shortcut (`AL RAWAHI GARAGE`). Verify window opens with dark charcoal theme and Arabic RTL interface.
3. **Register Customer & Vehicle:** Navigate to Customer Intake. Add a new customer (`سالم بن حمد الرواحي`) and link vehicle (`55441 D`).
4. **Close & Reopen (Persistence):** Exit the app via window close (X). Re-launch from desktop shortcut. Confirm customer and vehicle are loaded from `%APPDATA%\AlRawahiGarage\garage.db`.
5. **Create Repair Order:** Open Repair Orders tab. Create order with initial odometer reading (e.g. 48,500 km) and reported brake complaint.
6. **Add Labor Task:** Add labor item (`Brake pad replacement & rotor resurfacing`, 2.0 hrs @ 7.000 OMR = 14.000 OMR).
7. **Receive Part into Inventory:** Go to Inventory tab. Stock intake a part (e.g., `04465-60320`, Front Brake Pads) with quantity 10 @ cost 18.000 OMR, selling price 26.500 OMR.
8. **Issue Part to Repair Order:** In the Repair Order parts panel, issue 1 unit of brake pads with automatic idempotency protection.
9. **Verify Stock Decrement:** Check inventory stock balance; confirm it decreased by exactly 1 unit (10 -> 9) and check movement ledger (`RO_ISSUE`, -1).
10. **Return Part Workflow:** Perform a test part return with defective toggle. Verify defective parts do not inflate saleable stock and log quarantine ledger movement.
11. **Generate Invoice:** Transition order to `COMPLETED` and generate invoice. Confirm subtotal (labor + parts), 5% VAT (Oman), and total integer Baisa calculations.
12. **Record Payment:** Record partial or full cash/card payment. Verify overpayments (> balance due) are strictly blocked.
13. **Print or Save as PDF:** Click print on the invoice. Verify invoice layout renders correctly and PDF can be saved locally.
14. **Customer Retention Dialog:** If customer was temporary, verify bilingual retention confirmation modal prompts to promote customer to permanent.
15. **Final Restart Integrity:** Exit and restart application. Confirm all 17 SQLite tables, movements, invoices, and payment records remain intact with zero data loss.
