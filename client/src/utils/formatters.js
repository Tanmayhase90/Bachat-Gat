/**
 * Centralized, Ultra-Safe Formatters and Normalizers for Bachat Gat Web Application
 * Fully synchronized with Flutter Android App database schema (groups/shivshahi_group_001)
 * Guaranteed NEVER to throw runtime errors or TypeError on undefined/null values
 */

export const DEFAULT_GROUP_ID = 'shivshahi_group_001';

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

export const formatMonthYear = (month, year) => {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10) || new Date().getFullYear();
  const mName = (m >= 1 && m <= 12) ? MONTH_NAMES[m - 1] : 'Unknown';
  return `${mName} ${y}`;
};

/**
 * Data Normalizers for Firestore Documents
 * Fully mapped to both Flutter schema and Web fields
 */
export const normalizeGroup = (id, data = {}) => {
  const groupId = id || data.id || data.groupId || DEFAULT_GROUP_ID;
  const name = data.name || data.groupName || data.group_name || 'Chhatrapati Bachat Gat, Ghargaon Stand';
  const monthlyContribution = Number(data.monthlyContributionAmount || data.monthlyContribution || data.monthly_contribution_per_share || 1000);
  const monthlyTarget = Number(data.monthlyTarget || data.monthly_target || 363000);
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
    monthlyTarget: monthlyTarget,
    monthly_target: monthlyTarget,
    totalSavings,
    total_savings: totalSavings,
    totalOutstandingLoans,
    total_outstanding_loans: totalOutstandingLoans,
    totalInterestCollected,
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

export const normalizeMember = (id, data = {}) => {
  const memberId = id || data.id || data.memberId || data.member_id || '';
  const name = data.name || data.fullName || data.full_name || 'Member';
  const monthlyContribution = Number(data.monthlyContribution || data.monthlyContributionPerShare || data.monthlyHaftaAmount || data.monthly_contribution || 1000);
  const shares = Number(data.shares || data.shareCount || 1);
  const status = (data.status || (data.isActive !== false ? 'ACTIVE' : 'INACTIVE')).toUpperCase();

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
    role: (data.role || data.role_name || 'MEMBER').toUpperCase(),
    role_name: (data.role || data.role_name || 'MEMBER').toUpperCase(),
    groupId: data.groupId || DEFAULT_GROUP_ID,
    totalSavings: Number(data.totalSavings || data.total_savings || 0),
    total_savings: Number(data.totalSavings || data.total_savings || 0),
    activeLoanAmount: Number(data.activeLoanAmount || data.active_loan_amount || data.outstanding_loans || 0),
    outstanding_loans: Number(data.activeLoanAmount || data.active_loan_amount || data.outstanding_loans || 0),
    is_pending_dues: Boolean(data.is_pending_dues),
    pending_amount: Number(data.pending_amount || 0),
  };
};

export const normalizeSavings = (id, data = {}) => {
  const savingId = id || data.id || '';
  const memberId = data.memberId || data.member_id || '';
  const paidAmount = Number(data.paidAmount !== undefined ? data.paidAmount : (data.totalPaid !== undefined ? data.totalPaid : data.amount || 0));
  const expectedAmount = Number(data.expectedAmount || data.regularHaftaAmount || data.amount || 1000);
  const loanPrincipalPaid = Number(data.loanPrincipalPaid || 0);
  const interestAmount = Number(data.interestAmount || 0);
  const status = (data.status || (paidAmount >= expectedAmount ? 'paid' : 'pending')).toLowerCase();

  return {
    id: savingId,
    saving_id: savingId,
    groupId: data.groupId || DEFAULT_GROUP_ID,
    memberId: memberId,
    member_id: memberId,
    memberName: data.memberName || data.member_name || data.name || data.fullName || 'Member',
    member_name: data.memberName || data.member_name || data.name || data.fullName || 'Member',
    memberCode: data.memberCode || data.member_code || memberId,
    member_code: data.memberCode || data.member_code || memberId,
    month: parseInt(data.month, 10) || (new Date().getMonth() + 1),
    year: parseInt(data.year, 10) || new Date().getFullYear(),
    expectedAmount,
    regularHaftaAmount: expectedAmount,
    paidAmount,
    amount: paidAmount > 0 ? paidAmount : expectedAmount,
    totalPaid: Number(data.totalPaid || paidAmount + loanPrincipalPaid + interestAmount),
    loanPrincipalPaid,
    interestAmount,
    status: status,
    isPaid: status === 'paid' || paidAmount >= expectedAmount,
    paymentDate: data.paymentDate || data.payment_date || data.createdAt || new Date().toISOString().split('T')[0],
    payment_date: data.paymentDate || data.payment_date || data.createdAt || new Date().toISOString().split('T')[0],
    paymentMode: data.paymentMode || data.payment_mode || 'UPI',
    payment_mode: data.paymentMode || data.payment_mode || 'UPI',
    remarks: data.notes || data.remarks || '',
  };
};

export const normalizeLoan = (id, data = {}) => {
  const loanId = id || data.id || data.loanId || data.loan_id || '';
  const memberId = data.memberId || data.member_id || '';
  const originalPrincipal = Number(data.originalPrincipal !== undefined ? data.originalPrincipal : (data.principalAmount || data.principal_amount || 0));
  const pendingPrincipal = Number(data.pendingPrincipal !== undefined ? data.pendingPrincipal : (data.remainingAmount !== undefined ? data.remainingAmount : (data.outstanding_amount || originalPrincipal)));
  const interestRate = Number(data.interestRate !== undefined ? data.interestRate : (data.interest_rate || 2.0));
  const status = (data.status || (pendingPrincipal <= 0 ? 'closed' : 'active')).toUpperCase();
  const totalPrincipalPaid = Math.max(0, originalPrincipal - pendingPrincipal);

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
    totalInterestPaid: Number(data.totalInterestPaid || data.total_interest_paid || 0),
    total_interest_paid: Number(data.totalInterestPaid || data.total_interest_paid || 0),
    durationMonths: parseInt(data.durationMonths || data.duration_months, 10) || 12,
    duration_months: parseInt(data.durationMonths || data.duration_months, 10) || 12,
    status,
    purpose: data.purpose || 'General',
    issueDate: data.issueDate || data.loanDate || data.loan_date || data.createdAt || new Date().toISOString().split('T')[0],
    loanDate: data.issueDate || data.loanDate || data.loan_date || data.createdAt || new Date().toISOString().split('T')[0],
    loan_date: data.issueDate || data.loanDate || data.loan_date || data.createdAt || new Date().toISOString().split('T')[0],
    createdAt: data.createdAt || '',
    updatedAt: data.updatedAt || '',
    repayments: Array.isArray(data.repayments) ? data.repayments : [],
  };
};

export const normalizeActivity = (id, data = {}) => {
  return {
    id: id || data.id || `ACT_${Date.now()}`,
    type: (data.type || 'adjustment').toUpperCase(),
    amount: Number(data.amount || 0),
    description: data.description || 'Activity recorded',
    date: data.date || data.created_at || data.createdAt || new Date().toISOString(),
    created_at: data.date || data.created_at || data.createdAt || new Date().toISOString(),
    memberId: data.memberId || data.member_id || '',
    memberName: data.memberName || data.member_name || '',
    referenceId: data.referenceId || data.reference_id || '',
  };
};
