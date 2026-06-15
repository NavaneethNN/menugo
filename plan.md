# QR-Based Restaurant Ordering & Fulfillment System
## Version 1 (V1) — Complete Project Specification

This document is a complete functional and technical specification for V1 of the product. It is written to be self-contained so that any AI model or developer can pick it up and build from it without needing additional context.

---

## 1. Project Summary

A multi-tenant SaaS platform that lets restaurants offer QR-code-based ordering to customers, route orders to one or more kitchens, track preparation status item-by-item, and notify staff (waiters or customers, depending on the restaurant's chosen workflow mode) when food is ready.

The platform supports **multiple restaurants** (tenants), each configured independently with their own menu, tables, kitchens, staff, and operating mode.

V1 explicitly **excludes** billing/invoicing and online payments. Bill settlement is handled manually by a cashier who views ordered items on-screen and collects payment outside the system (cash/card via existing terminal). The system's only role is to mark the session as settled and free up the table seats.

---

## 2. Glossary / Key Terminology

- **Restaurant** — a tenant on the platform. Has its own menu, tables, kitchens, staff, and workflow mode.
- **Table** — a physical table with a fixed seat capacity and a unique QR code.
- **Table Session** — created when a customer scans the QR and enters a party size. Represents one group's occupancy of a subset of the table's seats. Multiple sessions can be active on the same table simultaneously (seat-based sharing).
- **Order** — a set of items placed by a customer within a session. A session can have multiple orders (customer can order more than once).
- **Order Item** — a single line item within an order, with quantity, special instructions, and an assigned kitchen.
- **Kitchen** — a preparation station (e.g., K1 = Biriyani/Fried Rice, K2 = Dosa/Parotta, K3 = Beverages). Each menu item is mapped to exactly one kitchen.
- **Workflow Mode** — per-restaurant configuration that determines how orders are routed after placement. Three modes:
  - **Assisted Dining** — Customer → Waiter → Kitchen (manual, no app) → Waiter → Customer
  - **Managed Dining** — Customer → Kitchen (app) → Waiter → Customer
  - **Self Collection** — Customer → Kitchen (app) → Customer (pickup)
- **Cashier/Counter View** — staff screen showing all items ordered across all sessions of a table, used for manual billing. Closing a session here releases its seats.

---

## 3. Tech Stack

### 3.1 Frontend — Customer Ordering App
- **Framework:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Form factor:** Mobile-first Progressive Web App (PWA) — installable, but works instantly in any mobile browser after QR scan. No app store install required for customers.
- **State/data fetching:** React Query (TanStack Query) for REST calls, native WebSocket client (or socket.io-client) for live order status.

### 3.2 Frontend — Staff Apps (Kitchen, Waiter, Cashier, Admin)
- **Framework:** React Native + Expo (managed workflow)
- **Platforms:** iOS, Android, and Web (via `expo export:web` / Expo Router web support) — single codebase for all three.
- **Rationale:** Staff devices are dedicated tablets/phones that benefit from persistent login, push notifications, and audible alerts (kitchen/waiter need sound even when the screen is locked). Expo gives native notification support while still producing a web build for staff who prefer a browser/desktop.
- **Admin module note:** Admin can be the same Expo/React Native codebase (web build) since restaurant owners will mostly use it on desktop, OR a separate Next.js dashboard if you prefer richer desktop UI later. For V1, build it inside the same Expo app to avoid maintaining two codebases.

### 3.3 Backend
- **API:** Next.js API Routes (or a standalone Node.js + Express/Fastify service — Next.js API routes are sufficient for V1 and keep one deployable unit)
- **Language:** TypeScript throughout (frontend, backend, shared types)
- **ORM:** Prisma
- **Database:** PostgreSQL via Neon (serverless Postgres — already in use)

### 3.4 Real-Time Layer
- **Requirement:** Order status changes (item ready, fully ready, new order, session closed) must push instantly to Kitchen, Waiter, Cashier, and Customer screens — polling is not acceptable for this product.
- **Recommended approach for V1:** A small dedicated **Socket.io server** (Node.js + TypeScript), deployed separately from the main app (e.g., Railway or Render, since Vercel serverless functions cannot hold persistent WebSocket connections).
- **Simpler alternative (if you want to avoid running a second service):** Use a managed real-time service such as **Supabase Realtime** (Postgres change-data-capture — pairs naturally with your Postgres DB) or **Ably**. This removes the need to host/maintain a socket server but adds a third-party dependency and cost at scale.
- **Decision for this spec:** Build with a self-hosted Socket.io server. It gives full control over event shapes (defined in Section 10) and keeps cost near-zero for a pilot.

### 3.5 Notifications
- **Staff apps (Expo/React Native):** Expo push notifications + in-app sound/vibration for "new order" and "item ready" events, even when app is backgrounded.
- **Customer PWA:** No push required for V1 — the customer keeps the order-tracking page open in their browser and receives live updates via WebSocket. Web Push can be added later if needed.

### 3.6 File Storage
- **Cloudflare R2** for menu item images (already used in other projects — zero egress fees).

### 3.7 QR Code Generation
- **Library:** `qrcode` (npm) — generate a QR code per table encoding a unique `table_token` + `restaurant_id`. Admin can download/print these from the Admin module.

### 3.8 Authentication
- **Staff (Admin, Kitchen, Waiter, Cashier):** Email/PIN-based login using NextAuth (or a simple JWT scheme) — each staff account belongs to one restaurant and has a role.
- **Customer:** No login. Identity is the **table session** — created on QR scan, referenced via a session token stored in the browser (e.g., in a short-lived cookie or URL param) for the duration of their visit.

### 3.9 Hosting Summary
| Component | Hosting |
|---|---|
| Customer PWA (Next.js) | Vercel |
| Admin/Kitchen/Waiter/Cashier (Expo web build) + native apps | Vercel (web build) + Expo EAS (app builds for iOS/Android) |
| Backend API (Next.js API routes) | Vercel |
| Real-time Socket.io server | Railway or Render |
| Database | Neon (Postgres) |
| Images | Cloudflare R2 |

---

## 4. Multi-Tenancy Model

Every table, menu item, order, staff account, kitchen, etc. is scoped to a `restaurantId`. There is no cross-restaurant data sharing. A super-admin (you, the platform owner) can have a separate elevated role to onboard new restaurants — but this can be a manual/seed-script process in V1 rather than a full self-serve signup flow.

---

## 5. Database Schema (Prisma)

```prisma
// ---------- ENUMS ----------

enum WorkflowMode {
  ASSISTED_DINING   // Customer -> Waiter -> Kitchen(manual) -> Waiter -> Customer
  MANAGED_DINING    // Customer -> Kitchen -> Waiter -> Customer
  SELF_COLLECTION   // Customer -> Kitchen -> Customer
}

enum StaffRole {
  ADMIN
  KITCHEN
  WAITER
  CASHIER
}

enum SessionStatus {
  ACTIVE
  CLOSED
}

enum OrderItemStatus {
  PENDING     // placed, not yet accepted by kitchen
  ACCEPTED    // kitchen accepted (Managed Dining / Self Collection only)
  PREPARING
  READY
  SERVED      // delivered to customer (or picked up, in Self Collection)
}

enum OrderStatus {
  PLACED
  PARTIALLY_READY
  FULLY_READY
  COMPLETED   // all items served/picked up
}

// ---------- CORE MODELS ----------

model Restaurant {
  id            String        @id @default(cuid())
  name          String
  workflowMode  WorkflowMode  @default(MANAGED_DINING)
  createdAt     DateTime      @default(now())

  tables        Table[]
  categories    Category[]
  kitchens      Kitchen[]
  menuItems     MenuItem[]
  staff         Staff[]
}

model Table {
  id            String   @id @default(cuid())
  restaurantId  String
  restaurant    Restaurant @relation(fields: [restaurantId], references: [id])
  tableNumber   String
  totalSeats    Int
  qrToken       String   @unique   // encoded in QR code

  sessions      TableSession[]

  @@unique([restaurantId, tableNumber])
}

model TableSession {
  id            String        @id @default(cuid())
  tableId       String
  table         Table         @relation(fields: [tableId], references: [id])
  seatsOccupied Int
  status        SessionStatus @default(ACTIVE)
  startedAt     DateTime      @default(now())
  closedAt      DateTime?
  closedBy      String?       // "cashier" | "auto_expiry" | "customer"

  orders        Order[]
}

model Category {
  id            String   @id @default(cuid())
  restaurantId  String
  restaurant    Restaurant @relation(fields: [restaurantId], references: [id])
  name          String
  sortOrder     Int      @default(0)

  menuItems     MenuItem[]
}

model Kitchen {
  id            String   @id @default(cuid())
  restaurantId  String
  restaurant    Restaurant @relation(fields: [restaurantId], references: [id])
  name          String   // e.g. "K1", "Beverage Counter"

  menuItems     MenuItem[]
  orderItems    OrderItem[]
  staff         Staff[]
}

model MenuItem {
  id            String   @id @default(cuid())
  restaurantId  String
  restaurant    Restaurant @relation(fields: [restaurantId], references: [id])
  categoryId    String
  category      Category @relation(fields: [categoryId], references: [id])
  kitchenId     String
  kitchen       Kitchen  @relation(fields: [kitchenId], references: [id])

  name          String
  description   String?
  price         Decimal
  imageUrl      String?
  isAvailable   Boolean  @default(true)

  orderItems    OrderItem[]
}

model Staff {
  id            String    @id @default(cuid())
  restaurantId  String
  restaurant    Restaurant @relation(fields: [restaurantId], references: [id])
  name          String
  role          StaffRole
  pin           String     // simple PIN login for V1
  kitchenId     String?    // only set if role = KITCHEN, ties staff to a specific kitchen
  kitchen       Kitchen?   @relation(fields: [kitchenId], references: [id])
  isActive      Boolean    @default(true)
}

model Order {
  id              String       @id @default(cuid())
  tableSessionId  String
  tableSession    TableSession @relation(fields: [tableSessionId], references: [id])
  status          OrderStatus  @default(PLACED)
  createdAt       DateTime     @default(now())

  items           OrderItem[]
}

model OrderItem {
  id                String           @id @default(cuid())
  orderId           String
  order             Order            @relation(fields: [orderId], references: [id])
  menuItemId        String
  menuItem          MenuItem         @relation(fields: [menuItemId], references: [id])
  kitchenId         String
  kitchen           Kitchen          @relation(fields: [kitchenId], references: [id])

  quantity          Int
  specialInstructions String?
  status            OrderItemStatus  @default(PENDING)
  readyAt           DateTime?
  servedAt          DateTime?
}
```

**Notes on the schema:**

- `OrderItem.kitchenId` is **denormalized** from `MenuItem.kitchenId` at order-creation time. This is intentional — if an admin reassigns a menu item to a different kitchen later, in-flight orders should not retroactively change which kitchen sees them.
- `Order.status` is a **derived/aggregated** field, recomputed by the backend whenever an `OrderItem.status` changes (see Section 9 for the exact logic).
- `TableSession.seatsOccupied` is used to compute table availability: `availableSeats = table.totalSeats - SUM(seatsOccupied WHERE status = ACTIVE)`.
- No `Bill`, `Payment`, or `Invoice` models exist in V1 by design.

---

## 6. Module-by-Module Specification

### 6.1 Customer Module (Next.js PWA)

**Entry flow:**
1. Customer scans table QR code → opens URL containing `qrToken`.
2. App checks available seats for that table.
   - If `requestedSeats <= availableSeats` → prompt "How many people?" → create `TableSession` → proceed to menu.
   - If not enough seats available → show **"Table Full"** message with a note to ask staff for assistance.
3. Menu screen: items grouped by category, with image, price, description, availability (out-of-stock items shown greyed out / hidden based on admin setting).
4. Cart: add/remove items, set quantity, optional free-text "special instructions" per item.
5. Place order → creates `Order` + `OrderItem`s (each item stamped with its `kitchenId` from the menu item).
6. Order tracking screen: shows live status per item (Pending → Preparing → Ready → Served), updated via WebSocket. Display adapts based on `workflowMode`:
   - **Assisted Dining:** simple "Order received, your server will bring it shortly" + status updates to "Served."
   - **Managed Dining:** per-kitchen item status, "Partially Ready" / "Fully Ready" banner.
   - **Self Collection:** per-kitchen item status, plus a prominent **"Ready for Pickup"** banner with counter/kitchen name when items are ready.
7. Customer can place additional orders within the same session (repeat from step 3).

### 6.2 Kitchen Module (Expo app)

- Used in **Managed Dining** and **Self Collection** modes only. Not used in Assisted Dining.
- Staff logs in with PIN; account is tied to a specific `kitchenId`.
- Dashboard shows incoming `OrderItem`s where `kitchenId` matches, grouped by `Order` (so kitchen staff see "Order #1001: 2x Chicken Biriyani" even if other items in the same order belong to other kitchens).
- Actions per item: **Accept** (PENDING → ACCEPTED), **Start Preparing** (ACCEPTED → PREPARING), **Mark Ready** (PREPARING → READY).
- New incoming items trigger an audible alert.
- On marking an item READY, backend recomputes the parent `Order.status` and fires the appropriate real-time event (see Section 9 and 10).

### 6.3 Waiter Module (Expo app)

- Used in **Assisted Dining** and **Managed Dining** modes only. Not used in Self Collection.
- **In Assisted Dining:** receives a "New Order" notification immediately on order placement, showing the full item list (with kitchen labels for reference, even though kitchens don't use the app). Waiter relays the order to the kitchen verbally/manually. When food is brought out, waiter marks the order **"Served"** (sets all `OrderItem.status = SERVED`, `Order.status = COMPLETED`).
- **In Managed Dining:** receives:
  - "Partially Ready" notification — shows which items are ready now and which are still pending, for a given order/table.
  - "Fully Ready" notification — all items for that order are ready; waiter picks up everything and delivers in one trip.
  - Marks items as **Served** individually or the whole order at once after delivery.

### 6.4 Cashier / Counter Module (Expo app)

- Shows all **active table sessions**, grouped by table.
- For each session: list of all items ordered (across multiple `Order`s within that session) with quantities — for manual bill calculation outside the system.
- **"Settle & Close Session"** button: sets `TableSession.status = CLOSED`, `closedAt = now()`, `closedBy = "cashier"`. This immediately frees the seats (`seatsOccupied` no longer counted toward table capacity).
- Sessions are closed **independently** — multiple groups at the same table settle on their own schedules.
- Optional admin/staff override: "Force Clear Table" — closes all active sessions for a table (for end-of-day cleanup or abandoned sessions).

### 6.5 Admin Module (Expo app, web build prioritized)

- **Menu management:** CRUD for categories and menu items (name, price, description, image upload to R2, category, kitchen assignment, availability toggle).
- **Table management:** create tables (table number, seat capacity), generate/download QR codes.
- **Kitchen management:** create kitchens, view items assigned to each.
- **Staff management:** create staff accounts (name, role, PIN, and kitchen assignment if role = KITCHEN).
- **Workflow configuration:** select `workflowMode` for the restaurant (Assisted Dining / Managed Dining / Self Collection). Changing this immediately changes routing for all *new* orders (in-flight orders keep their original routing).
- **Session monitoring (optional but useful):** live view of all active sessions per table, with manual "Force Clear" action.

---

## 7. Workflow Mode Routing Logic (Pseudocode)

```text
ON order placed (Order created with OrderItems):

  IF restaurant.workflowMode == ASSISTED_DINING:
      notify(role=WAITER, restaurantId, tableId, event="NEW_ORDER", payload=full item list)
      // No kitchen routing. Order.status stays PLACED until waiter marks COMPLETED.

  IF restaurant.workflowMode == MANAGED_DINING:
      FOR EACH distinct kitchenId in order.items:
          notify(role=KITCHEN, kitchenId, event="NEW_ORDER_ITEMS", payload=items for that kitchen)
      // Waiter notified only when items become READY (see Section 9).

  IF restaurant.workflowMode == SELF_COLLECTION:
      FOR EACH distinct kitchenId in order.items:
          notify(role=KITCHEN, kitchenId, event="NEW_ORDER_ITEMS", payload=items for that kitchen)
      // Customer notified directly when items become READY (see Section 9).


ON OrderItem.status -> READY (Managed Dining / Self Collection):

  recompute Order.status (see Section 9)

  IF restaurant.workflowMode == MANAGED_DINING:
      IF Order.status == PARTIALLY_READY:
          notify(role=WAITER, event="ORDER_PARTIALLY_READY", payload={readyItems, pendingItems})
      IF Order.status == FULLY_READY:
          notify(role=WAITER, event="ORDER_FULLY_READY", payload={allItems})

  IF restaurant.workflowMode == SELF_COLLECTION:
      notify(customer session, event="ITEM_READY_FOR_PICKUP", payload={item, kitchenName})
      IF Order.status == FULLY_READY:
          notify(customer session, event="ORDER_FULLY_READY_FOR_PICKUP")


ON Order marked COMPLETED (waiter "Served" action, or cashier closes session):
  -> update customer-facing tracking screen to "Completed"
```

---

## 8. Seat-Based Table Session Logic

```text
ON QR scan with requested party size N:

  activeSessions = TableSession.where(tableId, status = ACTIVE)
  occupiedSeats  = SUM(activeSessions.seatsOccupied)
  availableSeats = table.totalSeats - occupiedSeats

  IF N <= availableSeats:
      CREATE TableSession { tableId, seatsOccupied: N, status: ACTIVE }
      -> proceed to menu
  ELSE:
      -> show "Table Full" message


ON Cashier "Settle & Close Session":
  UPDATE TableSession SET status = CLOSED, closedAt = now(), closedBy = "cashier"
  -> seats immediately become available for new sessions


AUTO-EXPIRY (background job, runs every N minutes, configurable per restaurant, default 90 min):
  FOR EACH ACTIVE session WHERE no new Order created in last N minutes
  AND all OrderItems in status SERVED/COMPLETED:
      flag session for staff review (do NOT auto-close silently — surface in
      Admin/Cashier view as "Inactive — consider clearing")
```

> Note: Auto-expiry intentionally **flags rather than silently closes** sessions in V1, to avoid accidentally freeing seats for a group that's still seated but hasn't ordered recently. Staff/cashier makes the final call via "Force Clear."

---

## 9. Order Status Aggregation Logic

`Order.status` is recomputed every time any of its `OrderItem.status` values change:

```text
items = order.items (all OrderItems for this Order)

IF ALL items.status == SERVED:
    order.status = COMPLETED
ELSE IF ALL items.status == READY (or SERVED):
    order.status = FULLY_READY
ELSE IF ANY items.status == READY:
    order.status = PARTIALLY_READY
ELSE:
    order.status = PLACED
```

This logic directly implements the Order #1001 example (Sprite ready first → PARTIALLY_READY → notify waiter with ready/pending split; Biriyani ready later → FULLY_READY → notify waiter "fully ready").

---

## 10. Real-Time Event Specification (Socket.io)

All events are scoped by `restaurantId` (rooms). Staff clients join rooms based on role (and `kitchenId` for kitchen staff). Customer clients join a room scoped to their `tableSessionId`.

| Event Name | Direction | Payload | Consumed By |
|---|---|---|---|
| `order:new` | server → kitchen room | `{ orderId, tableNumber, items: [{orderItemId, name, qty, specialInstructions}] }` | Kitchen (Managed/Self Collection) |
| `order:new_full` | server → waiter room | `{ orderId, tableNumber, items: [...] }` | Waiter (Assisted Dining) |
| `order_item:status_update` | bidirectional | `{ orderItemId, status }` | Kitchen → server; server → Customer |
| `order:partially_ready` | server → waiter room | `{ orderId, tableNumber, readyItems: [...], pendingItems: [...] }` | Waiter (Managed Dining) |
| `order:fully_ready` | server → waiter room (Managed) or customer room (Self Collection) | `{ orderId, tableNumber, items: [...] }` | Waiter / Customer |
| `order:item_ready_for_pickup` | server → customer room | `{ orderItemId, name, kitchenName }` | Customer (Self Collection) |
| `order:completed` | server → customer room | `{ orderId }` | Customer |
| `session:closed` | server → customer room (force-disconnect) | `{ tableSessionId }` | Customer |
| `table:seats_updated` | server → admin/cashier room | `{ tableId, availableSeats }` | Admin/Cashier (for live "table full" status display) |

---

## 11. REST API Endpoint Summary

```
# Customer-facing (no auth — session-token based)
POST   /api/sessions                  -> create TableSession (QR scan + party size)
GET    /api/restaurants/:id/menu      -> categories + menu items (filtered to isAvailable)
POST   /api/orders                    -> place an order (items + sessionId)
GET    /api/orders/:id                -> order status (for tracking screen)

# Kitchen (auth: STAFF role=KITCHEN)
GET    /api/kitchen/orders            -> pending/active order items for this kitchen
PATCH  /api/order-items/:id/status    -> update item status (accepted/preparing/ready)

# Waiter (auth: STAFF role=WAITER)
GET    /api/waiter/orders             -> orders needing attention (new / partially ready / fully ready)
PATCH  /api/orders/:id/served         -> mark order (or specific items) as served

# Cashier (auth: STAFF role=CASHIER)
GET    /api/cashier/tables            -> active tables with sessions + ordered items
PATCH  /api/sessions/:id/close        -> settle & close a session
PATCH  /api/tables/:id/force-clear    -> close all active sessions for a table

# Admin (auth: STAFF role=ADMIN)
CRUD   /api/admin/categories
CRUD   /api/admin/menu-items
CRUD   /api/admin/tables
CRUD   /api/admin/kitchens
CRUD   /api/admin/staff
PATCH  /api/admin/restaurant/workflow-mode
GET    /api/admin/sessions            -> all sessions (active/closed) for monitoring
```

---

## 12. Suggested Repository Structure (Monorepo)

```
/apps
  /customer-pwa        -> Next.js PWA (customer ordering + tracking)
  /staff-app           -> Expo app (Admin, Kitchen, Waiter, Cashier — role-based navigation)
  /api                 -> Next.js API routes (or standalone Node service)
  /realtime-server     -> Socket.io server (deployed separately)
/packages
  /db                  -> Prisma schema + client (shared by /api and /realtime-server)
  /shared-types        -> TypeScript types for Order, OrderItem, events, etc. (shared across all apps)
```

Using a shared `shared-types` package ensures the event payloads in Section 10 and the API shapes in Section 11 stay consistent across the customer PWA, staff app, API, and realtime server — important when multiple AI-assisted sessions or developers work on different apps independently.

---

## 13. Development Phases

**Phase 1 — Foundation**
Set up monorepo, Prisma schema (Section 5), Neon database, seed script for one test restaurant with 2 kitchens, 3 tables, sample menu.

**Phase 2 — Admin Module**
Menu CRUD, table/QR generation, kitchen setup, staff accounts, workflow mode selector. This must come first since every other module depends on this data existing.

**Phase 3 — Customer Module**
QR scan → session creation (seat logic from Section 8) → menu browsing → cart → place order → tracking screen (initially with polling, before real-time is wired in).

**Phase 4 — Realtime Server**
Stand up Socket.io server, define rooms/auth, implement events from Section 10. Wire customer tracking screen to live updates.

**Phase 5 — Kitchen Module**
Dashboard, accept/prepare/ready actions, sound alerts. Test with Managed Dining mode first (most complete flow).

**Phase 6 — Waiter Module**
Partially-ready / fully-ready notifications (Managed Dining), full-order notification (Assisted Dining), mark-served actions.

**Phase 7 — Self Collection Mode**
Wire kitchen-ready events directly to customer tracking screen (pickup banner), skip waiter routing.

**Phase 8 — Cashier Module**
Active sessions/table view, settle & close session, force-clear table, seat-availability recalculation.

**Phase 9 — Workflow Mode Switch + End-to-End Testing**
Verify all three modes route correctly for the same restaurant by toggling `workflowMode` in Admin and placing test orders through each.

**Phase 10 — Pilot Deployment**
Deploy to one real restaurant (start with Managed Dining), monitor real-time reliability under live conditions, gather staff feedback before wider rollout.

---

## 14. Explicitly Out of Scope for V1

- Billing, invoicing, GST/VAT calculation
- Online/in-app payments
- Item modifiers/add-ons beyond a free-text "special instructions" field
- Analytics/reporting dashboards
- KOT thermal printer integration
- Multi-language menus
- Loyalty/membership/discount systems
- "Call waiter" button (independent of order flow)
- Self-serve restaurant signup/onboarding (new restaurants are added manually/via seed script)

---

## 15. Notes for AI-Assisted Development

- Always check `restaurant.workflowMode` before implementing any notification/routing logic — three modes share the same data model but branch at the routing layer (Section 7).
- `OrderItem.kitchenId` must be copied from `MenuItem.kitchenId` at order creation time — never read it live from the menu item during order processing.
- Seat availability (`availableSeats`) must always be computed from `ACTIVE` sessions only — `CLOSED` sessions do not count.
- `Order.status` is never set directly by client actions — it is always recomputed server-side from its `OrderItem` statuses (Section 9) to avoid inconsistent states.
- Real-time events and REST responses for the same entity (e.g., `Order`) should use the shared types defined in `/packages/shared-types` to avoid drift between the Socket.io server and API routes.