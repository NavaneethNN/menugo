import { createServer } from 'http';
import { Server } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  StaffRole,
} from '@restaurant/shared-types';
import { verifyToken } from './lib/auth';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      uptime: process.uptime(),
      connectedClients: io.engine.clientsCount 
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  httpServer,
  {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  }
);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (token) {
      const payload = await verifyToken(token);
      socket.data.staffId = payload.staffId;
      socket.data.restaurantId = payload.restaurantId;
      socket.data.role = payload.role;
      socket.data.kitchenId = payload.kitchenId;
    } else {
      socket.data.role = 'CUSTOMER';
    }
    next();
  } catch (error) {
    console.log(`[socket] auth failed for ${socket.id}:`, error);
    next(new Error('Authentication error'));
  }
});

function validateRoomAccess(socketId: string, roomId: string, socketData: Partial<SocketData>): boolean {
  const sessionPattern = /^session:([a-f0-9-]+)$/;
  const kitchenPattern = /^restaurant:([a-f0-9-]+):kitchen:([a-f0-9-]+)$/;
  const waiterPattern = /^restaurant:([a-f0-9-]+):waiter$/;
  const cashierPattern = /^restaurant:([a-f0-9-]+):cashier$/;
  const adminPattern = /^restaurant:([a-f0-9-]+):admin$/;

  if (sessionPattern.test(roomId)) {
    return true;
  }

  const kitchenMatch = roomId.match(kitchenPattern);
  if (kitchenMatch) {
    const [, restaurantId, kitchenId] = kitchenMatch;
    return socketData.role === 'KITCHEN' && 
           socketData.restaurantId === restaurantId && 
           socketData.kitchenId === kitchenId;
  }

  const waiterMatch = roomId.match(waiterPattern);
  if (waiterMatch) {
    const [, restaurantId] = waiterMatch;
    return socketData.role === 'WAITER' && socketData.restaurantId === restaurantId;
  }

  const cashierMatch = roomId.match(cashierPattern);
  if (cashierMatch) {
    const [, restaurantId] = cashierMatch;
    return socketData.role === 'CASHIER' && socketData.restaurantId === restaurantId;
  }

  const adminMatch = roomId.match(adminPattern);
  if (adminMatch) {
    const [, restaurantId] = adminMatch;
    return socketData.role === 'ADMIN' && socketData.restaurantId === restaurantId;
  }

  return false;
}

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}, role: ${socket.data.role || 'CUSTOMER'}`);

  socket.on('join_room', (roomId: string) => {
    if (!validateRoomAccess(socket.id, roomId, socket.data)) {
      console.log(`[socket] ${socket.id} denied access to room: ${roomId}`);
      socket.emit('error', { message: 'Access denied to room' });
      return;
    }

    socket.join(roomId);
    console.log(`[socket] ${socket.id} joined room: ${roomId}`);
  });

  socket.on('join_rooms', (roomIds: string[]) => {
    const validRooms: string[] = [];
    
    for (const roomId of roomIds) {
      if (validateRoomAccess(socket.id, roomId, socket.data)) {
        validRooms.push(roomId);
      } else {
        console.log(`[socket] ${socket.id} denied access to room: ${roomId}`);
      }
    }

    if (validRooms.length > 0) {
      socket.join(validRooms);
      console.log(`[socket] ${socket.id} joined rooms: ${validRooms.join(', ')}`);
    }
  });

  socket.on('order_item:status_update', (data) => {
    socket.broadcast.emit('order_item:status_update', data);
  });

  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

// Export io so the API can import it to emit events (when co-located)
export { io };

httpServer.listen(PORT, () => {
  console.log(`🚀 Realtime server running on port ${PORT}`);
});
