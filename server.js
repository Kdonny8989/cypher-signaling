const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

// Enable CORS for cross-platform clients
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true // Support legacy socket.io clients
});

// Liveness health-check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: Date.now() });
});

// Client registry
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`Connected client: ${socket.id}`);

  // Users register their unique E2EE account ID on connection
  socket.on('register', (userId) => {
    socket.join(userId);
    connectedUsers.set(socket.id, userId);
    console.log(`User registered: ${userId} on socket ${socket.id}`);
  });

  // Relay WebRTC Session Description (SDP Offers/Answers)
  socket.on('call-signal', (data) => {
    const { to, signal, from } = data;
    console.log(`Routing SDP signal from ${from} to ${to} (${signal.type})`);
    io.to(to).emit('call-signal-received', {
      from: from,
      signal: signal
    });
  });

  // Relay ICE network routing candidates
  socket.on('ice-candidate', (data) => {
    const { to, candidate, from } = data;
    io.to(to).emit('ice-candidate-received', {
      from: from,
      candidate: candidate
    });
  });

  socket.on('disconnect', () => {
    const userId = connectedUsers.get(socket.id);
    if (userId) {
      connectedUsers.delete(socket.id);
      console.log(`User offline: ${userId}`);
    }
  });
});

// Port configuration
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
