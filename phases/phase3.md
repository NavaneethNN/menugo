# Phase 3 — Customer Module

> **Goal:** Build the complete customer-facing PWA (`apps/customer-pwa`) — QR scan → seat selection → session creation → menu browsing → cart → order placement → order tracking screen. Real-time updates are wired in Phase 4; tracking in this phase uses polling as a fallback.
>
> **Prerequisite:** Phase 2 complete (at minimum, menu items, tables, and categories exist in the DB via the admin module or seed).
>
> **App in scope:** `apps/customer-pwa` (Next.js PWA) + verify/fix any `apps/api` customer-facing routes.

---

## Phase 3.1 — API: Session Creation (QR Scan)

**What to build / verify:**
`POST /api/sessions` — called when a customer scans a QR code.

**Logic (from plan.md §8):**
1. Look up `Table` by `qrToken`.
2. Compute `occupiedSeats = SUM(seatsOccupied WHERE status = ACTIVE)`.
3. If `requestedSeats > availableSeats` → return `409` with `{ error, availableSeats }`.
4. Create `TableSession { tableId, seatsOccupied, status: ACTIVE }`.
5. Generate a short-lived `sessionToken` (signed JWT, 8-hour expiry) containing `sessionId`.
6. Return `{ sessionId, sessionToken, restaurantId, workflowMode, tableNumber }`.

**File:** `apps/api/src/app/api/sessions/route.ts` — already scaffolded, verify full logic is correct.

**Validation (Zod):** `qrToken` string required, `seatsOccupied` integer ≥ 1.

---

## Phase 3.2 — API: Menu Endpoint

**What to build / verify:**
`GET /api/restaurants/:id/menu` — returns categories with their available menu items.

**Response shape:**
```json
{
  "restaurantId": "...",
  "restaurantName": "...",
  "workflowMode": "MANAGED_DINING",
  "categories": [
    {
      "id": "...",
      "name": "Main Course",
      "sortOrder": 0,
      "menuItems": [
        {
          "id": "...",
          "name": "Chicken Biriyani",
          "description": "...",
          "price": "180.00",
          "imageUrl": null,
          "isAvailable": true,
          "kitchenId": "..."
        }
      ]
    }
  ]
}
```

**Rules:** Only include `menuItems` where `isAvailable = true`. Sort categories by `sortOrder`. Sort items by name within each category.

**File:** `apps/api/src/app/api/restaurants/[id]/menu/route.ts` — already scaffolded, verify response shape matches above.

---

## Phase 3.3 — API: Order Placement

**What to build / verify:**
`POST /api/orders` — places an order within an active session.

**Auth:** Validate `sessionToken` JWT (extract `sessionId`). Confirm session is `ACTIVE`.

**Logic:**
1. Verify all `menuItemId`s belong to the same `restaurantId` as the session's table.
2. For each item: read `menuItem.kitchenId` and **copy it** to `OrderItem.kitchenId` (denormalize — never re-read from menu item later).
3. Create `Order` + `OrderItems` with `status = PENDING`.
4. After DB write → emit `order:new` Socket.io event to kitchen room (per kitchen in the order) — skip if realtime server not yet wired; log a TODO.
5. Emit `order:new_full` to waiter room if `workflowMode = ASSISTED_DINING`.
6. Return created `Order` with items.

**File:** `apps/api/src/app/api/orders/route.ts` — already scaffolded, verify denormalization + workflow branching.

**Validation (Zod):** `sessionId` string, `items` array min length 1, each item: `menuItemId`, `quantity` ≥ 1, `specialInstructions` optional string.

**⚠️ Important — Denormalize `workflowMode`:** At order creation time, read `restaurant.workflowMode` and store it directly on the `Order` record. This requires adding a `workflowMode WorkflowMode` column to the `Order` model in `packages/db/prisma/schema.prisma` and running `pnpm db:push`. All downstream routing logic (item status updates, emit calls) must read `order.workflowMode` — never re-read from `restaurant.workflowMode` live — so that mid-service mode changes do not affect in-flight orders.

---

## Phase 3.4 — API: Order Status (Tracking)

**What to build / verify:**
`GET /api/orders/:id` — returns order with all items and their current statuses.

**Response shape:**
```json
{
  "id": "...",
  "status": "PLACED",
  "createdAt": "...",
  "tableNumber": "T1",
  "workflowMode": "MANAGED_DINING",
  "items": [
    {
      "id": "...",
      "menuItemName": "Chicken Biriyani",
      "quantity": 2,
      "specialInstructions": null,
      "status": "PREPARING",
      "kitchenName": "Main Kitchen"
    }
  ]
}
```

**Auth:** Session token (customer) OR staff JWT — either is valid.

**File:** `apps/api/src/app/api/orders/[id]/route.ts` — already scaffolded, verify response includes `tableNumber`, `workflowMode`, `kitchenName` per item.

---

## Phase 3.5 — Customer PWA: Scan Page (`/scan/[token]`)

**What to build / verify:**
The entry point after a QR scan. Already scaffolded — verify and polish.

