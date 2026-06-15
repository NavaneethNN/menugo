# Phase 5 — Kitchen Module

> **Goal:** Build the complete Kitchen screen in `apps/staff-app` — incoming order items dashboard, accept/prepare/ready actions, real-time new-order alerts with sound, and connection to the Socket.io server. Test with **Managed Dining** mode first (most complete flow), then verify Self Collection mode works the same way.
>
> **Prerequisite:** Phase 4 complete (realtime server running, `order:new` events fire when orders are placed).
>
> **App in scope:** `apps/staff-app` `(kitchen)` screens + `apps/api` kitchen routes (verify/complete).

---

## Phase 5.1 — API: Kitchen Orders Endpoint

**What to build / verify:**
`GET /api/kitchen/orders` — returns all active `OrderItem`s for the authenticated kitchen staff's `kitchenId`.

**Auth:** JWT, role = `KITCHEN`. Extract `kitchenId` from JWT payload.

**Query logic:**
- Return `OrderItem`s where `kitchenId` matches AND `status` is NOT `SERVED` (i.e., `PENDING`, `ACCEPTED`, `PREPARING`, `READY`).
- Include: `menuItem.name`, `order.id`, `order.tableSession.table.tableNumber`, `quantity`, `specialInstructions`, `status`, `createdAt`.
- Sort: oldest first (`createdAt ASC`) so kitchen works FIFO.

**Response shape:**
```json
[
  {
    "id": "orderItemId",
    "orderId": "...",
    "menuItemName": "Chicken Biriyani",
    "tableNumber": "T1",
    "quantity": 2,
    "specialInstructions": "extra spicy",
    "status": "PENDING",
    "createdAt": "..."
  }
]
```

**File:** `apps/api/src/app/api/kitchen/orders/route.ts` — already scaffolded, verify query includes all fields above + correct status filter.

---

## Phase 5.2 — API: Order Item Status Update

**What to build / verify:**
`PATCH /api/order-items/:id/status` — kitchen staff advances item status.

**Auth:** JWT, role = `KITCHEN`. Verify `orderItem.kitchenId === staff.kitchenId` (kitchen staff can only update items from their own kitchen).

**Allowed transitions:**
- `PENDING → ACCEPTED`
- `ACCEPTED → PREPARING`
- `PREPARING → READY`

Reject any other transition with `400 Bad Request`.

**Logic after update:**
1. Recompute `Order.status` using `computeOrderStatus()` (from `apps/api/src/lib/order-status.ts`).
2. Update `Order.status` in DB if changed.
3. Call `emitEvent()` (from Phase 4.4) with the correct event(s) based on `workflowMode`:
   - Always emit `order_item:status_update` to `session:<sessionId>` room.
   - If `status = READY`:
     - `MANAGED_DINING` + `Order.status = PARTIALLY_READY` → emit `order:partially_ready` to waiter room.
     - `MANAGED_DINING` + `Order.status = FULLY_READY` → emit `order:fully_ready` to waiter room.
     - `SELF_COLLECTION` → emit `order:item_ready_for_pickup` to session room; if `FULLY_READY` also emit `order:fully_ready`.
4. Set `OrderItem.readyAt = now()` when status becomes `READY`.

**File:** `apps/api/src/app/api/order-items/[id]/status/route.ts` — already scaffolded, verify all transition guards + emit calls are present.

---

## Phase 5.3 — Staff App: Kitchen Dashboard Screen

**What to build:**
The main kitchen screen — a live card list of pending/active order items.

**Screen:** `apps/staff-app/app/(kitchen)/index.tsx` — already scaffolded. Verify and complete:

**Layout:**
- Header: "Kitchen Dashboard" + kitchen name (from auth store) + pending item count badge.
- `FlatList` of order item cards sorted oldest-first.
- Each card shows:
  - Menu item name (large, bold)
  - Table number (top-right)
  - Quantity
  - Special instructions (italic, if present)
  - Status badge (color-coded: PENDING=amber, ACCEPTED=blue, PREPARING=orange, READY=green)
  - Action button (context-aware):
    - PENDING → "Accept" (orange button)
    - ACCEPTED → "Start Preparing" (blue button)
    - PREPARING → "Mark Ready" (green button)
    - READY → no button (done, card grays out or is removed)
- Empty state: "No pending orders 🎉" centered message.
- Pull-to-refresh.

**Data:**
- `useQuery` polls `GET /api/kitchen/orders` every **15 seconds** as fallback.
- Socket.io updates in real-time (Phase 5.4) — new items appear instantly.
- `useMutation` for status update → on success invalidate query.

**File:** `apps/staff-app/app/(kitchen)/index.tsx` — already scaffolded, complete/verify all above.

---

## Phase 5.4 — Staff App: Kitchen Socket.io Integration

**What to build:**
Connect the kitchen screen to the realtime server to receive instant new-order notifications.

**Implementation:**
- On mount: connect to `EXPO_PUBLIC_SOCKET_URL` with auth `{ token: authStore.token }`.
- Join room: `restaurant:<restaurantId>:kitchen:<kitchenId>`.
- Listen for `order:new` event → `queryClient.invalidateQueries(['kitchen-orders', kitchenId])` to refresh the list.
- On `order:new`: also trigger an **audible alert** (Phase 5.5).
- On unmount: `socket.disconnect()`.

