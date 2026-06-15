# Phase 2 — Admin Module

> **Goal:** Build the complete Admin section of the `staff-app` (Expo) so that a restaurant owner can manage every entity that other modules depend on — menus, tables, kitchens, staff, and workflow mode. All admin API routes in `apps/api` must also be built here.
>
> **Prerequisite:** Phase 1 complete (monorepo running, DB seeded, `pnpm dev` works).
>
> **App in scope:** `apps/staff-app` (admin screens) + `apps/api` (admin API routes).

---

## Phase 2.1 — Admin API: Categories CRUD

**What to build:**
- `GET    /api/admin/categories` — list all categories for the restaurant
- `POST   /api/admin/categories` — create a category (`name`, `sortOrder`)
- `PATCH  /api/admin/categories/:id` — update name / sortOrder
- `DELETE /api/admin/categories/:id` — delete (guard: reject if category has menu items)

**Files to create/edit:**
- `apps/api/src/app/api/admin/categories/route.ts` — GET + POST
- `apps/api/src/app/api/admin/categories/[id]/route.ts` — PATCH + DELETE

**Auth:** JWT middleware, role must be `ADMIN`.

**Validation:** Zod. `name` required, non-empty. `sortOrder` optional integer ≥ 0.

---

## Phase 2.2 — Admin API: Kitchens CRUD

**What to build:**
- `GET    /api/admin/kitchens` — list kitchens for the restaurant
- `POST   /api/admin/kitchens` — create kitchen (`name`)
- `PATCH  /api/admin/kitchens/:id` — rename kitchen
- `DELETE /api/admin/kitchens/:id` — delete (guard: reject if kitchen has menu items or staff)

**Files to create/edit:**
- `apps/api/src/app/api/admin/kitchens/route.ts` — GET + POST
- `apps/api/src/app/api/admin/kitchens/[id]/route.ts` — PATCH + DELETE

**Auth:** JWT, role = `ADMIN`.

---

## Phase 2.3 — Admin API: Menu Items CRUD

**What to build:**
- `GET    /api/admin/menu-items` — list all items (with category + kitchen name)
- `POST   /api/admin/menu-items` — create item
- `PATCH  /api/admin/menu-items/:id` — update any field
- `DELETE /api/admin/menu-items/:id` — soft-delete (set `isAvailable = false`) OR hard delete if no order history
- `PATCH  /api/admin/menu-items/:id/availability` — toggle `isAvailable` (quick on/off for 86ing items)

**Fields:** `name`, `description?`, `price` (Decimal), `imageUrl?`, `categoryId`, `kitchenId`, `isAvailable`.

**Image upload:** Accept `imageUrl` as a pre-signed R2 URL (client uploads directly to R2, sends back URL). Do not proxy the file through the API.

**Files to create/edit:**
- `apps/api/src/app/api/admin/menu-items/route.ts` — GET + POST
- `apps/api/src/app/api/admin/menu-items/[id]/route.ts` — PATCH + DELETE
- `apps/api/src/app/api/admin/menu-items/[id]/availability/route.ts` — PATCH

**Auth:** JWT, role = `ADMIN`.

**Validation:** Zod. `price` must be positive. `categoryId` and `kitchenId` must belong to the same `restaurantId`.

---

## Phase 2.4 — Admin API: Tables + QR Generation

**What to build:**
- `GET    /api/admin/tables` — list tables with `qrToken`, active session count, available seats
- `POST   /api/admin/tables` — create table (`tableNumber`, `totalSeats`) — auto-generate `qrToken` (use `crypto.randomUUID()`)
- `PATCH  /api/admin/tables/:id` — update `tableNumber` or `totalSeats`
- `DELETE /api/admin/tables/:id` — delete (guard: no active sessions)
- `GET    /api/admin/tables/:id/qr` — return QR code as a base64 PNG (use `qrcode` npm package, encode URL `<CUSTOMER_PWA_URL>/scan/<qrToken>`)

**Files to create/edit:**
- `apps/api/src/app/api/admin/tables/route.ts` — GET + POST
- `apps/api/src/app/api/admin/tables/[id]/route.ts` — PATCH + DELETE
- `apps/api/src/app/api/admin/tables/[id]/qr/route.ts` — GET

