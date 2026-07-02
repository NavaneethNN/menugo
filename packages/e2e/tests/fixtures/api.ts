import { API_BASE } from '../../playwright.config';

export async function loginStaff(restaurantId: string, pin: string) {
  const res = await fetch(`${API_BASE}/api/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId, pin }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return (await res.json()) as { token: string; staff: { id: string; role: string; kitchenId: string | null } };
}

export async function createSession(qrToken: string, seatsOccupied: number) {
  const res = await fetch(`${API_BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrToken, seatsOccupied }),
  });
  if (!res.ok) throw new Error(`Session creation failed: ${res.status}`);
  return (await res.json()) as {
    sessionId: string;
    sessionToken: string;
    restaurantId: string;
    workflowMode: string;
    tableNumber: string;
  };
}

export async function createOrder(sessionId: string, sessionToken: string, items: { menuItemId: string; quantity: number }[]) {
  const res = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, sessionToken, items }),
  });
  if (!res.ok) throw new Error(`Order creation failed: ${res.status}`);
  return (await res.json()) as { orderId: string; items: { id: string; menuItemId: string; status: string }[] };
}

export async function updateItemStatus(token: string, orderItemId: string, status: string) {
  const res = await fetch(`${API_BASE}/api/order-items/${orderItemId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Status update failed: ${res.status}`);
  return res.json();
}

export async function markOrderServed(token: string, orderId: string) {
  const res = await fetch(`${API_BASE}/api/orders/${orderId}/served`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Mark served failed: ${res.status}`);
  return res.json();
}

export async function closeSession(token: string, sessionId: string) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/close`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Close session failed: ${res.status}`);
  return res.json();
}

export async function getKitchenOrders(token: string) {
  const res = await fetch(`${API_BASE}/api/kitchen/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Kitchen orders failed: ${res.status}`);
  return (await res.json()) as {
    id: string;
    orderId: string;
    menuItemName: string;
    status: string;
    order: { workflowMode: string };
  }[];
}

export async function getWaiterOrders(token: string) {
  const res = await fetch(`${API_BASE}/api/waiter/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Waiter orders failed: ${res.status}`);
  return (await res.json()) as {
    id: string;
    tableNumber: string;
    status: string;
    workflowMode: string;
    items: { id: string; menuItemName: string; quantity: number }[];
  }[];
}

export async function getCashierTables(token: string) {
  const res = await fetch(`${API_BASE}/api/cashier/tables`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Cashier tables failed: ${res.status}`);
  return (await res.json()) as {
    tableId: string;
    tableNumber: string;
    totalSeats: number;
    availableSeats: number;
    activeSessions: {
      sessionId: string;
      seatsOccupied: number;
      durationMinutes: number;
      sessionTotal: string;
      allServed: boolean;
      orders: { orderId: string; placedAt: string; items: { name: string; quantity: number; price: string; subtotal: string; status: string }[] }[];
    }[];
  }[];
}

export async function setRestaurantWorkflowMode(token: string, mode: string) {
  const res = await fetch(`${API_BASE}/api/admin/restaurant/workflow-mode`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ workflowMode: mode }),
  });
  if (!res.ok) throw new Error(`Workflow mode update failed: ${res.status}`);
  return res.json();
}
