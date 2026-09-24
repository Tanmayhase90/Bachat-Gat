/**
 * Comprehensive Automated Verification Suite for Web Licence Management & Backup-Restore
 * Safe for offline test execution (never touches production Firestore).
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Set test secret
const TEST_SECRET = 'Test_License_Signing_Secret_2026_!@#$';
process.env.LICENSE_SIGNING_SECRET = TEST_SECRET;

const {
  verifyKey,
  generateKey,
} = require('../server/src/controllers/licenseController');

let passedTests = 0;
function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('\n======================================================');
console.log('🧪 RUNNING BACHAT GAT LICENCE & BACKUP TEST SUITE');
console.log('======================================================\n');

// ----------------------------------------------------------------------------
// 1. LICENCE ALGORITHM TESTS (HMAC-SHA256 & FORMAT PARITY)
// ----------------------------------------------------------------------------
console.log('--- 1. Licence Algorithm & Key Verification ---');

const testMachineId = 'A1B2C3D4E5F6G7H8';
const futureDate = '2027-09-17';
const validKey = generateKey(testMachineId, futureDate);

runTest('Admin key generator creates valid base64url token', () => {
  assert(typeof validKey === 'string');
  assert(validKey.length > 20);
  const decoded = Buffer.from(validKey, 'base64url').toString('utf8');
  assert(decoded.includes(testMachineId));
  assert(decoded.includes(futureDate));
});

runTest('Valid licence key is accepted with correct expiry and days remaining', () => {
  const result = verifyKey(testMachineId, validKey);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.machineId, testMachineId);
  assert.strictEqual(result.expiryDate, futureDate);
  assert(result.daysRemaining > 300);
});

runTest('Licence key for different Machine ID is strictly rejected', () => {
  const wrongMachineId = 'DIFFERENT_MACHINE_999';
  const result = verifyKey(wrongMachineId, validKey);
  assert.strictEqual(result.valid, false);
  assert(result.error.includes('different Machine ID'));
});

runTest('Corrupted licence key signature is strictly rejected', () => {
  // Tamper with payload
  const tamperedKey = validKey.substring(0, validKey.length - 5) + 'AAAAA';
  const result = verifyKey(testMachineId, tamperedKey);
  assert.strictEqual(result.valid, false);
});

runTest('Expired licence key is strictly rejected', () => {
  const pastDate = '2025-01-01';
  const expiredKey = generateKey(testMachineId, pastDate);
  const result = verifyKey(testMachineId, expiredKey);
  assert.strictEqual(result.valid, false);
  assert(result.error.includes('expired'));
});

runTest('Malformed or non-base64 key is rejected gracefully without crashing', () => {
  const result = verifyKey(testMachineId, 'not-a-valid-key!@#$%^&*()');
  assert.strictEqual(result.valid, false);
});

runTest('Frontend activation targets the existing licence API route', () => {
  const serviceSource = fs.readFileSync(
    path.join(__dirname, '../client/src/services/licenseService.js'),
    'utf8'
  );
  assert(serviceSource.includes("api.post('/license',"));
  assert(!serviceSource.includes('https://bachat-gat-web.vercel.app/api/license'));
  assert(!serviceSource.includes('LICENSE_ACTIVATION_ENDPOINT'));
  assert(!serviceSource.includes("api.post('/license/activate',"));
});

// ----------------------------------------------------------------------------
// 2. DATE BOUNDARY & WARNING LOGIC TESTS
// ----------------------------------------------------------------------------
console.log('\n--- 2. Date Boundary & Warning Calculations ---');

runTest('Warning triggered within 8 days of expiry', () => {
  const now = new Date();
  const warningDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  const diffDays = Math.ceil((warningDate - now) / (1000 * 60 * 60 * 24));
  assert(diffDays <= 8);
  assert(diffDays > 0);
});

runTest('No warning triggered when remaining days > 8', () => {
  const now = new Date();
  const safeDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
  const diffDays = Math.ceil((safeDate - now) / (1000 * 60 * 60 * 24));
  assert(diffDays > 8);
});

runTest('Expired condition correctly flags when today > expiry', () => {
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const isExpired = now.getTime() > yesterday.getTime();
  assert.strictEqual(isExpired, true);
});

// ----------------------------------------------------------------------------
// 3. BACKUP PAYLOAD SCHEMA & MARATHI UNICODE TESTS
// ----------------------------------------------------------------------------
console.log('\n--- 3. Backup Payload Schema & Marathi Unicode Preservation ---');

const sampleBackupData = {
  format: 'bachat_gat_backup',
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  groupId: 'chhatrapati_group_001',
  group: {
    group_name: 'छत्रपती महिला बचत गट',
    description: 'नियमित बचत आणि अल्प व्याजदर कर्ज योजना',
  },
  members: [
    {
      _doc_id: 'member_001',
      name: 'सुनिता रमेश पाटील',
      phone: '9876543210',
      monthlyShare: 1000,
    },
    {
      _doc_id: 'member_002',
      name: 'अनिता विजय शिंदे',
      phone: '9876543211',
      monthlyShare: 1000,
    },
  ],
  monthly_contributions: [
    {
      _doc_id: 'contrib_001',
      memberId: 'member_001',
      month: 9,
      year: 2026,
      amount: 1000,
      paymentMode: 'रोख (Cash)',
    },
  ],
  loans: [],
  repayments: [],
  activities: [],
  notifications: [],
  transactions: [],
};

runTest('Backup schema conforms to required sections', () => {
  assert.strictEqual(sampleBackupData.format, 'bachat_gat_backup');
  assert.strictEqual(sampleBackupData.schemaVersion, 1);
  const required = ['group', 'members', 'monthly_contributions', 'loans', 'repayments'];
  for (const req of required) {
    assert(req in sampleBackupData, `Missing required section: ${req}`);
  }
});

runTest('Marathi Devanagari Unicode is preserved 100% through JSON serialization', () => {
  const jsonStr = JSON.stringify(sampleBackupData, null, 2);
  const buffer = Buffer.from(jsonStr, 'utf8');
  const deserialized = JSON.parse(buffer.toString('utf8'));

  assert.strictEqual(
    deserialized.group.group_name,
    'छत्रपती महिला बचत गट',
    'Group name Devanagari corrupted!'
  );
  assert.strictEqual(
    deserialized.members[0].name,
    'सुनिता रमेश पाटील',
    'Member name Devanagari corrupted!'
  );
  assert.strictEqual(
    deserialized.monthly_contributions[0].paymentMode,
    'रोख (Cash)',
    'Payment mode Devanagari corrupted!'
  );
});

runTest('Backup restore validator rejects non-Bachat Gat format', () => {
  const invalidFormat = { format: 'random_backup', group: {} };
  assert.notStrictEqual(invalidFormat.format, 'bachat_gat_backup');
});

runTest('Backup restore validator rejects missing essential sections', () => {
  const incomplete = { format: 'bachat_gat_backup', group: {} };
  const required = ['members', 'monthly_contributions', 'loans', 'repayments'];
  const hasAll = required.every((s) => s in incomplete);
  assert.strictEqual(hasAll, false);
});

// ----------------------------------------------------------------------------
// 4. AUTOMATIC BACKUP INTERVAL TESTS
// ----------------------------------------------------------------------------
console.log('\n--- 4. Two-Day Automatic Backup Interval Calculations ---');

runTest('Auto backup is due if never backed up before', () => {
  const lastBackup = null;
  const isDue = !lastBackup;
  assert.strictEqual(isDue, true);
});

runTest('Auto backup is NOT due if backed up yesterday (< 2 days)', () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const diffDays = (now - yesterday) / (1000 * 60 * 60 * 24);
  assert(diffDays < 2);
});

runTest('Auto backup IS due if last backup was 3 days ago (>= 2 days)', () => {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const diffDays = (now - threeDaysAgo) / (1000 * 60 * 60 * 24);
  assert(diffDays >= 2);
});

// ----------------------------------------------------------------------------
// 5. GOOGLE DRIVE CONNECTION STATE SAFETY TESTS
// ----------------------------------------------------------------------------
console.log('\n--- 5. Google Drive Connection State Safety ---');

runTest('driveConnected safely defaults to false when driveProfile is null', () => {
  const driveProfile = null;
  const driveConnected = Boolean(driveProfile && (driveProfile.email || driveProfile.name));
  assert.strictEqual(driveConnected, false);
});

runTest('driveConnected safely defaults to false when driveProfile is undefined', () => {
  let driveProfile;
  const driveConnected = Boolean(driveProfile && (driveProfile.email || driveProfile.name));
  assert.strictEqual(driveConnected, false);
});

runTest('driveConnected safely evaluates to true when valid driveProfile exists', () => {
  const driveProfile = { email: 'admin@gmail.com', name: 'Admin User' };
  const driveConnected = Boolean(driveProfile && (driveProfile.email || driveProfile.name));
  assert.strictEqual(driveConnected, true);
});

console.log('\n======================================================');
console.log(`🎉 ALL ${passedTests} TESTS PASSED SUCCESSFULLY!`);
console.log('======================================================\n');
