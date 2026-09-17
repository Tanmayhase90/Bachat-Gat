import { createRequire } from 'module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  updateDoc,
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyAfSLqG3mqeWxnhk_gBUPkDK9Y4Y17GeFU',
  authDomain: 'bachatgat-app-9e38e.firebaseapp.com',
  projectId: 'bachat-gat-app-9e38e',
  storageBucket: 'bachat-gat-app-9e38e.firebasestorage.app',
  messagingSenderId: '1038306626235',
  appId: '1:1038306626235:web:eb1da740ae33c09ad3b79e',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const TARGET_GROUP_ID = 'chhatrapati_group_001';
const ADMIN_UIDS = [
  'CJQxXytYc8SZEHy6ULLKM7nXSQS2', // admin@bachatgat.com
  '3b47MmQl6vcX9MJ99YxbrbtMyiy1', // admin2@bachatgat.com
];
const MEMBER_DOCS_TO_DELETE = [
  'eOM6E5b71kYix49K3R1dCoUZ6nG3', // M-365
  'M_23',                         // member
  'M_71',                         // member
];

async function run() {
  console.log('====================================================');
  console.log('STEP 1: Authenticate as Admin');
  console.log('====================================================');
  const cred = await signInWithEmailAndPassword(auth, 'admin@bachatgat.com', 'Admin@123');
  console.log('Authenticated successfully as:', cred.user.email, '(UID:', cred.user.uid, ')');

  console.log('\n====================================================');
  console.log('STEP 2: Inspect Current "users" Collection');
  console.log('====================================================');
  const initialUsersSnap = await getDocs(collection(db, 'users'));
  console.log('Total documents in users collection before deletion:', initialUsersSnap.size);
  initialUsersSnap.docs.forEach((d) => {
    const u = d.data();
    console.log(`- Doc [${d.id}]: role=${u.role || u.role_name}, email=${u.email}, name=${u.name || u.fullName}, memberId=${u.memberId}`);
  });

  console.log('\n====================================================');
  console.log('STEP 3: Delete ONLY the 3 Member Docs from "users"');
  console.log('====================================================');
  for (const docId of MEMBER_DOCS_TO_DELETE) {
    if (ADMIN_UIDS.includes(docId)) {
      throw new Error(`SAFETY ABORT: Attempted to delete admin document: ${docId}`);
    }
    const docRef = doc(db, 'users', docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if ((data.role || '').toLowerCase() === 'admin') {
        throw new Error(`SAFETY ABORT: Document ${docId} has role=admin!`);
      }
      console.log(`Deleting regular member doc: users/${docId} (${data.name || data.fullName}, email: ${data.email || 'N/A'})...`);
      await deleteDoc(docRef);
      console.log(`Deleted successfully: users/${docId}`);
    } else {
      console.log(`Notice: users/${docId} does not exist (already deleted).`);
    }
  }

  console.log('\n====================================================');
  console.log('STEP 4: Verify "users" Collection Contains ONLY 2 Admins');
  console.log('====================================================');
  const postUsersSnap = await getDocs(collection(db, 'users'));
  console.log('Total documents in users collection after deletion:', postUsersSnap.size);
  let allAreAdmins = true;
  postUsersSnap.docs.forEach((d) => {
    const u = d.data();
    console.log(`- Doc [${d.id}]: role=${u.role || u.role_name}, email=${u.email}, name=${u.name || u.fullName}`);
    if ((u.role || '').toLowerCase() !== 'admin') {
      allAreAdmins = false;
    }
  });

  if (postUsersSnap.size !== 2 || !allAreAdmins) {
    console.error('ERROR: users collection does not have exactly 2 admin accounts!');
    process.exit(1);
  }
  console.log('VERIFICATION PASSED: users collection contains ONLY the 2 admin accounts!');

  console.log('\n====================================================');
  console.log('STEP 5: Verify "groups/chhatrapati_group_001/members" (365 Records)');
  console.log('====================================================');
  const membersSnap = await getDocs(collection(db, 'groups', TARGET_GROUP_ID, 'members'));
  console.log('Total members in groups/chhatrapati_group_001/members:', membersSnap.size);
  
  // Verify IDs from M_1 to M_365
  const memberIds = new Set(membersSnap.docs.map((d) => d.id));
  const missingIds = [];
  for (let i = 1; i <= 365; i++) {
    const expectedId = `M_${i}`;
    if (!memberIds.has(expectedId)) {
      missingIds.push(expectedId);
    }
  }
  if (missingIds.length > 0) {
    console.error('ERROR: Missing expected member IDs:', missingIds);
    process.exit(1);
  }
  console.log('VERIFICATION PASSED: All 365 documents (M_1 to M_365) are intact and present!');

  // Check sample member documents
  const sampleM1 = membersSnap.docs.find((d) => d.id === 'M_1')?.data();
  const sampleM365 = membersSnap.docs.find((d) => d.id === 'M_365')?.data();
  console.log('Sample M_1:', sampleM1?.name, '| Code:', sampleM1?.memberCode, '| Role:', sampleM1?.role, '| Shares:', sampleM1?.shares);
  console.log('Sample M_365:', sampleM365?.name, '| Code:', sampleM365?.memberCode, '| Role:', sampleM365?.role, '| Shares:', sampleM365?.shares);

  console.log('\n====================================================');
  console.log('STEP 6: Test Member Creation Flow (Creating M_366)');
  console.log('====================================================');
  // Check counter
  const counterRef = doc(db, 'groups', TARGET_GROUP_ID, 'system', 'member_counter');
  const counterSnap = await getDoc(counterRef);
  let observedMax = Number(counterSnap?.data()?.lastNumber || 0);
  membersSnap.docs.forEach((d) => {
    const data = d.data();
    [d.id, data.memberCode, data.member_code].forEach((value) => {
      const num = parseInt(String(value || '').replace(/\D/g, ''), 10);
      if (Number.isFinite(num)) observedMax = Math.max(observedMax, num);
    });
  });

  const nextNumber = observedMax + 1;
  const testMemberId = `M_${nextNumber}`;
  const testMemberCode = `M-${nextNumber}`;
  const testName = 'दत्तात्रय रामदास गाडेकर';
  const testPhone = '9876543210';
  const numShares = 1;
  const contributionPerShare = 1000;
  const totalMonthlyContribution = 1000;

  console.log(`Adding test member ${testMemberId} (${testMemberCode}): "${testName}"...`);

  const newMemberPayload = {
    id: testMemberId,
    name: testName,
    fullName: testName,
    phone: testPhone,
    email: '',
    userId: null,
    authUid: null,
    firebaseUid: null,
    groupId: TARGET_GROUP_ID,
    memberCode: testMemberCode,
    member_code: testMemberCode,
    role: 'member',
    roleName: 'MEMBER',
    role_name: 'MEMBER',
    isActive: true,
    shares: numShares,
    shareCount: numShares,
    monthlyContribution: totalMonthlyContribution,
    monthly_contribution: totalMonthlyContribution,
    monthlyContributionPerShare: contributionPerShare,
    monthly_contribution_per_share: contributionPerShare,
    monthlyHaftaAmount: totalMonthlyContribution,
    status: 'ACTIVE',
    status_lower: 'active',
    joinDate: new Date().toISOString(),
    join_date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const actId = `ACT_${Date.now()}_add`;
  const batch = writeBatch(db);
  batch.set(counterRef, {
    lastNumber: nextNumber,
    format: 'M-{number}',
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.set(doc(db, 'groups', TARGET_GROUP_ID, 'members', testMemberId), newMemberPayload);
  batch.set(doc(db, 'groups', TARGET_GROUP_ID, 'activities', actId), {
    id: actId,
    type: 'adjustment',
    amount: newMemberPayload.monthlyContribution,
    description: `Member added: ${testName} (Shares: ${numShares}, Hafta: ₹${totalMonthlyContribution})`,
    memberId: testMemberId,
    memberName: testName,
    referenceId: testMemberId,
    date: new Date().toISOString(),
  });
  await batch.commit();

  // Update group aggregate totalMembers
  const groupRef = doc(db, 'groups', TARGET_GROUP_ID);
  const groupSnap = await getDoc(groupRef);
  if (groupSnap.exists()) {
    const gData = groupSnap.data();
    const currentTotal = Number(gData.totalMembers || gData.total_members || 0);
    const currentActive = Number(gData.activeMembers || gData.active_members || 0);
    await updateDoc(groupRef, {
      totalMembers: currentTotal + 1,
      total_members: currentTotal + 1,
      activeMembers: currentActive + 1,
      active_members: currentActive + 1,
      updatedAt: serverTimestamp(),
    });
  }

  console.log(`Test member ${testMemberId} created successfully in groups/${TARGET_GROUP_ID}/members!`);

  console.log('\n====================================================');
  console.log('STEP 7: Post-Test Verification');
  console.log('====================================================');
  // Check users collection
  const finalUsersSnap = await getDocs(collection(db, 'users'));
  console.log('Post-test users collection document count:', finalUsersSnap.size);
  finalUsersSnap.docs.forEach((d) => {
    console.log(`- Doc [${d.id}]: role=${d.data().role}, email=${d.data().email}, name=${d.data().name}`);
  });

  if (finalUsersSnap.size !== 2) {
    console.error('FAILURE: users collection document count is not 2! Found:', finalUsersSnap.size);
    process.exit(1);
  }
  console.log('VERIFIED: users collection still has EXACTLY 2 admin documents and 0 member documents!');

  // Check groups/chhatrapati_group_001/members count
  const finalMembersSnap = await getDocs(collection(db, 'groups', TARGET_GROUP_ID, 'members'));
  console.log('Post-test groups/chhatrapati_group_001/members count:', finalMembersSnap.size);

  const createdMemberDoc = await getDoc(doc(db, 'groups', TARGET_GROUP_ID, 'members', testMemberId));
  console.log(`Created member doc ${testMemberId} exists:`, createdMemberDoc.exists());
  console.log('Created member data:', JSON.stringify(createdMemberDoc.data(), null, 2));

  console.log('\n====================================================');
  console.log('ALL OPERATIONS & VERIFICATIONS COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('Execution failed:', err);
  process.exit(1);
});
