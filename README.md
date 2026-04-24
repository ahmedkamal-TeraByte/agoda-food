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
| `npm run seed` | Reset DB and seed 4 restaurants, 16 dishes, and 2 demo users (`alice`, `bob`) |
| `npm run type-check` | TypeScript check both workspaces |
| `npm run dev -w @agoda-food/backend` | Run any workspace script directly |

## Stages

1. ✅ Vue 3 UI (mocked)
2. ✅ Express + MongoDB backend
3. ✅ UI connected to real API
3a. ✅ User profiles + order history
4. ✅ LINE Login + LIFF
5. ⏭️ Reliability (Redis, BullMQ, Zod)

### Auth model (Stage 4)

**External browser** — "Login with LINE" button triggers the OAuth 2.0 PKCE-like flow:
1. Frontend generates a random `state`, stores it in `sessionStorage`, redirects to `https://access.line.me/oauth2/v2.1/authorize`.
2. LINE redirects back to `/auth/line/callback?code=...&state=...`.
3. Frontend verifies `state`, POSTs `code` to `POST /api/auth/line/exchange`.
4. Backend exchanges the code, verifies the id_token with LINE, upserts the user by `lineUserId`, returns a signed JWT.
5. Frontend stores `{ user, token }` in `localStorage`; the JWT is sent as `Authorization: Bearer <token>` on every request.

**Inside LINE (LIFF)** — the app is opened via the LIFF URL:
1. On boot, `liff.init()` is called; `liff.isInClient()` returns `true`.
2. If not yet logged in, `liff.login()` is called (handles redirect internally).
3. `liff.getIDToken()` is POSTed to `POST /api/auth/line/liff` — no code exchange needed.
4. Same JWT + user response, same `localStorage` storage.

**Onboarding** — LINE never provides phone and doesn't always provide email.
New users are redirected to `/onboarding` to complete email + phone before placing an order.

### Environment variables (before deploying)

Copy `.env.example` → `.env` in `backend/`, and `frontend/.env.example` → `frontend/.env`.

| Variable | Where | Description |
|---|---|---|
| `LINE_CHANNEL_ID` | backend | LINE Login channel ID |
| `LINE_CHANNEL_SECRET` | backend | LINE Login channel secret |
| `LINE_LOGIN_REDIRECT_URI` | backend | Callback URL registered in LINE console |
| `JWT_SECRET` | backend | Long random string for signing JWTs |
| `JWT_EXPIRES_IN` | backend | Token TTL e.g. `7d` |
| `VITE_LINE_CHANNEL_ID` | frontend | Same channel ID (not a secret) |
| `VITE_LIFF_ID` | frontend | LIFF app ID from LINE console |
