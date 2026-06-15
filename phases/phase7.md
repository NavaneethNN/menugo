# Phase 7 — Self Collection Mode

> **Goal:** Wire the Self Collection workflow end-to-end. In this mode, the kitchen marks items ready and the customer is notified directly to collect from the counter — no waiter involvement. Verify the customer tracking page handles Self Collection banners correctly and the correct socket events are emitted.
>
> **Prerequisite:** Phase 6 complete (waiter module done, `order:item_ready_for_pickup` event already defined in shared-types and realtime server).
>
> **Note:** Self Collection shares the same API routes and kitchen screens as Managed Dining. This phase is primarily about verifying the routing branches and customer-facing UI, not building new infrastructure.
>
> **Apps in scope:** `apps/api` (verify routing branch), `apps/customer-pwa` (pickup banners), `apps/staff-app` kitchen screen (no waiter step).

---

## Phase 7.1 — API: Verify Self Collection Routing in Order Placement

**What to verify:**
`POST /api/orders` — when `restaurant.workflowMode = SELF_COLLECTION`:
- Emits `order:new` to `restaurant:<id>:kitchen:<kitchenId>` per distinct kitchen (same as Managed Dining).
- Does **NOT** emit `order:new_full` to the waiter room.
- Emits `table:seats_updated` to cashier/admin rooms (same as always).

**Test:** Change the seeded restaurant's `workflowMode` to `SELF_COLLECTION` via the Admin API (`PATCH /api/admin/restaurant/workflow-mode`) or directly in the DB. Place an order. Confirm no waiter event fires.

**File:** `apps/api/src/app/api/orders/route.ts` — verify the `workflowMode` branch. No new code should be needed if Phase 4.4 was done correctly.

---

## Phase 7.2 — API: Verify Self Collection Routing on Item Ready

**What to verify:**
`PATCH /api/order-items/:id/status` → when status becomes `READY` and `workflowMode = SELF_COLLECTION`:

1. Emit `order:item_ready_for_pickup` to `session:<sessionId>` room with payload:
   ```json
   { "orderItemId": "...", "name": "Chicken Biriyani", "kitchenName": "Main Kitchen" }
   ```
2. Recompute `Order.status`.
3. If `Order.status = FULLY_READY` → emit `order:fully_ready` to `session:<sessionId>` room (customer room, NOT waiter room).
4. Do **NOT** emit `order:partially_ready` or `order:fully_ready` to the waiter room.

**File:** `apps/api/src/app/api/order-items/[id]/status/route.ts` — verify the `SELF_COLLECTION` branch in the emit logic.

---

## Phase 7.3 — Customer PWA: Self Collection Pickup Banner

**What to build / verify:**
The customer tracking page already has a Self Collection banner scaffold. Polish and verify it works correctly.

**Banner behaviour:**
- When `order:item_ready_for_pickup` is received via socket: show a **pulsing "Ready for Pickup"** banner for that item, including the kitchen name.
  - e.g., "Your Chicken Biriyani is ready at Main Kitchen — please collect!"
  - Banner uses an animated pulse (CSS `animate-pulse` in Tailwind).
- When `order:fully_ready` is received (all items ready): replace individual banners with a single **"All items ready — collect from the counters"** banner.
- When all items reach `SERVED`: replace with "All collected! Enjoy your meal."

**State management:**
- Track ready-for-pickup items in local React state: `readyItems: Set<orderItemId>`.
- Add to the set on `order:item_ready_for_pickup`.
- Clear on `order:completed`.

**File:** `apps/customer-pwa/src/app/track/[orderId]/page.tsx` — add `readyItems` state + `order:item_ready_for_pickup` socket handler + pickup banner rendering logic.

---

## Phase 7.4 — Customer PWA: Self Collection Kitchen Map (Optional Enhancement)

**What to build:**
A static "Where to collect" section below the item list showing each kitchen name involved in the order and which items to collect there.

**When to implement:** Only if testing reveals customers are confused about where to go.

**Implementation:**
- Group `order.items` by `kitchenName` client-side.
- Render a small card per kitchen: "Main Kitchen — 2x Chicken Biriyani, 1x Naan".
- Highlight cards for kitchens that have at least one `READY` item.

**File:** `apps/customer-pwa/src/app/track/[orderId]/page.tsx` — add kitchen map section below item list.

---

## Phase 7.5 — Kitchen Screen: Verify Self Collection Flow

**What to verify:**
The kitchen screen (built in Phase 5) works identically for Self Collection mode — no changes needed. Verify:

- Kitchen staff sees incoming items (same `order:new` event).
- Accept → Preparing → Ready flow works.
- On "Mark Ready": `order:item_ready_for_pickup` fires to customer (not waiter) — verify in browser console.
- Waiter screen does **not** show any notifications for Self Collection orders.

**Test steps:**
1. Set restaurant `workflowMode = SELF_COLLECTION`.
2. Customer places order.
3. Kitchen marks all items READY.
4. Customer tracking page shows "Ready for Pickup at Main Kitchen" banner.
5. Kitchen marks items SERVED (or cashier closes session).
6. Customer tracking shows "All collected! Enjoy your meal."

---

## Phase 7.6 — API: Self Collection — Mark Item Served (Customer or Kitchen)

**What to build:**
In Self Collection mode, items are marked `SERVED` when the customer collects them. This can be triggered by:
- **Kitchen staff** confirming hand-off (existing `PATCH /api/order-items/:id/status` — `READY → SERVED`). Add this transition.
- (Optional) A "I've collected this" button on the customer tracking page — calls the same endpoint with session token auth.

**Add allowed transition:**
- `READY → SERVED` (allowed for role `KITCHEN` only when `order.workflowMode = SELF_COLLECTION`, or via session token)

**Implementation:**
- Fetch the `Order` (with `workflowMode` field) via the `OrderItem`'s `orderId`.
- If `order.workflowMode === 'SELF_COLLECTION'`, allow `KITCHEN` role to transition `READY → SERVED`.
- If `order.workflowMode === 'MANAGED_DINING'`, reject with `403` — kitchen staff cannot mark served; waiters do this via `PATCH /api/orders/:id/served`.

**File:** `apps/api/src/app/api/order-items/[id]/status/route.ts` — add `READY → SERVED` transition gated by `order.workflowMode === 'SELF_COLLECTION'`.

---

## Phase 7 Completion Checklist

Before moving to Phase 8, verify all of the following:

- [ ] `workflowMode = SELF_COLLECTION` on order placement fires `order:new` to kitchen, NOT to waiter room
- [ ] Item status → READY fires `order:item_ready_for_pickup` to customer session room
- [ ] Item status → READY in Self Collection does NOT fire `order:partially_ready` / `order:fully_ready` to waiter room
- [ ] `order:fully_ready` fires to customer session room (not waiter) when all items ready
- [ ] Customer tracking page shows pulsing "Ready for Pickup" banner per item with kitchen name
- [ ] "All items ready" consolidated banner appears when `order:fully_ready` received
- [ ] `READY → SERVED` transition is valid for kitchen staff in Self Collection mode
- [ ] Waiter dashboard shows zero orders when `workflowMode = SELF_COLLECTION`
- [ ] End-to-end test: order → kitchen ready → customer sees pickup banner → kitchen marks served → customer sees "collected" message
- [ ] Switching back to `MANAGED_DINING` restores waiter routing for new orders (in-flight Self Collection orders unaffected)
- [ ] `pnpm dev` starts all services without error
