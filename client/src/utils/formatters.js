/**
 * Centralized, Ultra-Safe Formatters and Normalizers for Bachat Gat Web Application
 * Fully synchronized with Flutter Android App database schema (groups/chhatrapati_group_001)
 * Guaranteed NEVER to throw runtime errors or TypeError on undefined/null values
 */

export const DEFAULT_GROUP_ID = 'chhatrapati_group_001';

/**
 * Canonical natural numeric ascending sort comparator for Bachat Gat members.
 * Extracts the numeric integer component from memberId, member_id, memberCode, or id:
 * M_1 -> 1, M_2 -> 2 ... M_9 -> 9, M_10 -> 10, M_11 -> 11 ... M_99 -> 99, M_100 -> 100 ... M_365 -> 365, M_366 -> 366.
 */
export const compareMemberNumericOrder = (a, b) => {
  const idA = a?.memberId || a?.member_id || a?.memberCode || a?.member_code || a?.id || '';
  const idB = b?.memberId || b?.member_id || b?.memberCode || b?.member_code || b?.id || '';
  const numA = parseInt(String(idA).replace(/\D/g, ''), 10);
  const numB = parseInt(String(idB).replace(/\D/g, ''), 10);
  if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
    return numA - numB;
  }
  if (!isNaN(numA) && isNaN(numB)) return -1;
  if (isNaN(numA) && !isNaN(numB)) return 1;
  return String(idA).localeCompare(String(idB), undefined, { numeric: true, sensitivity: 'base' });
};

/**
 * Format any number or numeric string safely into Indian numbering system (e.g. 1,50,000)
 */
export const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (isNaN(num) || !isFinite(num)) return '0';
  return Math.round(num).toLocaleString('en-IN');
};

/**
 * Format currency with single ₹ prefix safely (e.g. ₹1,50,000)
 * Guaranteed to return clean, single-symbol Indian currency representation
 */
export const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '₹0';
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (isNaN(num) || !isFinite(num)) return '₹0';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Math.round(num));
  } catch (err) {
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  }
};

/**
 * Format percentage safely (e.g. 75%)
 */
export const formatPercentage = (value) => {
  if (value === null || value === undefined || value === '') return '0%';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num) || !isFinite(num)) return '0%';
  return `${Math.min(100, Math.max(0, Math.round(num)))}%`;
};

/**
 * Safely format dates (handles Firebase Timestamp, Date object, ISO string, milliseconds)
 */
export const formatDate = (value, options = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!value) return '-';
  try {
    let d;
    if (value && typeof value.toDate === 'function') {
      d = value.toDate();
    } else if (value && typeof value.seconds === 'number') {
      d = new Date(value.seconds * 1000);
    } else if (value instanceof Date) {
      d = value;
    } else {
      d = new Date(value);
    }

    if (isNaN(d.getTime())) return String(value) || '-';
    return d.toLocaleDateString('en-IN', options);
  } catch (err) {
    return String(value) || '-';
  }
};

/**
 * Safely format Month & Year (e.g. month: 3, year: 2026 -> "March 2026")
 */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MARATHI_MONTH_NAMES = [
  'जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
  'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'
];

export const formatMonthYear = (month, year, lang) => {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10) || new Date().getFullYear();
  let currentLang = lang;
  if (!currentLang) {
    try {
      currentLang = localStorage.getItem('bachat_gat_language');
    } catch (e) {
      currentLang = 'en';
    }
  }
  const isMr = currentLang === 'mr';
  if (m === 0) return isMr ? `मूळ बचत (${y})` : `Base Savings (${y})`;
  const names = isMr ? MARATHI_MONTH_NAMES : MONTH_NAMES;
  const mName = (m >= 1 && m <= 12) ? names[m - 1] : (isMr ? 'अज्ञात' : 'Unknown');
  return `${mName} ${y}`;
};

