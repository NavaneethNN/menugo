# Phase 9 — Workflow Mode Switch + End-to-End Testing

> **Goal:** Verify all three workflow modes route correctly by running a complete order lifecycle for each. Fix any bugs found. Harden the system for the pilot deployment in Phase 10.
>
> **Prerequisite:** Phases 2–8 complete (all modules built).
>
> **No new features are built in this phase — only verification, bug fixes, and hardening.**

---

## Phase 9.1 — End-to-End Test: Managed Dining (Full Flow)

**Test scenario:** The default mode. Most complex routing — involves kitchen + waiter.

**Steps:**
1. Ensure `workflowMode = MANAGED_DINING` on the test restaurant (Admin → Settings).
2. Open `http://localhost:3000/scan/<T1-qrToken>` on a mobile browser. Select 2 seats.
3. Browse menu → add 2 items from different kitchens (e.g., Chicken Biriyani from K1 + Mango Lassi from K2).
4. Place order → verify tracking page shows both items as `PENDING`.
5. Log into staff app as K1 kitchen staff (PIN: 1111).
   - Verify Chicken Biriyani appears.
   - Accept → Start Preparing → Mark Ready.
   - Verify customer tracking shows Biriyani as `READY` instantly (< 1s).
   - Verify customer tracking shows `PARTIALLY_READY` banner.
6. Log into staff app as K2 kitchen staff (PIN: 2222).
   - Accept → Preparing → Mark Ready Mango Lassi.
   - Verify customer sees `FULLY_READY` banner.
7. Log in as Waiter (PIN: 3333).
   - Verify "Ready to Serve" section shows the order.
   - Tap "Mark All Served".
   - Verify customer sees "All done! Enjoy your meal."
8. Log in as Cashier (PIN: 4444).
   - Verify table T1 shows active session with correct total.
   - Settle & close session.
   - Verify customer tracking shows "Your session has ended."
   - Verify T1 shows full seats available.

**Pass criteria:** Every step completes without error; all real-time updates appear in < 2 seconds.

---

## Phase 9.2 — End-to-End Test: Assisted Dining

**Test scenario:** Simplest mode — waiter handles everything, kitchen has no app.

**Steps:**
1. Set `workflowMode = ASSISTED_DINING` (Admin → Settings).
2. Customer scans → orders 2 items.
3. Verify waiter app (PIN: 3333) shows "New Orders" section with full item list.
4. Waiter acknowledges the order.
5. (Simulate kitchen preparation offline — no app step.)
6. Waiter brings food → taps "Mark All Served" on the order.
7. Verify customer tracking shows `COMPLETED`.
8. Cashier closes session.

**Verify kitchen staff app (PIN: 1111) shows NO new order notification** in Assisted Dining mode.

**Pass criteria:** Waiter receives new order notification; customer tracking updates on serve; kitchen app is silent.

---

## Phase 9.3 — End-to-End Test: Self Collection

**Test scenario:** Customer collects directly from kitchen counter.

**Steps:**
1. Set `workflowMode = SELF_COLLECTION`.
2. Customer scans → orders items from 2 kitchens.
3. Verify kitchen app shows items (same as Managed Dining).
4. K1 marks Biriyani READY.
   - Customer sees **"Ready for Pickup at Main Kitchen"** pulsing banner.
   - Waiter app shows NO notification.
5. K2 marks Lassi READY.
   - Customer sees second pickup banner + "All items ready" consolidated banner.
6. K1 marks Biriyani SERVED (customer collected).
7. K2 marks Lassi SERVED.
   - Customer sees "All collected! Enjoy your meal."
8. Cashier closes session.

**Pass criteria:** Customer sees correct pickup banners per kitchen; waiter is never notified; kitchen marks SERVED directly.

---

## Phase 9.4 — Workflow Mode Switch Test

**Verify:** Changing `workflowMode` takes effect immediately for **new** orders; in-flight orders keep their original routing via denormalized `order.workflowMode`.

**Steps:**
1. Place order A in `MANAGED_DINING` mode.
2. While order A is still in-flight (items PENDING), switch to `SELF_COLLECTION`.
3. Place order B.
4. Verify order A still routes to waiter on completion (Managed Dining) — its `order.workflowMode` is `MANAGED_DINING`.
5. Verify order B routes to customer directly on kitchen READY (Self Collection) — its `order.workflowMode` is `SELF_COLLECTION`.

**Note:** `workflowMode` is denormalized onto `Order` at creation time (see Phase 3.3). Downstream routing logic reads from `order.workflowMode`, never live from `restaurant.workflowMode`. This isolates in-flight orders from mid-service mode changes.

