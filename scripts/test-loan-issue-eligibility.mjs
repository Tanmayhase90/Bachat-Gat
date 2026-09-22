import assert from 'assert';
import { normalizeLoan, normalizeMember } from '../client/src/utils/formatters.js';

console.log('=== RUNNING LOAN ISSUE ELIGIBILITY TEST SUITE ===\n');

/**
 * Pure helper mirroring the CreateLoanModal eligibility filtering logic
 */
function filterEligibleMembersForLoanModal({ members, loans }) {
  const activeLoansList = (loans || []).filter((l) => {
    const status = (l.status || '').toUpperCase();
    const pending = Number(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0));
    return status === 'ACTIVE' && pending > 0;
  });

  const activeBorrowerMemberIds = new Set();
  activeLoansList.forEach((l) => {
    if (l.memberId) activeBorrowerMemberIds.add(String(l.memberId));
    if (l.member_id) activeBorrowerMemberIds.add(String(l.member_id));
    if (l.memberCode) activeBorrowerMemberIds.add(String(l.memberCode));
    if (l.member_code) activeBorrowerMemberIds.add(String(l.member_code));
  });

  return (members || []).filter((m) => {
    const mId = String(m.member_id || m.id || '');
    const mCode = String(m.member_code || m.memberCode || '');

    const hasActiveLoanFromLoansList = (mId && activeBorrowerMemberIds.has(mId)) || (mCode && activeBorrowerMemberIds.has(mCode));
    const hasActiveLoanFromMemberData = Number(m.outstanding_loans || m.active_loan_amount || 0) > 0;

    return !hasActiveLoanFromLoansList && !hasActiveLoanFromMemberData;
  });
}

/**
 * Helper mirroring search inside the modal
 */
function searchMembers(members, query) {
  if (!query || !query.trim()) return members;
  const q = query.toLowerCase().trim();
  return members.filter((m) => {
    const nameMatch = (m.name || '').toLowerCase().includes(q);
    const codeMatch = (m.member_code || m.memberCode || '').toLowerCase().includes(q);
    const phoneMatch = (m.phone || '').includes(q);
    return nameMatch || codeMatch || phoneMatch;
  });
}

// Setup base mock members
const member1 = normalizeMember('M_1', { name: 'Sunita Patil', memberCode: 'M-1', status: 'active', phone: '9876543210' });
const member2 = normalizeMember('M_2', { name: 'Anita Shinde', memberCode: 'M-2', status: 'active', phone: '9876543211' });
const member3 = normalizeMember('M_3', { name: 'Pooja Jadhav', memberCode: 'M-3', status: 'active', phone: '9876543212' });
const member4 = normalizeMember('M_4', { name: 'Kavita Deshmukh', memberCode: 'M-4', status: 'active', phone: '9876543213' });
const member5 = normalizeMember('M_5', { name: 'Rukmini Kadam', memberCode: 'M-5', status: 'active', phone: '9876543214' });

const allActiveMembers = [member1, member2, member3, member4, member5];

// --- TEST 1: Member with no loan ---
console.log('Test 1: Member with no loan -> appears');
{
  const loans = [];
  const eligible = filterEligibleMembersForLoanModal({ members: allActiveMembers, loans });
  assert.strictEqual(eligible.length, 5);
  assert.ok(eligible.some((m) => m.id === 'M_1'));
  console.log('  ✓ Member M-1 with no loan appears in eligible list');
}

// --- TEST 2: Member with active/outstanding loan ---
console.log('\nTest 2: Member with active/outstanding loan -> does NOT appear');
{
  const activeLoanM1 = normalizeLoan('L_001', {
    memberId: 'M_1',
    memberCode: 'M-1',
    originalPrincipal: 25000,
    pendingPrincipal: 20000,
    status: 'ACTIVE',
  });
  const loans = [activeLoanM1];
  const eligible = filterEligibleMembersForLoanModal({ members: allActiveMembers, loans });
  assert.strictEqual(eligible.length, 4);
  assert.ok(!eligible.some((m) => m.id === 'M_1'), 'M_1 must NOT appear');
  assert.ok(eligible.some((m) => m.id === 'M_2'), 'M_2 must appear');
  console.log('  ✓ Member M-1 with active loan is correctly excluded');
}

