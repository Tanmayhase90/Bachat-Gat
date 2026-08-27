/**
 * One-Time Script to Initialize / Create the First Admin Account in Firebase
 * 
 * IMPORTANT:
 * Public users through the /register registration page are ALWAYS assigned role = "member".
 * Admin roles can only be granted via this secure script or through the Firebase Console.
 * 
 * Usage:
 *   node scripts/create-admin.js <email> <password> <fullName> <phone>
 * 
 * Default:
 *   node scripts/create-admin.js admin@bachatgat.com Admin@123 "Shri Shivaji Patil" "9822000000"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } = require('firebase/auth');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');

// Helper to parse client/.env if process.env is empty
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createAdmin() {
  const args = process.argv.slice(2);
  const email = (args[0] || 'admin@bachatgat.com').trim().toLowerCase();
  const password = args[1] || 'Admin@123';
  const fullName = args[2] || 'Shri Shivaji Patil';
  const phone = args[3] || '9822000000';

  console.log(`\n==================================================`);
  console.log(`🚀 Initializing Admin User: ${email}`);
  console.log(`==================================================\n`);

  try {
    let uid;
    try {
      // 1. Try creating a new Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      uid = userCredential.user.uid;
      await updateProfile(userCredential.user, { displayName: fullName });
      console.log(`✔ Created new Firebase Auth account with UID: ${uid}`);
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-in-use') {
        // If already exists, sign in to retrieve existing UID
        console.log(`ℹ Account ${email} already exists in Firebase Auth. Signing in to retrieve UID...`);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        uid = userCredential.user.uid;
        console.log(`✔ Retrieved existing UID: ${uid}`);
      } else {
        throw authErr;
      }
    }

    // 2. Create / Overwrite Firestore document with role = "admin"
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, {
      uid,
      fullName,
      name: fullName,
      email,
      phone,
      role: 'admin',
      role_name: 'ADMIN',
      isActive: true,
      groupId: 'shivshahi_group_001',
      groupName: 'Chhatrapati Bachat Gat',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    console.log(`✔ Firestore document created/updated in users/${uid} with role: "admin"`);

    // 3. Ensure Default Group document exists
    const groupDocRef = doc(db, 'groups', 'shivshahi_group_001');
    await setDoc(groupDocRef, {
      groupId: 'shivshahi_group_001',
      groupName: 'Chhatrapati Bachat Gat',
      group_name: 'Chhatrapati Bachat Gat',
      groupCode: 'shivshahi_group_001',
      group_code: 'shivshahi_group_001',
      monthlyContribution: 1000,
      monthly_contribution_per_share: 1000,
      monthlyTarget: 363000,
      monthly_target: 363000,
      description: 'A progressive self help digital savings and micro-lending group.',
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    console.log(`✔ Default Group document verified in groups/shivshahi_group_001`);
    console.log(`\n🎉 Admin user creation completed successfully!`);
    console.log(`   You can now log in via the "Admin Login" tab with:\n   Email: ${email}\n   Password: ${password}\n`);
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Failed to create admin user:`, err.message || err);
    process.exit(1);
  }
}

createAdmin();