export const getOrdinalSuffix = (day) => {
  const d = parseInt(day, 10) || 10;
  if (d >= 11 && d <= 13) return `${d}th`;
  switch (d % 10) {
    case 1: return `${d}st`;
    case 2: return `${d}nd`;
    case 3: return `${d}rd`;
    default: return `${d}th`;
  }
};

export const formatMonthlyHaftaDueDate = (day = 10, lang = 'en') => {
  const d = parseInt(day, 10) || 10;
  let currentLang = lang;
  if (!currentLang) {
    try {
      currentLang = localStorage.getItem('bachat_gat_language') || 'en';
    } catch (e) {
      currentLang = 'en';
    }
  }
  const isMr = currentLang === 'mr';
  if (isMr) {
    return `हफ्त्याची तारीख: प्रत्येक महिन्याची ${d} तारीख`;
  }
  return `Monthly Hafta Due Date: ${getOrdinalSuffix(d)} of every month`;
};

export const normalizeGroup = (id, data = {}) => {
  const groupId = id || data.id || data.groupId || DEFAULT_GROUP_ID;
  const name = data.name || data.groupName || data.group_name || 'Chhatrapati Bachat Gat, Ghargaon Stand';
  const monthlyContribution = Number(
    data.monthly_contribution_per_share ??
    data.monthlyContributionPerShare ??
    data.monthlyContribution ??
    data.monthly_contribution ??
    data.monthlyShare ??
    data.monthly_share ??
    data.monthlyContributionAmount ??
    1000
  );
  const monthlyHaftaDay = parseInt(
    data.monthly_hafta_day ??
    data.monthlyHaftaDay ??
    10,
    10
  ) || 10;
  const monthlyTarget = Number(data.monthlyTarget || data.monthly_target || 0);
  const totalSavings = Number(data.totalSavings || data.total_savings || 0);
  const totalOutstandingLoans = Number(data.totalOutstandingLoans || data.total_outstanding_loans || 0);
  const totalInterestCollected = Number(data.totalInterestCollected || data.total_interest_collected || 0);
  const totalFund = data.totalFund !== undefined ? Number(data.totalFund) : Math.max(0, totalSavings + totalInterestCollected - totalOutstandingLoans);

  return {
    id: groupId,
    groupId: groupId,
    name: name,
    groupName: name,
    group_name: name,
    groupCode: data.groupCode || data.group_code || groupId,
    group_code: data.groupCode || data.group_code || groupId,
    monthlyContributionAmount: monthlyContribution,
    monthlyContribution: monthlyContribution,
    monthly_contribution_per_share: monthlyContribution,
    monthlyHaftaDay: monthlyHaftaDay,
    monthly_hafta_day: monthlyHaftaDay,
    monthlyTarget: monthlyTarget,
    monthly_target: monthlyTarget,
    totalSavings: totalSavings,
    total_savings: totalSavings,
    totalOutstandingLoans: totalOutstandingLoans,
    total_outstanding_loans: totalOutstandingLoans,
    totalInterestCollected: totalInterestCollected,
    total_interest_collected: totalInterestCollected,
    totalFund,
    total_fund: totalFund,
    availableBalance: totalFund,
    managerId: data.managerId || 'manager_001',
    description: data.description || '',
    createdAt: data.createdAt || '',
    updatedAt: data.updatedAt || '',
  };
};

export const isRegularMember = (m) => {
  if (!m) return false;
  const isDeleted = m.isDeleted === true || m.deleted === true;
  if (isDeleted) return false;
  const rawRole = String(m.role || m.role_name || m.roleName || 'member').toLowerCase().trim();
  if (rawRole === 'admin' || rawRole === 'administrator' || rawRole === 'superadmin' || rawRole === 'group_admin') {
    return false;
  }
  return rawRole === 'member' || rawRole === 'treasurer' || rawRole === 'secretary' || rawRole === '';
};

