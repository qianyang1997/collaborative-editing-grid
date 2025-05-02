const Redis = require('ioredis');
const { insertIntoDB, readFromDB, checkDBHealth } = require('./db');
const { broadcastSystemError } = require('./util');
const { addToInMemoryLog, persistInMemoryLogToDB, inMemoryLog } = require('./memory');

const CHANNEL = process.env.REDIS_CHANNEL;
const HOST = process.env.REDIS_HOST;
const PORT = process.env.REDIS_PORT;
const SAVE_TIMEOUT = Number(process.env.REDIS_SAVE_TIMEOUT);
const MAXLEN = Number(process.env.REDIS_MAXLEN);
const RETRY_LIMIT = Number(process.env.REDIS_RETRY_LIMIT);
const MAX_RETRY_INTERVAL = Number(process.env.REDIS_MAX_RETRY_INTERVAL);

const REDIS_CONFIG = {
  host: HOST,
  port: PORT,

  // Retries indefinitely
  maxRetriesPerRequest: null,

  // Uses a capped exponential backoff retry strategy
  retryStrategy: (times) => {
    if (times > RETRY_LIMIT) {
      return MAX_RETRY_INTERVAL;
    }
    return Math.min(times * 100, MAX_RETRY_INTERVAL);
  }
};

// Redis message queue
const pub = new Redis(REDIS_CONFIG);
const sub = new Redis(REDIS_CONFIG);
const save = new Redis(REDIS_CONFIG);

// Log redis connection status
pub.on('ready', () => {
  console.log('Redis connection is ready.');
});

pub.on('connect', () => {
  console.log('Connected to Redis.');
});

pub.on('reconnecting', (time) => {
  console.log(`Reconnecting to Redis in ${time}ms...`);
});

// Check Redis connection
const checkRedisHealth = async () => {
  if (pub.status != 'ready') {
    return false;
  }
  return true;
};

// Share Redis & DB health status
const checkHealthStatus = async () => {
  let status = 'success';
  let failedServices = [];

  const [redisStatus, dbStatus] = await Promise.all([checkRedisHealth(), checkDBHealth()]);
  if (!redisStatus) {
    status = 'error';
    failedServices.push('redis');
  }
  if (!dbStatus) {
    status = 'error';
    failedServices.push('mysql');
  }
  return {
    status,
    failedServices,
    message: `One or more backend services are down. Failed services: ${failedServices}.`
  };
};

// Log client open status
const addNewClient = async (clientId) => {
  // Broadcast client status to all active users
  pub.xadd(
    CHANNEL,
    '*',
    'data',
    JSON.stringify({
      type: 'USER',
      payload: { status: 'open', user: clientId, timestamp: new Date().toISOString() }
    })
  );
};

// Log client closed status
const dropClosedClient = async (clientId) => {
  // Redis & DB health check
  const healthCheck = await checkHealthStatus();

  // If mysql and/or redis is down, log error
  if (healthCheck.status === 'error') {
    const { failedServices } = healthCheck;

    if (failedServices.includes('mysql') && !failedServices.includes('redis')) {
      // If mysql is down but redis ready, broadcast error status to redis
      pub.xadd(
        CHANNEL,
        '*',
        'data',
        JSON.stringify({
          type: 'USER',
          payload: {
            status: 'error',
            user: clientId,
            timestamp: new Date().toISOString(),
            message: 'Client session failed due to mysql server'
          }
        })
      );
    } else if (failedServices.includes('redis') && !failedServices.includes('mysql')) {
      // If redis is down but mysql is ready, add client error status to DB to ensure data consistency when system goes back up
      const id = `ERROR__${clientId}`;
      const message = JSON.stringify({
        type: 'USER',
        payload: {
          status: 'error',
          user: clientId,
          timestamp: new Date().toISOString(),
          message: `Client session failed due to Redis server`
        }
      });
      const status = await insertIntoDB(id, message);
      console.log('Inserting client error to DB due to Redis shutdown. Insert status:', status);
    } else {
      // If both services are down, log client error session to in-memory store
      const id = `ERROR__${clientId}`;
      const message = JSON.stringify({
        type: 'USER',
        payload: {
          status: 'error',
          user: clientId,
          timestamp: new Date().toISOString(),
          message: `Client session failed; both redis and mysql are unavailable`
        }
      });
      addToInMemoryLog(id, message);
      console.log(
        'Both redis and mysql are down. Adding client error status to in-memory log:',
        id
      );
    }

    return;
  }

  // If backend services are running, broadcast client status to all active users
  pub.xadd(
    CHANNEL,
    '*',
    'data',
    JSON.stringify({
      type: 'USER',
      payload: { status: 'closed', user: clientId, timestamp: new Date().toISOString() }
    })
  );
};

