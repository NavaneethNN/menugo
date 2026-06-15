import type { MenuItem, Category, Kitchen, Order, TableSession, Table } from './models';
import type { OrderItemStatus, WorkflowMode } from './enums';

// ---- Request / Response shapes for REST API ----

// POST /api/sessions
export interface CreateSessionRequest {
  qrToken: string;
  seatsOccupied: number;
}
export interface CreateSessionResponse {
  sessionId: string;
  sessionToken: string;
  tableNumber: string;
  restaurantId: string;
  workflowMode: WorkflowMode;
}

// GET /api/restaurants/:id/menu
export interface MenuResponse {
  categories: Array<
    Category & {
      items: MenuItem[];
    }
  >;
}

// POST /api/orders
export interface CreateOrderRequest {
  sessionId: string;
  sessionToken: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    specialInstructions?: string;
  }>;
}
export type CreateOrderResponse = Order;

// GET /api/orders/:id
export type GetOrderResponse = Order;

// PATCH /api/order-items/:id/status
export interface UpdateOrderItemStatusRequest {
  status: OrderItemStatus;
}

// PATCH /api/orders/:id/served
export interface MarkOrderServedRequest {
  orderItemIds?: string[];
}

// GET /api/cashier/tables
export interface CashierTableView {
  tableId: string;
  tableNumber: string;
  totalSeats: number;
  availableSeats: number;
  sessions: Array<
    TableSession & {
      items: Array<{
        menuItemName: string;
        quantity: number;
        price: string;
        kitchenName: string;
      }>;
    }
  >;
}
export type CashierTablesResponse = CashierTableView[];

// PATCH /api/sessions/:id/close
export interface CloseSessionResponse {
  success: boolean;
  sessionId: string;
}

// Admin CRUD — generic
export interface AdminCreateTableRequest {
  tableNumber: string;
  totalSeats: number;
}
export interface AdminCreateTableResponse extends Table {
  qrCodeDataUrl: string;
}

export interface AdminCreateMenuItemRequest {
  name: string;
  description?: string;
  price: number;
  categoryId: string;
  kitchenId: string;
  imageUrl?: string;
  isAvailable?: boolean;
}

export interface AdminCreateStaffRequest {
  name: string;
  role: string;
  pin: string;
  kitchenId?: string;
}

export interface AdminSetWorkflowModeRequest {
  workflowMode: WorkflowMode;
}
