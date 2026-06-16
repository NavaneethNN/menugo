import type { Server } from 'socket.io';
import type { ServerToClientEvents } from '@restaurant/shared-types';

let ioInstance: Server<any, any, any, any> | null = null;

export function setIoInstance(io: Server<any, any, any, any>) {
  ioInstance = io;
}

export function emitToRoom<T extends keyof ServerToClientEvents>(
  room: string,
  event: T,
  payload: Parameters<ServerToClientEvents[T]>[0]
): void {
  if (!ioInstance) {
    console.error('[emit] Socket.io instance not initialized');
    return;
  }

  try {
    ioInstance.to(room).emit(event, payload);
    console.log(`[emit] ${event} to room ${room}:`, payload);
  } catch (error) {
    console.error(`[emit] Failed to emit ${event} to room ${room}:`, error);
  }
}
