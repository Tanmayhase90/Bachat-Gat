/**
 * Creates a temporary assigned member and linked finance records, verifies
 * access as that member, then removes all temporary data.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(new URL('../client/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase/app');
const {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} = require('firebase/auth');
const {
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  writeBatch,
} = require('firebase/firestore');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GROUP_ID = 'shivshahi_group_001';

function loadEnv() {
  const envPath = path.resolve(__dirname, '../client/.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...parts] = trimmed.split('=');
    if (!process.env[key]) process.env[key] = parts.join('=').trim();
  }
}

loadEnv();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyAfSLqG3mqeWxnhk_gBUPkDK9Y4Y17GeFU',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'bachat-gat-app-9e38e.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'bachat-gat-app-9e38e',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'bachat-gat-app-9e38e.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1038306626235',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:1038306626235:web:eb1da740ae33c09ad3b79e',
};

const stamp = Date.now();
const ids = {
  member: `M_WORKFLOW_${stamp}`,
  contribution: `C_WORKFLOW_${stamp}`,
  loan: `L_WORKFLOW_${stamp}`,
  repayment: `REP_WORKFLOW_${stamp}`,
  activity: `ACT_WORKFLOW_${stamp}`,
  notification: `NOT_WORKFLOW_${stamp}`,
};
const testEmail = `workflow.member.${stamp}@bachatgat.com`;
const testPassword = `Workflow@${String(stamp).slice(-6)}`;
const adminEmail = process.env.BACHAT_ADMIN_EMAIL || 'admin@bachatgat.com';
const adminPassword = process.env.BACHAT_ADMIN_PASSWORD || 'Admin@123';

const adminApp = initializeApp(firebaseConfig, `workflow-admin-${stamp}`);
const memberApp = initializeApp(firebaseConfig, `workflow-member-${stamp}`);
const adminAuth = getAuth(adminApp);
const adminDb = getFirestore(adminApp);
const memberAuth = getAuth(memberApp);
const memberDb = getFirestore(memberApp);
let testUser = null;

const paths = [
  ['groups', GROUP_ID, 'members', ids.member],
  ['groups', GROUP_ID, 'monthly_contributions', ids.contribution],
  ['groups', GROUP_ID, 'loans', ids.loan],
  ['groups', GROUP_ID, 'repayments', ids.repayment],
  ['groups', GROUP_ID, 'activities', ids.activity],
  ['groups', GROUP_ID, 'notifications', ids.notification],
];

async function removeTemporaryData(uid) {
  if (!adminAuth.currentUser) {
    await signInWithEmailAndPassword(adminAuth, adminEmail, adminPassword);
  }
  const batch = writeBatch(adminDb);
  for (const parts of paths) batch.delete(doc(adminDb, ...parts));
  if (uid) batch.delete(doc(adminDb, 'users', uid));
  await batch.commit();
}

async function run() {
  try {
    await signInWithEmailAndPassword(adminAuth, adminEmail, adminPassword);

    // Start with a Firestore-only member to cover the existing-member login flow.
    await setDoc(doc(adminDb, ...paths[0]), {
      id: ids.member,
      name: 'Workflow Test Member',
      fullName: 'Workflow Test Member',
      memberCode: ids.member,
      role: 'member',
      status: 'active',
      isActive: true,
      groupId: GROUP_ID,
    });
    const unlinkedMember = await getDoc(doc(adminDb, ...paths[0]));
    if (!unlinkedMember.exists() || unlinkedMember.data().authUid) {
      throw new Error('Verification failed: existing unlinked member setup');
    }
    console.log('PASS: existing member starts without a login account');

    const credential = await createUserWithEmailAndPassword(memberAuth, testEmail, testPassword);
    testUser = credential.user;
    const changedPassword = `${testPassword}X`;
    await reauthenticateWithCredential(testUser, EmailAuthProvider.credential(testEmail, testPassword));
    await updatePassword(testUser, changedPassword);
    await signOut(memberAuth);
    const changedCredential = await signInWithEmailAndPassword(memberAuth, testEmail, changedPassword);
    testUser = changedCredential.user;
    console.log('PASS: authenticated password change and re-login');

    await setDoc(doc(adminDb, 'groups', GROUP_ID), {
      groupId: GROUP_ID,
      groupCode: GROUP_ID,
      groupName: 'Chhatrapati Bachat Gat',
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await setDoc(doc(adminDb, 'groups', GROUP_ID, 'system', 'schema_v1'), {
      version: 1,
      collections: ['members', 'monthly_contributions', 'loans', 'repayments', 'activities', 'notifications'],
      updatedAt: serverTimestamp(),
    }, { merge: true });

    const batch = writeBatch(adminDb);
    batch.set(doc(adminDb, 'users', testUser.uid), {
      uid: testUser.uid,
      name: 'Workflow Test Member',
      fullName: 'Workflow Test Member',
      email: testEmail,
      role: 'member',
      role_name: 'MEMBER',
      isActive: true,
      memberId: ids.member,
      memberCode: ids.member,
      groupId: GROUP_ID,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(adminDb, ...paths[0]), {
      id: ids.member,
      name: 'Workflow Test Member',
      fullName: 'Workflow Test Member',
      email: testEmail,
      authUid: testUser.uid,
      userId: testUser.uid,
      firebaseUid: testUser.uid,
      memberCode: ids.member,
      role: 'member',
      status: 'active',
      isActive: true,
      groupId: GROUP_ID,
    });
    batch.set(doc(adminDb, ...paths[1]), { id: ids.contribution, memberId: ids.member, amount: 1000, paidAmount: 1000, month: 8, year: 2026, groupId: GROUP_ID });
    batch.set(doc(adminDb, ...paths[2]), { id: ids.loan, memberId: ids.member, principalAmount: 5000, pendingPrincipal: 4000, status: 'active', groupId: GROUP_ID });
    batch.set(doc(adminDb, ...paths[3]), { id: ids.repayment, loanId: ids.loan, memberId: ids.member, principalAmount: 1000, interestAmount: 100, amount: 1100, groupId: GROUP_ID });
    batch.set(doc(adminDb, ...paths[4]), { id: ids.activity, memberId: ids.member, type: 'repayment', amount: 1100, groupId: GROUP_ID });
    batch.set(doc(adminDb, ...paths[5]), { id: ids.notification, userId: testUser.uid, title: 'Workflow verified', isRead: false, groupId: GROUP_ID });
    await batch.commit();

    const checks = [
      ['user assignment', doc(memberDb, 'users', testUser.uid)],
      ['member link', doc(memberDb, ...paths[0])],
      ['monthly contribution', doc(memberDb, ...paths[1])],
      ['loan', doc(memberDb, ...paths[2])],
      ['repayment ledger', doc(memberDb, ...paths[3])],
      ['activity', doc(memberDb, ...paths[4])],
      ['notification', doc(memberDb, ...paths[5])],
    ];

    for (const [label, reference] of checks) {
      const snapshot = await getDoc(reference);
      if (!snapshot.exists()) throw new Error(`Verification failed: ${label}`);
      console.log(`PASS: ${label}`);
    }

    const userProfile = (await getDoc(doc(memberDb, 'users', testUser.uid))).data();
    const memberProfile = (await getDoc(doc(memberDb, ...paths[0]))).data();
    if (userProfile.memberId !== ids.member || memberProfile.authUid !== testUser.uid) {
      throw new Error('Verification failed: Auth UID and member ID are not linked.');
    }
    console.log('PASS: direct member login is linked to the assigned member');

    // Match the production delete/reactivate case: Firestore records are removed
    // while the Firebase Auth identity remains and is reclaimed with its password.
    const orphanedUid = testUser.uid;
    await deleteDoc(doc(adminDb, 'users', orphanedUid));
    await deleteDoc(doc(adminDb, ...paths[0]));
    await signOut(memberAuth);

    let duplicateRejected = false;
    try {
      await createUserWithEmailAndPassword(memberAuth, testEmail, changedPassword);
    } catch (error) {
      duplicateRejected = error.code === 'auth/email-already-in-use';
    }
    if (!duplicateRejected) throw new Error('Verification failed: orphaned Auth identity was not detected.');

    const reactivatedCredential = await signInWithEmailAndPassword(memberAuth, testEmail, changedPassword);
    testUser = reactivatedCredential.user;
    if (testUser.uid !== orphanedUid) throw new Error('Verification failed: reactivated account UID changed.');
    if ((await getDoc(doc(memberDb, 'users', orphanedUid))).exists()) {
      throw new Error('Verification failed: deleted user profile still exists.');
    }

    const reactivationBatch = writeBatch(adminDb);
    reactivationBatch.set(doc(adminDb, 'users', orphanedUid), {
      uid: orphanedUid,
      email: testEmail,
      role: 'member',
      role_name: 'MEMBER',
      isActive: true,
      memberId: ids.member,
      groupId: GROUP_ID,
    });
    reactivationBatch.set(doc(adminDb, ...paths[0]), {
      id: ids.member,
      name: 'Reactivated Workflow Member',
      email: testEmail,
      authUid: orphanedUid,
      memberCode: ids.member,
      status: 'active',
      isActive: true,
      groupId: GROUP_ID,
    });
    await reactivationBatch.commit();
    console.log('PASS: deleted member email and Auth account can be reactivated');

    await deleteUser(testUser);
    testUser = null;
    await removeTemporaryData(credential.user.uid);
    console.log('PASS: temporary workflow data cleaned up');
    console.log('FULL WORKFLOW VERIFIED');
  } finally {
    if (testUser) {
      const uid = testUser.uid;
      await deleteUser(testUser).catch(() => {});
      await removeTemporaryData(uid).catch(() => {});
    }
    await signOut(adminAuth).catch(() => {});
    await deleteApp(memberApp).catch(() => {});
    await deleteApp(adminApp).catch(() => {});
  }
}

run().catch((error) => {
  console.error('FULL WORKFLOW FAILED:', error.message || error);
  process.exitCode = 1;
});
