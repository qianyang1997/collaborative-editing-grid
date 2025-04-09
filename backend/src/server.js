const http = require('http');
const { WebSocketServer } = require('ws');
const { CHANNEL, pub, listenForMessage, saveMessage } = require('./message');

// HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  const { method, url } = req;

  if (url === '/api/health') {
    res.status(200);
    res.end(JSON.stringify({ status: 200 }));
    //   } else if (url === '/api/edit') {
    //     switch (method) {
    //       case 'GET':
    //         handleGetEdit(req, res);
    //         break;
    //       case 'POST':
    //         handlePostEdit(req, res);
    //         break;
    //       default:
    //         res.status(404);
    //         res.end(
    //           JSON.stringify({
    //             status: 404,
    //             message: `Method ${method} not available for endpoint ${url}.`
    //           })
    //         );
    //     }
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

  // Broadcast new client status to active clients
  pub.xadd(
    CHANNEL,
    '*',
    'data',
    JSON.stringify({ type: 'USER', payload: { status: 'open', user: clientId } })
  );

  // Query latest edits from Redis message queue
  pub.xrange(CHANNEL, '-', '+').then((queue_data) => {
    let edit_data = {};
    let user_data = {};

    queue_data.forEach(([key, [_, value]]) => {
      const parsedValue = JSON.parse(value);
      if (parsedValue.type === 'USER') {
        if (parsedValue.payload.status === 'open') {
          user_data[parsedValue.payload.user] = parsedValue.payload;
        } else {
          delete user_data[parsedValue.payload.user];
        }
      } else if (parsedValue.type === 'EDIT') {
        const { rowKey, columnKey, value, user } = parsedValue.payload;
        edit_data[`${rowKey}-${columnKey}`] = { value, user, id: key };
      }
    });

    socket.send(
      JSON.stringify({ type: 'DATA', payload: { data_type: 'user', message: user_data } })
    );
    socket.send(
      JSON.stringify({ type: 'DATA', payload: { data_type: 'data', message: edit_data } })
    );
  });

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
      JSON.stringify({ type: 'USER', payload: { status: 'closed', user: clientId } })
    );
  });
});

// TODO - run on schedule
setInterval(() => {
  saveMessage();
}, 1000000);

server.listen(5001, '0.0.0.0', () => {
  console.log('Server listening on port 5001.');
});