export const normalizeMember = (id, data = {}) => {
  const memberId = id || data.id || data.memberId || data.member_id || '';
  const name = data.name || data.fullName || data.full_name || 'Member';
  const monthlyContribution = Number(data.monthlyContribution || data.monthlyContributionPerShare || data.monthlyHaftaAmount || data.monthly_contribution || 1000);
  const shares = Number(data.shares || data.shareCount || 1);
  const status = (data.status || (data.isActive !== false ? 'ACTIVE' : 'INACTIVE')).toUpperCase();
  const rawRole = String(data.role || data.role_name || data.roleName || 'MEMBER').trim();
  const roleLower = rawRole.toLowerCase();

  return {
    id: memberId,
    memberId: memberId,
    member_id: memberId,
    name: name,
    fullName: name,
    phone: data.phone || '',
    shares: shares,
    shareCount: shares,
    monthlyContribution: monthlyContribution,
    monthlyContributionPerShare: monthlyContribution,
    monthly_contribution: monthlyContribution,
    status: status,
    isActive: status === 'ACTIVE' || status === 'active',
    is_active: (status === 'ACTIVE' || status === 'active') ? 1 : 0,
    joinDate: data.joinDate || data.joinedAt || data.joined_date || '',
    joinedAt: data.joinDate || data.joinedAt || data.joined_date || '',
    joined_date: data.joinDate || data.joinedAt || data.joined_date || '',
    memberCode: data.memberCode || data.member_code || memberId,
    member_code: data.memberCode || data.member_code || memberId,
    email: data.email || '',
    userId: data.userId || data.authUid || data.firebaseUid || '',
    authUid: data.authUid || data.firebaseUid || data.userId || '',
    firebaseUid: data.firebaseUid || data.authUid || data.userId || '',
    role: roleLower,
    role_name: rawRole.toUpperCase(),
    groupId: data.groupId || DEFAULT_GROUP_ID,
    totalSavings: Number(data.totalSavings || data.total_savings || 0),
    total_savings: Number(data.totalSavings || data.total_savings || 0),
    activeLoanAmount: Number(data.activeLoanAmount || data.active_loan_amount || data.outstanding_loans || 0),
    outstanding_loans: Number(data.activeLoanAmount || data.active_loan_amount || data.outstanding_loans || 0),
  };
};

/**
 * Authoritative validator for whether a contribution record represents an ALREADY PAID monthly saving.
 * Crucial invariants:
 * 1. Base / Opening savings (month === 0) NEVER counts as a regular monthly payment.
 * 2. regularHaftaAmount is the TARGET quota (₹1,000), NOT the paid amount.
 * 3. Payment status is determined by contribution month & year, NOT the paymentDate timestamp.
 */