// Add message to message queue
const addNewMessage = async (message, wsClient) => {
  if (pub.status !== 'ready') {
    // Close client session if Redis is down
    broadcastSystemError(wsClient, 'Redis server is not available.');
  } else {
    // Broadcast message to all active users
    pub
      .xadd(CHANNEL, '*', 'data', JSON.stringify(message))
      // Send message save status back to client
      .then((id) => {
        wsClient.send(JSON.stringify({ type: 'SAVE', payload: { id, status: 200 } }));
      })
      .catch((error) => {
        wsClient.send(JSON.stringify({ type: 'SAVE', payload: { error, status: 400 } }));
      });
  }
};

// Subscribe to new Redis messages
const listenForMessage = async (wsServer, wsClient, clientId, lastId = '$') => {
  console.log('Listening for message for client', clientId, lastId);

  // Stop subscription if client is closed
  if (wsClient.readyState !== WebSocket.OPEN) {
    return;
  }

  // Stop client server if Redis is down
  if (sub.status !== 'ready') {
    broadcastSystemError(wsServer, 'Redis server is not available.');
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
  // Redis & DB health check
  const healthCheck = await checkHealthStatus();

  // If DB is on and in-memory log is not empty, persist to DB
  if (healthCheck.status !== 'error' || !healthCheck.failedServices.includes('mysql')) {
    const saveStatus = await persistInMemoryLogToDB();
    if (saveStatus) console.log('Persist in-memory log to DB:', saveStatus);
  }

  // If health check fails, return error
  if (healthCheck.status === 'error') return healthCheck;

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
  // Redis & DB health check
  const healthCheck = await checkHealthStatus();
  if (healthCheck.status === 'error') return healthCheck;

  let edit_data = {};
  let user_data = {};

  // Get DB, message queue, and in-memory data
  // Copy in-memory log first to tackle the edge case where in-memory data is truncated after DB data is pulled
  const in_memory_data = [...Object.values(inMemoryLog)];
  const [db_data, queue_data] = await Promise.all([readFromDB(), pub.xrange(CHANNEL, '-', '+')]);

  let last_id;

  // Query messages from DB
  db_data
    // Note that all the ERROR logs prefixed with `ERROR__` are placed after Redis entries.
    // This ensures all the users that had force shutdowns are properly closed out.
    .sort((a, b) => a.ID - b.ID)
    .forEach((message) => {
      if (!message.ID.startsWith('ERROR__')) last_id = message.ID;
      processMessage(message.ID, message.message, user_data, edit_data);
    });

  // Query messages from Redis message queue
  queue_data.forEach(([key, [_, value]]) => {
    // If key already exists in DB, then it is already processed above. Skip
    if (key <= last_id) return;

    processMessage(key, value, user_data, edit_data);
  });

  // Query in-memory log
  in_memory_data.forEach((data) => {
    // Close out users that had forced shutdowns due to network error
    processMessage(_, data, user_data, edit_data);
  });

  if (Object.keys(user_data).length) {
    socket.send(
      JSON.stringify({ type: 'DATA', payload: { data_type: 'user', message: user_data } })
    );
  }
  if (Object.keys(edit_data).length) {
    socket.send(
      JSON.stringify({ type: 'DATA', payload: { data_type: 'data', message: edit_data } })
    );
  }

  return { status: 'success' };
};

module.exports = {
  checkRedisHealth,
  addNewClient,
  dropClosedClient,
  addNewMessage,
  listenForMessage,
  saveMessage,
  readInitialBatch
};
