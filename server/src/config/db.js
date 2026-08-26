const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bachat_gat_db',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  decimalNumbers: true,
  timezone: '+05:30'
});

// Test connection
async function testDbConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✔ Connected to MySQL Database Pool:', process.env.DB_NAME || 'bachat_gat_db');
    connection.release();
  } catch (err) {
    console.error('❌ Failed to connect to MySQL database:', err.message);
  }
}

testDbConnection();

module.exports = pool;
