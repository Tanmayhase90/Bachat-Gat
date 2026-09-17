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
  console.log('=== 1. Inspecting top-level "users" collection ===');
  const usersSnap = await getDocs(collection(db, 'users'));
  console.log(`Total users in "users" collection: ${usersSnap.size}`);
  usersSnap.docs.forEach((d) => {
    const data = d.data();
    console.log(`UID: [${d.id}]`);
    console.log(`  email: ${data.email}`);
    console.log(`  name: ${data.name || data.fullName}`);
    console.log(`  role: ${data.role || data.role_name}`);
    console.log(`  memberId: ${data.memberId || data.member_id}`);
    console.log(`  memberCode: ${data.memberCode || data.member_code}`);
    console.log(`  createdAt: ${JSON.stringify(data.createdAt)}`);
  });

  console.log('\n=== 2. Inspecting "groups/chhatrapati_group_001/members" ===');
  const membersSnap = await getDocs(collection(db, 'groups', 'chhatrapati_group_001', 'members'));
  console.log(`Total members: ${membersSnap.size}`);
  let maxMemberNum = 0;
  membersSnap.docs.forEach((d) => {
    const data = d.data();
    [d.id, data.memberCode, data.member_code].forEach((val) => {
      const num = parseInt(String(val || '').replace(/\D/g, ''), 10);
      if (Number.isFinite(num) && num > maxMemberNum) {
        maxMemberNum = num;
      }
    });
  });
  console.log(`Highest existing regular member number: ${maxMemberNum} (ID: M_${maxMemberNum}, Code: M-${maxMemberNum})`);

  console.log('\n=== 3. Inspecting "groups/chhatrapati_group_001/system/member_counter" ===');
  const counterSnap = await getDoc(doc(db, 'groups', 'chhatrapati_group_001', 'system', 'member_counter'));
  console.log('member_counter data:', counterSnap.data());

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
