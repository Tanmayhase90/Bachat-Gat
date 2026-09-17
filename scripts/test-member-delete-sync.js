import { createRequire } from 'module';

const require = createRequire(new URL('../client/package.json', import.meta.url));
const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} = require('firebase/firestore');
import { assertTestEnvironmentSafety, SAFE_TEST_GROUP_ID, PROD_PROJECT_ID } from './test-guard.mjs';

const firebaseConfig = {
  apiKey: 'AIzaSyAfSLqG3mqeWxnhk_gBUPkDK9Y4Y17GeFU',
  authDomain: 'bachat-gat-app-9e38e.firebaseapp.com',
  projectId: 'bachat-gat-app-9e38e',
  storageBucket: 'bachat-gat-app-9e38e.firebasestorage.app',
  messagingSenderId: '1038306626235',
  appId: '1:1038306626235:web:eb1da740ae33c09ad3b79e',
  measurementId: 'G-DJ20C3JZH8',
};

// Use dedicated test group ONLY - NEVER use production chhatrapati_group_001
const GROUP_ID = SAFE_TEST_GROUP_ID; // 'test_group_temp'

async function recalculateGroupAggregates(groupId = GROUP_ID) {
  const [groupSnap, membersSnap, contribsSnap, loansSnap, repaymentsSnap] = await Promise.all([
    getDoc(doc(db, 'groups', groupId)),
    getDocs(collection(db, 'groups', groupId, 'members')),
    getDocs(collection(db, 'groups', groupId, 'monthly_contributions')),
    getDocs(collection(db, 'groups', groupId, 'loans')),
    getDocs(collection(db, 'groups', groupId, 'repayments')),
  ]);

  const rawGroup = groupSnap.exists() ? groupSnap.data() : {};
  const regularDocs = membersSnap.docs.filter((d) => !d.data().isDeleted && !d.data().deleted);
  const totalMembers = regularDocs.length;
  const activeMembers = regularDocs.filter((d) => (d.data().status || 'active').toLowerCase() === 'active').length;
  const monthlyShare = Number(rawGroup.monthlyContributionAmount || rawGroup.monthly_contribution_per_share || 1000);
  const monthlyTarget = activeMembers * monthlyShare;

  let totalSavings = 0;
  contribsSnap.docs.forEach((d) => {
    const data = d.data();
    const isPaid = data.status === 'PAID' || data.status === 'paid' || data.isPaid || (data.paidAmount > 0) || (data.paid_amount > 0);
    if (isPaid) {
      totalSavings += Number(data.paidAmount || data.paid_amount || data.amount || data.totalPaid || 0);
    }
  });

  let totalLoans = 0;
  loansSnap.docs.forEach((d) => {
    const data = d.data();
    const status = (data.status || '').toUpperCase();
    const pending = Number(data.pendingPrincipal !== undefined ? data.pendingPrincipal : (data.remainingAmount || 0));
    if (status === 'ACTIVE' && pending > 0) {
      totalLoans += pending;
    }
  });

  let totalInterest = 0;
  repaymentsSnap.docs.forEach((d) => {
    const data = d.data();
    totalInterest += Number(data.interestAmount || data.interestPaid || data.interest_amount || 0);
  });

  const availableBalance = Math.max(0, (totalSavings + totalInterest) - totalLoans);

  const updates = {
    totalMembers,
    total_members: totalMembers,
    activeMembers,
    active_members: activeMembers,
    totalSavings,
    total_savings: totalSavings,
    savingsTotal: totalSavings,
    savings_total: totalSavings,
    totalLoans,
    total_loans: totalLoans,
    activeLoans: totalLoans,
    active_loans: totalLoans,
    activeLoansAmount: totalLoans,
    active_loans_amount: totalLoans,
    totalOutstandingLoans: totalLoans,
    total_outstanding_loans: totalLoans,
    totalInterest,
    total_interest: totalInterest,
    totalInterestCollected: totalInterest,
    total_interest_collected: totalInterest,
    totalFund: availableBalance,
    total_fund: availableBalance,
    availableBalance,
    available_balance: availableBalance,
    balance: availableBalance,
    monthlyTarget,
    monthly_target: monthlyTarget,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'groups', groupId), updates, { merge: true });
  return updates;
}

let app;
let db;

