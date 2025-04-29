const mysql = require('mysql2');

const TABLE_NAME = process.env.SQL_TABLE_NAME;

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.SQL_HOST,
  user: process.env.SQL_USER,
  password: process.env.SQL_PWD,
  database: process.env.SQL_DB,
  port: process.env.SQL_PORT,
  waitForConnections: true,
  connectionLimit: process.env.SQL_CONN_LIMIT,
  queueLimit: process.env.SQL_QUEUE_LIMIT
});

// Using pool to execute queries
const promisePool = pool.promise();

// Health check
const checkDBHealth = async () => {
  let status = false;
  let connection;

  try {
    connection = await promisePool.getConnection();
    const [result, _] = await connection.execute('SELECT 0');
    status = result[0]['0'] === 0;
  } catch (error) {
    console.error('Mysql connection failed:', error.message);
  } finally {
    if (connection) connection.release();
  }
  return status;
};

// Insert single messages (autocommit)
const insertIntoDB = async (id, message) => {
  let connection;
  let status = 0;

  try {
    connection = await promisePool.getConnection();
    const insertSql = 'INSERT IGNORE INTO UserEdits (ID, message) VALUES (?, ?)';
    const [result, _] = await connection.execute(insertSql, [id, message]);
    status = result.affectedRows;
  } catch (error) {
    console.log(error);
    status = -1;
  } finally {
    if (connection) connection.release();
  }

  return status;
};

// Read persisted messages from DB
const readFromDB = async () => {
  let connection;
  let result = [];

  try {
    connection = await promisePool.getConnection();
    // TODO: backend process to preserve only active users and latest edits; move the rest to another DB if needed
    const selectSql = `SELECT * FROM ${TABLE_NAME}`;
    const [messages, _] = await connection.execute(selectSql);
    result = messages;
  } catch (error) {
    console.error('Error when reading from mysql:', error.message);
  } finally {
    if (connection) connection.release();
  }

  return result;
};

module.exports = {
  checkDBHealth,
  insertIntoDB,
  readFromDB
};
