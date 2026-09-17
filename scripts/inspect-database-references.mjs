import { createRequire } from 'module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

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
  console.log('Authenticated.\n');

  const TARGET_GROUP = 'chhatrapati_group_001';

  // 1. Members
  const membersSnap = await getDocs(collection(db, 'groups', TARGET_GROUP, 'members'));
  console.log(`Total regular members: ${membersSnap.size}`);

  const memberIds = membersSnap.docs.map(d => d.id);
  const memberNums = [];
  const nonMIds = [];
  membersSnap.docs.forEach(d => {
    const match = d.id.match(/^M_(\d+)$/i);
    if (match) {
      memberNums.push(parseInt(match[1], 10));
    } else {
      nonMIds.push(d.id);
    }
  });

  memberNums.sort((a, b) => a - b);
  console.log(`Lowest member number: ${memberNums[0]}`);
  console.log(`Highest member number: ${memberNums[memberNums.length - 1]}`);
  console.log(`Non-conforming member IDs: ${JSON.stringify(nonMIds)}`);

  // Check for gaps
  const missing = [];
  const maxNum = memberNums[memberNums.length - 1];
  const numSet = new Set(memberNums);
  for (let i = 1; i <= maxNum; i++) {
    if (!numSet.has(i)) {
      missing.push(i);
    }
  }
  console.log(`Gaps currently in sequence (1 to ${maxNum}): ${missing.length > 0 ? missing.join(', ') : 'None! Continuous.'}`);

  // List members > 365
  const above365 = membersSnap.docs
    .filter(d => {
      const match = d.id.match(/^M_(\d+)$/i);
      return match && parseInt(match[1], 10) > 365;
    })
    .map(d => ({
      id: d.id,
      name: d.data().name || d.data().fullName,
      memberCode: d.data().memberCode,
      createdAt: d.data().createdAt,
    }));
  console.log('Members above M_365:', JSON.stringify(above365, null, 2));

  // 2. Check collections and where memberId/memberCode is used
  const collectionsToCheck = [
    'monthly_contributions',
    'loans',
    'repayments',
    'activities',
    'notifications',
    'settlements'
  ];

  for (const collName of collectionsToCheck) {
    const snap = await getDocs(collection(db, 'groups', TARGET_GROUP, collName));
    console.log(`\nCollection "${collName}": ${snap.size} documents`);
    if (snap.size > 0) {
      // inspect first 3 docs for member reference field names
      const fieldKeys = new Set();
      const sampleRefs = [];
      snap.docs.forEach((d, idx) => {
        const data = d.data();
        Object.keys(data).forEach(k => {
          if (/member|borrower|user|code|reference/i.test(k)) {
            fieldKeys.add(k);
          }
        });
        if (idx < 3) {
          sampleRefs.push({
            id: d.id,
            memberId: data.memberId,
            member_id: data.member_id,
            memberCode: data.memberCode,
            member_code: data.member_code,
            memberName: data.memberName || data.member_name || data.name,
          });
        }
      });
      console.log(`  Reference field keys found: ${Array.from(fieldKeys).join(', ')}`);
      console.log(`  Sample docs:`, JSON.stringify(sampleRefs, null, 2));
    }
  }

  // 3. Check member subcollections
  console.log('\nChecking if any member document has subcollections...');
  // Sample check M_1, M_2, M_365
  const sampleMemberDocs = ['M_1', 'M_2', 'M_365'];
  for (const mid of sampleMemberDocs) {
    const subColls = ['savings', 'loans', 'repayments', 'contributions'];
    for (const sub of subColls) {
      const subSnap = await getDocs(collection(db, 'groups', TARGET_GROUP, 'members', mid, sub)).catch(() => ({ size: 0 }));
      if (subSnap.size > 0) {
        console.log(`  Found subcollection in members/${mid}/${sub}: ${subSnap.size} docs`);
      }
    }
  }

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
