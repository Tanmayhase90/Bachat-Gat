import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '../client/.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...vals] = trimmed.split('=');
          const val = vals.join('=').trim();
          if (key && !process.env[key.trim()]) {
            process.env[key.trim()] = val;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Notice: client/.env file could not be parsed automatically:', e.message);
  }
}

loadEnv();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'YOUR_FIREBASE_API_KEY',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'bachat-gat-app-9e38e.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'bachat-gat-app-9e38e',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'bachat-gat-app-9e38e.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1038306626235',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:1038306626235:web:eb1da740ae33c09ad3b79e',
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-DJ20C3JZH8',
};

const app = initializeApp(firebaseConfig, `inspect-${Date.now()}`);
const db = getFirestore(app);

async function inspect() {
  console.log('--- Inspecting Firestore Groups ---');
  
  const groupsSnap = await getDocs(collection(db, 'groups'));
  console.log(`Found ${groupsSnap.docs.length} documents under collection "groups":`);
  
  for (const groupDoc of groupsSnap.docs) {
    const gId = groupDoc.id;
    const gData = groupDoc.data();
    console.log(`\n========================================`);
    console.log(`GROUP ID: "${gId}"`);
    console.log(`Document Data:`, JSON.stringify(gData, null, 2));

    // Check subcollections
    const subcollections = [
      'members',
      'monthly_contributions',
      'loans',
      'repayments',
      'activities',
      'savings',
      'transactions',
      'system'
    ];

    for (const sub of subcollections) {
      try {
        const subSnap = await getDocs(collection(db, 'groups', gId, sub));
        console.log(`  Subcollection "${sub}": ${subSnap.docs.length} documents`);
        if (subSnap.docs.length > 0 && subSnap.docs.length <= 5) {
          subSnap.docs.forEach((d) => console.log(`    - Doc ${d.id}:`, JSON.stringify(d.data()).slice(0, 100)));
        } else if (subSnap.docs.length > 5) {
          console.log(`    - Sample Doc ${subSnap.docs[0].id}:`, JSON.stringify(subSnap.docs[0].data()).slice(0, 100));
        }
      } catch (err) {
        console.log(`  Subcollection "${sub}": Error querying (${err.message})`);
      }
    }
  }

  console.log('\n--- Inspecting Root Users Collection ---');
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    console.log(`Found ${usersSnap.docs.length} users in root "users" collection:`);
    usersSnap.docs.forEach((u) => {
      const uData = u.data();
      console.log(`  User ${u.id}: email=${uData.email}, role=${uData.role || uData.role_name}, groupId=${uData.groupId || uData.group_id}, memberId=${uData.memberId || uData.member_id}`);
    });
  } catch (err) {
    console.log('Error querying root users collection:', err.message);
  }

  process.exit(0);
}

inspect().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
