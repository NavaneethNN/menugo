# Phase 3 Testing Guide

Complete testing instructions for the Customer Module (Phase 3).

---

## Prerequisites

### 1. Environment Variables

Ensure these are in `apps/api/.env.local`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
JWT_SECRET="your-long-random-secret-min-32-chars"
NEXT_PUBLIC_SOCKET_URL="http://localhost:4000"
CUSTOMER_PWA_URL="http://localhost:3000"
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

---

## Test Data (from seed)

| Item | Value |
|------|-------|
| Restaurant ID | (from seed) |
| Table | T1, T2, T3, T4 |
| QR Token | Check via Admin API |
| Menu Items | Chicken Biriyani, Masala Dosa, etc. |

---

## API Testing (via curl/Postman)

### 1. Create Session (QR Scan)

```bash
curl -X POST http://localhost:3001/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"qrToken":"<qr-token-from-table>","seatsOccupied":2}'
```

**Expected:** `{ sessionId, sessionToken, restaurantId, workflowMode, tableNumber }`

### 2. Table Full (409 Test)

```bash
# First fill table T1 with 4 seats
curl -X POST http://localhost:3001/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"qrToken":"<t1-qr-token>","seatsOccupied":4}'

# Then try with 1 more seat
curl -X POST http://localhost:3001/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"qrToken":"<t1-qr-token>","seatsOccupied":1}'
```

**Expected:** `409 Conflict` with `{ error: "Table Full", availableSeats: 0 }`

### 3. Get Menu

```bash
curl http://localhost:3001/api/restaurants/<restaurant-id>/menu
```

**Expected:** `{ restaurantId, restaurantName, workflowMode, categories: [{ id, name, sortOrder, menuItems: [...] }] }`

**Verify:**
- Only `isAvailable=true` items included
- Each item has `kitchenId`
- Categories sorted by `sortOrder`
- Items sorted by name

### 4. Place Order

```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId":"<session-id>",
    "sessionToken":"<session-token>",
    "items":[
      {"menuItemId":"<item-id>","quantity":2,"specialInstructions":"Extra spicy"},
      {"menuItemId":"<item-id-2>","quantity":1}
    ]
  }'
```

**Expected:** Created order with `id`, `status: PLACED`, `workflowMode`, `items` with `kitchenId` denormalized

### 5. Get Order Status

```bash
curl http://localhost:3001/api/orders/<order-id>
```

**Expected:** `{ id, status, workflowMode, createdAt, tableNumber, items: [{ id, menuItemName, quantity, specialInstructions, status, kitchenName }] }`

### 6. Invalid Session Token (401 Test)

```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<session-id>","sessionToken":"invalid-token","items":[]}'
```

**Expected:** `401 Unauthorized`

### 7. Menu Item Not Available (400 Test)

```bash
# First mark item unavailable via Admin API
# Then try to order it
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId":"<session-id>",
    "sessionToken":"<session-token>",
    "items":[{"menuItemId":"<unavailable-item-id>","quantity":1}]
  }'
```

**Expected:** `400 Bad Request` with error about unavailable item

---

## Customer PWA Testing (Browser)

### Test Setup

1. Open Chrome DevTools → Network tab (throttling: No throttling)
2. Device toolbar: iPhone 12 Pro (390×844)
3. Disable cache checked

### 1. Home Page (`/`)

**Test:** Navigate to `http://localhost:3000`

**Expected:**
- MenuGo branding displayed
- "Scan the QR code on your table" message
- Orange logo with "M"

**With session:**
1. Manually set in console: `sessionStorage.setItem('sessionId', 'test')`
2. `sessionStorage.setItem('restaurantId', '<id>')`
3. Refresh page

**Expected:** Auto-redirect to `/menu/<restaurantId>`

### 2. Scan Page (`/scan/[token]`)

**Test:** Navigate to `http://localhost:3000/scan/<qr-token>`

**Expected:**
- "Welcome! How many people are dining today?"
- Counter defaults to 1
- + and - buttons work (min 1)

**Seat Counter:**
- Tap + → count increases
- Tap - when 1 → stays at 1 (no negative)

**Submit:**
- Tap "See the menu"
- **Expected:** Session created, stored in sessionStorage, redirected to menu

**Table Full Test:**
1. Fill table via API (seatsOccupied = totalSeats)
2. Try to scan same table with 1 seat
- **Expected:** Error banner "Table is full. Only 0 seat(s) available."

**Session Storage Verify:**
```javascript
sessionStorage.getItem('sessionId')     // should exist
sessionStorage.getItem('sessionToken')  // JWT string
sessionStorage.getItem('restaurantId') // UUID
sessionStorage.getItem('workflowMode')  // MANAGED_DINING | etc
sessionStorage.getItem('tableNumber')   // T1, T2, etc
```

### 3. Menu Page (`/menu/[restaurantId]`)

**Test:** Navigate after scan or directly with session

**Expected:**
- Sticky header: "Menu" + "Table T1"
- Categories as section headers (uppercase, small)
- Items as cards with image, name, description, price in ₹
- Add (+) button on each item

