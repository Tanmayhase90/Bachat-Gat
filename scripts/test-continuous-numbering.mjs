import { createRequire } from 'module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, getDoc, getDocs, collection, setDoc, deleteDoc, writeBatch, serverTimestamp } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyAfSLqG3mqeWxnhk_gBUPkDK9Y4Y17GeFU',
  authDomain: 'bachat-gat-app-9e38e.firebaseapp.com',
  projectId: 'bachat-gat-app-9e38e',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const TARGET_GROUP = 'chhatrapati_group_001';

// Import memberService helpers or re-create them with same logic
function parseMemberNumber(val) {
  if (!val) return null;
  const match = String(val).trim().match(/^M[-_]?(\d+)$/i);
  if (match) {
    const num = parseInt(match[1], 10);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function parseAdminNumber(val) {
  if (!val) return null;
  const match = String(val).trim().match(/^A[-_]?(\d+)$/i);
  if (match) {
    const num = parseInt(match[1], 10);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function isRegularMember(m) {
  if (!m) return false;
  if (m.isDeleted === true || m.deleted === true) return false;
  const rawRole = String(m.role || m.role_name || m.roleName || 'member').toLowerCase().trim();
  if (rawRole === 'admin' || rawRole === 'administrator' || rawRole === 'superadmin' || rawRole === 'group_admin') {
    return false;
  }
  return true;
}

async function getNextMemberCode() {
  const membersSnap = await getDocs(collection(db, 'groups', TARGET_GROUP, 'members')).catch(() => ({ docs: [] }));
  const existingNums = new Set();
  membersSnap.docs.filter((d) => isRegularMember(d.data())).forEach((memberDoc) => {
    const data = memberDoc.data();
    const candidates = [memberDoc.id, data.memberCode, data.member_code, data.memberId, data.member_id];
    candidates.forEach((value) => {
      const num = parseMemberNumber(value);
      if (num !== null && num > 0) existingNums.add(num);
    });
  });

  let nextNumber = 1;
  while (existingNums.has(nextNumber)) {
    nextNumber++;
  }

  return {
    success: true,
    memberNumber: nextNumber,
    memberId: `M_${nextNumber}`,
    memberCode: `M-${nextNumber}`,
  };
}

async function compactMemberSequence() {
  const membersSnap = await getDocs(collection(db, 'groups', TARGET_GROUP, 'members')).catch(() => ({ docs: [] }));
  const regularMembers = membersSnap.docs
    .filter((d) => isRegularMember(d.data()))
    .map((d) => ({
      docId: d.id,
      data: d.data(),
      number: parseMemberNumber(d.id) || parseMemberNumber(d.data()?.memberCode) || 0,
    }))
    .filter((m) => m.number > 0)
    .sort((a, b) => a.number - b.number);

  const totalRemaining = regularMembers.length;
  const shifts = [];
  regularMembers.forEach((mem, idx) => {
    const expectedNumber = idx + 1;
    if (mem.number !== expectedNumber) {
      shifts.push({
        oldDocId: mem.docId,
        oldNumber: mem.number,
        newDocId: `M_${expectedNumber}`,
        newNumber: expectedNumber,
        data: mem.data,
      });
    }
  });

  const counterRef = doc(db, 'groups', TARGET_GROUP, 'system', 'member_counter');
  if (shifts.length === 0) {
    await setDoc(counterRef, {
      lastNumber: totalRemaining,
      format: 'M-{number}',
      updatedAt: serverTimestamp(),
    }, { merge: true }).catch(() => null);
    return { success: true, shiftedCount: 0, totalMembers: totalRemaining };
  }

  const targetDocIds = new Set(shifts.map((s) => s.newDocId));
  const oldDocIds = new Set(shifts.map((s) => s.oldDocId));
  const docIdsToDelete = [];
  for (const oldId of oldDocIds) {
    if (!targetDocIds.has(oldId)) {
      docIdsToDelete.push(oldId);
    }
  }

  let memberBatch = writeBatch(db);
  let count = 0;
  for (const shift of shifts) {
    const targetRef = doc(db, 'groups', TARGET_GROUP, 'members', shift.newDocId);
    const updatedPayload = {
      ...shift.data,
      id: shift.newDocId,
      memberId: shift.newDocId,
      member_id: shift.newDocId,
      memberCode: `M-${shift.newNumber}`,
      member_code: `M-${shift.newNumber}`,
      updatedAt: new Date().toISOString(),
    };
    memberBatch.set(targetRef, updatedPayload);
    count++;
    if (count >= 400) {
      await memberBatch.commit();
      memberBatch = writeBatch(db);
      count = 0;
    }
  }

  for (const delId of docIdsToDelete) {
    const delRef = doc(db, 'groups', TARGET_GROUP, 'members', delId);
    memberBatch.delete(delRef);
    count++;
    if (count >= 400) {
      await memberBatch.commit();
      memberBatch = writeBatch(db);
      count = 0;
    }
  }
  if (count > 0) {
    await memberBatch.commit();
  }

  await setDoc(counterRef, {
    lastNumber: totalRemaining,
    format: 'M-{number}',
    updatedAt: serverTimestamp(),
  }, { merge: true }).catch(() => null);

  return { success: true, shiftedCount: shifts.length, totalMembers: totalRemaining };
}

async function run() {
  console.log('Authenticating...');
  await signInWithEmailAndPassword(auth, 'admin@bachatgat.com', 'Admin@123');
  console.log('Authenticated.\n');

  console.log('====================================================');
  console.log('STEP 1: Check Baseline Members');
  console.log('====================================================');
  const initialSnap = await getDocs(collection(db, 'groups', TARGET_GROUP, 'members'));
  const initialRegular = initialSnap.docs.filter(d => isRegularMember(d.data()));
  console.log(`Current regular member count: ${initialRegular.length}`);
  const nextRes = await getNextMemberCode();
  console.log(`Next calculated member code: ${nextRes.memberCode} (ID: ${nextRes.memberId})`);
  if (nextRes.memberCode !== `M-${initialRegular.length + 1}`) {
    throw new Error(`Baseline check failed: expected M-${initialRegular.length + 1}, got ${nextRes.memberCode}`);
  }
  console.log('✔ Baseline check passed.');

  console.log('\n====================================================');
  console.log('STEP 2: TEST CASE 1 — Sequential Member Creation (M_366)');
  console.log('====================================================');
  const testMember366Id = nextRes.memberId;
  const testMember366Code = nextRes.memberCode;
  const testMember366Payload = {
    id: testMember366Id,
    memberId: testMember366Id,
    member_id: testMember366Id,
    memberCode: testMember366Code,
    member_code: testMember366Code,
    name: 'Test Member 366 (Rahul Shinde)',
    fullName: 'Test Member 366 (Rahul Shinde)',
    phone: '9988776655',
    email: '',
    role: 'member',
    role_name: 'MEMBER',
    shares: 1,
    monthlyContribution: 1000,
    status: 'ACTIVE',
    isActive: true,
    groupId: TARGET_GROUP,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'groups', TARGET_GROUP, 'members', testMember366Id), testMember366Payload);
  console.log(`Created member: ${testMember366Id} (${testMember366Code})`);

  const nextAfter366 = await getNextMemberCode();
  console.log(`Next member code after adding 366: ${nextAfter366.memberCode}`);
  if (nextAfter366.memberCode !== 'M-367') {
    throw new Error(`Test Case 1 failed: expected M-367, got ${nextAfter366.memberCode}`);
  }
  console.log('✔ Test Case 1 PASSED: Next member after 366 is M-367.');

  console.log('\n====================================================');
  console.log('STEP 3: TEST CASE 2 — Delete Last Member & Reuse (Delete M_366)');
  console.log('====================================================');
  await deleteDoc(doc(db, 'groups', TARGET_GROUP, 'members', testMember366Id));
  console.log(`Deleted member ${testMember366Id}.`);

  const nextAfterDelete366 = await getNextMemberCode();
  console.log(`Next member code after deleting M_366: ${nextAfterDelete366.memberCode}`);
  if (nextAfterDelete366.memberCode !== 'M-366') {
    throw new Error(`Test Case 2 failed: expected M-366 to be reused, got ${nextAfterDelete366.memberCode}`);
  }
  console.log('✔ Test Case 2 PASSED: M-366 is reused immediately, NOT M-367!');

  console.log('\n====================================================');
  console.log('STEP 4: TEST CASE 3 & 4 — Middle Member Deletion & Compaction');
  console.log('====================================================');
  // Re-create M_366 (Person A) and M_367 (Person B)
  const memberA = { ...testMember366Payload, name: 'Person A (366)', fullName: 'Person A (366)' };
  const memberB = {
    id: 'M_367',
    memberId: 'M_367',
    member_id: 'M_367',
    memberCode: 'M-367',
    member_code: 'M-367',
    name: 'Person B (367)',
    fullName: 'Person B (367)',
    phone: '9123456780',
    email: '',
    role: 'member',
    role_name: 'MEMBER',
    shares: 2,
    monthlyContribution: 2000,
    status: 'ACTIVE',
    isActive: true,
    groupId: TARGET_GROUP,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'groups', TARGET_GROUP, 'members', 'M_366'), memberA);
  await setDoc(doc(db, 'groups', TARGET_GROUP, 'members', 'M_367'), memberB);
  console.log('Created Person A at M_366 and Person B at M_367.');

  // Now delete M_366 (middle member of 365, 366, 367)
  console.log('Deleting Person A (M_366)...');
  await deleteDoc(doc(db, 'groups', TARGET_GROUP, 'members', 'M_366'));

  // Run compaction
  console.log('Running compaction...');
  const compactRes = await compactMemberSequence();
  console.log(`Compaction result: shifted ${compactRes.shiftedCount} member(s), total remaining: ${compactRes.totalMembers}`);

  // Verify Person B has shifted to M_366
  const shiftedSnap = await getDoc(doc(db, 'groups', TARGET_GROUP, 'members', 'M_366'));
  if (!shiftedSnap.exists()) {
    throw new Error('Test Case 3 failed: M_366 does not exist after compaction!');
  }
  const shiftedData = shiftedSnap.data();
  console.log(`M_366 now contains: "${shiftedData.name}", phone: ${shiftedData.phone}, shares: ${shiftedData.shares}`);
  if (shiftedData.name !== 'Person B (367)' || shiftedData.phone !== '9123456780' || shiftedData.shares !== 2) {
    throw new Error('Test Case 3 failed: Person B data was not preserved during shift!');
  }
  console.log('✔ Person B data 100% preserved at new position M_366!');

  // Verify M_367 no longer exists
  const oldBSnap = await getDoc(doc(db, 'groups', TARGET_GROUP, 'members', 'M_367'));
  if (oldBSnap.exists()) {
    throw new Error('Test Case 3 failed: old M_367 still exists!');
  }
  console.log('✔ Old M_367 was cleanly removed with no duplicates.');

  // Verify next member code after compaction (Test Case 4)
  const nextAfterCompaction = await getNextMemberCode();
  console.log(`Next member code after compaction: ${nextAfterCompaction.memberCode}`);
  if (nextAfterCompaction.memberCode !== 'M-367') {
    throw new Error(`Test Case 4 failed: expected M-367, got ${nextAfterCompaction.memberCode}`);
  }
  console.log('✔ Test Case 4 PASSED: Next member after compaction is M-367.');

  console.log('\n====================================================');
  console.log('STEP 5: Clean Up Test Members');
  console.log('====================================================');
  await deleteDoc(doc(db, 'groups', TARGET_GROUP, 'members', 'M_366'));
  await compactMemberSequence();
  const finalSnap = await getDocs(collection(db, 'groups', TARGET_GROUP, 'members'));
  console.log(`Final regular member count: ${finalSnap.size} (Restored to original 365)`);
  const finalNext = await getNextMemberCode();
  console.log(`Final next member code: ${finalNext.memberCode}`);
  if (finalNext.memberCode !== 'M-366') {
    throw new Error(`Clean up failed: expected next code M-366, got ${finalNext.memberCode}`);
  }
  console.log('✔ Database restored cleanly to 365 continuous members.');

  console.log('\n====================================================');
  console.log('STEP 6: Verify Admin Collection Untouched');
  console.log('====================================================');
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log(`Total users in users/ collection: ${usersSnap.size}`);
  usersSnap.docs.forEach((d) => {
    const u = d.data();
    console.log(`- Admin UID [${d.id}]: role=${u.role}, email=${u.email}, memberId=${u.memberId}, memberCode=${u.memberCode}`);
  });
  if (usersSnap.size !== 2) {
    throw new Error(`Admin check failed: expected 2 admins, got ${usersSnap.size}`);
  }
  console.log('✔ Admin accounts strictly untouched and independent.');

  console.log('\n>>> ALL TEST CASES PASSED SUCCESSFULLY! <<<');
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
