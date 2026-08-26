const path = require('path');
const fs = require('fs');

// Ensure modules can be loaded from server/node_modules if running from anywhere
const serverNodeModules = path.join(__dirname, '../server/node_modules');
const mysql = require(path.join(serverNodeModules, 'mysql2/promise'));
const bcrypt = require(path.join(serverNodeModules, 'bcryptjs'));
require(path.join(serverNodeModules, 'dotenv')).config({ path: path.join(__dirname, '../server/.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
};

async function setupDatabase() {
  console.log('==============================================');
  console.log('🚀 Starting Bachat Gat Database Initialization');
  console.log(`Connecting to MySQL on ${dbConfig.host}:${dbConfig.port} as ${dbConfig.user}...`);
  console.log('==============================================');

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✔ Connected to MySQL Server successfully.');

    // 1. Create Database if not exists
    const dbName = process.env.DB_NAME || 'bachat_gat_db';
    console.log(`Creating database ${dbName} if not exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${dbName}\`;`);
    console.log(`✔ Using database: ${dbName}`);

    // 2. Read and execute schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('Executing schema.sql...');
    await connection.query(schemaSql);
    console.log('✔ Tables and constraints created successfully.');

    // 3. Hash passwords properly
    const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
    const memberPasswordHash = await bcrypt.hash('Member@123', 10);

    // 4. Insert Seed Data
    console.log('Inserting seed users with clean names and role_name...');

    // Users
    await connection.query(`
      INSERT INTO users (id, name, email, phone, password, role, role_name, is_active) VALUES
      (1, 'Shri Shivaji Patil', 'admin@bachatgat.com', '9876543210', ?, 'ADMIN', 'ADMIN', 1),
      (2, 'Rahul Tanaji Shinde', 'rahul@bachatgat.com', '9822012345', ?, 'MEMBER', 'MEMBER', 1),
      (3, 'Akshay Suresh Jadhav', 'akshay@bachatgat.com', '9822054321', ?, 'MEMBER', 'TREASURER', 1),
      (4, 'Pooja Vikas More', 'pooja@bachatgat.com', '9822098765', ?, 'MEMBER', 'SECRETARY', 1),
      (5, 'Snehal Ramesh Chavan', 'snehal@bachatgat.com', '9822011223', ?, 'MEMBER', 'MEMBER', 1),
      (6, 'Vikas Anand Kadam', 'vikas@bachatgat.com', '9822033445', ?, 'MEMBER', 'MEMBER', 1)
      ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), role_name=VALUES(role_name);
    `, [adminPasswordHash, memberPasswordHash, memberPasswordHash, memberPasswordHash, memberPasswordHash, memberPasswordHash]);

    // Group
    await connection.query(`
      INSERT INTO \`groups\` (id, group_name, group_code, monthly_contribution_per_share, monthly_target, description, created_by, created_at) VALUES
      (1, 'Chhatrapati Bachat Gat', 'shivshahi_group_001', 1000.00, 363000.00, 'A progressive self help digital savings and micro-lending group.', 1, '2026-08-18 10:00:00')
      ON DUPLICATE KEY UPDATE group_name=VALUES(group_name);
    `);

    // Group Members
    await connection.query(`
      INSERT INTO group_members (id, group_id, user_id, member_code, joined_date, monthly_contribution, is_active) VALUES
      (1, 1, 2, 'MEM-001', '2026-08-18', 1000.00, 1),
      (2, 1, 3, 'MEM-002', '2026-08-18', 1000.00, 1),
      (3, 1, 4, 'MEM-003', '2026-08-19', 1000.00, 1),
      (4, 1, 5, 'MEM-004', '2026-08-20', 1000.00, 1),
      (5, 1, 6, 'MEM-005', '2026-08-20', 1000.00, 1)
      ON DUPLICATE KEY UPDATE member_code=VALUES(member_code);
    `);

    // Savings for August 2026 (Month 8)
    await connection.query(`
      INSERT INTO savings (id, group_id, member_id, amount, month, year, payment_date, payment_mode, remarks, recorded_by) VALUES
      (1, 1, 1, 1000.00, 8, 2026, '2026-08-20', 'UPI', 'August monthly contribution', 1),
      (2, 1, 2, 1000.00, 8, 2026, '2026-08-21', 'CASH', 'August monthly contribution', 1)
      ON DUPLICATE KEY UPDATE amount=VALUES(amount);
    `);

    // Loans (Rahul: 1000 Active, Akshay: 1000 Active with 710 outstanding)
    await connection.query(`
      INSERT INTO loans (id, group_id, member_id, loan_number, principal_amount, interest_rate, loan_date, duration_months, purpose, status, outstanding_amount, created_by) VALUES
      (1, 1, 1, 'LN-2026-001', 1000.00, 2.00, '2026-08-22', 12, 'Small business inventory purchase', 'ACTIVE', 1000.00, 1),
      (2, 1, 2, 'LN-2026-002', 1000.00, 2.00, '2026-08-22', 12, 'Farming equipment repair', 'ACTIVE', 710.00, 1)
      ON DUPLICATE KEY UPDATE outstanding_amount=VALUES(outstanding_amount);
    `);

    // Loan Repayment for Loan 2
    await connection.query(`
      INSERT INTO loan_repayments (id, loan_id, member_id, payment_month, payment_year, regular_hafta_amount, principal_repayment_amount, interest_amount, total_payment, payment_date, payment_mode, remarks, recorded_by) VALUES
      (1, 2, 2, 8, 2026, 0.00, 290.00, 20.00, 310.00, '2026-08-25', 'UPI', 'Partial Hafta payment', 1)
      ON DUPLICATE KEY UPDATE total_payment=VALUES(total_payment);
    `);

    // Notifications
    await connection.query(`
      INSERT INTO notifications (id, user_id, group_id, title, message, type, is_read) VALUES
      (1, 1, 1, 'Welcome to Bachat Gat', 'Chhatrapati Bachat Gat digital portal initialized successfully.', 'SUCCESS', 0),
      (2, 1, 1, 'Loan Created', 'Loan LN-2026-001 of ₹1,000 created for Rahul Shinde.', 'INFO', 0),
      (3, 1, 1, 'Repayment Received', 'Repayment of ₹310 received for Loan LN-2026-002 from Akshay Jadhav.', 'SUCCESS', 0)
      ON DUPLICATE KEY UPDATE title=VALUES(title);
    `);

    // Activity Logs
    await connection.query(`
      INSERT INTO activity_logs (id, group_id, user_id, action, description, created_at) VALUES
      (1, 1, 1, 'GROUP_CREATED', 'Group Chhatrapati Bachat Gat created with ID shivshahi_group_001', '2026-08-18 10:00:00'),
      (2, 1, 1, 'SAVINGS_RECORDED', 'Savings ₹1,000 recorded for Rahul Tanaji Shinde for 08/2026', '2026-08-20 11:30:00'),
      (3, 1, 1, 'SAVINGS_RECORDED', 'Savings ₹1,000 recorded for Akshay Suresh Jadhav for 08/2026', '2026-08-21 14:15:00'),
      (4, 1, 1, 'LOAN_CREATED', 'Loan LN-2026-001 of ₹1,000 issued to Rahul Tanaji Shinde @ 2.0% monthly interest', '2026-08-22 16:00:00'),
      (5, 1, 1, 'LOAN_CREATED', 'Loan LN-2026-002 of ₹1,000 issued to Akshay Suresh Jadhav @ 2.0% monthly interest', '2026-08-22 16:30:00'),
      (6, 1, 1, 'LOAN_REPAYMENT', 'Repayment of ₹310 (Principal: ₹290, Interest: ₹20) recorded for Loan LN-2026-002', '2026-08-25 10:45:00')
      ON DUPLICATE KEY UPDATE action=VALUES(action);
    `);

    console.log('✔ Realistic sample data seeded successfully with role_name column!');
    console.log('==============================================');
    console.log('🎉 Database setup completed!');
    console.log('Admin Account:     admin@bachatgat.com / Admin@123');
    console.log('Member Account:    rahul@bachatgat.com / Member@123');
    console.log('Treasurer Account: akshay@bachatgat.com / Member@123');
    console.log('Secretary Account: pooja@bachatgat.com / Member@123');
    console.log('==============================================');

  } catch (err) {
    console.error('❌ Database setup failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

setupDatabase();
