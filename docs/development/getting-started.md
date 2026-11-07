# Developer Guide & Getting Started

---

## 🚀 Environment Setup

Create a `.env` file in the root of `sagana-backend/` based on `.env.example`:

```ini
# PostgreSQL Database Connection URL (e.g. Neon)
DATABASE_URL="postgresql://user:password@ep-sample-pooler.neon.tech/neondb?sslmode=require"

# Clerk Authentication API Keys
CLERK_SECRET_KEY="sk_test_..."
CLERK_PUBLISHABLE_KEY="pk_test_..."

# Server Port
PORT=3000
```

---

## 💻 Running the Application

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Development Server
```bash
# Standard dev server with watch mode
pnpm run start

# Or with debug flags
pnpm run start:debug
```
The server will start on `http://localhost:3000` with hot-reload enabled.

### 3. Open API Documentation
* **Swagger UI:** `http://localhost:3000/api/docs`

### 4. Start VitePress Documentation Server
```bash
pnpm run docs:dev
```
The documentation hub will open on `http://localhost:5173`.

### 5. Maintenance & Seeding Scripts
```bash
# Seed initial barangay join codes
pnpm run seed:barangay-codes

# Hard-delete test/reset machines by MAC address
pnpm run delete:machines
```

---

## 🧪 Testing with Bruno

The repository contains pre-configured [Bruno](https://www.usebruno.com/) request collections under the [`bruno/`](../../bruno/) directory:

```
bruno/
├── environments/
│   └── Local.bru
├── barangays/
├── batches/
├── feedstocks/
├── machines/
├── system/
├── telemetry/
└── users/
```

### Setting up Environment Variables in Bruno
1. Open Bruno and choose **Open Collection**.
2. Select the `sagana-backend/bruno` folder.
3. Select the `Local` environment (pre-configured with `baseUrl = http://localhost:3000/api`) and set `token` to your Clerk JWT.

---

## 🧪 Running Automated Tests

```bash
# Unit tests
pnpm run test

# End-to-end (E2E) tests
pnpm run test:e2e

# Test coverage report
pnpm run test:cov
```
