# DEVELOPMENT GUIDE: AL RAWAHI GARAGE MANAGEMENT SYSTEM

**Developer:** AKASHA AI  
**Project Type:** Standalone Offline Windows Desktop Application

---

## 1. Architecture Overview

The system consists of two primary runtime layers:
1. **Renderer Process (React 19 + TypeScript + Vite + Tailwind CSS v4):**
   - Pure UI layer with zero direct OS or database access.
   - Built to run both inside the Electron desktop shell and within the Google AI Studio browser preview.
   - Communicates exclusively through the typed `window.garageApi` interface (backed by `preload.ts` in Electron, or `browserMockAdapter.ts` in web preview).
2. **Main Process (Node.js 22 LTS / Electron):**
   - Privileged backend host.
   - Manages SQLite database connection via `better-sqlite3`.
   - Validates all incoming requests using Zod schemas (`electron/ipc/validation.ts`).
   - Persists all business data to `%APPDATA%\AlRawahiGarage\garage.db`.

---

## 2. Environment Prerequisites

To run and build the project locally on a developer machine:
- **Node.js:** v20.x or v22.x LTS (Recommended: Node 22.x)
- **Package Manager:** npm or bun
- **Operating System:** Windows 10/11 (or macOS/Linux for web preview mode)
- **Windows Build Tools:** Visual Studio Build Tools (C++ Desktop development) or Python 3 + Visual Studio Community for compiling `better-sqlite3` native bindings.

---

## 3. Running in Development

### Mode A: Web Browser Development & AI Studio Preview
Runs Vite dev server. The application loads the in-memory/localStorage preview adapter:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Mode B: Electron Desktop Development (Native Windows)
Compiles TypeScript electron scripts and starts the Electron application:
```bash
npm run electron:dev
```

---

## 4. Testing & Code Quality

### Running Unit Tests
Unit tests use Node's built-in test runner (`node:test`) executed via `tsx`:
```bash
npm test
```
To run a specific test file:
```bash
npx tsx --test tests/currency.test.ts
```

### TypeScript Verification & Linting
```bash
npm run lint
```

---

## 5. Security & IPC Rules for Contributors

1. **Never bypass `preload.ts`**: Do not enable `nodeIntegration: true` or disable `contextIsolation`.
2. **Never expose raw SQL to the renderer**: All database interactions must happen in `electron/ipc/handlers.ts` using prepared statements.
3. **Always validate incoming parameters with Zod**: Every new IPC handler must parse its arguments against a schema in `electron/ipc/validation.ts`.
4. **Always store money in integer Baisa**: Never pass floating point OMR amounts to database insertion statements. Use `toBaisa()` and `formatOMR()`.