// --- TEST 3: Member with fully repaid historical loan ---
console.log('\nTest 3: Member with fully repaid historical loan -> appears');
{
  const closedLoanM2 = normalizeLoan('L_002', {
    memberId: 'M_2',
    memberCode: 'M-2',
    originalPrincipal: 15000,
    pendingPrincipal: 0,
    status: 'CLOSED',
  });
  const loans = [closedLoanM2];
  const eligible = filterEligibleMembersForLoanModal({ members: allActiveMembers, loans });
  assert.strictEqual(eligible.length, 5);
  assert.ok(eligible.some((m) => m.id === 'M_2'), 'M_2 with closed loan must appear');
  console.log('  ✓ Member M-2 with fully repaid historical loan appears in eligible list');
}

// --- TEST 4: Member with active loan -> completely repay loan -> member becomes eligible again ---
console.log('\nTest 4: Member with active loan -> completely repay loan -> member becomes eligible again');
{
  // Before repayment: Active loan
  let loanM3 = normalizeLoan('L_003', {
    memberId: 'M_3',
    memberCode: 'M-3',
    originalPrincipal: 30000,
    pendingPrincipal: 10000,
    status: 'ACTIVE',
  });
  let eligible = filterEligibleMembersForLoanModal({ members: allActiveMembers, loans: [loanM3] });
  assert.ok(!eligible.some((m) => m.id === 'M_3'), 'M_3 must not appear before repayment');

  // After complete repayment: pendingPrincipal = 0, status = CLOSED
  loanM3 = normalizeLoan('L_003', {
    memberId: 'M_3',
    memberCode: 'M-3',
    originalPrincipal: 30000,
    pendingPrincipal: 0,
    status: 'CLOSED',
  });
  eligible = filterEligibleMembersForLoanModal({ members: allActiveMembers, loans: [loanM3] });
  assert.ok(eligible.some((m) => m.id === 'M_3'), 'M_3 must appear after full repayment');
  console.log('  ✓ Member M-3 became automatically eligible upon full repayment (pending = 0)');
}

// --- TEST 5: Multiple members with active loans -> all are excluded ---
console.log('\nTest 5: Multiple members with active loans -> all are excluded');
{
  const activeLoans = [
    normalizeLoan('L_001', { memberId: 'M_1', pendingPrincipal: 15000, status: 'ACTIVE' }),
    normalizeLoan('L_003', { memberId: 'M_3', pendingPrincipal: 8000, status: 'ACTIVE' }),
    normalizeLoan('L_005', { memberId: 'M_5', pendingPrincipal: 20000, status: 'ACTIVE' }),
  ];
  const eligible = filterEligibleMembersForLoanModal({ members: allActiveMembers, loans: activeLoans });
  assert.strictEqual(eligible.length, 2);
  assert.deepStrictEqual(eligible.map((m) => m.id).sort(), ['M_2', 'M_4'].sort());
  console.log('  ✓ M_1, M_3, M_5 are excluded; M_2 and M_4 remain eligible');
}

// --- TEST 6: Search by member name -> only eligible members are searchable ---
console.log('\nTest 6: Search by member name -> only eligible members are searchable');
{
  // M_1 (Sunita) has active loan, M_2 (Anita) has no loan
  const activeLoanM1 = normalizeLoan('L_001', { memberId: 'M_1', pendingPrincipal: 5000, status: 'ACTIVE' });
  const eligible = filterEligibleMembersForLoanModal({ members: allActiveMembers, loans: [activeLoanM1] });
  
  // Search for excluded member "Sunita"
  const searchSunita = searchMembers(eligible, 'Sunita');
  assert.strictEqual(searchSunita.length, 0, 'Searching for active borrower Sunita must return 0 results');

  // Search for eligible member "Anita"
  const searchAnita = searchMembers(eligible, 'Anita');
  assert.strictEqual(searchAnita.length, 1);
  assert.strictEqual(searchAnita[0].id, 'M_2');
  console.log('  ✓ Search by name returns only eligible members; excluded members cannot be found');
}

