# Agoda Food

LINE Bot + LIFF lunch ordering app for the Agoda Bangkok office.

Customers browse restaurants, place orders, and pay with PromptPay. Merchants run a dashboard for menus, categories, settings, and order/payment review. A LINE bot pushes status updates and lets merchants approve PromptPay proofs from inside LINE.

## Architecture

A single npm-workspaces monorepo with two deployable parts:

```
agoda-food/
├── frontend/   Vue 3 + Vite + Pinia + Tailwind + Vue Router
└── backend/    Express + MongoDB + Mongoose + TypeScript
```

**In development** each workspace runs its own dev server — Vite on `:5173` proxies `/api` to Express on `:3000`.

**In production** the backend serves the built frontend's static assets itself, so the entire app is a single service on one port.

### What's in the box

- **Customer app** — browse, cart, checkout, order tracking, profile
- **LINE Login + LIFF** — auth in the browser and inside the LINE app
- **Merchant dashboard** — `/merchant/*` for orders, menu, categories, settings
- **Restaurant onboarding** — self-serve apply flow with Agoda-email OTP referral
- **PromptPay payments** — Stripe-powered QR with manual proof-upload fallback
- **LINE bot** — Messaging API webhook for status pushes and merchant actions
- **Object storage** — Cloudflare R2 (public bucket for images, private for payment proofs); falls back to local filesystem if unconfigured
- **Transactional email** — Mailjet for OTPs

## Prerequisites