**Auth:** JWT, role = `ADMIN`.

**Dependency:** Add `qrcode` + `@types/qrcode` to `apps/api/package.json`.

**New env var:** Add `CUSTOMER_PWA_URL` to `apps/api/.env.example` (e.g. `http://localhost:3000`). The QR endpoint uses this to build the full scan URL: `${CUSTOMER_PWA_URL}/scan/${qrToken}`.

---

## Phase 2.5 — Admin API: Staff Management

**What to build:**
- `GET    /api/admin/staff` — list all staff for the restaurant
- `POST   /api/admin/staff` — create staff (`name`, `role`, `pin`, `kitchenId?`)
- `PATCH  /api/admin/staff/:id` — update name / PIN / kitchenId / isActive
- `DELETE /api/admin/staff/:id` — deactivate (`isActive = false`), never hard delete

**Files to create/edit:**
- `apps/api/src/app/api/admin/staff/route.ts` — GET + POST
- `apps/api/src/app/api/admin/staff/[id]/route.ts` — PATCH + DELETE

**Auth:** JWT, role = `ADMIN`.

**Validation:** PIN must be 4–10 digits (numeric string). `kitchenId` required when `role = KITCHEN`. `kitchenId` must belong to same restaurant.

**Security:** Store PIN as bcrypt hash. Compare with `bcrypt.compare` on login. Update `apps/api/src/app/api/staff/login/route.ts` to use `bcrypt.compare` instead of plain comparison.

---

## Phase 2.6 — Admin API: Workflow Mode + Session Monitoring

**What to build:**
- `PATCH  /api/admin/restaurant/workflow-mode` — update `workflowMode` (`ASSISTED_DINING` | `MANAGED_DINING` | `SELF_COLLECTION`)
- `GET    /api/admin/sessions` — list all sessions (active + closed), each with table number, seats, order count, total items, `startedAt`

**Files to create/edit:**
- `apps/api/src/app/api/admin/restaurant/workflow-mode/route.ts` — PATCH
- `apps/api/src/app/api/admin/sessions/route.ts` — GET (support `?status=ACTIVE|CLOSED` query param)

**Auth:** JWT, role = `ADMIN`.

---

## Phase 2.7 — Staff App: Admin Navigation Shell

**What to build:**
The admin area of `apps/staff-app`. Uses Expo Router tab/stack navigation scoped to the `(admin)` group.

**Screens (tab bar with 5 tabs):**
1. **Menu** — categories + items
2. **Tables** — table list + QR download
3. **Kitchens** — kitchen list
4. **Staff** — staff accounts
5. **Settings** — workflow mode selector + restaurant info

**Files to create:**
- `apps/staff-app/app/(admin)/_layout.tsx` — tab navigator (5 tabs, icons from `@expo/vector-icons`)

**Guards:** `app/index.tsx` already redirects to `/(admin)` if role is `ADMIN`. No extra auth check needed here.

---

## Phase 2.8 — Staff App: Menu Management Screen

**What to build:**
Full menu management UI — categories accordion + items list within each, add/edit/delete/toggle availability.

**Screens/components:**
- `apps/staff-app/app/(admin)/menu/index.tsx` — categories list with expand/collapse, items within each category
- `apps/staff-app/app/(admin)/menu/category-form.tsx` — modal: create/edit category
- `apps/staff-app/app/(admin)/menu/item-form.tsx` — modal: create/edit menu item (name, price, description, category, kitchen, availability toggle, image URL field)

**Data:** TanStack Query — `useQuery` for list, `useMutation` for CRUD. Invalidate on success.

---

## Phase 2.9 — Staff App: Tables + QR Screen

**What to build:**
Table list with seat availability badges. Tap a table → view QR code full-screen → share/download button.

**Screens/components:**
- `apps/staff-app/app/(admin)/tables/index.tsx` — table list, each card shows table number, total seats, active sessions, available seats
- `apps/staff-app/app/(admin)/tables/[id]/qr.tsx` — full-screen QR display, `Share` button (uses `expo-sharing` to share the QR image)
- `apps/staff-app/app/(admin)/tables/table-form.tsx` — modal: create/edit table

