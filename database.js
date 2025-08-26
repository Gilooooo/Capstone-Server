const mysql = require('mysql2/promise');


const pool = mysql.createPool({
  host: "localhost",
  user: 'root',
  password: 'amine_*2019sabornido',
  database: 'accounts',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

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