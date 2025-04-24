const http = require('http');
const { WebSocketServer } = require('ws');
const {
  listenForMessage,
  saveMessage,
  readInitialBatch,
  addNewClient,
  dropClosedClient,
  addNewMessage
} = require('./message');
const { broadcastSystemError } = require('./util');

const SAVE_INTERVAL = Number(process.env.REDIS_SAVE_INTERVAL);
const PORT = Number(process.env.PORT);

// Handle Redis or DB connection errors not caught by try-catch blocks
process.on('unhandledRejection', (reason, _) => {
  console.error('🔴 Unhandled Promise Rejection:', reason);
});

// HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });

  // Health check
  if (req.url === '/api/health') {
    res.status(200);
    res.end(JSON.stringify({ status: 200 }));
  } else {
    res.status(404);
    res.end(JSON.stringify({ status: 404, message: `Endpoint ${url} not found.` }));
  }
});

// Websocket
const ws = new WebSocketServer({ server });

ws.on('connection', (socket, req) => {
  // Identify unique client
  const clientId = req.headers['sec-websocket-key'];

  // Subscribe to Redis messages
  listenForMessage(ws, socket, clientId);

  // Get initial batch of data from DB and in-memory store
  readInitialBatch(socket).then((data) => {
    if (data.status === 'error') {
      broadcastSystemError(socket, data.message);
    } else {
      // Broadcast new client status to active clients
      addNewClient(clientId);
    }
  });

  // Broadcast user message to all active users
  socket.on('message', (data) => {
    const parsedData = JSON.parse(data);

    if (parsedData.type == 'EDIT') {
      // Publish to Redis queue
      parsedData.payload.user = clientId;
      addNewMessage(parsedData, socket);
    }
  });

  socket.on('error', (error) => {
    console.error(error);
  });

  // Broadcast client offline status to all active users
  socket.on('close', () => {
    dropClosedClient(clientId);
  });
});

// Persist message queue to DB on schedule
setInterval(() => {
  saveMessage()
    .then((data) => {
      if (data) {
        console.log('Message save status:', data);
        // If Redis is down, close client sessions one by one
        if (data.status === 'error' && data.failedServices.includes('redis')) {
          ws.clients.forEach((client) => {
            broadcastSystemError(client, data.message);
          });
        }
      }
    })
    .catch((error) => {
      console.error('Message save error:', error.message);
    });
}, SAVE_INTERVAL);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}.`);
});
