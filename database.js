const mysql = require('mysql2/promise');


// Debug: Check environment variables
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);

const pool = mysql.createPool(
  process.env.DATABASE_URL || {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  }
);

// Test the database connection
pool.getConnection()
  .then((connection) => {
    console.log('Connected to MySQL database.');
    connection.release(); 
  })
  .catch((err) => {
    console.error('Error connecting:', err);
  });

module.exports = pool;