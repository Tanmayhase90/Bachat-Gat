import { createRequire } from 'module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, getDoc, updateDoc, serverTimestamp, getDocs, collection } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyAfSLqG3mqeWxnhk_gBUPkDK9Y4Y17GeFU',
  authDomain: 'bachat-gat-app-9e38e.firebaseapp.com',
  projectId: 'bachat-gat-app-9e38e',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  console.log('1. Authenticating as admin...');
  await signInWithEmailAndPassword(auth, 'admin@bachatgat.com', 'Admin@123');
  console.log('Authenticated successfully.\n');

  console.log('2. Updating Admin 1: CJQxXytYc8SZEHy6ULLKM7nXSQS2 (admin@bachatgat.com)...');
  const admin1Ref = doc(db, 'users', 'CJQxXytYc8SZEHy6ULLKM7nXSQS2');
  const admin1Snap = await getDoc(admin1Ref);
  if (!admin1Snap.exists()) {
    throw new Error('Admin 1 doc not found!');
  }
  await updateDoc(admin1Ref, {
    memberId: 'A_1',
    memberCode: 'A-1',
    adminId: 'A_1',
    adminCode: 'A-1',
    role: 'admin',
    role_name: 'ADMIN',
    updatedAt: serverTimestamp(),
  });
  console.log('Admin 1 updated to memberId: A_1, memberCode: A-1.\n');

  console.log('3. Updating Admin 2: 3b47MmQl6vcX9MJ99YxbrbtMyiy1 (admin2@bachatgat.com)...');
  const admin2Ref = doc(db, 'users', '3b47MmQl6vcX9MJ99YxbrbtMyiy1');
  const admin2Snap = await getDoc(admin2Ref);
  if (!admin2Snap.exists()) {
    throw new Error('Admin 2 doc not found!');
  }
  await updateDoc(admin2Ref, {
    memberId: 'A_2',
    memberCode: 'A-2',
    adminId: 'A_2',
    adminCode: 'A-2',
    role: 'admin',
    role_name: 'ADMIN',
    updatedAt: serverTimestamp(),
  });
  console.log('Admin 2 updated to memberId: A_2, memberCode: A-2.\n');

  console.log('4. Verifying Firestore users collection...');
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log(`Total users in users collection: ${usersSnap.size}`);
  usersSnap.docs.forEach((d) => {
    const data = d.data();
    console.log(`UID: [${d.id}]`);
    console.log(`  email: ${data.email}`);
    console.log(`  name: ${data.name || data.fullName}`);
    console.log(`  role: ${data.role}`);
    console.log(`  memberId: ${data.memberId}`);
    console.log(`  memberCode: ${data.memberCode}`);
    console.log(`  adminId: ${data.adminId}`);
    console.log(`  adminCode: ${data.adminCode}`);
  });

  console.log('\nAdmin update completed successfully!');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
