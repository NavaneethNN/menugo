import type { WorkflowMode, StaffRole, SessionStatus, OrderItemStatus, OrderStatus } from './enums';

export interface Restaurant {
  id: string;
  name: string;
  workflowMode: WorkflowMode;
  createdAt: string;
}

export interface Table {
  id: string;
  restaurantId: string;
  tableNumber: string;
  totalSeats: number;
  qrToken: string;
}

export interface TableSession {
  id: string;
  tableId: string;
  seatsOccupied: number;
  status: SessionStatus;
  startedAt: string;
  closedAt: string | null;
  closedBy: string | null;
}

export interface Category {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
}

export interface Kitchen {
  id: string;
  restaurantId: string;
  name: string;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  kitchenId: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
}

export interface Staff {
  id: string;
  restaurantId: string;
  name: string;
  role: StaffRole;
  kitchenId: string | null;
  isActive: boolean;
}

export interface Order {
  id: string;
  tableSessionId: string;
  status: OrderStatus;
  workflowMode: WorkflowMode;
  tableNumber: string;
  createdAt: string;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItemName: string;
  kitchenId: string;
  kitchenName: string;
  quantity: number;
  specialInstructions: string | null;
  status: OrderItemStatus;
  readyAt: string | null;
  servedAt: string | null;
}
