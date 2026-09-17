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
  writeBatch
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

const app = initializeApp(firebaseConfig, `consolidate-${Date.now()}`);
const db = getFirestore(app);

async function main() {
  console.log('=== STARTING FIRESTORE GROUP CONSOLIDATION & CLEANUP ===');

  // Step 1: Update user CJQxXytYc8SZEHy6ULLKM7nXSQS2 (admin@bachatgat.com) to point to chhatrapati_group_001
  const userAdminRef = doc(db, 'users', 'CJQxXytYc8SZEHy6ULLKM7nXSQS2');
  const userSnap = await getDoc(userAdminRef);
  if (userSnap.exists()) {
    console.log('1. Updating User CJQxXytYc8SZEHy6ULLKM7nXSQS2 (admin@bachatgat.com) groupId to chhatrapati_group_001...');
    await setDoc(userAdminRef, {
      groupId: 'chhatrapati_group_001',
      group_id: 'chhatrapati_group_001',
      groupCode: 'chhatrapati_group_001',
      group_code: 'chhatrapati_group_001',
    }, { merge: true });
    console.log('   -> User updated successfully.');
  } else {
    console.log('1. User CJQxXytYc8SZEHy6ULLKM7nXSQS2 not found, skipping user update.');
  }

  // Step 2: Delete subcollection documents under groups/chhatrapati_group_001
  console.log('\n2. Deleting subcollection documents in groups/chhatrapati_group_001...');
  const chhatrapatiMembers = await getDocs(collection(db, 'groups', 'chhatrapati_group_001', 'members'));
  for (const mDoc of chhatrapatiMembers.docs) {
    console.log(`   Deleting groups/chhatrapati_group_001/members/${mDoc.id}`);
    await deleteDoc(doc(db, 'groups', 'chhatrapati_group_001', 'members', mDoc.id));
  }

  // Step 3: Delete root group documents chhatrapati_group_001 and group_001
  console.log('\n3. Deleting unused root group documents:');
  console.log('   Deleting groups/chhatrapati_group_001...');
  await deleteDoc(doc(db, 'groups', 'chhatrapati_group_001'));
  console.log('   -> groups/chhatrapati_group_001 deleted.');

  console.log('   Deleting groups/group_001...');
  await deleteDoc(doc(db, 'groups', 'group_001'));
  console.log('   -> groups/group_001 deleted.');

  // Step 4: Verification of remaining groups and collections
  console.log('\n=== VERIFICATION ===');
  const remainingGroups = await getDocs(collection(db, 'groups'));
  console.log(`Remaining documents in collection "groups": ${remainingGroups.docs.length}`);
  remainingGroups.docs.forEach((d) => console.log(` - Group: ${d.id} (${d.data().name || d.data().group_name})`));

  const activeGroupId = 'chhatrapati_group_001';
  const [membersSnap, contribSnap, loansSnap, repaysSnap, systemSnap] = await Promise.all([
    getDocs(collection(db, 'groups', activeGroupId, 'members')),
    getDocs(collection(db, 'groups', activeGroupId, 'monthly_contributions')),
    getDocs(collection(db, 'groups', activeGroupId, 'loans')),
    getDocs(collection(db, 'groups', activeGroupId, 'repayments')),
    getDocs(collection(db, 'groups', activeGroupId, 'system')),
  ]);

  console.log(`\nActive Group "${activeGroupId}" health check:`);
  console.log(` - Members count: ${membersSnap.docs.length}`);
  console.log(` - Monthly Contributions count: ${contribSnap.docs.length}`);
  console.log(` - Loans count: ${loansSnap.docs.length}`);
  console.log(` - Repayments count: ${repaysSnap.docs.length}`);
  console.log(` - System docs count: ${systemSnap.docs.length}`);

  console.log('\n=== CONSOLIDATION & CLEANUP COMPLETED SUCCESSFULLY ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Consolidation failed:', err);
  process.exit(1);
});