---

## Phase 9.5 — Seat Availability Stress Test

**Test scenario:** Multiple sessions on the same table simultaneously.

**Steps:**
1. Table T2 has 6 seats.
2. Open 3 browser tabs, each scanning T2's QR code:
   - Tab 1: request 2 seats → should succeed (`availableSeats = 4` after)
   - Tab 2: request 3 seats → should succeed (`availableSeats = 1` after)
   - Tab 3: request 2 seats → should return **409 Table Full** (`availableSeats = 1`)
3. Cashier closes session from Tab 1 (2 seats freed).
4. Tab 3 retries → now succeeds.
5. Cashier closes all sessions → T2 shows 6/6 available.

**Pass criteria:** Seat math is always correct; no race condition allows overbooking.

---

## Phase 9.6 — Bug Fix Pass

After completing tests 9.1–9.5, document and fix all bugs found. Common issues to check:

**API robustness:**
- [ ] All endpoints return correct HTTP status codes (not just 200 for everything)
- [ ] Zod validation errors return `400` with useful messages, not `500`
- [ ] Missing JWT returns `401`, wrong role returns `403`
- [ ] DB errors return `500` with a generic message (no Prisma stack traces exposed to client)

**Realtime reliability:**
- [ ] Socket events fire even when the realtime server is briefly restarted (API retries or logs failure gracefully)
- [ ] Customer page shows "Reconnecting..." if socket drops; resumes live updates on reconnect
- [ ] Staff apps reconnect automatically after network interruption

**Customer PWA:**
- [ ] All pages work correctly with no `sessionStorage` (e.g., user opens `/menu` directly — should redirect to scan)
- [ ] Back button behaviour on mobile is correct (no unintended navigation)
- [ ] QR scan page works on iOS Safari and Android Chrome

**Staff app:**
- [ ] Login persists across app restart (store token in `SecureStore` via `expo-secure-store`, not just Zustand memory)
- [ ] Loading and error states on every screen (no blank screens on slow network)

---

## Phase 9.7 — Login Persistence (SecureStore)

**What to build:**
Currently the Zustand auth store is in-memory — logging in is lost on app restart. Fix this.

**Implementation:**
- Add `expo-secure-store` to `apps/staff-app/package.json`.
- Create `apps/staff-app/src/lib/storage.ts` — `saveAuth(payload)`, `loadAuth()`, `clearAuth()` wrappers around `SecureStore`.
- On `setAuth` in Zustand: also call `saveAuth()`.
- On app start (`app/_layout.tsx`): call `loadAuth()` and populate the store before rendering. Show a splash/loading screen during this check.
- On `clearAuth`: call `SecureStore.deleteItemAsync`.

**Files:**
- `apps/staff-app/package.json` — add `expo-secure-store`
- `apps/staff-app/src/lib/storage.ts` — new file
- `apps/staff-app/src/store/auth.ts` — call `saveAuth` in `setAuth`, `clearAuth` in `clearAuth`
- `apps/staff-app/app/_layout.tsx` — add auth rehydration on mount

---

## Phase 9.8 — Final Pre-Pilot Checklist

Run through this checklist before Phase 10 (pilot deployment):

**Security:**
- [ ] No real credentials in any `.env.example` or committed file
- [ ] `JWT_SECRET` is a strong random string (≥ 32 chars) in production env
- [ ] `INTERNAL_SECRET` is set and validated on `/internal/emit`
- [ ] Prisma queries always scope to `restaurantId` (no cross-tenant data leakage)
- [ ] Staff PIN is stored as bcrypt hash, never returned in API responses

**Performance:**
- [ ] Menu endpoint response < 300ms on Neon (check with `curl -w "%{time_total}"`)
- [ ] Socket.io server handles ≥ 50 concurrent connections without error
- [ ] No N+1 queries — all Prisma queries use `include` not separate lookups in loops

**UX:**
- [ ] All loading states show a spinner or skeleton (no blank screens)
- [ ] All error states show a user-friendly message + retry option
- [ ] Customer PWA scores ≥ 90 on Lighthouse PWA audit
- [ ] All text is legible at 375px width (iPhone SE)

**Deployment readiness:**
- [ ] `pnpm build` succeeds for `apps/api` and `apps/customer-pwa` with zero errors
- [ ] `apps/realtime-server` builds with `tsc` and starts with `node dist/index.js`
- [ ] All environment variables documented in each app's `.env.example`
- [ ] `README.md` quick-start guide is accurate and tested from scratch
