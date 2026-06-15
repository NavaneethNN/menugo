# Phase 4 — Realtime Server

> **Goal:** Stand up and fully wire the Socket.io realtime layer. Replace the polling fallback in the customer tracking page with live WebSocket updates. Ensure all rooms, events, and auth defined in plan.md §10 are implemented correctly.
>
> **Prerequisite:** Phase 3 complete (customer flow works end-to-end with polling).
>
> **Apps in scope:** `apps/realtime-server` (Socket.io server) + `apps/api` (emit events after DB writes) + `apps/customer-pwa` (replace polling with socket listener).

---

## Phase 4.1 — Realtime Server: Room Architecture

**What to build:**
Define and implement all Socket.io rooms that match plan.md §10.

**Room naming convention:**
| Room | Who joins | Purpose |
|---|---|---|
| `session:<sessionId>` | Customer browser | Order status updates for this session |
| `restaurant:<restaurantId>:kitchen:<kitchenId>` | Kitchen staff (that kitchen only) | New order items for this kitchen |
| `restaurant:<restaurantId>:waiter` | Waiter staff | Partial/full-ready + new order (Assisted) |
| `restaurant:<restaurantId>:cashier` | Cashier staff | Session closed / seats updated |
| `restaurant:<restaurantId>:admin` | Admin staff | Session monitoring |

**Implementation:**
- On `join_room` event: validate the room name format, then call `socket.join(roomId)`.
- Add a `join_rooms` event (plural) so a client can join multiple rooms in one call (useful for staff with multiple roles or monitoring).
- Log all room joins/leaves with `socket.id` and room name.

**File:** `apps/realtime-server/src/index.ts` — already scaffolded with basic `join_room`. Extend with all room types + auth middleware.

---

## Phase 4.2 — Realtime Server: Auth Middleware

**What to build:**
Validate JWT tokens on socket connection so only authenticated staff can join staff rooms. Customers connecting to `session:*` rooms do not need a JWT (session token is enough).

**Implementation:**
- `io.use()` middleware: read `socket.handshake.auth.token`.
- If token present: verify JWT (same `JWT_SECRET` as API). Attach decoded payload to `socket.data` (`staffId`, `role`, `restaurantId`, `kitchenId`).
- If no token: allow connection (customer) but restrict which rooms they can join (only `session:*`).
- On `join_room`: enforce room access rules:
  - `session:*` → anyone allowed
  - `restaurant:*:kitchen:*` → must be authenticated, role = `KITCHEN`, `kitchenId` must match
  - `restaurant:*:waiter` → role = `WAITER`
  - `restaurant:*:cashier` → role = `CASHIER`
  - `restaurant:*:admin` → role = `ADMIN`

**Files:**
- `apps/realtime-server/src/index.ts` — add `io.use()` auth middleware + room access guard in `join_room` handler
- `apps/realtime-server/src/lib/auth.ts` — `verifyToken(token: string)` helper (reuse same logic as `apps/api/src/lib/auth.ts`)

---

## Phase 4.3 — Realtime Server: All Event Handlers

**What to build:**
Implement all events from plan.md §10 on the server side.

**Events the server emits (triggered by API via HTTP call or direct import):**

| Event | Emitted to room | Trigger |
|---|---|---|
| `order:new` | `restaurant:<id>:kitchen:<kitchenId>` | New order placed (Managed/Self Collection) |
| `order:new_full` | `restaurant:<id>:waiter` | New order placed (Assisted Dining) |
| `order:partially_ready` | `restaurant:<id>:waiter` | Item goes READY, order = PARTIALLY_READY |
| `order:fully_ready` | `restaurant:<id>:waiter` OR `session:<sessionId>` | Order = FULLY_READY |
| `order:item_ready_for_pickup` | `session:<sessionId>` | Item READY in Self Collection mode |
| `order:completed` | `session:<sessionId>` | Order = COMPLETED |
| `session:closed` | `session:<sessionId>` | Session closed by cashier |
| `table:seats_updated` | `restaurant:<id>:cashier` + `restaurant:<id>:admin` | Session opened or closed |

**Implementation approach:**
- Expose an internal HTTP endpoint `POST /internal/emit` on the realtime server (protected by a shared `INTERNAL_SECRET` env var). The API calls this endpoint after DB writes.
- Body: `{ room: string, event: string, payload: object }`.
- This avoids tight coupling between the API and realtime server (they remain separate deployable units).

**Files:**
- `apps/realtime-server/src/index.ts` — add `/internal/emit` HTTP handler
- `apps/realtime-server/src/lib/emit.ts` — `emitToRoom(room, event, payload)` helper

**New env var:** Add `INTERNAL_SECRET` to `apps/realtime-server/.env.example` and `apps/api/.env.example`.

---

## Phase 4.4 — API: Emit Events After DB Writes

**What to build:**
After every DB write that changes order/item/session state, the API must call the realtime server's `/internal/emit` endpoint.

**Where to add emit calls:**

