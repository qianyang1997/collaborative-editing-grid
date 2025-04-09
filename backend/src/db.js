const mysql = require('mysql2');

// Create a connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'your_user',
  password: 'your_password',
  database: 'your_database',
  waitForConnections: true, // Wait for a connection instead of erroring out
  connectionLimit: 10, // Maximum number of connections to pool
  queueLimit: 0 // Unlimited queue size (optional)
});

// Using pool to execute queries
const promisePool = pool.promise();

// TODO: single transaction
const insertIntoDB = async (data) => {
  const connection = await promisePool.getConnection();
  let result;
  try {
    const insertSql = 'INSERT IGNORE INTO customers (name, email) VALUES (?, ?)';
    const insertValues = ['John Doe', 'john.doe@example.com'];
    result = await connection.execute(insertSql, insertValues);
    console.log('Insert result:', result);
  } catch (error) {
    console.log(error);
  } finally {
    connection.release(); // Release connection back to the pool
    return result;
  }
};

const readFromDB = async () => {
  result = null;
  console.log('Read result');
  return result;
};

module.exports = {
  insertIntoDB,
  readFromDB
};