async function runTest() {
  console.log('=== STARTING SYNC & DELETION RECALCULATION TEST ===\n');

  // Hard safety guard: verify emulator is active
  await assertTestEnvironmentSafety({
    projectId: firebaseConfig.projectId,
    groupId: GROUP_ID,
    checkEmulatorAlive: true,
  });

  app = initializeApp(firebaseConfig, `test-sync-${Date.now()}`);
  db = getFirestore(app);

  const emulatorHost = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').trim();
  const [host, port] = emulatorHost.split(':');
  connectFirestoreEmulator(db, host, parseInt(port, 10) || 8080);
  console.log('✔ Connected to Firebase Local Emulator Suite at ' + emulatorHost);

  const memARef = doc(db, 'groups', GROUP_ID, 'members', 'TEST_M_1');
  const memBRef = doc(db, 'groups', GROUP_ID, 'members', 'TEST_M_2');
  const contribDocId = 'C_TEST_M_1_2026_09';
  const contribRef = doc(db, 'groups', GROUP_ID, 'monthly_contributions', contribDocId);

  try {
    // 1. Create Member A and Member B
    await setDoc(memARef, {
      id: 'TEST_M_1',
      name: 'Test Member A',
      shares: 1,
      monthlyContribution: 1000,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    });

    await setDoc(memBRef, {
      id: 'TEST_M_2',
      name: 'Test Member B',
      shares: 1,
      monthlyContribution: 1000,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    });

    console.log('Step 1: Created Member A and Member B on emulator.');

    // 2. Record ₹1,000 saving for Member A
    await setDoc(contribRef, {
      id: contribDocId,
      memberId: 'TEST_M_1',
      memberName: 'Test Member A',
      month: 9,
      year: 2026,
      paidAmount: 1000,
      expectedAmount: 1000,
      status: 'PAID',
      paymentMode: 'CASH',
      createdAt: new Date().toISOString(),
    });
    console.log('Step 2: Recorded ₹1,000 monthly saving for Member A.');

    // 3. Recalculate group
    const groupState1 = await recalculateGroupAggregates(GROUP_ID);
    console.log('\n--- Group State Before Deletion ---');
    console.log('Total Members:', groupState1.totalMembers, '(Expected: 2)');
    console.log('Total Savings: ₹' + groupState1.totalSavings, '(Expected: ₹1000)');
    console.log('Available Balance: ₹' + groupState1.availableBalance, '(Expected: ₹1000)');

    if (groupState1.totalMembers !== 2 || groupState1.totalSavings !== 1000 || groupState1.availableBalance !== 1000) {
      throw new Error('Initial state mismatch!');
    }

    // 4. Delete Member A and associated records (mimics Web deleteMember)
    console.log('\nStep 3: Deleting Member A from Web app...');
    await deleteDoc(memARef);
    await deleteDoc(contribRef);
    const groupState2 = await recalculateGroupAggregates(GROUP_ID);

    console.log('\n--- Group State After Deletion of Member A ---');
    console.log('Total Members:', groupState2.totalMembers, '(Expected: 1)');
    console.log('Active Members:', groupState2.activeMembers, '(Expected: 1)');
    console.log('Total Savings: ₹' + groupState2.totalSavings, '(Expected: ₹0)');
    console.log('Available Balance: ₹' + groupState2.availableBalance, '(Expected: ₹0)');

    if (groupState2.totalMembers !== 1 || groupState2.totalSavings !== 0 || groupState2.availableBalance !== 0) {
      throw new Error('Post-deletion recalculation mismatch! Stale values detected.');
    }

    console.log('\nSUCCESS: Post-deletion values correctly updated to 0!');
  } finally {
    // Guaranteed cleanup in finally block
    console.log('\nFinal Step: Cleaning up test records in finally block...');
    await deleteDoc(memARef).catch(() => {});
    await deleteDoc(memBRef).catch(() => {});
    await deleteDoc(contribRef).catch(() => {});
    if (db) {
      const groupStateFinal = await recalculateGroupAggregates(GROUP_ID).catch(() => null);
      if (groupStateFinal) {
        console.log('Clean final state: Total Members =', groupStateFinal.totalMembers, ', Total Savings = ₹' + groupStateFinal.totalSavings);
      }
    }
  }

  console.log('\n=== ALL TEST CHECKS PASSED SUCCESSFULLY ===');
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
