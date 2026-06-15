import type { OrderItemStatus, OrderStatus } from '@restaurant/shared-types';

export function computeOrderStatus(itemStatuses: OrderItemStatus[]): OrderStatus {
  if (itemStatuses.length === 0) return 'PLACED';

  const allServed = itemStatuses.every((s) => s === 'SERVED');
  if (allServed) return 'COMPLETED';

  const allReadyOrServed = itemStatuses.every((s) => s === 'READY' || s === 'SERVED');
  if (allReadyOrServed) return 'FULLY_READY';

  const anyReady = itemStatuses.some((s) => s === 'READY');
  if (anyReady) return 'PARTIALLY_READY';

  return 'PLACED';
}
