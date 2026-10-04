# Tailor POS ✂

A modern tailor-shop point of sale replacing the legacy Windows desktop app
("P A C : All in one PAC" by FocusStar I.T. Solutions). Same business logic —
job cards, measurements, advances, sales conversion, VAT 5% (UAE, AED) — with a
brand-new web UI: dark sidebar navigation, gradient stat cards, and clean,
print-friendly invoices.

## Stack

| Layer  | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS (`client/`) |
| Backend  | Node.js + Express + TypeScript + Mongoose (`server/`) |
| Database | MongoDB (local via `docker-compose.yml`, or Atlas) |
| Currency / Tax | AED · 5% VAT (configurable in Settings) |

## Quick start

### 1. Database

```bash
docker compose up -d        # starts MongoDB on localhost:27017
# …or point MONGODB_URI at your own MongoDB
```

### 2. Server (API on http://localhost:5000/api)

```bash
cd server
cp ../.env.example .env     # or create your own .env
npm install
npm run seed                # ledgers, products, number counters
npm run dev
```

### 3. Client (http://localhost:3000)

```bash
cd client
npm install
# optional: create .env.local with NEXT_PUBLIC_API_URL=http://localhost:5000/api
npm run dev
```

Or run both at once from the repo root: `npm run dev` (uses `concurrently`).

## Seed data

- **Ledgers** — all entries from the old "Find Ledger" screen (BLISS TEXTILE,
  KEWALRAM & SONS, NOJOOM AL MARWA, jumah, ALI AWOD, AMER MONSOORI, BADER ALI,
  DHAWI, MAJID) plus TARAK, AMU BOKHIT and ZAINULLA.
- **Products** — `5001` ARABI BIG (138.10), `5002` KUWAITI BIG (119.05),
  `936` LUBBAN fabric (119.05).
- **Counters** — job cards continue at **13259**, bills at **85935**, matching
  the numbering of the old system.

## Accounts & roles

`npm run seed` creates three accounts the first time it runs (it never
overwrites an existing user, so re-seeding will not reset a changed password):

| Username | Password | Role | Can do |
|---|---|---|---|
| `superadmin` | `ChangeMe@123` | Super Admin | Everything, always. Only a Super Admin can create or edit another Super Admin. |
| `admin` | `Admin@12345` | Admin | Everything except touching Super Admin accounts. |
| `salesman` | `Sales@12345` | Salesman | Job cards, sales, and read-only ledgers/products. No payments report, settings or users. |

**Change these passwords immediately** — from the account menu in the top-right,
or by editing the user on the Users screen.

Roles only seed the starting permission set. Every user stores an explicit list,
so on the Users screen you can tick or untick any individual capability
(`jobcards.convert`, `products.manage`, `payments.view`, …) per person.
Super Admins bypass the list and always hold every permission.

Permission changes and deactivations take effect on the next request — an
already-issued token does not keep stale access, because the API reloads the
user on every call.

Guard rails enforced by the API, not just the UI:

- An Admin cannot create, edit or delete a Super Admin, or promote anyone to Super Admin.
- Nobody can delete, deactivate or change the role of their own account.
- The last Super Admin cannot be demoted, deactivated or deleted.

## Features

- **Dashboard** — today's / month's sales, open job cards, customer count,
  recent job cards, low-stock alerts.
- **Job Card Entry** — auto numbering (No / Book No / Ref), customer lookup
  (Find Ledger), walk-in "New" customer mode, editable order-items grid with
  product search (F2/Enter), auto totals (Total − Discount + 5% Tax = Net),
  measurements grid (LEN, CHEST, COLLAR, …), materials used, payment panel
  (Advance / Before-tax / Tax / Balance), part payments, payment history,
  close / reopen, and **Convert to Sales**.
- **Sales / Return** — Retail/Wholesale/Distributor, Cash/Credit, A/B category,
  credit-card toggle, find-a-job-card for conversion (advance carried over),
  per-line discount & tax math, footer totals, print-friendly tax invoice,
  return mode.
