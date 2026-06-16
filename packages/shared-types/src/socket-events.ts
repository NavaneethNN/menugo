import type { OrderItemStatus } from './enums';

// ---- Shared item shape used in events ----

export interface EventOrderItem {
  orderItemId: string;
  name: string;
  qty: number;
  specialInstructions: string | null;
  kitchenName?: string;
}

// ---- Server → Kitchen room ----

export interface OrderNewEvent {
  orderId: string;
  tableNumber: string;
  items: EventOrderItem[];
}

// ---- Server → Waiter room (Assisted Dining) ----

export interface OrderNewFullEvent {
  orderId: string;
  tableNumber: string;
  items: EventOrderItem[];
}

// ---- Bidirectional: Kitchen → Server → Customer ----

export interface OrderItemStatusUpdateEvent {
  orderItemId: string;
  status: OrderItemStatus;
}

// ---- Server → Waiter room (Managed Dining) ----

export interface OrderPartiallyReadyEvent {
  orderId: string;
  tableNumber: string;
  readyItems: EventOrderItem[];
  pendingItems: EventOrderItem[];
}

// ---- Server → Waiter room (Managed) OR Customer room (Self Collection) ----

export interface OrderFullyReadyEvent {
  orderId: string;
  tableNumber: string;
  items: EventOrderItem[];
}

// ---- Server → Customer room (Self Collection) ----

export interface OrderItemReadyForPickupEvent {
  orderItemId: string;
  name: string;
  kitchenName: string;
}

// ---- Server → Customer room ----

export interface OrderCompletedEvent {
  orderId: string;
}

// ---- Server → Customer room (force-disconnect) ----

export interface SessionClosedEvent {
  tableSessionId: string;
}

// ---- Server → Admin/Cashier room ----

export interface TableSeatsUpdatedEvent {
  tableId: string;
  availableSeats: number;
}

// ---- Socket.io typed event maps ----

export interface ServerToClientEvents {
  'order:new': (data: OrderNewEvent) => void;
  'order:new_full': (data: OrderNewFullEvent) => void;
  'order_item:status_update': (data: OrderItemStatusUpdateEvent) => void;
  'order:partially_ready': (data: OrderPartiallyReadyEvent) => void;
  'order:fully_ready': (data: OrderFullyReadyEvent) => void;
  'order:item_ready_for_pickup': (data: OrderItemReadyForPickupEvent) => void;
  'order:completed': (data: OrderCompletedEvent) => void;
  'session:closed': (data: SessionClosedEvent) => void;
  'table:seats_updated': (data: TableSeatsUpdatedEvent) => void;
  'error': (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  'order_item:status_update': (data: OrderItemStatusUpdateEvent) => void;
  join_room: (roomId: string) => void;
  join_rooms: (roomIds: string[]) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  staffId?: string;
  restaurantId?: string;
  role?: 'KITCHEN' | 'WAITER' | 'CASHIER' | 'ADMIN' | 'CUSTOMER';
  kitchenId?: string;
  tableSessionId?: string;
}
