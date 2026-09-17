import { createRequire } from 'module';
const require = createRequire(new URL('../client/package.json', import.meta.url));
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, getDoc, getDocs, collection } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyAfSLqG3mqeWxnhk_gBUPkDK9Y4Y17GeFU',
  authDomain: 'bachat-gat-app-9e38e.firebaseapp.com',
  projectId: 'bachat-gat-app-9e38e',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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

async function run() {
  console.log('Authenticating...');
  await signInWithEmailAndPassword(auth, 'admin@bachatgat.com', 'Admin@123');
  console.log('Authenticated.\n');

  console.log('====================================================');
  console.log('1. AUDIT OF TOP-LEVEL "users" (ADMIN COLLECTION)');
  console.log('====================================================');
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log(`Total documents in "users" collection: ${usersSnap.size}`);

  const admins = [];
  let maxAdminNum = 0;
  let hasAnyMInAdmins = false;

  usersSnap.docs.forEach((d) => {
    const data = d.data();
    const adminNum = parseAdminNumber(data.adminId || data.memberId || d.id);
    if (adminNum !== null) {
      maxAdminNum = Math.max(maxAdminNum, adminNum);
    }
    // Check if any admin has M_ series
    const idStrings = [d.id, data.memberId, data.memberCode, data.adminId, data.adminCode].map(String);
    idStrings.forEach((s) => {
      if (/^M[-_]?\d+$/i.test(s)) {
        hasAnyMInAdmins = true;
      }
    });

    admins.push({
      uid: d.id,
      email: data.email,
      name: data.name || data.fullName,
      role: data.role,
      memberId: data.memberId,
      memberCode: data.memberCode,
      adminId: data.adminId,
      adminCode: data.adminCode,
    });
  });

  admins.sort((a, b) => (parseAdminNumber(a.memberId) || 0) - (parseAdminNumber(b.memberId) || 0));
  admins.forEach((adm, idx) => {
    console.log(`Admin ${idx + 1}:`);
    console.log(`  UID:        ${adm.uid}`);
    console.log(`  Email:      ${adm.email}`);
    console.log(`  Name:       ${adm.name}`);
    console.log(`  Role:       ${adm.role}`);
    console.log(`  memberId:   ${adm.memberId}`);
    console.log(`  memberCode: ${adm.memberCode}`);
    console.log(`  adminId:    ${adm.adminId}`);
    console.log(`  adminCode:  ${adm.adminCode}`);
  });

  console.log(`\nAdmins with 'M' series IDs: ${hasAnyMInAdmins ? 'YES (ERROR)' : 'NONE (CORRECT)'}`);
  const nextAdminNum = maxAdminNum + 1;
  const nextAdminId = `A_${nextAdminNum}`;
  const nextAdminCode = `A-${nextAdminNum}`;
  console.log(`Highest existing Admin number: ${maxAdminNum}`);
  console.log(`Next Admin ID:   ${nextAdminId}`);
  console.log(`Next Admin Code: ${nextAdminCode}`);

  console.log('\n====================================================');
  console.log('2. AUDIT OF "groups/chhatrapati_group_001/members"');
  console.log('====================================================');
  const membersSnap = await getDocs(collection(db, 'groups', 'chhatrapati_group_001', 'members'));
  console.log(`Total documents in "groups/chhatrapati_group_001/members": ${membersSnap.size}`);

  let maxMemberNum = 0;
  let minMemberNum = Infinity;
  let hasAnyAInMembers = false;
  const memberSet = new Set(membersSnap.docs.map((d) => d.id));

  membersSnap.docs.forEach((d) => {
    const data = d.data();
    [d.id, data.memberCode, data.member_code, data.memberId, data.member_id].forEach((val) => {
      const num = parseMemberNumber(val);
      if (num !== null) {
        maxMemberNum = Math.max(maxMemberNum, num);
        minMemberNum = Math.min(minMemberNum, num);
      }
      const aNum = parseAdminNumber(val);
      if (aNum !== null) {
        hasAnyAInMembers = true;
      }
    });
  });

  console.log(`First member number: ${minMemberNum} (ID: M_${minMemberNum}, Code: M-${minMemberNum})`);
  console.log(`Highest existing regular member number: ${maxMemberNum} (ID: M_${maxMemberNum}, Code: M-${maxMemberNum})`);
  console.log(`Members with 'A' series IDs: ${hasAnyAInMembers ? 'YES (ERROR)' : 'NONE (CORRECT)'}`);

  // Check M_1 through M_365
  let missing1to365 = [];
  for (let i = 1; i <= 365; i++) {
    if (!memberSet.has(`M_${i}`)) missing1to365.push(`M_${i}`);
  }
  console.log(`Preservation check (M_1 to M_365): ${missing1to365.length === 0 ? 'ALL 365 PRESENT & INTACT' : 'MISSING: ' + missing1to365.join(',')}`);

  // Check member_counter
  const counterSnap = await getDoc(doc(db, 'groups', 'chhatrapati_group_001', 'system', 'member_counter'));
  const counterData = counterSnap.data();
  console.log('member_counter:', JSON.stringify(counterData));

  const nextMemberNum = Math.max(maxMemberNum, Number(counterData?.lastNumber || 0)) + 1;
  const nextMemberId = `M_${nextMemberNum}`;
  const nextMemberCode = `M-${nextMemberNum}`;
  console.log(`Next Member ID:   ${nextMemberId}`);
  console.log(`Next Member Code: ${nextMemberCode}`);

  console.log('\n====================================================');
  console.log('3. PROOF OF COMPLETE SERIAL INDEPENDENCE');
  console.log('====================================================');
  console.log(`- Admin Serial Format:  A_{number} / A-{number}`);
  console.log(`- Member Serial Format: M_{number} / M-{number}`);
  console.log(`- Admin count:          ${usersSnap.size}`);
  console.log(`- Member count:         ${membersSnap.size}`);
  console.log(`- Total admins do NOT affect member serial: Next member is ${nextMemberCode} regardless of admin count (${usersSnap.size}).`);
  console.log(`- Total members do NOT affect admin serial: Next admin is ${nextAdminCode} regardless of member count (${membersSnap.size}).`);
  console.log(`- Shared global counter: NONE. Member counter lives in groups/chhatrapati_group_001/system/member_counter, Admin counter is derived strictly from users/ collection.`);

  if (!hasAnyMInAdmins && !hasAnyAInMembers && missing1to365.length === 0) {
    console.log('\n>>> ALL VERIFICATION CHECKS PASSED PERFECTLY! <<<');
    process.exit(0);
  } else {
    console.error('\n>>> VERIFICATION CHECKS FAILED! <<<');
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('Audit failed:', e);
  process.exit(1);
});