- **Ledgers / Products** — searchable CRUD with modals.
- **Payments** — every advance & part payment across job cards in one table.
- **Measurements per person** — one job card can carry several people, each
  with their own name, measurements, fabric, size and quantity. Every person is
  saved under the customer (`MeasurementProfile`) and re-selected with a tick
  on later orders, so a customer ordering two thobes instead of four just
  unticks the other two. Cards written before this feature still open: the old
  single `measurements` object is lifted into the first block.
- **Users & Permissions** — Super Admin / Admin / Salesman roles, plus a
  per-user permission grid so any capability can be granted or revoked
  individually. Accounts can be deactivated without being deleted.
- **Settings** — VAT rate, default book no, salesman, delivery lead days
  (stored per device).

## API overview (`/api`)

Every endpoint except `/health` and `/auth/login` requires a
`Authorization: Bearer <token>` header, and each one checks a specific permission.

- `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password`,
  `GET /auth/permissions`
- `GET/POST /users`, `PUT/DELETE /users/:id` (needs `users.manage`)
- `GET /measurements?ledgerId=`, `POST /measurements` (upserts by name),
  `PUT/DELETE /measurements/:id` — the people saved under a customer
  (read needs `jobcards.view`, writing needs `jobcards.create`/`jobcards.edit`)
- `GET/POST /ledgers`, `GET/PUT/DELETE /ledgers/:id` (`?q=`)
- `GET/POST /products`, `GET/PUT/DELETE /products/:id` (`?q=`)
- `GET /jobcards` (`?q=&status=`), `POST /jobcards`, `GET/PUT /jobcards/:id`,
  `POST /jobcards/:id/payments`, `/close`, `/reopen`,
  `POST /jobcards/:id/convert` → creates the sales bill,
  `GET /jobcards/next`, `GET /jobcards/adjacent`, `GET /jobcards/payments/all`
- `GET/POST /sales`, `GET /sales/:id`, `GET /sales/next`
- `GET /dashboard/summary`

All money math (line amounts, 5% tax, advance split, balances) is computed
server-side so the client can never drift.

## Project layout

```
tailor-pos/
├── client/                 # Next.js 14 app
│   ├── app/                # routes: dashboard, job-cards, sales, ledgers,
│   │                       # products, payments, settings
│   ├── components/         # Sidebar, Topbar, JobCardForm, SaleForm,
│   │                       # LedgerSearchModal, PaymentDialog, …
│   └── lib/                # api.ts (typed REST client), types.ts, format.ts
├── server/                 # Express + Mongoose API
│   └── src/
│       ├── models/         # Ledger, Product, JobCard, Sale, Counter, User,
│       │                   # MeasurementProfile
│       ├── routes/         # ledgers, products, jobcards, sales, dashboard
│       ├── utils/money.ts  # rounding + totals
│       ├── seed.ts         # npm run seed
│       └── index.ts
├── docker-compose.yml      # MongoDB for local dev
└── .env.example
```

## Environment

| Var | Where | Default |
|---|---|---|
| `MONGODB_URI` | server | `mongodb://localhost:27017/tailor-pos` |
| `PORT` | server | `5000` |
| `JWT_SECRET` | server | dev fallback (set your own) |
| `JWT_EXPIRES_IN` | server | `12h` |
| `SEED_ADMIN_USER` / `SEED_ADMIN_PASS` | server | `superadmin` / `ChangeMe@123` |
| `NEXT_PUBLIC_API_URL` | client | `http://localhost:5000/api` |

## Notes / v1 limits

- Auth is JWT bearer tokens held in `localStorage`, with permissions checked
  server-side on every endpoint. Before exposing this publicly: serve over
  HTTPS, set a strong `JWT_SECRET`, and consider moving the token to an
  httpOnly cookie to harden it against XSS.
- Stock is informational only; sales do not decrement `stockQty` yet.
- PDF export uses the browser print dialog (`window.print`) with a dedicated
  invoice layout.