- Node 20+
- MongoDB running locally on `mongodb://localhost:27017` (or set `MONGODB_URI`)
- A [LINE Developers](https://developers.line.biz/) account with a Login channel and a LIFF app (required — the backend won't start without them)

Optional, only if you want those features to work:
- A Messaging API channel (LINE bot)
- A Stripe account with PromptPay enabled
- A Cloudflare R2 bucket pair (public + private)
- A Mailjet account (for sending real OTP emails)

## Install

```bash
npm install     # installs both workspaces
```

## Configuration

Configuration is split in two:

1. **Bootstrap env vars** in `backend/.env` — only the values needed to connect to MongoDB. Copy `backend/.env.example` → `backend/.env`.

   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/agoda-food
   # NODE_ENV=production
   ```

2. **Everything else** lives in the `app_config` collection in MongoDB and is loaded once at server startup. See `backend/src/config/keys.ts` for the full catalog (LINE, LIFF, JWT, R2, Stripe, Mailjet, OTP, etc.).

The frontend reads one variable from `frontend/.env` (copy from `frontend/.env.example`):

```env
VITE_LIFF_ID=        # leave blank to disable in-LINE auto-login
```

### Minimum config to boot

The server refuses to start without these five required keys in `app_config`:

| Key | Description |
|---|---|
| `LINE_CHANNEL_ID` | LINE Login channel ID |
| `LINE_CHANNEL_SECRET` | LINE Login channel secret |
| `LINE_LOGIN_REDIRECT_URI` | Callback URL registered in the LINE console (e.g. `http://localhost:5173/auth/line/callback` in dev) |
| `LIFF_ID` | LIFF app ID from LINE Developers Console |
| `JWT_SECRET` | Long random string for signing session JWTs |

Insert them with the mongo shell:

```js
use agoda-food

db.app_config.insertMany([
  { key: "LINE_CHANNEL_ID",         value: "<your channel id>",    isSecret: false },
  { key: "LINE_CHANNEL_SECRET",     value: "<your channel secret>", isSecret: true  },
  { key: "LINE_LOGIN_REDIRECT_URI", value: "http://localhost:5173/auth/line/callback", isSecret: false },
  { key: "LIFF_ID",                 value: "<your liff id>",       isSecret: false },
  { key: "JWT_SECRET",              value: "<long random string>", isSecret: true  },
])
```

To change a value later:

```js
db.app_config.updateOne(
  { key: "JWT_SECRET" },
  { $set: { value: "<new value>" } }
)
```

### Optional integrations

All of these are off by default; the related feature is disabled when its keys are missing, but the rest of the app still works.

| Feature | Required keys | Notes |
|---|---|---|
| LINE Messaging bot | `LINE_MESSAGING_ACCESS_TOKEN`, `LINE_MESSAGING_CHANNEL_SECRET` | Push notifications and merchant payment approvals from LINE |
| Stripe PromptPay | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Without it the app uses a mock provider and order proof-upload fallback |
| Cloudflare R2 (public) | `R2_ACCOUNT_ID`, `R2_PUBLIC_ACCESS_KEY_ID`, `R2_PUBLIC_SECRET_ACCESS_KEY`, `R2_PUBLIC_BUCKET`, `R2_PUBLIC_BASE_URL` | For restaurant covers, logos, menu photos. Only used in production; non-prod always writes to `<repo>/.uploads/` |
| Cloudflare R2 (private) | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | For payment-proof screenshots (signed-URL reads). Only used in production; non-prod always writes to `<repo>/.uploads/` |
| Mailjet email | `MAILJET_API_KEY`, `MAILJET_API_SECRET`, `MAIL_FROM`, `MAIL_FROM_NAME` | When unset, OTP codes are printed to the server console (handy for dev) |

Default values, descriptions, and other tunables (`JWT_EXPIRES_IN`, `OTP_TTL_MINUTES`, `AGODA_EMAIL_DOMAIN`, `STRIPE_STATEMENT_DESCRIPTOR`, etc.) live in [`backend/src/config/keys.ts`](backend/src/config/keys.ts).

## Seed sample data

After MongoDB is running and required config is in place:

```bash
npm run seed
```

This drops and re-seeds the `restaurants` and `menuitems` collections with 4 demo restaurants (Somtum Der, MK Gold, Jay Fai, Pizza Company) and ~16 dishes, owned by a stub "Seed Admin" user.

## Development

```bash
npm run dev             # runs both backend (:3000) and frontend (:5173)
npm run dev:backend     # backend only
npm run dev:frontend    # frontend only (expects backend on :3000)
```

Open [http://localhost:5173](http://localhost:5173).

For local Stripe webhook testing:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

For local LINE webhook testing, expose `:3000` with a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`) and set the webhook URL in the LINE console to `<tunnel>/api/line/webhook`.

## Production (single service)

```bash
npm run build    # builds both (frontend → frontend/dist, backend → backend/dist)
npm start        # serves the whole app on :3000
```

Open [http://localhost:3000](http://localhost:3000).

## Useful commands

| Command | What it does |
|---|---|
| `npm run seed` | Reset DB and seed 4 restaurants + dishes + seed admin user |
| `npm run type-check` | TypeScript check both workspaces |
| `npm run dev -w @agoda-food/backend` | Run any workspace script directly |

## Auth model

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

**Onboarding** — LINE never provides phone and doesn't always provide email. New users are redirected to `/onboarding` to complete email + phone before placing an order.

**Merchant onboarding** — anyone can apply for a restaurant at `/restaurants/apply`. The applicant fills the form, the backend emails a one-time code to the Agoda-domain referral, and the restaurant is only persisted **after** the OTP is verified (so abandoned attempts never leave drafts behind). On success the user is promoted to the `merchant` role.

## Project layout

```
backend/src/
├── config/       AppConfig singleton + key catalog (keys.ts)
├── lib/          line, lineBot, jwt, otp, email, storage (R2), stripe, promptPay, ...
├── middleware/   requireUser, requireMerchant
├── models/       Restaurant, MenuItem, Order, Payment, User, OtpCode, AppConfigEntry
├── routes/       auth, users, restaurants, orders, merchant, email, stripeWebhook, agodaFoodLineWebhook
├── services/     LINE-bot business logic (active orders, payment review, order details)
├── seed.ts       sample data seeder
└── server.ts     entrypoint

frontend/src/
├── pages/        Home, Restaurant, Cart, Checkout, OrderSuccess, Orders, Profile,
│                 Login, LineCallback, Onboarding, RestaurantApply, Merchant*
├── components/   AppHeader, RestaurantCard, MenuItemCard, MerchantOrderCard, ...
├── stores/       Pinia stores (cart, user)
├── services/     api.ts — fetch wrapper with auth header
├── composables/  shared hooks
├── router/       vue-router config
└── main.ts       entrypoint
```
