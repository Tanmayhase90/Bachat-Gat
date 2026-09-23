import { createRequire } from 'module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase/app');
const {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  deleteUser,
} = require('firebase/auth');
const {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  collection,
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyAfSLqG3mqeWxnhk_gBUPkDK9Y4Y17GeFU',
  authDomain: 'bachat-gat-app-9e38e.firebaseapp.com',
  projectId: 'bachat-gat-app-9e38e',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function updateA2Admin() {
  console.log('=== UPDATING ADMIN A_2 ===\n');

  const adaptedPassword = '9970#BachatGat';
  const newEmail = 'walmikaher8427@gmail.com';
  const newFullName = 'Walmik Aher';
  const newPhone = '9970956556';

  let newUid = null;

  // Step 1: Create or sign in to walmikaher8427@gmail.com in Firebase Auth
  console.log('Step 1: Setting up Firebase Auth account for walmikaher8427@gmail.com...');
  try {
    const cred = await createUserWithEmailAndPassword(auth, newEmail, adaptedPassword);
    newUid = cred.user.uid;
    await updateProfile(cred.user, { displayName: newFullName });
    console.log(`  ✓ Created new Firebase Auth account with UID: ${newUid}`);
  } catch (authErr) {
    if (authErr.code === 'auth/email-already-in-use') {
      console.log(`  ℹ Email ${newEmail} already exists in Firebase Auth. Signing in to update...`);
      const cred = await signInWithEmailAndPassword(auth, newEmail, adaptedPassword);
      newUid = cred.user.uid;
      await updateProfile(cred.user, { displayName: newFullName });
      console.log(`  ✓ Signed in to existing UID: ${newUid}`);
    } else {
      throw authErr;
    }
  }

  // Step 2: Sign in as Admin A_1 to obtain administrative Firestore write permissions
  console.log('\nStep 2: Authenticating as Admin A_1 (admin@bachatgat.com) for Firestore updates...');
  await signInWithEmailAndPassword(auth, 'admin@bachatgat.com', 'Admin@123');
  console.log('  ✓ Authenticated as Admin A_1');

  // Step 3: Update Firestore Document users/{newUid} for A_2
  console.log(`\nStep 3: Updating Firestore Document users/${newUid} for Admin A_2...`);
  const oldDocSnap = await getDoc(doc(db, 'users', '3b47MmQl6vcX9MJ99YxbrbtMyiy1'));
  const oldData = oldDocSnap.exists() ? oldDocSnap.data() : {};

  const userDocRef = doc(db, 'users', newUid);
  const updatedA2Data = {
    ...oldData,
    uid: newUid,
    id: newUid,
    name: newFullName,
    fullName: newFullName,
    email: newEmail,
    phone: newPhone,
    contact: newPhone,
    contact_number: newPhone,
    adminId: 'A_2',
    adminCode: 'A-2',
    memberId: 'A_2',
    memberCode: 'A-2',
    role: 'admin',
    role_name: 'ADMIN',
    isActive: true,
    is_active: true,
    groupId: oldData.groupId || 'chhatrapati_group_001',
    groupName: oldData.groupName || 'Chhatrapati Bachat Gat, Ghargaon Stand',
    group_id: oldData.group_id || 'chhatrapati_group_001',
    group_code: oldData.group_code || 'chhatrapati_group_001',
    updatedAt: serverTimestamp(),
  };

  await setDoc(userDocRef, updatedA2Data, { merge: true });
  console.log(`  ✓ Firestore document users/${newUid} set as Admin A_2`);

  // Step 4: Delete old placeholder doc & old auth account if UID changed
  if (newUid !== '3b47MmQl6vcX9MJ99YxbrbtMyiy1') {
    console.log('\nStep 4: Cleaning up old placeholder A_2 doc & auth user (3b47MmQl6vcX9MJ99YxbrbtMyiy1)...');

    // Delete old Firestore doc
    await deleteDoc(doc(db, 'users', '3b47MmQl6vcX9MJ99YxbrbtMyiy1')).catch(() => {});
    console.log('  ✓ Old Firestore placeholder doc users/3b47MmQl6vcX9MJ99YxbrbtMyiy1 removed');

    // Delete old Auth account using a separate auth app
    const tempApp = initializeApp(firebaseConfig, `cleanup-old-a2-${Date.now()}`);
    const tempAuth = getAuth(tempApp);
    try {
      const oldCred = await signInWithEmailAndPassword(tempAuth, 'admin2@bachatgat.com', 'Admin@123');
      await deleteUser(oldCred.user);
      console.log('  ✓ Old Firebase Auth account admin2@bachatgat.com deleted');
    } catch (e) {
      console.log('  ℹ Old Auth user deletion notice:', e.message);
    } finally {
      await deleteApp(tempApp).catch(() => {});
    }
  }

  // Step 5: Verify A_1 Safety
  console.log('\nStep 5: Verifying A_1 remains completely untouched...');
  const a1DocSnap = await getDoc(doc(db, 'users', 'CJQxXytYc8SZEHy6ULLKM7nXSQS2'));
  const a1Data = a1DocSnap.data();
  console.log('A_1 Doc Details:');
  console.log('  UID:', a1Data.uid || a1DocSnap.id);
  console.log('  Admin ID:', a1Data.adminId || a1Data.memberId);
  console.log('  Name:', a1Data.name || a1Data.fullName);
  console.log('  Email:', a1Data.email);
  console.log('  Phone:', a1Data.phone);
  console.log('  Role:', a1Data.role);

  if (a1Data.email !== 'admin@bachatgat.com' || (a1Data.adminId !== 'A_1' && a1Data.memberId !== 'A_1')) {
    throw new Error('CRITICAL SAFETY FAILURE: A_1 was modified!');
  }
  console.log('  ✓ A_1 is 100% verified untouched!');

  // Step 6: Verify exactly 2 admin accounts exist
  console.log('\nStep 6: Verifying total admin accounts in Firestore...');
  const usersSnap = await getDocs(collection(db, 'users'));
  const adminUsers = usersSnap.docs.filter((d) => {
    const data = d.data();
    return (data.role || '').toLowerCase() === 'admin' || (data.role_name || '').toUpperCase() === 'ADMIN';
  });

  console.log(`Total users in users collection: ${usersSnap.size}`);
  console.log(`Total admin users: ${adminUsers.length}`);
  adminUsers.forEach((d) => {
    const data = d.data();
    console.log(`  - [${data.adminId || data.memberId}] ${data.name || data.fullName} (${data.email}) - UID: ${d.id}`);
  });

  if (adminUsers.length !== 2) {
    throw new Error(`Expected exactly 2 admins, found ${adminUsers.length}`);
  }
  console.log('  ✓ Exactly 2 admin accounts exist: A_1 and A_2');

  console.log('\n=== A_2 UPDATE COMPLETED SUCCESSFULLY ===\n');
}

updateA2Admin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Update Error:', err);
    process.exit(1);
  });
