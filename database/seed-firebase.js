/**
 * Firebase Data Seeder & Migration Script
 * Populates Firestore with standard Bachat Gat sample data.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to parse client/.env if process.env is empty
function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '../client/.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...vals] = trimmed.split('=');
          const val = vals.join('=').trim();
          if (key && !process.env[key.trim()]) {
            process.env[key.trim()] = val;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Notice: client/.env file could not be parsed automatically:', e.message);
  }
}

loadEnv();

const firebaseConfig = {
  apiKey: "AIzaSyAfSLqG3mqeWxnhk_gBUPkDK9Y4Y17GeFU",
  authDomain: "bachat-gat-app-9e38e.firebaseapp.com",
  projectId: "bachat-gat-app-9e38e",
  storageBucket: "bachat-gat-app-9e38e.firebasestorage.app",
  messagingSenderId: "1038306626235",
  appId: "1:1038306626235:web:eb1da740ae33c09ad3b79e",
  measurementId: "G-DJ20C3JZH8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedFirebase() {
  console.log('🚀 Starting Bachat Gat Firebase Data Seeding for project:', firebaseConfig.projectId);

  try {
    // 1. Seed Group Document
    const groupId = 'group_001';
    console.log('📌 Seeding Group [group_001]...');
    await setDoc(doc(db, 'groups', groupId), {
      groupId,
      groupName: 'Chhatrapati Bachat Gat',
      group_name: 'Chhatrapati Bachat Gat',
      groupCode: 'shivshahi_group_001',
      group_code: 'shivshahi_group_001',
      monthlyContribution: 1000,
      monthly_contribution_per_share: 1000,
      monthlyTarget: 363000,
      monthly_target: 363000,
      description: 'A progressive self help digital savings and micro-lending group.',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // 2. Seed Members
    const membersData = [
      {
        id: 'mem_001',
        fullName: 'Rahul Tanaji Shinde',
        email: 'rahul@bachatgat.com',
        phone: '9822011111',
        memberCode: 'MEM-001',
        monthlyContribution: 1000,
        role: 'member',
        joinedAt: '2026-08-18',
        status: 'ACTIVE',
      },
      {
        id: 'mem_002',
        fullName: 'Akshay Suresh Jadhav',
        email: 'akshay@bachatgat.com',
        phone: '9822022222',
        memberCode: 'MEM-002',
        monthlyContribution: 1000,
        role: 'member',
        joinedAt: '2026-08-18',
        status: 'ACTIVE',
      },
      {
        id: 'mem_003',
        fullName: 'Pooja Vikas More',
        email: 'pooja@bachatgat.com',
        phone: '9822033333',
        memberCode: 'MEM-003',
        monthlyContribution: 1000,
        role: 'member',
        joinedAt: '2026-08-19',
        status: 'ACTIVE',
      },
      {
        id: 'mem_004',
        fullName: 'Snehal Ramesh Chavan',
        email: 'snehal@bachatgat.com',
        phone: '9822044444',
        memberCode: 'MEM-004',
        monthlyContribution: 1000,
        role: 'member',
        joinedAt: '2026-08-20',
        status: 'ACTIVE',
      },
      {
        id: 'mem_005',
        fullName: 'Vikas Anand Kadam',
        email: 'vikas@bachatgat.com',
        phone: '9822055555',
        memberCode: 'MEM-005',
        monthlyContribution: 1000,
        role: 'member',
        joinedAt: '2026-08-20',
        status: 'ACTIVE',
      },
    ];

    console.log('📌 Seeding Members...');
    for (const mem of membersData) {
      await setDoc(doc(db, 'members', mem.id), {
        ...mem,
        groupId,
        isActive: true,
        createdAt: serverTimestamp(),
      }, { merge: true });
    }

    // 3. Seed Sample Savings
    console.log('📌 Seeding Savings Records...');
    const savings = [
      { id: 'sav_001', memberId: 'mem_001', amount: 1000, month: 8, year: 2026, paymentMode: 'UPI', paymentDate: '2026-08-18' },
      { id: 'sav_002', memberId: 'mem_002', amount: 1000, month: 8, year: 2026, paymentMode: 'UPI', paymentDate: '2026-08-18' },
      { id: 'sav_003', memberId: 'mem_003', amount: 1000, month: 8, year: 2026, paymentMode: 'CASH', paymentDate: '2026-08-19' },
      { id: 'sav_004', memberId: 'mem_004', amount: 1000, month: 8, year: 2026, paymentMode: 'UPI', paymentDate: '2026-08-20' },
      { id: 'sav_005', memberId: 'mem_005', amount: 1000, month: 8, year: 2026, paymentMode: 'BANK_TRANSFER', paymentDate: '2026-08-20' },
    ];
    for (const s of savings) {
      await setDoc(doc(db, 'savings', s.id), {
        ...s,
        groupId,
        createdAt: serverTimestamp(),
      }, { merge: true });
    }

    // 4. Seed Sample Loans
    console.log('📌 Seeding Loan Records...');
    await setDoc(doc(db, 'loans', 'loan_001'), {
      loanId: 'loan_001',
      loanNumber: 'LN-2026-001',
      memberId: 'mem_001',
      groupId,
      principalAmount: 25000,
      interestRate: 2.0,
      durationMonths: 12,
      remainingAmount: 20000,
      status: 'ACTIVE',
      loanDate: '2026-08-18',
      purpose: 'Dairy livestock purchase',
      createdAt: serverTimestamp(),
    }, { merge: true });

    await setDoc(doc(db, 'loans', 'loan_002'), {
      loanId: 'loan_002',
      loanNumber: 'LN-2026-002',
      memberId: 'mem_004',
      groupId,
      principalAmount: 15000,
      interestRate: 2.0,
      durationMonths: 6,
      remainingAmount: 15000,
      status: 'ACTIVE',
      loanDate: '2026-08-20',
      purpose: 'Seed & fertilizer seasonal purchase',
      createdAt: serverTimestamp(),
    }, { merge: true });

    // 5. Seed Sample Repayment
    console.log('📌 Seeding Repayments...');
    await setDoc(doc(db, 'repayments', 'rep_001'), {
      loanId: 'loan_001',
      memberId: 'mem_001',
      groupId,
      amount: 5500,
      principalAmount: 5000,
      interestAmount: 500,
      regularHaftaAmount: 0,
      paymentMonth: 8,
      paymentYear: 2026,
      paymentMode: 'UPI',
      paidAt: '2026-08-22',
      remarks: 'First installment via GPay',
      createdAt: serverTimestamp(),
    }, { merge: true });

    console.log('🎉 Firebase Seeding Completed Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during Firebase seeding:', err);
    process.exit(1);
  }
}

seedFirebase();