**Dependency:** Add `expo-sharing` to `apps/staff-app/package.json`.

---

## Phase 2.10 — Staff App: Kitchen, Staff & Settings Screens

**What to build:**

**Kitchen screen:**
- `apps/staff-app/app/(admin)/kitchens/index.tsx` — list with create/rename/delete actions (inline swipe-to-delete or long-press menu)

**Staff screen:**
- `apps/staff-app/app/(admin)/staff/index.tsx` — staff list with role badges, active/inactive toggle
- `apps/staff-app/app/(admin)/staff/staff-form.tsx` — modal: create/edit staff (name, role, PIN, kitchen assignment dropdown)

**Settings screen:**
- `apps/staff-app/app/(admin)/settings/index.tsx` — workflow mode picker (3 options with descriptions), save button. Show current mode prominently.

**Session monitoring screen (plan.md §6.5):**
- `apps/staff-app/app/(admin)/sessions/index.tsx` — live list of all active sessions across all tables. Each row: table number, seats occupied, duration, order count. Filter tabs: Active / Closed. "Force Clear" button per session (calls `PATCH /api/tables/:id/force-clear`). This uses `GET /api/admin/sessions` built in Phase 2.6.
- Add a 6th tab to the admin tab navigator: **Sessions**.

---

## Phase 2.11 — Admin API: R2 Pre-Signed Upload URL

**What to build:**
Endpoint to generate a pre-signed Cloudflare R2 upload URL so the admin app can upload images directly to R2 without proxying through the API.

**Endpoint:**
`POST /api/admin/upload-url` — returns a temporary signed URL for direct browser upload.

**Request body (Zod):**
```json
{
  "filename": "chicken-biriyani.jpg",
  "contentType": "image/jpeg"
}
```

**Response:**
```json
{
  "uploadUrl": "https://<account>.r2.cloudflarestorage.com/<bucket>/...?X-Amz-Algorithm=...",
  "publicUrl": "https://images.yourdomain.com/chicken-biriyani.jpg"
}
```

**Implementation:**
- Use `@aws-sdk/s3-request-presigner` with Cloudflare R2 credentials (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`).
- Generate PUT pre-signed URL valid for 5 minutes.
- Sanitize filename: replace spaces with hyphens, add timestamp prefix to avoid collisions.
- Validate `contentType` starts with `image/`.

**Files:**
- `apps/api/src/app/api/admin/upload-url/route.ts` — new file
- `apps/api/.env.example` — add R2 env vars
- `apps/staff-app/app/(admin)/menu/item-form.tsx` — update: when user selects image, call `POST /api/admin/upload-url`, then `fetch(uploadUrl, { method: 'PUT', body: file })`, then save returned `publicUrl` to form state.

**Dependencies:** Add `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` to `apps/api/package.json`.

---

## Phase 2 Completion Checklist

Before moving to Phase 3, verify all of the following:

- [ ] All 6 groups of admin API routes return correct JSON and enforce JWT + ADMIN role
- [ ] PIN is stored as a bcrypt hash; login route uses `bcrypt.compare`
- [ ] `qrToken` is generated server-side with `crypto.randomUUID()`
- [ ] QR `/qr` endpoint returns a valid PNG base64 string encoding `<PWA_URL>/scan/<token>`
- [ ] Category delete is blocked if menu items exist
- [ ] Kitchen delete is blocked if menu items or staff are assigned
- [ ] Table delete is blocked if active sessions exist
- [ ] `categoryId` and `kitchenId` cross-validation on menu item create/update
- [ ] `workflowMode` change takes effect for new orders (existing in-flight orders unaffected)
- [ ] All admin screens in staff-app fetch from API, show loading/error states
- [ ] Menu item availability toggle works instantly from the app
- [ ] QR code renders correctly in the tables screen and can be shared/saved
- [ ] `POST /api/admin/upload-url` returns valid R2 pre-signed URL
- [ ] Menu item form uploads image directly to R2 and stores public URL
- [ ] `pnpm dev` still starts all services without error after Phase 2 changes