export function isMonthlySavingPaid(record, expectedShare = 1000) {
  if (!record) return false;

  const m = record.month !== undefined && record.month !== null && !isNaN(parseInt(record.month, 10))
    ? parseInt(record.month, 10)
    : null;

  // 1. Base / Opening savings is never a monthly contribution
  const isBase = record.isBase ||
    record.type === 'BASE_SAVINGS' ||
    m === 0 ||
    record.notes?.toLowerCase().includes('opening') ||
    record.remarks?.toLowerCase().includes('opening') ||
    record.paymentMode === 'Opening Balance' ||
    record.payment_mode === 'Opening Balance';

  if (isBase) return false;

  const rawStatus = (record.status || record.status_lower || '').toLowerCase();
  const expected = Number(
    record.expectedAmount ||
    record.expected_amount ||
    record.requiredAmount ||
    expectedShare ||
    1000
  );

  // 2. Extract actual paid amount safely (do NOT use regularHaftaAmount as paid amount)
  let paid = 0;
  if (record.paidAmount !== undefined && record.paidAmount !== null && !isNaN(Number(record.paidAmount)) && Number(record.paidAmount) > 0) {
    paid = Number(record.paidAmount);
  } else if (record.paid_amount !== undefined && record.paid_amount !== null && !isNaN(Number(record.paid_amount)) && Number(record.paid_amount) > 0) {
    paid = Number(record.paid_amount);
  } else if (record.amount !== undefined && record.amount !== null && !isNaN(Number(record.amount)) && Number(record.amount) > 0 && rawStatus === 'paid') {
    paid = Number(record.amount);
  } else if (record.totalPaid !== undefined && record.totalPaid !== null && !isNaN(Number(record.totalPaid)) && Number(record.totalPaid) > 0 && rawStatus === 'paid') {
    paid = Number(record.totalPaid);
  } else if (record.total_paid !== undefined && record.total_paid !== null && !isNaN(Number(record.total_paid)) && Number(record.total_paid) > 0 && rawStatus === 'paid') {
    paid = Number(record.total_paid);
  }

  // 3. If explicitly marked pending with 0 paid, it is NOT paid
  if (rawStatus === 'pending' && paid <= 0) {
    return false;
  }

  // 4. If status is paid and paid > 0 or has explicit paid status
  if (rawStatus === 'paid') {
    return paid > 0 || (record.amount !== undefined && Number(record.amount) > 0) || expected > 0;
  }

  return paid >= expected && expected > 0;
}

/**
 * Canonical calculation for a member's monthly contribution and dues status
 * Single source of truth for both Dashboard and Members pages.
 */
export function calculateMonthlyMemberStatus({
  member = {},
  payments = [],
  selectedMonth = new Date().getMonth() + 1,
  selectedYear = new Date().getFullYear(),
  monthlyShare = 1000,
}) {
  const m = Number(selectedMonth);
  const y = Number(selectedYear);
  const memberId = String(member.id || member.memberId || member.member_id || '');
  const sharesCount = Math.max(1, Number(member.shares || member.shareCount || 1) || 1);
  const effectiveRatePerShare = Number(
    monthlyShare ||
    member.monthlyContributionPerShare ||
    member.monthly_contribution_per_share ||
    (member.monthlyContribution ? member.monthlyContribution / sharesCount : 1000)
  ) || 1000;
  const requiredAmount = sharesCount * effectiveRatePerShare;

  // Filter payments strictly for this member in the selected month & year using authoritative check
  const memberPayments = payments.filter((p) => {
    const pMemId = String(p.memberId || p.member_id || '');
    const pMonth = Number(p.month);
    const pYear = Number(p.year);

    if (pMemId !== memberId || pMonth !== m || pYear !== y) {
      return false;
    }

    return isMonthlySavingPaid(p, requiredAmount);
  });

  const amountPaid = memberPayments.reduce((sum, p) => {
    let pPaid = 0;
    if (p.paidAmount !== undefined && p.paidAmount !== null && Number(p.paidAmount) > 0) {
      pPaid = Number(p.paidAmount);
    } else if (p.paid_amount !== undefined && p.paid_amount !== null && Number(p.paid_amount) > 0) {
      pPaid = Number(p.paid_amount);
    } else if (p.amount !== undefined && p.amount !== null && Number(p.amount) > 0) {
      pPaid = Number(p.amount);
    } else if (p.totalPaid !== undefined && p.totalPaid !== null && Number(p.totalPaid) > 0) {
      pPaid = Number(p.totalPaid);
    } else {
      pPaid = requiredAmount;
    }
    return sum + pPaid;
  }, 0);

  const currentDues = Math.max(requiredAmount - amountPaid, 0);
  const isPaid = currentDues === 0 && amountPaid >= requiredAmount;
  const isPending = !isPaid;
  const status = isPaid ? 'Paid' : 'Pending';

  return {
    memberId,
    amountPaid,
    requiredAmount,
    currentDues,
    current_dues: currentDues,
    remainingDue: currentDues,
    remaining_due: currentDues,
    pending_amount: currentDues,
    pendingAmount: currentDues,
    status,
    due_status: status,
    dueStatus: status,
    payment_status: status,
    paymentStatus: status,
    isPending,
    is_pending_dues: isPending,
    isPendingDues: isPending,
    isPaid,
    has_paid_current_month: isPaid,
    hasPaidCurrentMonth: isPaid,
  };
}

