# Phase 6 — Waiter Module

> **Goal:** Build the complete Waiter screen in `apps/staff-app` — new order notifications (Assisted Dining), partially/fully ready notifications (Managed Dining), mark-served actions per item or full order, and real-time socket integration.
>
> **Prerequisite:** Phase 5 complete (kitchen module working, `order:partially_ready` and `order:fully_ready` events firing correctly to the waiter room).
>
> **Apps in scope:** `apps/staff-app` `(waiter)` screens + `apps/api` waiter routes.

---

## Phase 6.1 — API: Waiter Orders Endpoint

**What to build:**
`GET /api/waiter/orders` — returns all orders that need waiter attention.

**Auth:** JWT, role = `WAITER`. Extract `restaurantId` from JWT.

**Query logic — return orders where ANY of these conditions is true:**
- `workflowMode = ASSISTED_DINING` AND `order.status = PLACED` (new order, waiter must relay to kitchen)
- `workflowMode = MANAGED_DINING` AND `order.status IN (PARTIALLY_READY, FULLY_READY)` (items ready for pickup/delivery)

**Include per order:**
- `order.id`, `order.status`, `order.createdAt`
- `tableSession.table.tableNumber`
- `items[]`: `menuItemName`, `kitchenName`, `quantity`, `specialInstructions`, `status`

**Sort:** `FULLY_READY` first, then `PARTIALLY_READY`, then `PLACED`. Within each group: oldest first.

**File:** `apps/api/src/app/api/waiter/orders/route.ts` — new file.

---

## Phase 6.2 — API: Mark Order Served

**What to build:**
`PATCH /api/orders/:id/served` — waiter marks an order (or specific items) as served after delivery.

**Auth:** JWT, role = `WAITER`. Verify order belongs to same `restaurantId`.

**Request body (Zod):**
```json
{
  "itemIds": ["id1", "id2"]   // optional — if omitted, mark ALL items in the order
}
```

**Logic:**
1. If `itemIds` provided: set those `OrderItem.status = SERVED`, `servedAt = now()`.
2. If omitted: set ALL items in the order to `SERVED`.
3. Recompute `Order.status` via `computeOrderStatus()`.
4. If all items `SERVED` → `Order.status = COMPLETED`.
5. Emit `order:completed` to `session:<sessionId>` room.

**File:** `apps/api/src/app/api/orders/[id]/served/route.ts` — already scaffolded, verify partial `itemIds` support + emit call.

---

## Phase 6.3 — Staff App: Waiter Dashboard Screen

**What to build:**
Main waiter screen — a live list of orders needing attention, divided into clear sections.

**Screen:** `apps/staff-app/app/(waiter)/index.tsx` — new file.

**Layout:**
- Header: "Orders" + count of actionable orders.
- Sectioned `SectionList` with three sections (only show sections with items):
  1. **"Ready to Serve"** (`FULLY_READY`) — highlighted in green, action: "Mark All Served"
  2. **"Partially Ready"** (`PARTIALLY_READY`) — show which items are ready vs pending
  3. **"New Orders"** (`PLACED`, Assisted Dining only) — show full item list for manual kitchen relay

**Each order card shows:**
- Table number (large)
- Order ID (last 4 chars)
- Time elapsed since order placed (e.g., "12 min ago")
- Items list: each item with name, qty, kitchen label, status badge
- Action button(s):
  - `FULLY_READY` → "Served — Mark All Served" (green, full-width)
  - `PARTIALLY_READY` → "Mark Ready Items Served" (marks only `READY` items as `SERVED`)
  - `PLACED` (Assisted) → "Acknowledged" button (no status change — just removes from view by adding a local "seen" flag)

**Empty state:** "All clear! No pending orders." with a checkmark icon.

**Files:**
- `apps/staff-app/app/(waiter)/index.tsx` — new file
- `apps/staff-app/app/(waiter)/_layout.tsx` — new file, Stack with header + logout

---

## Phase 6.4 — Staff App: Waiter Socket.io Integration

**What to build:**
Connect waiter screen to realtime server for instant notifications.

**Implementation:**
- On mount: connect with auth `{ token: authStore.token }`.
- Join room: `restaurant:<restaurantId>:waiter`.
- Listen for:
  - `order:new_full` (Assisted Dining) → `queryClient.invalidateQueries(['waiter-orders'])` + sound alert
  - `order:partially_ready` → invalidate + update the relevant order card in cache
  - `order:fully_ready` → invalidate + play alert sound
- On unmount: `socket.disconnect()`.

**File:** `apps/staff-app/app/(waiter)/index.tsx` — add socket `useEffect`.

---

## Phase 6.5 — Staff App: Waiter Sound Alert

**What to build:**
Audible alert for `order:fully_ready` and `order:new_full` (Assisted Dining).

**Implementation:**
- Reuse `playNewOrderAlert()` from `apps/staff-app/src/lib/sound.ts` (created in Phase 5.5).
- Optionally: add a second sound `ready-to-serve.mp3` for the "fully ready" event (different tone from kitchen's "new order" sound).
- Add `apps/staff-app/assets/sounds/ready-to-serve.mp3`.

**Files:**
- `apps/staff-app/src/lib/sound.ts` — add `playReadyToServeAlert()` function
- `apps/staff-app/assets/sounds/ready-to-serve.mp3` — add sound asset

---

## Phase 6.6 — Staff App: Waiter Order Detail Screen (Optional)

**What to build:**
Tap an order card → full-screen detail view showing all items with individual "Mark Served" toggles. Useful for large orders with many items from multiple kitchens.

**Screen:** `apps/staff-app/app/(waiter)/order/[id].tsx` — new file.

**Layout:**
- Header: "Order — Table T1" + back button
- Item list with checkboxes (pre-checked for `READY` items, disabled for non-READY)
- "Mark Selected as Served" button
- Shows `kitchenName` per item so waiter knows which counter to pick up from

**Files:**
- `apps/staff-app/app/(waiter)/order/[id].tsx` — new file

---

## Phase 6 Completion Checklist

Before moving to Phase 7, verify all of the following:

- [ ] `GET /api/waiter/orders` returns correct orders per `workflowMode` — only PLACED for Assisted, only PARTIALLY_READY/FULLY_READY for Managed
- [ ] `PATCH /api/orders/:id/served` with no `itemIds` marks all items SERVED
- [ ] `PATCH /api/orders/:id/served` with `itemIds` marks only those items SERVED
- [ ] `Order.status = COMPLETED` after all items are SERVED
- [ ] `order:completed` event fires to customer session room on completion
- [ ] Waiter dashboard shows correct sections based on `workflowMode`
- [ ] "Mark All Served" button on FULLY_READY orders works end-to-end
- [ ] Waiter screen updates instantly when `order:fully_ready` socket event arrives
- [ ] Alert sound plays on new fully-ready order
- [ ] End-to-end Managed Dining test: order placed → kitchen marks all READY → waiter sees "Ready to Serve" → marks served → customer tracking shows "All done!"
- [ ] End-to-end Assisted Dining test: order placed → waiter notified → acknowledges → marks served → customer sees completed
- [ ] Logout works from waiter screen
- [ ] `pnpm dev` starts all services without error
