import assert from 'assert';
import { authService } from '../client/src/services/authService.js';
import { memberService } from '../client/src/services/memberService.js';

console.log('=== VERIFYING ADMIN AUTHENTICATION AND DATA ===\n');

async function verifyLogins() {
  // 1. Verify A_2 Login with exact user credentials
  console.log('Test 1: Logging in as Admin A_2 (walmikaher8427@gmail.com, password: 9970)...');
  const a2Result = await authService.login('walmikaher8427@gmail.com', '9970', 'admin');
  assert.strictEqual(a2Result.success, true);
  assert.strictEqual(a2Result.user.role, 'admin');
  assert.strictEqual(a2Result.user.name, 'Walmik Aher');
  assert.strictEqual(a2Result.user.fullName, 'Walmik Aher');
  assert.strictEqual(a2Result.user.email, 'walmikaher8427@gmail.com');
  assert.strictEqual(a2Result.user.phone, '9970956556');
  assert.ok(a2Result.user.memberId === 'A_2' || a2Result.user.adminId === 'A_2');
  console.log('  ✓ Admin A_2 successfully authenticated!');
  console.log('    - Admin ID:', a2Result.user.memberId || a2Result.user.adminId);
  console.log('    - Name:', a2Result.user.name);
  console.log('    - Email:', a2Result.user.email);
  console.log('    - Phone / Contact:', a2Result.user.phone);
  console.log('    - Role:', a2Result.user.role);

  // Verify getMe session for A_2
  const a2Me = await authService.getMe();
  assert.strictEqual(a2Me.success, true);
  assert.strictEqual(a2Me.user.email, 'walmikaher8427@gmail.com');
  console.log('  ✓ authService.getMe() confirms active session for Walmik Aher');

  // 2. Verify A_1 Login remains completely functional
  console.log('\nTest 2: Logging in as Admin A_1 (admin@bachatgat.com, password: Admin@123)...');
  const a1Result = await authService.login('admin@bachatgat.com', 'Admin@123', 'admin');
  assert.strictEqual(a1Result.success, true);
  assert.strictEqual(a1Result.user.role, 'admin');
  assert.strictEqual(a1Result.user.name, 'TANMAY HASE');
  assert.strictEqual(a1Result.user.email, 'admin@bachatgat.com');
  assert.ok(a1Result.user.memberId === 'A_1' || a1Result.user.adminId === 'A_1');
  console.log('  ✓ Admin A_1 successfully authenticated!');
  console.log('    - Admin ID:', a1Result.user.memberId || a1Result.user.adminId);
  console.log('    - Name:', a1Result.user.name);
  console.log('    - Email:', a1Result.user.email);
  console.log('    - Role:', a1Result.user.role);

  // 3. Verify getNextAdminCode logic confirms exactly 2 admins (A_1, A_2)
  console.log('\nTest 3: Checking admin serial count using memberService.getNextAdminCode()...');
  const nextAdmin = await memberService.getNextAdminCode();
  console.log('  Next available admin serial:', nextAdmin.adminId, `(indicates highest existing admin is A_2)`);
  assert.strictEqual(nextAdmin.adminNumber, 3, 'Highest admin number must be 2 (A_1 and A_2), so next is A_3');
  assert.strictEqual(nextAdmin.adminId, 'A_3');
  console.log('  ✓ Verified exactly 2 admin accounts exist: A_1 and A_2');

  console.log('\n=== ALL ADMIN VERIFICATION TESTS PASSED SUCCESSFULLY ===');
}

verifyLogins()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification Error:', err);
    process.exit(1);
  });