/**
 * Single source of truth calculation for multiple active members in a selected period.
 */
export function calculateMonthlyMemberStatuses({
  activeMembers = [],
  payments = [],
  selectedMonth = new Date().getMonth() + 1,
  selectedYear = new Date().getFullYear(),
  monthlyShare = 1000,
}) {
  const m = Number(selectedMonth);
  const y = Number(selectedYear);

  const statuses = activeMembers.map((member) => {
    const statusObj = calculateMonthlyMemberStatus({
      member,
      payments,
      selectedMonth: m,
      selectedYear: y,
      monthlyShare,
    });
    return {
      ...member,
      ...statusObj,
    };
  });

  const paidMembers = statuses.filter((s) => s.isPaid);
  const pendingMembers = statuses.filter((s) => s.isPending);

  const totalMembers = statuses.length;
  const paidCount = paidMembers.length;
  const pendingCount = pendingMembers.length;

  const collectedAmount = statuses.reduce((sum, s) => sum + s.amountPaid, 0);
  const monthlyTarget = statuses.reduce((sum, s) => sum + s.requiredAmount, 0) || (totalMembers * Number(monthlyShare || 1000));
  const pendingAmount = pendingMembers.reduce((sum, s) => sum + s.currentDues, 0);
  const progressPercentage = monthlyTarget > 0 ? Math.min(100, Math.round(((collectedAmount / monthlyTarget) * 100) * 100) / 100) : 0;

  return {
    month: m,
    year: y,
    totalMembers,
    paidCount,
    paidMembersCount: paidCount,
    paidMembers,
    pendingCount,
    pendingMembersCount: pendingCount,
    pendingMembers,
    collectedAmount,
    monthlyTarget,
    targetAmount: monthlyTarget,
    pendingAmount,
    expectedPending: pendingAmount,
    expectedPendingAmount: pendingAmount,
    progressPercentage,
    completionPercentage: progressPercentage,
    monthlyStatuses: statuses,
  };
}

