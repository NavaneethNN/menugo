# Phase 8 — Cashier Module

> **Goal:** Build the complete Cashier screen in `apps/staff-app` — live active table/session view, full item list per session for manual billing, settle & close session, and force-clear table. Seats must free up immediately on close.
>
> **Prerequisite:** Phase 7 complete (all three workflow modes working end-to-end).
>
> **Apps in scope:** `apps/staff-app` `(cashier)` screens + `apps/api` cashier routes.

---

## Phase 8.1 — API: Cashier Tables View

**What to build:**
`GET /api/cashier/tables` — returns all tables with their active sessions and full item breakdown for manual billing.

**Auth:** JWT, role = `CASHIER`. Extract `restaurantId` from JWT.

**Response shape:**
```json
[
  {
    "tableId": "...",
    "tableNumber": "T1",
    "totalSeats": 4,
    "availableSeats": 2,
    "activeSessions": [
      {
        "sessionId": "...",
        "seatsOccupied": 2,
        "startedAt": "...",
        "durationMinutes": 45,
        "orders": [
          {
            "orderId": "...",
            "placedAt": "...",
            "items": [
              {
                "name": "Chicken Biriyani",
                "quantity": 2,
                "price": "180.00",
                "subtotal": "360.00",
                "status": "SERVED"
              }
            ]
          }
        ],
        "sessionTotal": "540.00",
        "allServed": true
      }
    ]
  }
]
```

**Computed fields:**
- `availableSeats = totalSeats - SUM(seatsOccupied WHERE status = ACTIVE)`
- `durationMinutes = now() - session.startedAt` (in minutes, rounded)
- `sessionTotal = SUM(item.price * item.quantity)` across all orders in the session
- `allServed = true` if every OrderItem in every Order of the session has `status = SERVED`

**File:** `apps/api/src/app/api/cashier/tables/route.ts` — new file.

---

## Phase 8.2 — API: Close Session (Settle & Close)

**What to build / verify:**
`PATCH /api/sessions/:id/close` — settle and close a session.

**Auth:** JWT, role = `CASHIER`. Verify session belongs to same `restaurantId`.

**Logic:**
1. Set `TableSession.status = CLOSED`, `closedAt = now()`, `closedBy = "cashier"`.
2. Emit `session:closed` to `session:<sessionId>` room (customer tracking page disconnects gracefully).
3. Emit `table:seats_updated` to `restaurant:<id>:cashier` and `restaurant:<id>:admin` rooms with updated `availableSeats`.

**File:** `apps/api/src/app/api/sessions/[id]/close/route.ts` — already scaffolded, verify emit calls are present.

---

## Phase 8.3 — API: Force Clear Table

**What to build:**
`PATCH /api/tables/:id/force-clear` — close ALL active sessions for a table at once (end-of-day cleanup or abandoned sessions).

**Auth:** JWT, role = `CASHIER` or `ADMIN`.

**Logic:**
1. Find all `TableSession`s where `tableId = id` AND `status = ACTIVE`.
2. Set all to `CLOSED`, `closedAt = now()`, `closedBy = "cashier"`.
3. Emit `session:closed` for each session.
4. Emit `table:seats_updated` once with `availableSeats = table.totalSeats`.

**File:** `apps/api/src/app/api/tables/[id]/force-clear/route.ts` — new file.

---

## Phase 8.4 — Staff App: Cashier Dashboard Screen

**What to build:**
Main cashier screen — a live grid/list of all tables showing occupancy and quick actions.

**Screen:** `apps/staff-app/app/(cashier)/index.tsx` — new file.

**Layout:**
- Header: "Counter" + total active sessions count.
- Table grid (2-column on tablet, 1-column on phone):
  - Each table card shows:
    - Table number (large, bold)
    - Seat pill: "2 / 4 seats occupied" with colour (green = seats available, red = full)
    - Active session count badge
    - Tap → navigate to session detail screen
- Tables with no active sessions shown as dimmed "Available" cards.
- Pull-to-refresh.
- Real-time update: `table:seats_updated` socket event refreshes the relevant table card.

**Files:**
- `apps/staff-app/app/(cashier)/index.tsx` — new file
- `apps/staff-app/app/(cashier)/_layout.tsx` — new file, Stack with header + logout

