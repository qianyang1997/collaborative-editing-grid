const mysql = require('mysql2');

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.SQL_HOST,
  user: process.env.SQL_USER,
  password: process.env.SQL_PWD,
  database: process.env.SQL_DB,
  port: process.env.SQL_PORT,
  waitForConnections: true, // Wait for a connection instead of erroring out
  connectionLimit: process.env.SQL_CONN_LIMIT, // Maximum number of connections to pool
  queueLimit: process.env.SQL_QUEUE_LIMIT // Unlimited queue size (optional)
});

// Using pool to execute queries
const promisePool = pool.promise();

// Insert single messages (autocommit)
const insertIntoDB = async (id, message) => {
  const connection = await promisePool.getConnection();
  let status = 0;
  try {
    const insertSql = 'INSERT IGNORE INTO UserEdits (ID, message) VALUES (?, ?)';
    const [result, _] = await connection.execute(insertSql, [id, message]);
    status = result.affectedRows;
  } catch (error) {
    console.log(error);
    status = -1;
  } finally {
    connection.release();
  }

  return status;
};

// Read persisted messages from DB
const readFromDB = async () => {
  const connection = await promisePool.getConnection();
  let result = [];
  try {
    const selectSql = 'SELECT * FROM mysql.UserEdits';
    const [messages, _] = await connection.execute(selectSql);
    result = messages;
  } catch (error) {
    console.log(error);
  } finally {
    connection.release();
  }

  return result;
};

module.exports = {
  insertIntoDB,
  readFromDB
};
