import { createRequire } from 'module';

const require = createRequire(new URL('../client/package.json', import.meta.url));
const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyAfSLqG3mqeWxnhk_gBUPkDK9Y4Y17GeFU',
  authDomain: 'bachat-gat-app-9e38e.firebaseapp.com',
  projectId: 'bachat-gat-app-9e38e',
  storageBucket: 'bachat-gat-app-9e38e.firebasestorage.app',
  messagingSenderId: '1038306626235',
  appId: '1:1038306626235:web:eb1da740ae33c09ad3b79e',
  measurementId: 'G-DJ20C3JZH8',
};

const app = initializeApp(firebaseConfig, `reset-${Date.now()}`);
const db = getFirestore(app);

const TARGET_GROUP_ID = 'chhatrapati_group_001';

async function batchDeleteCollection(collectionRef, label) {
  console.log(`\nDeleting documents from: ${label}...`);
  const snap = await getDocs(collectionRef);
  const total = snap.docs.length;
  console.log(`Found ${total} documents in ${label}.`);
  if (total === 0) return 0;

  const BATCH_SIZE = 400;
  let deletedCount = 0;

  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const chunk = snap.docs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deletedCount += chunk.length;
    console.log(`  -> Deleted batch ${deletedCount}/${total} in ${label}`);
  }

  return deletedCount;
}

