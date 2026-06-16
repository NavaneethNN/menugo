# Phase 2 Testing Guide

Complete testing instructions for the Admin Module (Phase 2).

---

## Prerequisites

### 1. Environment Variables

Add these to `apps/api/.env.local`:

```env
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"

# JWT
JWT_SECRET="your-long-random-secret-min-32-chars"

# Realtime Server
NEXT_PUBLIC_SOCKET_URL="http://localhost:4000"
REALTIME_SERVER_INTERNAL_URL="http://localhost:4000"
INTERNAL_SECRET="another-random-secret"

# Customer PWA (for QR generation)
CUSTOMER_PWA_URL="http://localhost:3000"

# Cloudflare R2 (optional - for image uploads)
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_PUBLIC_URL=""
```

### 2. Database Setup

```bash
# From project root
pnpm db:push
pnpm db:seed
```

### 3. Start Services

```bash
# From project root
pnpm dev
```

Services will start:
- Customer PWA: http://localhost:3000
- API: http://localhost:3001
- Realtime Server: http://localhost:4000

---

## Test Data (from seed)

| Role | PIN |
|------|-----|
| Admin | 1234 |
| Kitchen (K1) | 1111 |
| Kitchen (K2) | 2222 |
| Waiter | 3333 |
| Cashier | 4444 |

---

## API Testing (via curl/Postman)

### 1. Staff Login

```bash
curl -X POST http://localhost:3001/api/staff/login \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"restaurant-id-from-seed","pin":"1234"}'
```

**Expected:** JSON with `token`, `staff.id`, `staff.role=ADMIN`

### 2. Get Categories (Authenticated)

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/admin/categories
```

**Expected:** Array of categories with `_count.menuItems`

### 3. Create Category

```bash
curl -X POST http://localhost:3001/api/admin/categories \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Beverages","sortOrder":5}'
```

**Expected:** Created category object with `id`

### 4. Create Kitchen

```bash
curl -X POST http://localhost:3001/api/admin/kitchens \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"K3 - Desserts"}'
```

**Expected:** Created kitchen object

### 5. Create Menu Item

```bash
curl -X POST http://localhost:3001/api/admin/menu-items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Gulab Jamun",
    "description":"Sweet milk dumplings",
    "price":120,
    "categoryId":"<category-id>",
    "kitchenId":"<kitchen-id>",
    "isAvailable":true
  }'
```

**Expected:** Created item with `category` and `kitchen` included

### 6. Create Table

```bash
curl -X POST http://localhost:3001/api/admin/tables \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"tableNumber":"T5","totalSeats":6}'
```

**Expected:** Created table with auto-generated `qrToken`

### 7. Get QR Code

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/admin/tables/<table-id>/qr
```

**Expected:** `{ "qrBase64": "...", "scanUrl": "http://localhost:3000/scan/..." }`

### 8. Create Staff

```bash
curl -X POST http://localhost:3001/api/admin/staff \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"New Kitchen Staff",
    "role":"KITCHEN",
    "pin":"5555",
    "kitchenId":"<kitchen-id>"
  }'
```

**Expected:** Created staff (PIN stored as bcrypt hash, not returned)

### 9. Update Workflow Mode

```bash
curl -X PATCH http://localhost:3001/api/admin/restaurant/workflow-mode \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"workflowMode":"SELF_COLLECTION"}'
```

**Expected:** `{ "workflowMode": "SELF_COLLECTION" }`

