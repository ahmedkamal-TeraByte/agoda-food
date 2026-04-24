# Agoda Food

LINE Bot + LIFF lunch ordering app for the Agoda Bangkok office.

## Architecture

A single npm-workspaces monorepo with two deployable parts:

```
agoda-food/
├── frontend/   Vue 3 + Vite + Pinia + Tailwind
└── backend/    Express + MongoDB + Mongoose
```

**In development** each workspace runs its own dev server — Vite on `:5173` proxies `/api` to Express on `:3000`.

**In production** the backend serves the built frontend's static assets itself, so the entire app is a single service on one port.

## Prerequisites

- Node 20+
- MongoDB running locally on `mongodb://localhost:27017` (or set `MONGODB_URI`)

## Install

```bash
npm install     # installs both workspaces
npm run seed    # populates MongoDB with restaurants + dishes
```

## Development

```bash
npm run dev             # runs both backend (:3000) and frontend (:5173)
npm run dev:backend     # backend only
npm run dev:frontend    # frontend only (expects backend on :3000)
```

Open [http://localhost:5173](http://localhost:5173).

## Production (single service)

```bash
npm run build    # builds both (frontend → frontend/dist, backend → backend/dist)
npm start        # serves everything on :3000
```

Open [http://localhost:3000](http://localhost:3000).

## Useful commands

| Command | What it does |
|---|---|
| `npm run seed` | Reset DB and seed 4 restaurants + 16 dishes |
| `npm run type-check` | TypeScript check both workspaces |
| `npm run dev -w @agoda-food/backend` | Run any workspace script directly |

## Stages

1. ✅ Vue 3 UI (mocked)
2. ✅ Express + MongoDB backend
3. ✅ UI connected to real API
4. ⏭️ LINE login + LIFF
5. ⏭️ Reliability (Redis, BullMQ, Zod)
