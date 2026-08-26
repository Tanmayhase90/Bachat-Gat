-- =======================================================
-- Bachat Gat – Sample Data Script
-- =======================================================

USE bachat_gat_db;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Insert Default Admin User (Password: Admin@123)
-- Role is stored in role_name column; Name contains only the actual user name without brackets.
INSERT INTO users (id, name, email, phone, password, role, role_name, is_active) VALUES
(1, 'Shri Shivaji Patil', 'admin@bachatgat.com', '9876543210', '$2a$10$3kF3pQ7300Wf0z0Zk8LDEuD042qjQoJb00Yj0u0z00J0u0z00J0u0', 'ADMIN', 'ADMIN', 1);

-- 2. Insert Sample Members (Password: Member@123)
INSERT INTO users (id, name, email, phone, password, role, role_name, is_active) VALUES
(2, 'Rahul Tanaji Shinde', 'rahul@bachatgat.com', '9822012345', '$2a$10$3kF3pQ7300Wf0z0Zk8LDEuD042qjQoJb00Yj0u0z00J0u0z00J0u0', 'MEMBER', 'MEMBER', 1),
(3, 'Akshay Suresh Jadhav', 'akshay@bachatgat.com', '9822054321', '$2a$10$3kF3pQ7300Wf0z0Zk8LDEuD042qjQoJb00Yj0u0z00J0u0z00J0u0', 'MEMBER', 'TREASURER', 1),
(4, 'Pooja Vikas More', 'pooja@bachatgat.com', '9822098765', '$2a$10$3kF3pQ7300Wf0z0Zk8LDEuD042qjQoJb00Yj0u0z00J0u0z00J0u0', 'MEMBER', 'SECRETARY', 1),
(5, 'Snehal Ramesh Chavan', 'snehal@bachatgat.com', '9822011223', '$2a$10$3kF3pQ7300Wf0z0Zk8LDEuD042qjQoJb00Yj0u0z00J0u0z00J0u0', 'MEMBER', 'MEMBER', 1),
(6, 'Vikas Anand Kadam', 'vikas@bachatgat.com', '9822033445', '$2a$10$3kF3pQ7300Wf0z0Zk8LDEuD042qjQoJb00Yj0u0z00J0u0z00J0u0', 'MEMBER', 'MEMBER', 1);

-- 3. Insert Bachat Gat Group
INSERT INTO `groups` (id, group_name, group_code, monthly_contribution_per_share, monthly_target, description, created_by, created_at) VALUES
(1, 'Chhatrapati Bachat Gat', 'shivshahi_group_001', 1000.00, 363000.00, 'A progressive self help digital savings and micro-lending group.', 1, '2026-08-18 10:00:00');

-- 4. Insert Group Members
INSERT INTO group_members (id, group_id, user_id, member_code, joined_date, monthly_contribution, is_active) VALUES
(1, 1, 2, 'MEM-001', '2026-08-18', 1000.00, 1),
(2, 1, 3, 'MEM-002', '2026-08-18', 1000.00, 1),
(3, 1, 4, 'MEM-003', '2026-08-19', 1000.00, 1),
(4, 1, 5, 'MEM-004', '2026-08-20', 1000.00, 1),
(5, 1, 6, 'MEM-005', '2026-08-20', 1000.00, 1);

-- 5. Insert Monthly Savings Records
-- Month 8 (August 2026)
INSERT INTO savings (id, group_id, member_id, amount, month, year, payment_date, payment_mode, remarks, recorded_by) VALUES
(1, 1, 1, 1000.00, 8, 2026, '2026-08-20', 'UPI', 'August monthly contribution', 1),
(2, 1, 2, 1000.00, 8, 2026, '2026-08-21', 'CASH', 'August monthly contribution', 1);

-- 6. Insert Loans
-- Loan 1: Active Loan for Rahul Shinde (MEM-001) - 1000 at 2% monthly interest
INSERT INTO loans (id, group_id, member_id, loan_number, principal_amount, interest_rate, loan_date, duration_months, purpose, status, outstanding_amount, created_by) VALUES
(1, 1, 1, 'LN-2026-001', 1000.00, 2.00, '2026-08-22', 12, 'Small business inventory purchase', 'ACTIVE', 1000.00, 1),
-- Loan 2: Loan for Akshay Jadhav (MEM-002) - 1000 with partial repayment (Outstanding 710)
(2, 1, 2, 'LN-2026-002', 1000.00, 2.00, '2026-08-22', 12, 'Farming equipment repair', 'ACTIVE', 710.00, 1);

-- 7. Insert Repayments for Loan 2
-- Repaid 290 principal + 20 interest
INSERT INTO loan_repayments (id, loan_id, member_id, payment_month, payment_year, regular_hafta_amount, principal_repayment_amount, interest_amount, total_payment, payment_date, payment_mode, remarks, recorded_by) VALUES
(1, 2, 2, 8, 2026, 0.00, 290.00, 20.00, 310.00, '2026-08-25', 'UPI', 'Partial Hafta payment', 1);

-- 8. Notifications
INSERT INTO notifications (id, user_id, group_id, title, message, type, is_read) VALUES
(1, 1, 1, 'Welcome to Bachat Gat', 'Chhatrapati Bachat Gat digital portal initialized successfully.', 'SUCCESS', 0),
(2, 1, 1, 'Loan Created', 'Loan LN-2026-001 of ₹1,000 created for Rahul Shinde.', 'INFO', 0),
(3, 1, 1, 'Repayment Received', 'Repayment of ₹310 received for Loan LN-2026-002 from Akshay Jadhav.', 'SUCCESS', 0);

-- 9. Activity Logs
INSERT INTO activity_logs (id, group_id, user_id, action, description, created_at) VALUES
(1, 1, 1, 'GROUP_CREATED', 'Group Chhatrapati Bachat Gat created with ID shivshahi_group_001', '2026-08-18 10:00:00'),
(2, 1, 1, 'SAVINGS_RECORDED', 'Savings ₹1,000 recorded for Rahul Tanaji Shinde for 08/2026', '2026-08-20 11:30:00'),
(3, 1, 1, 'SAVINGS_RECORDED', 'Savings ₹1,000 recorded for Akshay Suresh Jadhav for 08/2026', '2026-08-21 14:15:00'),
(4, 1, 1, 'LOAN_CREATED', 'Loan LN-2026-001 of ₹1,000 issued to Rahul Tanaji Shinde @ 2.0% monthly interest', '2026-08-22 16:00:00'),
(5, 1, 1, 'LOAN_CREATED', 'Loan LN-2026-002 of ₹1,000 issued to Akshay Suresh Jadhav @ 2.0% monthly interest', '2026-08-22 16:30:00'),
(6, 1, 1, 'LOAN_REPAYMENT', 'Repayment of ₹310 (Principal: ₹290, Interest: ₹20) recorded for Loan LN-2026-002', '2026-08-25 10:45:00');

SET FOREIGN_KEY_CHECKS = 1;
