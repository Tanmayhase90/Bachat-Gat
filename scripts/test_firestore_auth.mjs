import { createRequire } from 'module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs, doc, getDoc, query, where } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyAfSLqG3mqeWxnhk_gBUPkDK9Y4Y17GeFU',
  authDomain: 'bachat-gat-app-9e38e.firebaseapp.com',
  projectId: 'bachat-gat-app-9e38e',
  storageBucket: 'bachat-gat-app-9e38e.firebasestorage.app',
  messagingSenderId: '1038306626235',
  appId: '1:1038306626235:web:eb1da740ae33c09ad3b79e',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  console.log('=== TEST 1: Unauthenticated Queries ===');
  try {
    const snap = await getDocs(collection(db, 'users'));
    console.log('Unauth users getDocs SUCCESS, count:', snap.size);
  } catch (e) {
    console.log('Unauth users getDocs FAILED:', e.code, e.message);
  }

  try {
    const snap = await getDocs(collection(db, 'groups', 'chhatrapati_group_001', 'members'));
    console.log('Unauth chhatrapati_group_001/members SUCCESS, count:', snap.size);
  } catch (e) {
    console.log('Unauth chhatrapati_group_001/members FAILED:', e.code, e.message);
  }

  console.log('\n=== TEST 2: Admin Login (admin@bachatgat.com) ===');
  try {
    const cred = await signInWithEmailAndPassword(auth, 'admin@bachatgat.com', 'Admin@123');
    console.log('Admin login SUCCESS! UID:', cred.user.uid, 'Email:', cred.user.email);

    // Check user doc in users/{uid}
    const uDoc = await getDoc(doc(db, 'users', cred.user.uid));
    console.log('users doc exists:', uDoc.exists());
    if (uDoc.exists()) {
      console.log('User profile in Firestore:', JSON.stringify(uDoc.data(), null, 2));
    }

    // Test reading users collection
    try {
      const snap = await getDocs(collection(db, 'users'));
      console.log('Admin users collection SUCCESS, count:', snap.size);
      snap.docs.forEach(d => console.log('  user doc:', d.id, 'role:', d.data().role, 'email:', d.data().email, 'name:', d.data().name));
    } catch (e) {
      console.log('Admin users collection FAILED:', e.code, e.message);
    }

    // Test reading users collection with where role == 'member'
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'member')));
      console.log('Admin users where role==member SUCCESS, count:', snap.size);
    } catch (e) {
      console.log('Admin users where role==member FAILED:', e.code, e.message);
    }

    // Test reading groups
    try {
      const snap = await getDocs(collection(db, 'groups'));
      console.log('Admin groups SUCCESS, count:', snap.size);
    } catch (e) {
      console.log('Admin groups FAILED:', e.code, e.message);
    }

    // Test reading groups/chhatrapati_group_001/members
    try {
      const snap = await getDocs(collection(db, 'groups', 'chhatrapati_group_001', 'members'));
      console.log('Admin chhatrapati_group_001/members SUCCESS, count:', snap.size);
    } catch (e) {
      console.log('Admin chhatrapati_group_001/members FAILED:', e.code, e.message);
    }

    // Test reading monthly_contributions
    try {
      const snap = await getDocs(collection(db, 'groups', 'chhatrapati_group_001', 'monthly_contributions'));
      console.log('Admin chhatrapati_group_001/monthly_contributions SUCCESS, count:', snap.size);
    } catch (e) {
      console.log('Admin chhatrapati_group_001/monthly_contributions FAILED:', e.code, e.message);
    }

    // Test reading loans
    try {
      const snap = await getDocs(collection(db, 'groups', 'chhatrapati_group_001', 'loans'));
      console.log('Admin chhatrapati_group_001/loans SUCCESS, count:', snap.size);
    } catch (e) {
      console.log('Admin chhatrapati_group_001/loans FAILED:', e.code, e.message);
    }

    // Test reading repayments
    try {
      const snap = await getDocs(collection(db, 'groups', 'chhatrapati_group_001', 'repayments'));
      console.log('Admin chhatrapati_group_001/repayments SUCCESS, count:', snap.size);
    } catch (e) {
      console.log('Admin chhatrapati_group_001/repayments FAILED:', e.code, e.message);
    }

    // Test reading activities
    try {
      const snap = await getDocs(collection(db, 'groups', 'chhatrapati_group_001', 'activities'));
      console.log('Admin chhatrapati_group_001/activities SUCCESS, count:', snap.size);
    } catch (e) {
      console.log('Admin chhatrapati_group_001/activities FAILED:', e.code, e.message);
    }

  } catch (e) {
    console.log('Admin login FAILED:', e.code, e.message);
  }

  process.exit(0);
}

run();
