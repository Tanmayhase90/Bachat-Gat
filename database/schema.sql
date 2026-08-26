-- =======================================================
-- Bachat Gat – Digital Savings Group Management System
-- MySQL Database Schema
-- Database: bachat_gat_db
-- =======================================================

CREATE DATABASE IF NOT EXISTS bachat_gat_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE bachat_gat_db;

-- Disable foreign key checks during schema creation
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users Table
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS loan_repayments;
DROP TABLE IF EXISTS loans;
DROP TABLE IF EXISTS savings;
DROP TABLE IF EXISTS group_members;
DROP TABLE IF EXISTS `groups`;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'MEMBER', 'TREASURER', 'SECRETARY') DEFAULT 'MEMBER',
    role_name VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_email (email),
    INDEX idx_user_role (role),
    INDEX idx_user_role_name (role_name)
) ENGINE=InnoDB;

-- 2. Groups Table
CREATE TABLE `groups` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_name VARCHAR(200) NOT NULL,
    group_code VARCHAR(50) NOT NULL UNIQUE,
    monthly_contribution_per_share DECIMAL(12, 2) NOT NULL DEFAULT 1000.00,
    monthly_target DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    description TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_group_code (group_code)
) ENGINE=InnoDB;

-- 3. Group Members Table
CREATE TABLE group_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    member_code VARCHAR(50) NOT NULL,
    joined_date DATE NOT NULL,
    monthly_contribution DECIMAL(12, 2) NOT NULL DEFAULT 1000.00,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_group_user (group_id, user_id),
    UNIQUE KEY uq_group_member_code (group_id, member_code),
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_gm_group (group_id),
    INDEX idx_gm_user (user_id),
    INDEX idx_gm_active (is_active)
) ENGINE=InnoDB;

-- 4. Savings Table
CREATE TABLE savings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    member_id INT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    month INT NOT NULL COMMENT '1-12',
    year INT NOT NULL,
    payment_date DATE NOT NULL,
    payment_mode ENUM('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE') DEFAULT 'CASH',
    transaction_ref VARCHAR(100),
    remarks VARCHAR(255),
    recorded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_member_month_year (group_id, member_id, month, year),
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES group_members(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_savings_group (group_id),
    INDEX idx_savings_member (member_id),
    INDEX idx_savings_period (year, month)
) ENGINE=InnoDB;

-- 5. Loans Table
CREATE TABLE loans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    member_id INT NOT NULL,
    loan_number VARCHAR(50) NOT NULL UNIQUE,
    principal_amount DECIMAL(12, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) NOT NULL COMMENT 'Monthly interest rate percentage e.g. 2.00',
    loan_date DATE NOT NULL,
    duration_months INT NOT NULL DEFAULT 12,
    purpose VARCHAR(255),
    status ENUM('ACTIVE', 'CLOSED') DEFAULT 'ACTIVE',
    outstanding_amount DECIMAL(12, 2) NOT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES group_members(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_loans_group (group_id),
    INDEX idx_loans_member (member_id),
    INDEX idx_loans_status (status)
) ENGINE=InnoDB;

-- 6. Loan Repayments Table
CREATE TABLE loan_repayments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    loan_id INT NOT NULL,
    member_id INT NOT NULL,
    payment_month INT NOT NULL COMMENT '1-12',
    payment_year INT NOT NULL,
    regular_hafta_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    principal_repayment_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    interest_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_payment DECIMAL(12, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_mode ENUM('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE') DEFAULT 'CASH',
    remarks VARCHAR(255),
    recorded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES group_members(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_repayments_loan (loan_id),
    INDEX idx_repayments_member (member_id),
    INDEX idx_repayments_period (payment_year, payment_month)
) ENGINE=InnoDB;

-- 7. Notifications Table
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    group_id INT,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('INFO', 'SUCCESS', 'WARNING', 'ALERT') DEFAULT 'INFO',
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
    INDEX idx_notif_user (user_id),
    INDEX idx_notif_read (is_read)
) ENGINE=InnoDB;

-- 8. Activity Logs Table
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_activity_group (group_id),
    INDEX idx_activity_user (user_id),
    INDEX idx_activity_time (created_at)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
