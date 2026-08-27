/**
 * One-time Firestore cleanup script
 * Deletes a member by name from both root and group-scoped collections,
 * plus related records that reference the memberId(s) found.
 *
 * Usage:
 *   node scripts/delete-member-by-name.js Rutik
 *   node scripts/delete-member-by-name.js Rutik --dry-run
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} = require('firebase/firestore');

function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '../client/.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const [key, ...vals] = trimmed.split('=');
        if (key && !process.env[key.trim()]) {
          process.env[key.trim()] = vals.join('=').trim();
        }
      }
    }
  } catch (err) {
    console.warn('Could not load client/.env:', err.message);
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
const db = getFirestore(app);

const targetName = (process.argv[2] || 'Rutik').trim().toLowerCase();
const dryRun = process.argv.includes('--dry-run');
const groupId = 'shivshahi_group_001';

function matchesName(data = {}) {
  const candidates = [
    data.name,
    data.fullName,
    data.memberName,
    data.member_name,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());
  return candidates.includes(targetName);
}

async function deleteQueryResults(q, label, batch) {
  const snap = await getDocs(q);
  const ids = [];
  snap.docs.forEach((d) => {
    ids.push(d.id);
    if (!dryRun) batch.delete(d.ref);
  });
  if (ids.length) {
    console.log(`${dryRun ? '[dry-run] ' : ''}${label}: ${ids.join(', ')}`);
  }
  return ids;
}

async function main() {
  console.log(`Target member name: ${targetName}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : 'delete'}`);

  const batch = writeBatch(db);
  const memberIds = new Set();

  // Group-scoped members
  const groupMembersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
  groupMembersSnap.docs.forEach((d) => {
    if (matchesName(d.data())) memberIds.add(d.id);
  });

  // Root-level members
  const rootMembersSnap = await getDocs(collection(db, 'members'));
  rootMembersSnap.docs.forEach((d) => {
    if (matchesName(d.data())) memberIds.add(d.id);
  });

  if (memberIds.size === 0) {
    console.log('No matching member found.');
    return;
  }

  console.log(`Matched memberId(s): ${Array.from(memberIds).join(', ')}`);

  // Delete member docs
  for (const memberId of memberIds) {
    if (!dryRun) {
      batch.delete(doc(db, 'groups', groupId, 'members', memberId));
      batch.delete(doc(db, 'members', memberId));
    }
  }

  // Delete related records that reference the memberId(s)
  const collectionsToClean = [
    ['groups', groupId, 'monthly_contributions'],
    ['groups', groupId, 'loans'],
    ['groups', groupId, 'repayments'],
    ['groups', groupId, 'activities'],
    ['savings'],
    ['loans'],
    ['repayments'],
  ];

  for (const memberId of memberIds) {
    for (const pathParts of collectionsToClean) {
      const colRef = collection(db, ...pathParts);
      const queries = [
        query(colRef, where('memberId', '==', memberId)),
        query(colRef, where('member_id', '==', memberId)),
      ];
      for (const q of queries) {
        const snap = await getDocs(q);
        snap.docs.forEach((d) => {
          if (!dryRun) batch.delete(d.ref);
        });
        if (snap.docs.length) {
          console.log(`${dryRun ? '[dry-run] ' : ''}${pathParts.join('/')} linked records for ${memberId}: ${snap.docs.map((d) => d.id).join(', ')}`);
        }
      }
    }
  }

  if (dryRun) {
    console.log('Dry run complete. No deletions were written.');
    return;
  }

  await batch.commit();
  console.log('Delete completed successfully.');
}

main().catch((err) => {
  console.error('Delete failed:', err);
  process.exit(1);
});