async function runReset() {
  console.log('====================================================');
  console.log('       STARTING FIREBASE DATA RESET (DATA ONLY)     ');
  console.log('====================================================');

  // 1. Reset Group Document in groups/chhatrapati_group_001
  console.log(`\n1. Resetting financial metrics in groups/${TARGET_GROUP_ID}...`);
  const groupDocRef = doc(db, 'groups', TARGET_GROUP_ID);
  const groupSnap = await getDoc(groupDocRef);
  const existingGroupData = groupSnap.exists() ? groupSnap.data() : {};

  const cleanGroupData = {
    // Preserve configuration
    name: existingGroupData.name || existingGroupData.groupName || 'Chhatrapati Bachat Gat, Ghargaon Stand',
    groupName: existingGroupData.groupName || existingGroupData.name || 'Chhatrapati Bachat Gat, Ghargaon Stand',
    group_name: existingGroupData.group_name || existingGroupData.name || 'Chhatrapati Bachat Gat, Ghargaon Stand',
    description: existingGroupData.description || 'A progressive self help digital savings and micro-lending group.',
    groupId: TARGET_GROUP_ID,
    group_id: TARGET_GROUP_ID,
    groupCode: TARGET_GROUP_ID,
    group_code: TARGET_GROUP_ID,
    id: TARGET_GROUP_ID,
    status: 'ACTIVE',
    status_lower: 'active',
    monthlyContributionAmount: Number(existingGroupData.monthlyContributionAmount || 1000),
    monthlyContribution: Number(existingGroupData.monthlyContribution || 1000),
    monthly_contribution: Number(existingGroupData.monthly_contribution || 1000),
    monthlyContributionPerShare: Number(existingGroupData.monthlyContributionPerShare || 1000),
    monthly_contribution_per_share: Number(existingGroupData.monthly_contribution_per_share || 1000),
    monthlyShare: Number(existingGroupData.monthlyShare || 1000),
    monthly_share: Number(existingGroupData.monthly_share || 1000),
    monthlyHaftaDay: Number(existingGroupData.monthlyHaftaDay || existingGroupData.monthly_hafta_day || 10),
    monthly_hafta_day: Number(existingGroupData.monthly_hafta_day || existingGroupData.monthlyHaftaDay || 10),
    createdAt: existingGroupData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // Reset financial totals to ₹0 and counts to 0
    totalMembers: 0,
    total_members: 0,
    activeMembers: 0,
    active_members: 0,
    totalSavings: 0,
    total_savings: 0,
    savingsTotal: 0,
    savings_total: 0,
    totalLoans: 0,
    total_loans: 0,
    activeLoans: 0,
    active_loans: 0,
    activeLoansAmount: 0,
    active_loans_amount: 0,
    activeLoansCount: 0,
    active_loans_count: 0,
    totalOutstandingLoans: 0,
    total_outstanding_loans: 0,
    totalInterest: 0,
    total_interest: 0,
    totalInterestCollected: 0,
    total_interest_collected: 0,
    interestCollected: 0,
    interest_collected: 0,
    totalFund: 0,
    total_fund: 0,
    availableBalance: 0,
    available_balance: 0,
    balance: 0,
    monthlyTarget: 0,
    monthly_target: 0,
  };

  await setDoc(groupDocRef, cleanGroupData);
  console.log('   -> Group financial metrics reset to 0.');

  // 2. Reset System Member Counter
  console.log(`\n2. Resetting system/member_counter in groups/${TARGET_GROUP_ID}...`);
  const counterRef = doc(db, 'groups', TARGET_GROUP_ID, 'system', 'member_counter');
  await setDoc(counterRef, {
    format: 'M-{number}',
    lastNumber: 0,
    updatedAt: serverTimestamp(),
  });
  console.log('   -> member_counter reset to lastNumber: 0.');

  // 3. Clear Subcollections under groups/chhatrapati_group_001
  const subcollections = [
    'members',
    'monthly_contributions',
    'loans',
    'repayments',
    'activities',
    'notifications',
  ];

  for (const sub of subcollections) {
    await batchDeleteCollection(
      collection(db, 'groups', TARGET_GROUP_ID, sub),
      `groups/${TARGET_GROUP_ID}/${sub}`
    );
  }

  // 4. Clear Legacy Root Collections
  const rootCollections = ['members', 'loans', 'transactions'];
  for (const rc of rootCollections) {
    await batchDeleteCollection(collection(db, rc), `root /${rc}`);
  }

  // 5. Clean root 'users' collection (Preserve Admin Accounts)
  console.log('\n5. Inspecting root "users" collection to preserve Admin accounts...');
  const usersSnap = await getDocs(collection(db, 'users'));
  const userDeleteBatch = writeBatch(db);
  let deletedUsersCount = 0;
  let preservedAdminCount = 0;

  for (const uDoc of usersSnap.docs) {
    const uData = uDoc.data();
    const isAdmin =
      (uData.role || '').toLowerCase() === 'admin' ||
      (uData.role_name || '').toUpperCase() === 'ADMIN' ||
      uData.email === 'admin@bachatgat.com' ||
      uData.email === 'admin2@bachatgat.com';

    if (isAdmin) {
      console.log(`   [PRESERVED ADMIN] ${uDoc.id} (${uData.email})`);
      // Ensure admin profile has role: admin and active group
      await setDoc(
        doc(db, 'users', uDoc.id),
        {
          role: 'admin',
          role_name: 'ADMIN',
          groupId: TARGET_GROUP_ID,
          group_id: TARGET_GROUP_ID,
          isActive: true,
          is_active: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      preservedAdminCount++;
    } else {
      userDeleteBatch.delete(uDoc.ref);
      deletedUsersCount++;
    }
  }

  if (deletedUsersCount > 0) {
    await userDeleteBatch.commit();
    console.log(`   -> Deleted ${deletedUsersCount} demo member user records.`);
  }
  console.log(`   -> Preserved ${preservedAdminCount} Admin user accounts.`);

  // 6. Final Health Check & Verification
  console.log('\n====================================================');
  console.log('             FINAL POST-RESET VERIFICATION          ');
  console.log('====================================================');

  const [
    finalGroupDoc,
    finalMembers,
    finalContribs,
    finalLoans,
    finalRepays,
    finalUsers,
  ] = await Promise.all([
    getDoc(groupDocRef),
    getDocs(collection(db, 'groups', TARGET_GROUP_ID, 'members')),
    getDocs(collection(db, 'groups', TARGET_GROUP_ID, 'monthly_contributions')),
    getDocs(collection(db, 'groups', TARGET_GROUP_ID, 'loans')),
    getDocs(collection(db, 'groups', TARGET_GROUP_ID, 'repayments')),
    getDocs(collection(db, 'users')),
  ]);

  const g = finalGroupDoc.data() || {};
  console.log(`Group: ${g.name} [${TARGET_GROUP_ID}]`);
  console.log(` - Total Members: ${g.totalMembers} (subcollection count: ${finalMembers.docs.length})`);
  console.log(` - Total Savings: ₹${g.totalSavings} (contributions count: ${finalContribs.docs.length})`);
  console.log(` - Active Loans: ₹${g.activeLoans} (loans count: ${finalLoans.docs.length})`);
  console.log(` - Repayments count: ${finalRepays.docs.length}`);
  console.log(` - Available Balance: ₹${g.availableBalance}`);
  console.log(` - Preserved Admin Users in users collection: ${finalUsers.docs.length}`);
  finalUsers.docs.forEach((u) => {
    console.log(`   * ${u.id}: email=${u.data().email}, role=${u.data().role}`);
  });

  console.log('\n====================================================');
  console.log('      DATABASE RESET COMPLETED SUCCESSFULLY!        ');
  console.log('====================================================');

  process.exit(0);
}

runReset().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