### 10. Get Sessions

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/admin/sessions?status=ACTIVE"
```

**Expected:** Array of sessions with `tableNumber`, `orderCount`, `totalItems`

### 11. Toggle Item Availability

```bash
curl -X PATCH http://localhost:3001/api/admin/menu-items/<id>/availability \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"isAvailable":false}'
```

**Expected:** Updated item

---

## Staff App Testing (Expo Web)

### Run Staff App

```bash
cd apps/staff-app
pnpm dev
# Press 'w' for web
```

### Test Scenarios

#### 1. Admin Login
1. Open http://localhost:8081 (or Expo URL)
2. Enter Restaurant ID (from seed)
3. Enter PIN: 1234
4. **Expected:** Redirected to Menu tab

#### 2. Menu Management
1. **Add Category:**
   - Tap "Category" button
   - Enter name: "Desserts"
   - Tap Save
   - **Expected:** Category appears in list

2. **Add Menu Item:**
   - Tap "Item" button
   - Fill: name, price, description
   - Select category (pill buttons)
   - Select kitchen (pill buttons)
   - Tap Save
   - **Expected:** Item appears under category

3. **Toggle Availability:**
   - Expand category
   - Toggle switch on item
   - **Expected:** Switch animates, item updates

4. **Edit Item:**
   - Tap pencil icon on item
   - Change price
   - Tap Save
   - **Expected:** Price updated in list

#### 3. Tables Management
1. **Add Table:**
   - Tap "Add Table"
   - Enter: T6, seats: 4
   - Tap Save
   - **Expected:** Table appears with 4/4 available

2. **View QR:**
   - Tap QR button on table card
   - **Expected:** Full-screen QR displayed

3. **Share QR:**
   - Tap Share button
   - **Expected:** System share dialog opens

4. **Edit Table:**
   - Tap pencil icon
   - Change seat count
   - **Expected:** Seat count updates

5. **Delete Table:**
   - Create table with no sessions
   - Tap trash icon
   - Confirm delete
   - **Expected:** Table removed from list

#### 4. Kitchens Management
1. **Add Kitchen:**
   - Type name in input
   - Tap + button
   - **Expected:** Kitchen appears with 0 items, 0 staff

2. **Rename Kitchen:**
   - Tap pencil icon
   - Edit name inline
   - Tap Save
   - **Expected:** Name updated

3. **Delete Kitchen (Blocked):**
   - Try to delete kitchen with menu items
   - **Expected:** Alert "Cannot delete kitchen with menu items"

#### 5. Staff Management
1. **Add Staff:**
   - Tap "Add Staff"
   - Enter name
   - Select role (colored pills)
   - If KITCHEN: select kitchen
   - Enter PIN (4-10 digits)
   - Tap Save
   - **Expected:** Staff appears with role badge

2. **Toggle Active:**
   - Toggle switch on staff card
   - **Expected:** Switch state changes

3. **Edit Staff:**
   - Tap staff card
   - Change role or PIN
   - Tap Save
   - **Expected:** Staff updated

#### 6. Settings - Workflow Mode
1. **View Current Mode:**
   - Open Settings tab
   - **Expected:** Current mode displayed prominently

2. **Change Mode:**
   - Select different mode card
   - **Expected:** Card highlighted with orange border

3. **Save Changes:**
   - Tap "Save Changes"
   - **Expected:** Success, mode persists on reload

#### 7. Sessions Monitoring
1. **Filter Sessions:**
   - Tap "Active", "Closed", or "All"
   - **Expected:** List filters accordingly

2. **View Inactive Badge:**
   - Find session >90min with items
   - **Expected:** Yellow "Inactive" badge shown

3. **Force Clear:**
   - Tap "Force Clear" on active session
   - Confirm
   - **Expected:** Session closed (if tableId available)

---

## Error Cases to Test

### API Error Tests

| Test | Endpoint | Expected |
|------|----------|----------|
| No auth header | GET /api/admin/categories | 401 Unauthorized |
| Wrong role (KITCHEN) | POST /api/admin/categories | 403 Forbidden |
| Invalid categoryId | POST /api/admin/menu-items | 400 Invalid categoryId |
| Duplicate table number | POST /api/admin/tables | 409 Table number exists |
| Delete category with items | DELETE /api/admin/categories/:id | 409 Cannot delete |
| Invalid PIN format | POST /api/admin/staff | 400 PIN must be 4-10 digits |
| KITCHEN role without kitchenId | POST /api/admin/staff | 400 kitchenId required |
| Invalid workflow mode | PATCH /api/admin/restaurant/workflow-mode | 400 Invalid enum value |
| Wrong PIN at login | POST /api/staff/login | 401 Invalid credentials |

---

## Postman Collection

Import this skeleton:

```json
{
  "info": { "name": "Restaurant Admin API", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "header": [{"key": "Content-Type", "value": "application/json"}],
            "url": "{{baseUrl}}/api/staff/login",
            "body": { "mode": "raw", "raw": "{\"restaurantId\":\"{{restaurantId}}\",\"pin\":\"1234\"}" }
          }
        }
      ]
    },
    {
      "name": "Categories",
      "item": [
        { "name": "List", "request": { "method": "GET", "header": [{"key": "Authorization", "value": "Bearer {{token}}"}], "url": "{{baseUrl}}/api/admin/categories" } },
        { "name": "Create", "request": { "method": "POST", "header": [{"key": "Authorization", "value": "Bearer {{token}}"}, {"key": "Content-Type", "value": "application/json"}], "url": "{{baseUrl}}/api/admin/categories", "body": { "mode": "raw", "raw": "{\"name\":\"Test\",\"sortOrder\":0}" } } }
      ]
    }
  ]
}
```

---

## Checklist

- [ ] All API endpoints return correct status codes
- [ ] JWT auth works for all admin routes
- [ ] PIN is bcrypt hashed (verify in DB)
- [ ] QR code generates valid PNG base64
- [ ] Delete guards work (categories, kitchens, tables)
- [ ] Cross-validation works (categoryId, kitchenId belong to restaurant)
- [ ] Workflow mode change affects new orders only
- [ ] Staff app fetches data correctly
- [ ] Availability toggle works instantly
- [ ] QR sharing works
- [ ] Image upload works (if R2 configured)
- [ ] All type checks pass (`pnpm typecheck` in both apps)
- [ ] No console errors in browser

---

## Troubleshooting

### "Invalid token" errors
- Check JWT_SECRET is set
- Ensure token is from /api/staff/login (not session token)

### "Cannot find restaurant"
- Check DATABASE_URL is correct
- Run `pnpm db:seed` again

### QR code not generating
- Check CUSTOMER_PWA_URL is set
- Verify table exists with valid qrToken

### Image upload fails
- Check all R2 env vars are set
- Verify R2_ENDPOINT format: `https://<account-id>.r2.cloudflarestorage.com`
- Ensure CORS is configured on R2 bucket

### Staff app won't start
- Check EXPO_PUBLIC_API_URL in staff-app .env
- Verify API is running on port 3001

---

## Next Phase

After Phase 2 tests pass, proceed to [Phase 3 Testing](./phase3_test.md) (Customer Module).
