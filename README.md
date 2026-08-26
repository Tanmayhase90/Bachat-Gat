# Bachat Gat – Digital Savings Group Management System

A full-stack responsive web application designed for Bachat Gat / Self Help Groups (SHGs) to digitize monthly savings, micro-loan disbursement, monthly interest calculation, loan repayments, pending dues tracking, and financial reporting.

---

## 🛠️ Technology Stack

- **Frontend**: React.js 18, Vite, React Router DOM, Axios, Lucide React, Custom Responsive CSS
- **Backend**: Node.js, Express.js, JWT Authentication, bcryptjs, MySQL2 (Connection Pool with Atomic Transactions), CORS, dotenv
- **Database**: MySQL 8.0 (`bachat_gat_db`)

---

## 📂 Project Structure

```
Bachat-Gat/
├── database/
│   ├── schema.sql           # MySQL database schema (8 tables, foreign keys, indexes)
│   ├── sample-data.sql      # Realistic initial data (Group, members, savings, loans, repayments)
│   └── setup.js             # Automated database creation and seed script
│
├── server/                  # Node.js + Express REST API
│   ├── package.json
│   ├── .env.example
│   ├── .env                 # Database credentials & JWT secret
│   ├── test-api.js          # Automated end-to-end API test suite
│   └── src/
│       ├── config/
│       │   └── db.js        # MySQL connection pool
│       ├── controllers/     # auth, group, member, savings, loan, dashboard, report, notif
│       ├── middleware/      # authMiddleware, roleMiddleware, errorMiddleware
│       ├── routes/          # auth, group, member, savings, loan, dashboard, report, notif
│       ├── utils/           # financial calculations & activity logger
│       └── index.js         # Express app bootstrap
│
└── client/                  # React Single Page Application (SPA)
    ├── package.json
    ├── vite.config.js       # Proxy setup for /api -> localhost:5000
    ├── index.html
    └── src/
        ├── context/         # AuthContext (state & role authorization)
        ├── services/        # Axios API services
        ├── components/
        │   ├── layout/      # Sidebar, Header, MainLayout
        │   ├── common/      # StatCard, Modal, Loader, EmptyState, NotificationDropdown, GroupInfoModal
        │   └── forms/       # AddMemberModal, RecordSavingsModal, CreateLoanModal, RecordRepaymentModal
        ├── pages/           # Login, Dashboard, Members, MemberDetails, Savings, Loans, LoanDetails, Reports, Settings
        ├── styles/          # Responsive deep pink / burgundy theme variables and UI styling
        ├── App.jsx          # Route configurations
        └── main.jsx
```

---

## 🔑 Default Login Credentials

| Role | Email / Username | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@bachatgat.com` | `Admin@123` | Full access: Group Settings, Add Member, Record Savings, Issue Loans, Record Repayments, Reports |
| **Member** | `rahul@bachatgat.com` | `Member@123` | Member portal: View own savings, loan history, active dues |

*Note: You can also use the **Quick Demo Accounts** buttons on the Login page for one-click login.*

---

## 🚀 Setup & Execution Guide

### 1. Database Setup (MySQL)

Ensure MySQL Server is running locally.

Configure your database password in `server/.env`:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=bachat_gat_db
JWT_SECRET=bachat_gat_super_secret_jwt_key_2026_internship_production
JWT_EXPIRES_IN=7d
```

Run the automated setup and seed script from the project root:
```bash
node database/setup.js
```

*Alternatively, you can import SQL files directly via MySQL CLI:*
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p bachat_gat_db < database/sample-data.sql
```

---

### 2. Backend Server

Navigate to the `server/` directory:
```bash
cd server
npm install
npm run dev   # Or `npm start`
```
Backend API will be accessible at: `http://localhost:5000/api`

To run the automated backend test suite:
```bash
node test-api.js
```

---

### 3. Frontend Application

Navigate to the `client/` directory:
```bash
cd client
npm install
npm run dev
```
Frontend web application will run at: `http://localhost:3000`

---

## 📊 Core Financial Formulas & Calculations

1. **Monthly Savings**:
   - Prevention of duplicate savings for same `(member, month, year)`.
   - `Total Group Savings = SUM(savings.amount)`.

2. **Monthly Loan Interest**:
   - `Monthly Interest = (Outstanding Principal × Monthly Interest Rate %) / 100`
   - *Example: ₹1,000 @ 2% / month = ₹20.00*

3. **Loan Repayment**:
   - `Total Payment = Regular Hafta + Principal Repayment + Interest Amount`
   - `New Outstanding = Old Outstanding - Principal Repayment`
   - If `New Outstanding == 0`, loan is automatically marked as **CLOSED**.
   - Executed using atomic MySQL transactions (`START TRANSACTION ... COMMIT / ROLLBACK`).

4. **Group Balances**:
   - `Total Group Fund = Total Savings + Total Interest Collected`
   - `Available Balance = Total Savings + Total Interest Collected - Active Loans Outstanding`

---

## 📋 Complete Feature Checklist

- [x] **Authentication & Security**: JWT Auth, bcrypt password hashing, Role-based route protection (`ADMIN` / `MEMBER`).
- [x] **Dashboard Module**: Total Group Fund, Available Balance, Active Loans, Quick Action triggers, Monthly Savings Progress bar with selector, and live Activity Logs.
- [x] **Group Information Modal**: Group Code, Monthly Share, Monthly Target, Total Members.
- [x] **Members Module**: Member directory with search, "All Members" & "Pending Dues" tabs, add member modal, individual member profile with savings & loan history.
- [x] **Monthly Savings Module**: Record monthly savings, automatic duplicate prevention, period filter, aggregated total counter.
- [x] **Loans Module**: Disburse new loans with live interest calculation, "Active Loans" & "Closed Loans" tabs, repayment progress percentage bar.
- [x] **Loan Repayment Modal**: Live automatic computation of interest and total payment, principal reduction, automatic loan closure on completion.
- [x] **Reports Module**:
  - **Monthly Report**: Collection summary, interest revenue, available balance, transaction details.
  - **Pending Dues Report**: Unpaid monthly hafta, active loan principal, pending interest, total pending dues.
  - **Loans Overview Report**: Principal disbursed, recovered principal, interest earned, current status.
  - **Export & Print**: One-click CSV export and print view for all reports.
- [x] **Notifications**: Notification badge, dropdown feed, mark as read / mark all as read.
- [x] **Settings**: Group name, monthly share, monthly target, admin profile and password change.
- [x] **Responsive Web UI**: Customized deep pink / burgundy theme with desktop sidebar, header, and mobile navigation drawer.