---

## Phase 8.5 — Staff App: Session Detail + Bill Screen

**What to build:**
Tap a table → session list. Tap a session → full bill view with settle button.

**Screens:**
- `apps/staff-app/app/(cashier)/table/[tableId].tsx` — lists all active sessions for this table. Each session shows: seats occupied, duration, total amount, "All Served" badge if applicable. Tap → bill detail.
- `apps/staff-app/app/(cashier)/session/[sessionId].tsx` — full bill detail screen.

**Bill detail layout:**
- Header: "Table T1 — Session" + duration
- Order breakdown: each order as a collapsible section, items with qty × price = subtotal
- Session total (large, at bottom)
- **"Settle & Close"** button (prominent, green) — calls `PATCH /api/sessions/:id/close`. On success: navigate back to table list, show success toast.
- Seats occupied note: "Closing this session frees 2 seats."

**Files:**
- `apps/staff-app/app/(cashier)/table/[tableId].tsx` — new file
- `apps/staff-app/app/(cashier)/session/[sessionId].tsx` — new file

---

## Phase 8.6 — Staff App: Force Clear Table Action

**What to build:**
Long-press or context menu on a table card → "Force Clear Table" confirmation dialog.

**Implementation:**
- On long-press of a table card in the cashier dashboard: show an `Alert.alert` confirmation dialog.
  - Title: "Force Clear Table T1?"
  - Message: "This will close all N active sessions and free all seats. Use this for end-of-day or abandoned tables."
  - Buttons: "Cancel" | "Force Clear" (destructive)
- On confirm: call `PATCH /api/tables/:id/force-clear`. On success: invalidate table list query.

**File:** `apps/staff-app/app/(cashier)/index.tsx` — add `onLongPress` handler to table cards.

---

## Phase 8.7 — Staff App: Cashier Socket.io Integration

**What to build:**
Connect cashier screen to realtime server for live seat availability updates.

**Implementation:**
- On mount: connect with auth `{ token: authStore.token }`.
- Join room: `restaurant:<restaurantId>:cashier`.
- Listen for `table:seats_updated` → update the affected table card in TanStack Query cache (`queryClient.setQueryData`).
- Listen for `session:closed` (another cashier closed it) → invalidate tables query.
- On unmount: `socket.disconnect()`.

**File:** `apps/staff-app/app/(cashier)/index.tsx` — add socket `useEffect`.

---

## Phase 8.8 — Staff App: Inactive Session Flagging (plan.md §8)

**What to build:**
Surface sessions that have been inactive for a long time as "Consider Clearing" in the cashier view.

**Definition of inactive (V1):** Session has been ACTIVE for > 90 minutes AND all OrderItems are in `SERVED` or `COMPLETED` status.

**Implementation:**
- Compute on the client from `durationMinutes` and `allServed` fields already in the API response.
- Show an amber "Inactive" badge on sessions meeting the criteria.
- No auto-close — cashier decides.

**File:** `apps/staff-app/app/(cashier)/table/[tableId].tsx` — add inactive badge logic.

---

## Phase 8 Completion Checklist

Before moving to Phase 9, verify all of the following:

- [ ] `GET /api/cashier/tables` returns correct `availableSeats`, `sessionTotal`, `allServed` for each session
- [ ] `PATCH /api/sessions/:id/close` sets `status = CLOSED`, emits `session:closed` + `table:seats_updated`
- [ ] `PATCH /api/tables/:id/force-clear` closes all active sessions and emits events for each
- [ ] Cashier dashboard shows all tables with live seat counts
- [ ] `table:seats_updated` socket event updates the table card **without page refresh**
- [ ] Session bill detail shows correct itemised breakdown with subtotals and session total
- [ ] "Settle & Close" button works and navigates back on success
- [ ] Closed session's seats are immediately reflected in the table card
- [ ] Force Clear confirmation dialog appears on long-press; action closes all sessions
- [ ] Customer tracking page shows "Your session has ended" message when session is force-closed
- [ ] Inactive session badge appears for sessions > 90 min with all items served
- [ ] `pnpm dev` starts all services without error