**Behaviour:**
- Display "Welcome! How many people are dining today?" with a +/− counter.
- On submit: `POST /api/sessions` with `{ qrToken: token, seatsOccupied }`.
- On `409`: show "Table Full — only N seats available."
- On success: store `sessionId`, `sessionToken`, `restaurantId`, `workflowMode`, `tableNumber` in `sessionStorage`. Navigate to `/menu/[restaurantId]`.

**File:** `apps/customer-pwa/src/app/scan/[token]/page.tsx` — already scaffolded, verify all edge cases (table full, network error, loading state).

---

## Phase 3.6 — Customer PWA: Menu Page (`/menu/[restaurantId]`)

**What to build / verify:**
Menu browsing + cart + order placement. Already scaffolded — verify and polish.

**Behaviour:**
- Fetch menu from `GET /api/restaurants/:id/menu` via TanStack Query.
- Render categories as sticky section headers; items as cards with image, name, description, price.
- Unavailable items are hidden (API already filters them).
- Cart: floating bottom bar showing item count + total price. Add/remove per item.
- "Place Order" button: `POST /api/orders`. On success: clear cart, navigate to `/track/[orderId]`.
- Guard: if `sessionStorage` is empty (session expired / direct URL access) → redirect to home with a message.

**File:** `apps/customer-pwa/src/app/menu/[restaurantId]/page.tsx` — already scaffolded, verify session guard + cart state + error handling.

**UX details:**
- Show a skeleton loader while menu loads.
- Sticky category header scrolls with the page.
- Price formatted as `₹180.00`.

---

## Phase 3.7 — Customer PWA: Order Tracking Page (`/track/[orderId]`)

**What to build / verify:**
Live order tracking. Already scaffolded — polish and ensure all three workflow modes render correctly.

**Behaviour:**
- Fetch order from `GET /api/orders/:id` — poll every 10 seconds as fallback (Socket.io wired in Phase 4).
- Render each `OrderItem` as a status card: item name, quantity, status badge with colour.
- Status badge colours:
  - `PENDING` → gray
  - `ACCEPTED` → blue
  - `PREPARING` → orange
  - `READY` → green
  - `SERVED` → brand (dark orange)
- **Banners by workflowMode:**
  - `ASSISTED_DINING`: single "Order received — your server will bring it shortly" banner.
  - `MANAGED_DINING`: "Partially Ready" / "Fully Ready" banner based on `order.status`.
  - `SELF_COLLECTION`: "Ready for Pickup at [Kitchen Name]" banner (pulsing) when any item is `READY`.
- "Order another round" button — navigates back to `/menu/[restaurantId]`.
- All-served state: "All done! Enjoy your meal." celebration banner.

**File:** `apps/customer-pwa/src/app/track/[orderId]/page.tsx` — already scaffolded, verify all three workflow mode banners + correct status colours.

---

## Phase 3.8 — Customer PWA: PWA Config + Meta

**What to build:**
Ensure the PWA is installable and has correct metadata.

**Items:**
- `apps/customer-pwa/public/manifest.json` — already created. Verify: `name`, `short_name`, `start_url`, `display: standalone`, `theme_color: #f97316`, icons array (at minimum 192×192 and 512×512 placeholder icons).
- `apps/customer-pwa/public/icons/` — add placeholder icon PNGs (192×192, 512×512). Can be simple orange squares for V1.
- `apps/customer-pwa/src/app/layout.tsx` — verify `<meta name="apple-mobile-web-app-capable">`, viewport `maximum-scale=1`.
- Test: open `http://localhost:3000/scan/<any-qr-token>` on mobile browser — browser should prompt "Add to Home Screen".

**Files:**
- `apps/customer-pwa/public/manifest.json` — verify/update
- `apps/customer-pwa/src/app/layout.tsx` — verify metadata export

---

## Phase 3 Completion Checklist

Before moving to Phase 4, verify all of the following:

- [ ] `POST /api/sessions` correctly enforces seat availability and returns `sessionToken`
- [ ] `GET /api/restaurants/:id/menu` returns only `isAvailable = true` items, sorted correctly
- [ ] `POST /api/orders` copies `kitchenId` from `MenuItem` to `OrderItem` at creation time
- [ ] `POST /api/orders` copies `workflowMode` from `Restaurant` onto `Order` at creation time
- [ ] `packages/db/prisma/schema.prisma` has `workflowMode` column on `Order` model; `pnpm db:push` run successfully
- [ ] `GET /api/orders/:id` response includes `tableNumber`, `workflowMode`, `kitchenName` per item
- [ ] Scan page handles table-full `409` gracefully
- [ ] Menu page guards against missing session (expired / direct URL access)
- [ ] Cart total and item count update instantly on add/remove
- [ ] Order placement navigates to tracking page with correct `orderId`
- [ ] Tracking page polls every 10s and updates status cards
- [ ] All three `workflowMode` banners render correctly on tracking page
- [ ] "Order another round" button returns to menu within same session
- [ ] `manifest.json` is valid and PWA prompt appears on mobile
- [ ] All pages are mobile-first, usable on a 375px wide screen
- [ ] `pnpm dev` still starts all services without error