export const normalizeSavings = (id, data = {}) => {
  const savingId = id || data.id || data.contribId || data.contrib_id || '';
  const memberId = String(data.memberId || data.member_id || '');
  const expectedAmount = Number(data.expectedAmount || data.expected_amount || 1000);
  const rawStatus = (data.status || data.status_lower || '').toLowerCase();

  const month = data.month !== undefined && data.month !== null && !isNaN(parseInt(data.month, 10))
    ? parseInt(data.month, 10)
    : (new Date().getMonth() + 1);
  const year = parseInt(data.year, 10) || new Date().getFullYear();

  const isBase = data.isBase ||
    data.type === 'BASE_SAVINGS' ||
    month === 0 ||
    data.notes?.toLowerCase().includes('opening') ||
    data.remarks?.toLowerCase().includes('opening') ||
    data.paymentMode === 'Opening Balance' ||
    data.payment_mode === 'Opening Balance';

  const isPaid = isBase ? true : isMonthlySavingPaid({ ...data, month, year, memberId }, expectedAmount);

  let paidAmount = 0;
  if (isBase) {
    paidAmount = Number(data.paidAmount || data.paid_amount || data.amount || data.totalPaid || data.total_paid || 10000);
  } else if (isPaid) {
    if (data.paidAmount !== undefined && data.paidAmount !== null && Number(data.paidAmount) > 0) {
      paidAmount = Number(data.paidAmount);
    } else if (data.paid_amount !== undefined && data.paid_amount !== null && Number(data.paid_amount) > 0) {
      paidAmount = Number(data.paid_amount);
    } else if (data.amount !== undefined && data.amount !== null && Number(data.amount) > 0) {
      paidAmount = Number(data.amount);
    } else if (data.totalPaid !== undefined && data.totalPaid !== null && Number(data.totalPaid) > 0) {
      paidAmount = Number(data.totalPaid);
    } else {
      paidAmount = expectedAmount;
    }
  } else {
    paidAmount = 0;
  }

  const loanPrincipalPaid = Number(data.loanPrincipalPaid || data.loan_principal_paid || 0);
  const interestAmount = Number(data.interestAmount || data.interest_amount || data.interest || 0);
  const finalStatus = isPaid ? 'paid' : 'pending';

  return {
    id: savingId,
    saving_id: savingId,
    groupId: data.groupId || data.group_id || DEFAULT_GROUP_ID,
    memberId: memberId,
    member_id: memberId,
    memberName: data.memberName || data.member_name || data.name || data.fullName || 'Member',
    member_name: data.memberName || data.member_name || data.name || data.fullName || 'Member',
    memberCode: data.memberCode || data.member_code || memberId,
    member_code: data.memberCode || data.member_code || memberId,
    month,
    year,
    expectedAmount,
    regularHaftaAmount: expectedAmount,
    paidAmount,
    paid_amount: paidAmount,
    amount: paidAmount,
    totalPaid: Number(data.totalPaid !== undefined ? data.totalPaid : (paidAmount + loanPrincipalPaid + interestAmount)),
    loanPrincipalPaid,
    interestAmount,
    status: finalStatus,
    status_lower: finalStatus,
    isPaid: isPaid,
    isBase: isBase,
    paymentDate: data.paymentDate || data.payment_date || data.createdAt || new Date().toISOString().split('T')[0],
    payment_date: data.paymentDate || data.payment_date || data.createdAt || new Date().toISOString().split('T')[0],
    paymentMode: data.paymentMode || data.payment_mode || 'UPI',
    payment_mode: data.paymentMode || data.payment_mode || 'UPI',
    remarks: data.notes || data.remarks || '',
    notes: data.notes || data.remarks || '',
  };
};

