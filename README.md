# AI-Powered Adaptive Interview Coach

Minimal full-stack starter for the assignment project.

## Project Structure

- `frontend/` Angular app with routing and a landing page
- `backend/` Node.js + Express API

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+ (recommended)

## Install Dependencies

### Frontend

```bash
cd frontend
npm install
```

### Backend

```bash
cd backend
npm install
```

## Run the Apps

### Recommended run order

1. Start backend first
2. Start frontend second

### Start backend

```bash
cd backend
npm run dev
```

Backend default URL: `http://localhost:5000`  
Health check: `GET http://localhost:5000/api/health`

### Start frontend

```bash
cd frontend
npm start
```

Frontend default URL: `http://localhost:4200`

## Firebase Setup (Manual Later)

No real Firebase credentials are committed. The project boots without them.

### Frontend config

Keep frontend values browser-safe only:

- `frontend/src/environments/environment.ts`
- `frontend/src/environments/environment.development.ts`

Set only:

- `apiBaseUrl` (backend URL)
- `appName`

### Backend Firebase Admin config

1. Copy `.env.example` to `.env`:

```bash
cd backend
cp .env.example .env
```

2. Update `.env` with service account values:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_DATABASE_URL`
- `FRONTEND_URL`

If these are missing, backend still starts and skips Firebase Admin initialization.
