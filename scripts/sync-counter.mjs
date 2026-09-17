import { createRequire } from 'module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyAfSLqG3mqeWxnhk_gBUPkDK9Y4Y17GeFU',
  authDomain: 'bachat-gat-app-9e38e.firebaseapp.com',
  projectId: 'bachat-gat-app-9e38e',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  await signInWithEmailAndPassword(auth, 'admin@bachatgat.com', 'Admin@123');
  const counterRef = doc(db, 'groups', 'chhatrapati_group_001', 'system', 'member_counter');
  await setDoc(counterRef, {
    lastNumber: 365,
    format: 'M-{number}',
    updatedAt: serverTimestamp(),
  }, { merge: true });
  console.log('Synchronized member_counter to lastNumber: 365');
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