**File:** `apps/staff-app/app/(kitchen)/index.tsx` — add socket connection in `useEffect`, already has the basic scaffold, extend with auth token + alert trigger.

**Bidirectional `order_item:status_update` (plan.md §10):** When the kitchen staff taps Accept/Preparing/Ready, the status update is sent via the REST API (`PATCH /api/order-items/:id/status`). The API then emits `order_item:status_update` server → customer room. Do **not** emit it directly from the staff app socket — always go through the REST API so the DB is the source of truth. The "bidirectional" in plan.md refers to the kitchen triggering it (via REST) and the customer receiving it (via socket), not a direct socket emit from the staff app.

---

## Phase 5.5 — Staff App: Kitchen Sound Alert

**What to build:**
Play an audible "new order" sound when `order:new` is received while the app is in the foreground or background (background audio only, not push notifications).

**Note on Expo Push Notifications:** True background/lock-screen push notifications via `expo-notifications` are **deferred to post-V1**. The current implementation provides in-app sound via `expo-av` which works when the app is in the foreground or backgrounded (but not fully terminated/locked on iOS). For a pilot deployment with dedicated kitchen tablets kept plugged in and screen-on, this is sufficient.

**Implementation:**
- Add `expo-av` to `apps/staff-app/package.json`.
- Place a short alert sound file at `apps/staff-app/assets/sounds/new-order.mp3` (use any royalty-free beep/ding).
- Create `apps/staff-app/src/lib/sound.ts` — `playNewOrderAlert()` function using `expo-av` `Audio.Sound.createAsync()`.
- Call `playNewOrderAlert()` in the `order:new` socket event handler.
- For background support: configure `Audio.setAudioModeAsync({ playsInSilentModeIOS: true })` on app start in `app/_layout.tsx`.

**Files:**
- `apps/staff-app/package.json` — add `expo-av`
- `apps/staff-app/app/_layout.tsx` — add `Audio.setAudioModeAsync` call on mount
- `apps/staff-app/src/lib/sound.ts` — new file
- `apps/staff-app/assets/sounds/new-order.mp3` — add sound asset

---

## Phase 5.6 — Staff App: Kitchen Order Grouping View (Optional Enhancement)

**What to build:**
Group items by `orderId` so kitchen staff see "Order #1001: 2x Chicken Biriyani" instead of individual flat cards. This matches plan.md §6.2 spec.

**When to implement:** Build this if the flat card list feels confusing in testing. It's a UI enhancement only — no API changes.

**Implementation:**
- Group `OrderItem[]` by `orderId` client-side using `reduce`.
- Each group shows: Order ID (last 4 chars for readability), table number, items list.
- Action buttons remain per-item (each item advances independently).
- Collapse/expand group on tap.

**File:** `apps/staff-app/app/(kitchen)/index.tsx` — refactor `FlatList` to use grouped `SectionList`.

---

## Phase 5.7 — Staff App: Kitchen Header + Logout

**What to build:**
- Kitchen name + role shown in header.
- Logout button → clears Zustand auth store → redirects to `/login`.

**Files:**
- `apps/staff-app/app/(kitchen)/_layout.tsx` — new file, Stack navigator with header showing kitchen name + logout icon button
- `apps/staff-app/src/store/auth.ts` — `clearAuth()` already exists, verify it works with `router.replace('/login')`

---

## Phase 5 Completion Checklist

Before moving to Phase 6, verify all of the following:

- [ ] `GET /api/kitchen/orders` returns only items for the authenticated kitchen's `kitchenId`
- [ ] `GET /api/kitchen/orders` excludes `SERVED` items; includes `PENDING`, `ACCEPTED`, `PREPARING`, `READY`
- [ ] `PATCH /api/order-items/:id/status` blocks cross-kitchen updates (kitchenId mismatch → 403)
- [ ] Only valid status transitions accepted; invalid ones return 400
- [ ] `OrderItem.readyAt` is set when status → `READY`
- [ ] `Order.status` is recomputed after every item status change
- [ ] Correct Socket.io events fired for Managed Dining: `order:partially_ready` / `order:fully_ready` to waiter room
- [ ] Kitchen screen shows all pending items on load
- [ ] Accept → Start Preparing → Mark Ready button flow works end-to-end
- [ ] New order placed from customer PWA appears on kitchen screen **without manual refresh**
- [ ] Audible alert plays when `order:new` is received
- [ ] `Audio.setAudioModeAsync` configured so sound plays in silent mode (iOS)
- [ ] Kitchen screen pull-to-refresh works
- [ ] Logout clears auth store and redirects to login
- [ ] End-to-end test (Managed Dining): customer places order → kitchen accepts → prepares → marks ready → customer tracking page updates in real-time
- [ ] `pnpm dev` starts all services without error

**Post-V1:** Expo Push Notifications for true lock-screen alerts (requires backend push token registry + Expo Push API integration).
