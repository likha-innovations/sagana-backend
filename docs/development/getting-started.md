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
CLERK_WEBHOOK_SECRET="whsec_..."

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
pnpm run start:dev
```
The server will start on `http://localhost:3000` with hot-reload enabled.

### 3. Open API Documentation
* **Swagger UI:** `http://localhost:3000/api/docs`

### 4. Start VitePress Documentation Server
```bash
pnpm run docs:dev
```
The documentation hub will open on `http://localhost:5173`.

---

## 🧪 Testing with Bruno

The repository contains pre-configured [Bruno](https://www.usebruno.com/) request collections under the [`bruno/`](../../bruno/) directory:

```
bruno/
├── auth/
│   └── Clerk Webhook (Create User).bru
├── system/
│   └── Health Check.bru
└── users/
    ├── Get Profile (Me).bru
    └── Update Profile (Me).bru
```

### Setting up Environment Variables in Bruno
1. Open Bruno and choose **Open Collection**.
2. Select the `sagana-backend/bruno` folder.
3. Configure your local environment with `baseUrl = http://localhost:3000` and `token = <your_clerk_jwt>`.

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
