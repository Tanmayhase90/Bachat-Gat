import { createRequire } from 'module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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
  await signInWithEmailAndPassword(auth, 'admin@bachatgat.com', 'Admin@123');
  const snap = await getDocs(collection(db, 'groups', 'chhatrapati_group_001', 'members'));
  console.log('--- ALL MEMBERS IN groups/chhatrapati_group_001/members ---');
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(`ID: ${d.id}, name: ${data.name}, role: ${data.role}, role_name: ${data.role_name}, status: ${data.status}`);
  });
  process.exit(0);
}
run();
