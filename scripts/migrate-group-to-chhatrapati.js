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

const app = initializeApp(firebaseConfig, `migrate-group-${Date.now()}`);
const db = getFirestore(app);

const OLD_GROUP_ID = 'chhatrapati_group_001';
const NEW_GROUP_ID = 'chhatrapati_group_001';

async function migrate() {
  console.log(`=== MIGRATING FIRESTORE GROUP: ${OLD_GROUP_ID} -> ${NEW_GROUP_ID} ===\n`);

  // 1. Fetch old group document to copy configuration
  const oldGroupRef = doc(db, 'groups', OLD_GROUP_ID);
  const oldGroupSnap = await getDoc(oldGroupRef);
  const oldData = oldGroupSnap.exists() ? oldGroupSnap.data() : {};

  // 2. Write to groups/chhatrapati_group_001
  const newGroupRef = doc(db, 'groups', NEW_GROUP_ID);
  const groupConfig = {
    name: oldData.name || oldData.groupName || 'Chhatrapati Bachat Gat, Ghargaon Stand',
    groupName: oldData.groupName || oldData.name || 'Chhatrapati Bachat Gat, Ghargaon Stand',
    group_name: oldData.group_name || oldData.name || 'Chhatrapati Bachat Gat, Ghargaon Stand',
    description: oldData.description || 'A progressive self help digital savings and micro-lending group.',
    groupId: NEW_GROUP_ID,
    group_id: NEW_GROUP_ID,
    groupCode: NEW_GROUP_ID,
    group_code: NEW_GROUP_ID,
    id: NEW_GROUP_ID,
    status: 'ACTIVE',
    status_lower: 'active',
    monthlyContributionAmount: Number(oldData.monthlyContributionAmount || 1000),
    monthlyContribution: Number(oldData.monthlyContribution || 1000),
    monthly_contribution: Number(oldData.monthly_contribution || 1000),
    monthlyContributionPerShare: Number(oldData.monthlyContributionPerShare || 1000),
    monthly_contribution_per_share: Number(oldData.monthly_contribution_per_share || 1000),
    monthlyShare: Number(oldData.monthlyShare || 1000),
    monthly_share: Number(oldData.monthly_share || 1000),
    monthlyHaftaDay: Number(oldData.monthlyHaftaDay || oldData.monthly_hafta_day || 10),
    monthly_hafta_day: Number(oldData.monthly_hafta_day || oldData.monthlyHaftaDay || 10),
    createdAt: oldData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // Financial totals (clean zero state)
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

  console.log(`1. Setting group document groups/${NEW_GROUP_ID}...`);
  await setDoc(newGroupRef, groupConfig);
  console.log(`   -> groups/${NEW_GROUP_ID} created successfully.`);

  // 3. Set member_counter in groups/chhatrapati_group_001/system/member_counter
  console.log(`\n2. Setting system/member_counter in groups/${NEW_GROUP_ID}...`);
  await setDoc(doc(db, 'groups', NEW_GROUP_ID, 'system', 'member_counter'), {
    format: 'M-{number}',
    lastNumber: 0,
    updatedAt: serverTimestamp(),
  });
  console.log(`   -> member_counter set to lastNumber: 0.`);

  // 4. Set schema_v1 in groups/chhatrapati_group_001/system/schema_v1
  await setDoc(doc(db, 'groups', NEW_GROUP_ID, 'system', 'schema_v1'), {
    collections: ['members', 'monthly_contributions', 'loans', 'repayments', 'activities', 'notifications'],
    version: '1.0',
    updatedAt: serverTimestamp(),
  });

  // 5. Delete old group subcollections and document (groups/chhatrapati_group_001)
  console.log(`\n3. Deleting old group documents in groups/${OLD_GROUP_ID}...`);
  const subcollections = ['members', 'monthly_contributions', 'loans', 'repayments', 'activities', 'notifications', 'system'];
  for (const sub of subcollections) {
    const snap = await getDocs(collection(db, 'groups', OLD_GROUP_ID, sub));
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  }
  await deleteDoc(oldGroupRef);
  console.log(`   -> Old group groups/${OLD_GROUP_ID} deleted.`);

  // 6. Update all Admin users in root 'users' collection to point to NEW_GROUP_ID
  console.log(`\n4. Updating Admin accounts in root "users" collection...`);
  const usersSnap = await getDocs(collection(db, 'users'));
  for (const uDoc of usersSnap.docs) {
    console.log(`   Updating user ${uDoc.id} (${uDoc.data().email}) to groupId: ${NEW_GROUP_ID}`);
    await setDoc(doc(db, 'users', uDoc.id), {
      groupId: NEW_GROUP_ID,
      group_id: NEW_GROUP_ID,
      groupCode: NEW_GROUP_ID,
      group_code: NEW_GROUP_ID,
      role: 'admin',
      role_name: 'ADMIN',
      isActive: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  // 7. Verification
  console.log('\n=== VERIFICATION ===');
  const groupsSnap = await getDocs(collection(db, 'groups'));
  console.log(`Groups collection has ${groupsSnap.docs.length} document(s):`);
  groupsSnap.docs.forEach((d) => console.log(` - Group: ${d.id} (${d.data().name || d.data().group_name})`));

  const newDoc = await getDoc(newGroupRef);
  console.log(`\nGroup Document [${NEW_GROUP_ID}] data:`, JSON.stringify(newDoc.data(), null, 2));

  const finalUsers = await getDocs(collection(db, 'users'));
  console.log(`\nUsers in users collection (${finalUsers.docs.length}):`);
  finalUsers.docs.forEach((u) => {
    console.log(` - User ${u.id}: email=${u.data().email}, role=${u.data().role}, groupId=${u.data().groupId}`);
  });

  console.log('\n=== GROUP MIGRATION COMPLETED SUCCESSFULLY ===');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
