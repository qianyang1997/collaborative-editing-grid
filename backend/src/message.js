const Redis = require('ioredis');
const { insertIntoDB, readFromDB } = require('./db');

const CHANNEL = process.env.REDIS_CHANNEL;
const SAVE_TIMEOUT = Number(process.env.REDIS_SAVE_TIMEOUT);
const MAXLEN = Number(process.env.REDIS_MAXLEN);

// Redis message queue
const pub = new Redis();
const sub = new Redis();
const save = new Redis();

// Subscribe to new Redis messages
const listenForMessage = async (wsServer, wsClient, clientId, lastId = '$') => {
  console.log('Listening for message for client', clientId, lastId);

  // Stop subscription if client is closed
  if (wsClient.readyState !== WebSocket.OPEN) {
    return;
  }

  const results = await sub.xread('BLOCK', 0, 'STREAMS', CHANNEL, lastId);
  const [_, messages] = results[0];

  messages.forEach(([key, [_, message]]) => {
    // Exclude the client who sent the message
    const senderId = JSON.parse(message).payload.user;
    if (wsClient.readyState === WebSocket.OPEN && senderId !== clientId) {
      wsClient.send(message);
    }
  });

  // Pass the last id of the results to the next round.
  await listenForMessage(wsServer, wsClient, clientId, messages[messages.length - 1][0]);
};

// Save batches of data to permanent storage
const saveMessage = async (lastId = '0') => {
  // Read all messages within a TIMEOUT block
  const results = await save.xread('BLOCK', SAVE_TIMEOUT, 'STREAMS', CHANNEL, lastId);
  if (!results) return;

  const [_, messages] = results[0];

  if (messages.length) {
    // Insert messages into DB
    const saveStatus = await Promise.all(
      messages.map(([key, [_, message]]) => insertIntoDB(key, message))
    );

    // Log insert status
    let rowsInserted = 0;
    let rowsFailed = 0;
    for (let i = 0; i < saveStatus.length; i++) {
      if (saveStatus[i] >= 0) rowsInserted += saveStatus[i];
      else rowsFailed += saveStatus[i];
    }

    if (!rowsFailed) {
      // Trim message queue if insertion successful; keep a buffer
      const numDeleted = await pub.xtrim(CHANNEL, 'MAXLEN', ['~', MAXLEN]);
      return {
        status: 'success',
        rowsInserted,
        numDeleted,
        upsertTimestamp: new Date().toISOString()
      };
    } else {
      // Do not trim message queue if insertion unsuccessful
      return { status: 'failed', rowsFailed, upsertTimestamp: new Date().toISOString() };
    }
  }
};

const processMessage = (key, value, user_data, edit_data) => {
  const parsedValue = JSON.parse(value);

  if (parsedValue.type === 'USER') {
    // Create a list of currently active users
    if (parsedValue.payload.status === 'open') {
      user_data[parsedValue.payload.user] = parsedValue.payload;
    } else {
      delete user_data[parsedValue.payload.user];
    }
  } else if (parsedValue.type === 'EDIT') {
    // Create the latest snapshot of grid data
    const { rowKey, columnKey, value, user } = parsedValue.payload;
    edit_data[`${rowKey}-${columnKey}`] = { value, user, id: key };
  }
};

const readInitialBatch = async (socket) => {
  console.log('Reading initial batch');

  let edit_data = {};
  let user_data = {};

  // Get DB and message queue data
  const [db_data, queue_data] = await Promise.all([readFromDB(), pub.xrange(CHANNEL, '-', '+')]);

  let last_id;

  // Query messages from DB
  db_data
    .sort((a, b) => a.ID - b.ID)
    .forEach((message) => {
      last_id = message.ID;
      processMessage(message.ID, message.message, user_data, edit_data);
    });

  // Query messages from Redis message queue
  queue_data.forEach(([key, [_, value]]) => {
    // If key already exists in DB, skip
    if (key <= last_id) {
      return;
    }

    processMessage(key, value, user_data, edit_data);
  });

  socket.send(JSON.stringify({ type: 'DATA', payload: { data_type: 'user', message: user_data } }));
  socket.send(JSON.stringify({ type: 'DATA', payload: { data_type: 'data', message: edit_data } }));
};

module.exports = {
  CHANNEL,
  pub,
  sub,
  listenForMessage,
  saveMessage,
  readInitialBatch
};
