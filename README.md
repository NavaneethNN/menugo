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
- [ ] **Phase 2** — Admin Module
- [ ] **Phase 3** — Customer Module
- [ ] **Phase 4** — Realtime Server
- [ ] **Phase 5** — Kitchen Module
- [ ] **Phase 6** — Waiter Module
- [ ] **Phase 7** — Self Collection Mode
- [ ] **Phase 8** — Cashier Module
- [ ] **Phase 9** — End-to-End Testing
- [ ] **Phase 10** — Pilot Deployment