**Add to Cart:**
1. Tap + on "Chicken Biriyani"
2. **Expected:** Quantity shows "1", + button changes to - 1 +

**Cart Counter:**
- Add multiple items
- **Expected:** Cart bar shows item count and total

**Price Format:**
- **Expected:** `₹180.00` (2 decimal places)

**Remove from Cart:**
- Tap - on item with qty 1
- **Expected:** Item removed from cart, qty badge hidden

**Session Guard:**
1. Clear sessionStorage: `sessionStorage.clear()`
2. Refresh `/menu/<restaurant-id>`
- **Expected:** Redirect to `/?error=session_expired`

**Place Order:**
1. Add items to cart
2. Tap "Place order"
3. **Expected:** Cart clears, redirected to `/track/<order-id>`

### 4. Order Tracking Page (`/track/[orderId]`)

**Test:** Navigate after placing order or directly

**Expected:**
- Header: "Order Tracker" + "Table T1"
- Item cards with name, quantity, status badge

**Status Badge Colors:**
| Status | Color |
|--------|-------|
| PENDING | Gray |
| ACCEPTED | Blue |
| PREPARING | Orange |
| READY | Green |
| SERVED | Brand (dark orange) |

**Polling:**
- Open Network tab
- **Expected:** GET `/api/orders/<id>` every 10 seconds

**Banners by Workflow:**

**ASSISTED_DINING:**
- Single banner: "Order received. Your server will bring everything shortly." (blue)

**MANAGED_DINING:**
- Partial ready: "Some items are ready — your server is on the way!" (yellow)
- Fully ready: (same as partial, or all served = green celebration)

**SELF_COLLECTION:**
- Any item READY: "Ready for Pickup at [Kitchen Name]" (orange, pulsing)
- Shows unique kitchen names from READY items

**All Served State:**
- All items marked SERVED
- **Expected:** Green banner "All done! Enjoy your meal."

**Order More:**
- Tap "+ Order more"
- **Expected:** Navigate to `/menu/<restaurantId>`

---

## PWA Install Testing

### Manifest Check

1. Open DevTools → Application → Manifest
2. **Expected:**
   - Name: "Restaurant Order"
   - Short name: "Order"
   - Start URL: "/"
   - Display: "standalone"
   - Theme color: #f97316
   - Icons: 192×192, 512×512

### Install Prompt

1. Open in Chrome mobile emulator
2. Look for install icon in address bar
3. **Expected:** "Add to Home Screen" prompt available

### Offline Check

1. Install PWA to home screen (if possible)
2. Turn off network
3. Refresh
- **Expected:** Basic offline page or cached home page

---

## Error Cases to Test

| Test | Scenario | Expected |
|------|----------|----------|
| Invalid QR token | `/scan/invalid-token` | "Invalid QR code" error |
| Session mismatch | order with wrong sessionToken | 401 Unauthorized |
| Session closed | order after session cleared | "Session not found" |
| Item from other restaurant | menuItemId not in this restaurant | 400 error |
| Zero quantity | quantity: 0 in order item | 400 validation error |
| Empty order | items: [] | 400 min 1 item required |
| Expired sessionToken | wait 8+ hours | JWT expired error |

---

## Workflow Mode Testing

### Setup via Admin API

```bash
# Change to SELF_COLLECTION
curl -X PATCH http://localhost:3001/api/admin/restaurant/workflow-mode \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"workflowMode":"SELF_COLLECTION"}'
```

### Verify Mode Persistence

1. Create order in SELF_COLLECTION mode
2. Change restaurant to ASSISTED_DINING via admin
3. Check order status
- **Expected:** Order still shows `workflowMode: SELF_COLLECTION` (denormalized)

---

## Checklist

- [ ] Session creation returns 8h JWT token
- [ ] Table full returns 409 with availableSeats
- [ ] Menu endpoint filters unavailable items
- [ ] Menu items include kitchenId
- [ ] Order stores workflowMode at creation time
- [ ] Order items denormalize kitchenId from menu item
- [ ] Order status includes tableNumber, kitchenName
- [ ] Scan page handles 409 gracefully
- [ ] Menu page guards missing session (redirects home)
- [ ] Cart updates instantly on add/remove
- [ ] Tracking page polls every 10s
- [ ] Status badge colors match spec
- [ ] All 3 workflow mode banners render correctly
- [ ] SELF_COLLECTION shows kitchen names in pickup banner
- [ ] "Order more" returns to same session
- [ ] PWA manifest valid and installable
- [ ] Home page auto-redirects if session exists
- [ ] All mobile-first, usable on 375px width

---

## Troubleshooting

### "Invalid QR code" error
- Verify qrToken from database matches URL
- Check table exists with valid qrToken

### Menu not loading
- Check API is running on port 3001
- Verify restaurantId in URL is correct

### Session expired redirect loop
- Clear sessionStorage manually
- Re-scan QR code

### Order placement fails
- Verify sessionToken not expired
- Check all menuItemIds are available
- Verify session is still ACTIVE

### Tracking not updating
- Check Network tab for polling requests
- Verify orderId in URL is correct

---

## Next Phase

After Phase 3 tests pass, proceed to Phase 4 (Real-time with Socket.io).