export const normalizeLoan = (id, data = {}, repayments = []) => {
  const loanId = id || data.id || data.loanId || data.loan_id || '';
  const memberId = data.memberId || data.member_id || '';
  const originalPrincipal = Number(data.originalPrincipal !== undefined ? data.originalPrincipal : (data.principalAmount || data.principal_amount || 0));
  const pendingPrincipal = Number(data.pendingPrincipal !== undefined ? data.pendingPrincipal : (data.remainingAmount !== undefined ? data.remainingAmount : (data.outstanding_amount || originalPrincipal)));
  const interestRate = Number(data.interestRate !== undefined ? data.interestRate : (data.interest_rate || 2.0));
  const rawStatus = (data.status || '').toUpperCase();
  const status = pendingPrincipal <= 0 || rawStatus === 'CLOSED' || rawStatus === 'COMPLETED' ? 'CLOSED' : (rawStatus || 'ACTIVE');

  const loanRepayments = Array.isArray(repayments) && repayments.length > 0
    ? repayments
    : (Array.isArray(data.repayments) ? data.repayments : []);

  const repaymentPrincipal = loanRepayments.reduce(
    (sum, r) => sum + Number(r.principalAmount || r.principalPaid || r.principalRepaid || r.principal_repayment_amount || 0),
    0
  );
  const totalPrincipalPaid = Math.max(
    0,
    originalPrincipal - pendingPrincipal,
    Number(data.totalPrincipalPaid || data.total_principal_paid || 0),
    repaymentPrincipal
  );

  const repaymentInterest = loanRepayments.reduce(
    (sum, r) => sum + Number(r.interestAmount || r.interestPaid || r.interest_amount || 0),
    0
  );
  const totalInterestPaid = Math.max(
    Number(data.totalInterestPaid || data.total_interest_paid || data.interestPaid || data.interest_amount || 0),
    repaymentInterest
  );

  return {
    id: loanId,
    loanId: loanId,
    loan_id: loanId,
    loanNumber: data.loanNumber || data.loan_number || `LN-${String(loanId).slice(-6)}`,
    loan_number: data.loanNumber || data.loan_number || `LN-${String(loanId).slice(-6)}`,
    memberId: memberId,
    member_id: memberId,
    memberName: data.memberName || data.member_name || 'Member',
    member_name: data.memberName || data.member_name || 'Member',
    memberCode: data.memberCode || data.member_code || memberId,
    member_code: data.memberCode || data.member_code || memberId,
    groupId: data.groupId || DEFAULT_GROUP_ID,
    originalPrincipal,
    principalAmount: originalPrincipal,
    principal_amount: originalPrincipal,
    pendingPrincipal,
    outstandingAmount: pendingPrincipal,
    outstanding_amount: pendingPrincipal,
    interestRate,
    interest_rate: interestRate,
    totalPrincipalPaid,
    total_principal_paid: totalPrincipalPaid,
    total_principal_repaid: totalPrincipalPaid,
    totalInterestPaid,
    total_interest_paid: totalInterestPaid,
    durationMonths: parseInt(data.durationMonths || data.duration_months, 10) || 12,
    duration_months: parseInt(data.durationMonths || data.duration_months, 10) || 12,
    status,
    purpose: data.purpose || 'General',
    issueDate: data.issueDate || data.loanDate || data.loan_date || data.createdAt || new Date().toISOString().split('T')[0],
    loanDate: data.issueDate || data.loanDate || data.loan_date || data.createdAt || new Date().toISOString().split('T')[0],
    loan_date: data.issueDate || data.loanDate || data.loan_date || data.createdAt || new Date().toISOString().split('T')[0],
    createdAt: data.createdAt || '',
    updatedAt: data.updatedAt || '',
    repayments: loanRepayments,
  };
};

export const normalizeActivity = (id, data = {}) => {
  let month = data.month || data.contributionMonth || data.contribution_month || null;
  let year = data.year || data.contributionYear || data.contribution_year || null;
  const refId = data.referenceId || data.reference_id || '';
  const actId = id || data.id || '';
  const desc = data.description || '';

  if ((!month || !year) && (refId || actId)) {
    const match = (refId + ' ' + actId).match(/(?:C|T)_[^_]+_(\d{4})_(\d{1,2})/i) || (refId + ' ' + actId).match(/_(\d{4})_(\d{1,2})/);
    if (match) {
      year = parseInt(match[1], 10);
      month = parseInt(match[2], 10);
    }
  }

  if ((!month || !year) && desc) {
    const yearMatch = desc.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      const parsedYear = parseInt(yearMatch[1], 10);
      const enMonths = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const mrMonths = ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'];
      const lowerDesc = desc.toLowerCase();
      let foundMonth = null;
      for (let i = 0; i < 12; i++) {
        if (lowerDesc.includes(enMonths[i]) || desc.includes(mrMonths[i])) {
          foundMonth = i + 1;
          break;
        }
      }
      if (foundMonth) {
        month = foundMonth;
        year = parsedYear;
      }
    }
  }

  return {
    id: actId || `ACT_${Date.now()}`,
    type: (data.type || 'adjustment').toUpperCase(),
    amount: Number(data.amount || 0),
    description: data.description || 'Activity recorded',
    date: data.date || data.created_at || data.createdAt || new Date().toISOString(),
    created_at: data.date || data.created_at || data.createdAt || new Date().toISOString(),
    memberId: data.memberId || data.member_id || '',
    memberName: data.memberName || data.member_name || '',
    referenceId: refId,
    month: month ? Number(month) : undefined,
    year: year ? Number(year) : undefined,
  };
};
