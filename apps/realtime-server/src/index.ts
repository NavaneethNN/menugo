import { createServer } from 'http';
import { Server } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@restaurant/shared-types';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
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
  }
);

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on('join_room', (roomId: string) => {
    socket.join(roomId);
    console.log(`[socket] ${socket.id} joined room: ${roomId}`);
  });

  socket.on('order_item:status_update', (data) => {
    // Relay kitchen → customers in the session room
    // The API handles DB update; realtime server just relays
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