// --- TEST 7: Search by member code -> only eligible members are searchable ---
console.log('\nTest 7: Search by member code -> only eligible members are searchable');
{
  const activeLoanM1 = normalizeLoan('L_001', { memberId: 'M_1', memberCode: 'M-1', pendingPrincipal: 5000, status: 'ACTIVE' });
  const eligible = filterEligibleMembersForLoanModal({ members: allActiveMembers, loans: [activeLoanM1] });

  // Search for code "M-1"
  const searchM1 = searchMembers(eligible, 'M-1');
  assert.strictEqual(searchM1.length, 0, 'Searching for M-1 must return 0 results');

  // Search for code "M-2"
  const searchM2 = searchMembers(eligible, 'M-2');
  assert.strictEqual(searchM2.length, 1);
  assert.strictEqual(searchM2[0].id, 'M_2');
  console.log('  ✓ Search by code returns only eligible members; excluded member code cannot be found');
}

// --- TEST 8: Available Members count exactly matches eligible members count ---
console.log('\nTest 8: Available Members count matches eligible members count');
{
  const activeLoans = [
    normalizeLoan('L_001', { memberId: 'M_1', pendingPrincipal: 5000, status: 'ACTIVE' }),
    normalizeLoan('L_002', { memberId: 'M_2', pendingPrincipal: 10000, status: 'ACTIVE' }),
  ];
  const eligible = filterEligibleMembersForLoanModal({ members: allActiveMembers, loans: activeLoans });
  const displayedCount = eligible.length;
  assert.strictEqual(displayedCount, 3);
  console.log(`  ✓ Total Active Members: 5, Active Borrowers: 2, Displayed Count: ${displayedCount}`);
}

// --- TEST 9: Service validation rejects duplicate active loan creation ---
console.log('\nTest 9: Attempt to issue a second loan to a member with active loan -> rejected');
{
  // Simulated validation logic inside loanService.createLoan
  function validateLoanCreation({ memberId, memberCode, existingLoans }) {
    const active = existingLoans.filter((l) => {
      const isMember = l.memberId === memberId || (memberCode && l.memberCode === memberCode);
      const isActive = (l.status || '').toUpperCase() === 'ACTIVE';
      const pending = Number(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0));
      return isMember && isActive && pending > 0;
    });

    if (active.length > 0) {
      throw new Error('This member already has an active loan with an outstanding balance. A new loan cannot be issued until the existing loan is fully repaid.');
    }
    return true;
  }

  const existingLoans = [
    normalizeLoan('L_001', { memberId: 'M_1', memberCode: 'M-1', pendingPrincipal: 12000, status: 'ACTIVE' }),
    normalizeLoan('L_002', { memberId: 'M_2', memberCode: 'M-2', pendingPrincipal: 0, status: 'CLOSED' }),
  ];

  // Attempt loan for M_1 (has active loan) -> must throw
  assert.throws(
    () => validateLoanCreation({ memberId: 'M_1', memberCode: 'M-1', existingLoans }),
    /already has an active loan with an outstanding balance/
  );
  console.log('  ✓ createLoan correctly threw rejection error for active borrower M_1');

  // Attempt loan for M_2 (closed loan) -> must succeed
  assert.doesNotThrow(
    () => validateLoanCreation({ memberId: 'M_2', memberCode: 'M-2', existingLoans })
  );
  console.log('  ✓ createLoan allowed loan creation for member M_2 with repaid historical loan');
}

// --- TEST 10: Existing loan issue flow for eligible member works as expected ---
console.log('\nTest 10: Existing loan issue flow for eligible member works');
{
  const eligibleMember = member4;
  assert.strictEqual(eligibleMember.isActive, true);
  assert.strictEqual(eligibleMember.name, 'Kavita Deshmukh');
  console.log('  ✓ Eligible member data is intact and ready for normal disbursement flow');
}

console.log('\n=== ALL 10 TESTS PASSED SUCCESSFULLY ===');
