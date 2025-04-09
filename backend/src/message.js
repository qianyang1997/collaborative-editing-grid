const Redis = require('ioredis');
const { insertIntoDB } = require('./db');

const CHANNEL = 'ioredis_channel';
const SAVE_TIMEOUT = 5000;
const MAXLEN = 500;

// Redis message queue
const pub = new Redis();
const sub = new Redis();
const save = new Redis();

// Subscribe to new Redis messages
const listenForMessage = async (wsServer, wsClient, clientId, lastId = '$') => {
  console.log('Listening for message for client', clientId, lastId);
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

// TODO - Save batches of data to permanent storage
const saveMessage = async (lastId = '0') => {
  console.log('saveMessage called');

  // Read all messages within a TIMEOUT block
  const results = await save.xread('BLOCK', SAVE_TIMEOUT, 'STREAMS', CHANNEL, lastId);
  const [_, messages] = results[0];

  if (messages.length) {
    // TODO - insert into DB, then delete from queue, but keep some as buffer
    const saveStatus = await Promise.all(
      messages.map(([key, [_, message]]) => insertIntoDB(message))
    );
    if (saveStatus.ok) {
      pub.xtrim(CHANNEL, 'MAXLEN', MAXLEN, { APPROXIMATE: true });
    }
  }
};

module.exports = {
  CHANNEL,
  pub,
  sub,
  listenForMessage,
  saveMessage
};
