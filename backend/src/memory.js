const { insertIntoDB } = require('./db');

const inMemoryLog = {};

const addToInMemoryLog = (id, message) => {
  inMemoryLog[id] = message;
};

const persistInMemoryLogToDB = async () => {
  // If in-memory log is empty, skip
  if (!Object.keys(inMemoryLog).length) return;

  // Insert all properties to DB
  const saveStatus = await Promise.all(
    Object.entries(inMemoryLog).map(([k, v]) => insertIntoDB(k, v))
  );

  // Log insert status
  let rowsInserted = 0;
  let rowsFailed = 0;
  for (let i = 0; i < saveStatus.length; i++) {
    if (saveStatus[i] >= 0) rowsInserted += saveStatus[i];
    else rowsFailed += saveStatus[i];
  }

  if (!rowsFailed) {
    // Truncate in memory log if insertion successful
    let numDeleted = 0;
    Object.keys(inMemoryLog).forEach((key) => {
      numDeleted++;
      delete inMemoryLog[key];
    });

    return {
      status: 'success',
      rowsInserted,
      numDeleted: Object.keys(inMemoryLog).length,
      upsertTimestamp: new Date().toISOString()
    };
  } else {
    // Do not modify in-memory log if insertion unsuccessful
    return { status: 'failed', rowsFailed, upsertTimestamp: new Date().toISOString() };
  }
};

module.exports = {
  inMemoryLog,
  addToInMemoryLog,
  persistInMemoryLogToDB
};
