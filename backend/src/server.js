const http = require('http');
const { WebSocketServer } = require('ws');
const { CHANNEL, pub, listenForMessage, saveMessage, readInitialBatch } = require('./message');

const SAVE_INTERVAL = Number(process.env.REDIS_SAVE_INTERVAL);
const PORT = Number(process.env.PORT);

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
  readInitialBatch(socket);

  // Broadcast new client status to active clients
  pub.xadd(
    CHANNEL,
    '*',
    'data',
    JSON.stringify({
      type: 'USER',
      payload: { status: 'open', user: clientId, timestamp: new Date().toISOString() }
    })
  );

  // Broadcast user message to all active users
  socket.on('message', (data) => {
    const parsedData = JSON.parse(data);

    if (parsedData.type == 'EDIT') {
      // Publish to Redis queue
      parsedData.payload.user = clientId;
      pub
        .xadd(CHANNEL, '*', 'data', JSON.stringify(parsedData))
        // Update save status and send back to client
        .then((id) => {
          socket.send(JSON.stringify({ type: 'SAVE', payload: { id, status: 200 } }));
        })
        .catch((error) => {
          socket.send(JSON.stringify({ type: 'SAVE', payload: { error, status: 400 } }));
        });
    }
  });

  socket.on('error', (error) => {
    console.log(error);
  });

  // Broadcast client offline status to all active users
  socket.on('close', () => {
    pub.xadd(
      CHANNEL,
      '*',
      'data',
      JSON.stringify({
        type: 'USER',
        payload: { status: 'closed', user: clientId, timestamp: new Date().toISOString() }
      })
    );
  });
});

// Persist message queue to DB on schedule
setInterval(() => {
  saveMessage().then((data) => {
    if (data) {
      console.log(data);
    }
  });
}, SAVE_INTERVAL);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}.`);
});