| API Route | DB Write | Event to emit |
|---|---|---|
| `POST /api/orders` | Order created | `order:new` per kitchen (Managed/Self), `order:new_full` to waiter (Assisted) |
| `PATCH /api/order-items/:id/status` | Item status updated | `order_item:status_update` to session room; also `order:partially_ready` / `order:fully_ready` / `order:item_ready_for_pickup` based on recomputed Order.status + workflowMode |
| `PATCH /api/orders/:id/served` | Items marked SERVED | `order:completed` to session room |
| `PATCH /api/sessions/:id/close` | Session closed | `session:closed` to session room; `table:seats_updated` to cashier/admin rooms |
| `POST /api/sessions` | Session created | `table:seats_updated` to cashier/admin rooms |

**Implementation:**
- Create `apps/api/src/lib/realtime.ts` — `emitEvent(room, event, payload)` — makes a `fetch` POST to `REALTIME_SERVER_INTERNAL_URL/internal/emit` with the `INTERNAL_SECRET` header. Fails silently (log error, don't throw) so a realtime failure never breaks the API response.
- Import and call `emitEvent` in each relevant route after the Prisma write.

**Files:**
- `apps/api/src/lib/realtime.ts` — new file
- `apps/api/src/app/api/orders/route.ts` — add emit calls
- `apps/api/src/app/api/order-items/[id]/status/route.ts` — add emit calls (most complex)
- `apps/api/src/app/api/orders/[id]/served/route.ts` — add emit calls
- `apps/api/src/app/api/sessions/route.ts` — add `table:seats_updated`
- `apps/api/src/app/api/sessions/[id]/close/route.ts` — add `session:closed` + `table:seats_updated`

**New env vars:** `REALTIME_SERVER_INTERNAL_URL`, `INTERNAL_SECRET` in `apps/api/.env.example`.

---

## Phase 4.5 — Customer PWA: Replace Polling with WebSocket

**What to build:**
Update the order tracking page to connect to Socket.io and receive live updates instead of polling every 10s.

**Changes to `apps/customer-pwa/src/app/track/[orderId]/page.tsx`:**
1. On mount: connect to `NEXT_PUBLIC_SOCKET_URL` with `{ transports: ['websocket'] }`.
2. Emit `join_room` with `session:<sessionId>` (read from `sessionStorage`).
3. Listen for `order_item:status_update` → update the matching item's status in TanStack Query cache (`queryClient.setQueryData`).
4. Listen for `order:partially_ready`, `order:fully_ready` → update `order.status` in cache.
5. Listen for `order:completed` → set all items to SERVED in cache + show completion banner.
6. Listen for `order:item_ready_for_pickup` → show Self Collection pickup banner.
7. Listen for `session:closed` → show "Your session has ended" message + disable "order again" button.
8. On unmount: `socket.disconnect()`.
9. Keep the 10s polling as a **background fallback** (keep `refetchInterval: 10_000` on the query) — socket updates just make it feel instant.

**File:** `apps/customer-pwa/src/app/track/[orderId]/page.tsx` — already has socket scaffold, verify all events above are handled.

---

## Phase 4.6 — Realtime Server: Connection Health + Reconnection

**What to build:**
Make the realtime server production-ready for the pilot.

**Items:**
- **Ping/pong health:** Socket.io default heartbeat is fine. Ensure `pingTimeout` and `pingInterval` are configured (30s / 25s).
- **Reconnection on client:** Customer PWA socket options: `reconnectionAttempts: 5`, `reconnectionDelay: 2000`. Show a small "Reconnecting…" banner if disconnected for >3s.
- **`/health` endpoint:** already exists — verify it returns `{ status: 'ok', uptime, connectedClients: io.engine.clientsCount }`.
- **CORS:** `ALLOWED_ORIGINS` env var already wired — verify it includes both PWA and staff app URLs.

**Files:**
- `apps/realtime-server/src/index.ts` — verify `pingTimeout`, `pingInterval`, client count in `/health`
- `apps/customer-pwa/src/app/track/[orderId]/page.tsx` — add reconnection options + "Reconnecting…" UI

---

## Phase 4 Completion Checklist

Before moving to Phase 5, verify all of the following:

- [ ] Realtime server starts on port 4000, `/health` returns `connectedClients` count
- [ ] JWT auth middleware allows customers (no token) and validates staff tokens
- [ ] Room access rules enforced: kitchen staff can only join their kitchen's room
- [ ] `/internal/emit` endpoint rejects requests without correct `INTERNAL_SECRET`
- [ ] `POST /api/orders` triggers `order:new` to correct kitchen room(s)
- [ ] `PATCH /api/order-items/:id/status` → READY triggers correct event based on `workflowMode`:
  - Managed Dining: `order:partially_ready` or `order:fully_ready` to waiter room
  - Self Collection: `order:item_ready_for_pickup` or `order:fully_ready` to session room
- [ ] Customer tracking page updates item status **instantly** without waiting for the 10s poll
- [ ] `session:closed` disconnects the customer tracking page gracefully
- [ ] `table:seats_updated` fires when a session is opened or closed
- [ ] Reconnection banner appears if socket drops and disappears on reconnect
- [ ] `pnpm dev` starts all four services; no CORS errors in browser console
- [ ] End-to-end test: place order → kitchen marks READY → customer sees READY badge in < 1 second
