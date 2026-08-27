# Bachat Gat – Digital Savings Group Management System

A web application designed for Self-Help Groups (SHGs / Bachat Gat) to manage member contributions, micro-loans, interest calculations, repayments, and group finances in real-time.

Powered by **React + Vite**, **Firebase Authentication**, and **Cloud Firestore** for project `bachat-gat-app-9e38e`.

---

## 🚀 Key Highlights & Architecture

- **Frontend**: React 18, Vite, React Router v6, Lucide Icons, Modern CSS.
- **Backend & Database**: Firebase Authentication (Email/Password), Cloud Firestore.
- **Real-Time Synchronization**: Live Firestore `onSnapshot` listeners for group settings, user profiles, notifications, and financial ledger updates.
- **Multi-Client Shared Backend**: Web application shares the Cloud Firestore database with the Flutter Android application safely without conflicts.

---

## 📁 Project Structure

```
Bachat-Gat/
├── client/                      # React Frontend (Vite)
│   ├── src/
│   │   ├── components/          # Common components, layout, modals
│   │   ├── config/              # Centralized Firebase initialization
│   │   ├── context/             # AuthContext with real-time session sync
│   │   ├── pages/               # Dashboard, Login, Register, Members, Savings, Loans, Reports, Settings
│   │   └── services/            # Direct Firestore service layer (Auth, Group, Member, Savings, Loan)
│   ├── .env                     # Firebase configuration credentials
│   └── package.json
├── scripts/
│   └── create-admin.js          # CLI script to initialize the first Admin user
├── database/
│   └── seed-firebase.js         # Optional Firestore sample data seeder
├── firestore.rules              # Firestore Security Rules
└── package.json                 # Monorepo root scripts
```

---

## 🛠️ Getting Started

### 1. Configure Environment Variables
Verify your Firebase Web App credentials in `client/.env`:
```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=bachat-gat-app-9e38e.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=bachat-gat-app-9e38e
VITE_FIREBASE_STORAGE_BUCKET=bachat-gat-app-9e38e.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1038306626235
VITE_FIREBASE_APP_ID=1:1038306626235:web:eb1da740ae33c09ad3b79e
VITE_FIREBASE_MEASUREMENT_ID=G-DJ20C3JZH8
```

### 2. Start the Development Server
```bash
npm run dev
# or
cd client && npm run dev
```

### 3. Create the First Admin Account (Optional)
```bash
npm run admin:create
# or with custom credentials:
node scripts/create-admin.js admin@bachatgat.com Admin@123 "Shri Shivaji Patil" "9822000000"
```
