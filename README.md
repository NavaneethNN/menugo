# Restaurant Platform — V1 Monorepo

QR-Based Restaurant Ordering & Fulfillment System. See `plan.md` for the full spec.

## Structure

```
/apps
  /customer-pwa      Next.js 14 PWA  (port 3000) — customer QR scan → order → track
  /staff-app         Expo React Native           — kitchen / waiter / cashier / admin
  /api               Next.js 14 API  (port 3001) — all REST endpoints
  /realtime-server   Socket.io       (port 4000) — real-time event bus
/packages
  /db                Prisma schema + PrismaClient singleton
  /shared-types      TypeScript types — enums, models, Socket events, API shapes
```

## Quick Start

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9  (`npm i -g pnpm`)
- PostgreSQL database (Neon recommended)

### 1. Install dependencies
```bash
pnpm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Fill in DATABASE_URL and JWT_SECRET at minimum
```

### 3. Push schema & seed
```bash
pnpm db:generate   # generate Prisma client
pnpm db:push       # push schema to Neon (dev)
pnpm db:seed       # seed one test restaurant
```

Seed creates:
- Restaurant: "Demo Restaurant" (MANAGED_DINING mode)
- 2 kitchens: K1 (Main), K2 (Beverages)
- 3 tables: T1 (4 seats), T2 (6 seats), T3 (2 seats)
- 7 menu items
- 5 staff: Admin PIN=1234, K1 PIN=1111, K2 PIN=2222, Waiter PIN=3333, Cashier PIN=4444

### 4. Run all services
```bash
pnpm dev
```
Turbo runs `dev` in all apps in parallel.

Or run individually:
```bash
pnpm --filter @restaurant/api dev           # :3001
pnpm --filter @restaurant/customer-pwa dev  # :3000
pnpm --filter @restaurant/realtime-server dev # :4000
pnpm --filter @restaurant/staff-app web     # Expo web
```

### 5. Test the customer flow
1. Check table QR tokens: `SELECT "tableNumber", "qrToken" FROM "Table";`
2. Open `http://localhost:3000/scan/<qrToken>`
3. Select party size → browse menu → place order
4. Open `http://localhost:3001` staff app → login as kitchen (PIN 1111) → accept/prepare/ready
5. **Real-time Tracking**: View order status updates instantly on the tracking page

### 6. Real-time Features
- **Order Tracking**: Real-time status updates without polling
- **Kitchen Notifications**: Instant order alerts to relevant kitchen rooms
- **Waiter Alerts**: Order readiness notifications for managed dining
- **Session Management**: Live session status and table availability
- **Reconnection**: Automatic reconnection with visual feedback

### 7. Development Services
- **API Server**: `http://localhost:3001` - REST endpoints with event emission
- **Realtime Server**: `http://localhost:4000` - Socket.io with health endpoint
- **Customer PWA**: `http://localhost:3000` - Progressive web app with real-time tracking
- **Staff App**: Expo web/mobile - Kitchen, waiter, cashier interfaces

## Graphify

`/.graphify.json` contains a full file-map graph of the monorepo including:
- All packages/apps as nodes with descriptions
- Dependency edges between apps and packages
- Data flow diagrams for all 3 workflow modes

Load it in any Graphify-compatible viewer to see the interactive architecture map.

## Deployment

| Service | Target |
|---|---|
| `customer-pwa` | Vercel |
| `api` | Vercel |
| `realtime-server` | Railway / Render |
| `staff-app` (web) | Vercel |
| `staff-app` (native) | Expo EAS |
| Database | Neon (Postgres) |
| Images | Cloudflare R2 |

## Development Phases (from plan.md)

- [x] **Phase 1** — Foundation (monorepo, schema, seed) ✅
- [x] **Phase 2** — Admin Module ✅
- [x] **Phase 3** — Customer Module ✅
- [x] **Phase 4** — Realtime Server ✅
- [x] **Phase 5** — Kitchen Module ✅
- [x] **Phase 6** — Waiter Module ✅
- [x] **Phase 7** — Self Collection Mode ✅
- [x] **Phase 8** — Cashier Module ✅
- [x] **Phase 9** — End-to-End Testing + Hardening ✅
- [ ] **Phase 10** — Pilot Deployment

## Current Status

**✅ All V1 modules complete:**
- Database schema (Prisma + Neon Postgres), migrations, seed script
- Admin Module — menu CRUD, tables/QR generation, kitchen/staff management, workflow mode selector
- Customer PWA — QR scan → seat selection → menu → cart → order → real-time tracking
- Realtime Server — Socket.io with JWT auth, room-based events, `/internal/emit` endpoint
- Kitchen Module — order queue, accept/prepare/ready transitions, sound alerts
- Waiter Module — new-order + ready notifications (Assisted + Managed Dining), mark served
- Self Collection Mode — per-item pickup banners, kitchen marks served directly
- Cashier Module — active sessions view, itemised billing, settle & close, force-clear table
- Login persistence via `expo-secure-store` (Phase 9.7)
- E2E Playwright specs for all three workflow modes (Phases 9.1–9.3)

**� Next:**
- Phase 10 — Deploy to pilot restaurant (Managed Dining first), monitor under live conditions

## Code Quality

- **100% TypeScript** with strict typing throughout
- **Zod validation** on all external inputs
- **bcrypt** PIN hashing, JWT + role auth on every protected endpoint
- **Multi-tenant isolation** — every Prisma query scoped to `restaurantId`
- **Socket events** emitted after every DB mutation via `emitEvent()`
- **No N+1 queries** — all relations loaded via `include`
