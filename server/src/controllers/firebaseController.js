const { auth, db } = require('../config/firebaseAdmin');
const { DEFAULT_GROUP_ID, getCollection, value, writeActivity, writeNotification } = require('../utils/firestore');
const { calculateMonthlyInterest, calculateProgressPercentage } = require('../utils/calculations');

const number = (item) => Number(item) || 0;
const today = () => new Date().toISOString().split('T')[0];
const groupIdOf = (req) => req.user.groupId || DEFAULT_GROUP_ID;

async function register(req, res) {
  res.status(410).json({ success: false, message: 'Registration is handled by Firebase Authentication in the client.' });
}

async function login(req, res) {
  res.status(410).json({ success: false, message: 'Login is handled by Firebase Authentication in the client.' });
}

async function getMe(req, res) {
  const profile = await db.collection('users').doc(req.user.uid).get();
  res.json({ success: true, user: { ...req.user, ...(profile.exists ? profile.data() : {}) } });
}

async function updateProfile(req, res, next) {
  try {
    const allowed = ['fullName', 'name', 'phone'];
    const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    update.updatedAt = new Date().toISOString();
    await db.collection('users').doc(req.user.uid).set(update, { merge: true });
    if (update.fullName || update.name) await auth.updateUser(req.user.uid, { displayName: update.fullName || update.name });
    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) { next(err); }
}

async function getGroupDetails(req, res) {
  const id = groupIdOf(req);
  const snapshot = await db.collection('groups').doc(id).get();
  const members = await getCollection('members', id);
  const group = snapshot.exists ? snapshot.data() : {};
  res.json({ success: true, group: { ...group, id, groupId: id, total_members: members.length, total_active_members: members.filter((m) => m.status !== 'INACTIVE' && m.isActive !== false).length } });
}

async function updateGroupDetails(req, res, next) {
  try {
    const id = groupIdOf(req);
    const body = req.body;
    const update = {
      groupName: body.group_name || body.groupName,
      group_name: body.group_name || body.groupName,
      monthlyContribution: number(body.monthly_contribution_per_share || body.monthlyContribution) || 1000,
      monthlyTarget: number(body.monthly_target || body.monthlyTarget) || 363000,
      description: body.description || '', updatedAt: new Date().toISOString(),
    };
    await db.collection('groups').doc(id).set(update, { merge: true });
    await writeActivity(id, req.user.uid, 'GROUP_UPDATED', `Group settings updated by ${req.user.name || req.user.email}`);
    res.json({ success: true, message: 'Group settings updated successfully.', group: { ...update, id, groupId: id } });
  } catch (err) { next(err); }
}

async function getAllMembers(req, res) {
  let members = await getCollection('members', groupIdOf(req));
  const { search, status, month, year } = req.query;
  if (search) { const term = search.toLowerCase(); members = members.filter((m) => `${m.fullName || m.name} ${m.email} ${m.phone} ${m.memberCode}`.toLowerCase().includes(term)); }
  if (status === 'active') members = members.filter((m) => m.status !== 'INACTIVE' && m.isActive !== false);
  if (status === 'inactive') members = members.filter((m) => m.status === 'INACTIVE' || m.isActive === false);
  const savings = await getCollection('savings', groupIdOf(req));
  const loans = await getCollection('loans', groupIdOf(req));
  members = members.map((m) => ({ ...m, member_id: m.id, name: m.fullName || m.name, member_code: m.memberCode || m.member_code, total_savings: savings.filter((s) => s.memberId === m.id).reduce((sum, s) => sum + number(s.amount), 0), outstanding_loans: loans.filter((l) => l.memberId === m.id && l.status === 'ACTIVE').reduce((sum, l) => sum + number(value(l, 'remainingAmount', 'outstanding_amount')), 0), has_paid_current_month: savings.some((s) => s.memberId === m.id && number(s.month) === number(month) && number(s.year) === number(year)) }));
  res.json({ success: true, count: members.length, members });
}

async function getMemberById(req, res) { const members = await getCollection('members', groupIdOf(req)); const member = members.find((m) => m.id === req.params.id); if (!member) return res.status(404).json({ success: false, message: 'Member not found.' }); res.json({ success: true, member }); }
async function createMember(req, res, next) { try { const ref = db.collection('members').doc(); const member = { id: ref.id, ...req.body, groupId: groupIdOf(req), status: 'ACTIVE', isActive: true, createdAt: new Date().toISOString() }; await ref.set(member); res.status(201).json({ success: true, memberId: ref.id }); } catch (err) { next(err); } }
async function updateMember(req, res, next) { try { await db.collection('members').doc(req.params.id).set({ ...req.body, updatedAt: new Date().toISOString() }, { merge: true }); res.json({ success: true, message: 'Member updated successfully.' }); } catch (err) { next(err); } }
async function deleteMember(req, res, next) { try { await db.collection('members').doc(req.params.id).set({ status: 'INACTIVE', isActive: false }, { merge: true }); res.json({ success: true, message: 'Member deactivated successfully.' }); } catch (err) { next(err); } }

async function getAllSavings(req, res) { let savings = await getCollection('savings', groupIdOf(req)); const { month, year, memberId, search } = req.query; if (month) savings = savings.filter((s) => number(s.month) === number(month)); if (year) savings = savings.filter((s) => number(s.year) === number(year)); if (memberId) savings = savings.filter((s) => s.memberId === memberId); if (search) { const members = await getCollection('members', groupIdOf(req)); const ids = members.filter((m) => `${m.fullName || m.name} ${m.memberCode}`.toLowerCase().includes(search.toLowerCase())).map((m) => m.id); savings = savings.filter((s) => ids.includes(s.memberId)); } res.json({ success: true, count: savings.length, totalAmount: savings.reduce((sum, s) => sum + number(s.amount), 0), savings }); }
async function recordSavings(req, res, next) { try { const { member_id, amount, month, year } = req.body; const existing = (await getCollection('savings', groupIdOf(req))).some((s) => s.memberId === member_id && number(s.month) === number(month) && number(s.year) === number(year)); if (existing) return res.status(400).json({ success: false, message: 'Savings for this member and period is already recorded.' }); const ref = db.collection('savings').doc(); await ref.set({ id: ref.id, ...req.body, memberId: member_id, groupId: groupIdOf(req), amount: number(amount), createdAt: new Date().toISOString() }); res.status(201).json({ success: true, savingsId: ref.id }); } catch (err) { next(err); } }
async function updateSavings(req, res, next) { try { await db.collection('savings').doc(req.params.id).set({ ...req.body, updatedAt: new Date().toISOString() }, { merge: true }); res.json({ success: true, message: 'Savings record updated successfully.' }); } catch (err) { next(err); } }

async function getAllLoans(req, res) { let loans = await getCollection('loans', groupIdOf(req)); const repayments = await getCollection('repayments', groupIdOf(req)); loans = loans.map((l) => ({ ...l, loan_id: l.id, loan_number: value(l, 'loanNumber', 'loan_number'), principal_amount: number(value(l, 'principalAmount', 'principal_amount')), outstanding_amount: number(value(l, 'remainingAmount', 'outstanding_amount')), interest_rate: number(value(l, 'interestRate', 'interest_rate')), total_principal_repaid: repayments.filter((r) => r.loanId === l.id).reduce((s, r) => s + number(value(r, 'principalAmount', 'principal_repayment_amount')), 0) })); if (req.query.status) loans = loans.filter((l) => l.status === req.query.status.toUpperCase()); res.json({ success: true, count: loans.length, loans }); }
async function getLoanById(req, res) { const loan = (await getCollection('loans', groupIdOf(req))).find((l) => l.id === req.params.id); if (!loan) return res.status(404).json({ success: false, message: 'Loan not found.' }); res.json({ success: true, loan }); }
async function createLoan(req, res, next) { try { const ref = db.collection('loans').doc(); const principal = number(req.body.principal_amount); await ref.set({ id: ref.id, ...req.body, loanNumber: `LN-${new Date().getFullYear()}-${ref.id.slice(-3)}`, principalAmount: principal, remainingAmount: principal, groupId: groupIdOf(req), status: 'ACTIVE', createdAt: new Date().toISOString() }); res.status(201).json({ success: true, loanId: ref.id }); } catch (err) { next(err); } }
async function recordLoanRepayment(req, res, next) { try { const ref = db.collection('repayments').doc(); await ref.set({ id: ref.id, ...req.body, loanId: req.params.loanId, groupId: groupIdOf(req), createdAt: new Date().toISOString() }); res.status(201).json({ success: true, repaymentId: ref.id }); } catch (err) { next(err); } }
async function getLoanRepayments(req, res) { const repayments = (await getCollection('repayments', groupIdOf(req))).filter((r) => r.loanId === req.params.loanId); res.json({ success: true, repayments }); }

async function getDashboardSummary(req, res) { const [savings, loans, repayments, members, groups] = await Promise.all(['savings', 'loans', 'repayments', 'members', 'groups'].map((name) => getCollection(name, groupIdOf(req)))); const active = loans.filter((l) => l.status === 'ACTIVE'); const totalSavings = savings.reduce((s, x) => s + number(x.amount), 0); const interest = repayments.reduce((s, x) => s + number(value(x, 'interestAmount', 'interest_amount')), 0); const activeLoans = active.reduce((s, x) => s + number(value(x, 'remainingAmount', 'outstanding_amount')), 0); const group = groups[0] || {}; res.json({ success: true, summary: { groupName: value(group, 'groupName', 'group_name') || 'Bachat Gat', groupCode: value(group, 'groupCode', 'group_code') || groupIdOf(req), totalGroupFund: totalSavings + interest, totalSavings, activeLoans, activeLoansCount: active.length, totalInterest: interest, availableBalance: totalSavings + interest - activeLoans, totalMembers: members.length, activeMembers: members.filter((m) => m.status !== 'INACTIVE').length } }); }
async function getMonthlyProgress(req, res) { const month = number(req.query.month) || new Date().getMonth() + 1; const year = number(req.query.year) || new Date().getFullYear(); const [savings, members, groups] = await Promise.all(['savings', 'members', 'groups'].map((name) => getCollection(name, groupIdOf(req)))); const active = members.filter((m) => m.status !== 'INACTIVE' && m.isActive !== false); const collected = savings.filter((s) => number(s.month) === month && number(s.year) === year).reduce((sum, s) => sum + number(s.amount), 0); const target = number(value(groups[0] || {}, 'monthlyTarget', 'monthly_target')) || active.length * 1000; res.json({ success: true, progress: { month, year, collectedAmount: collected, targetAmount: target, progressPercentage: calculateProgressPercentage(collected, target), activeMembersCount: active.length } }); }
async function getRecentActivities(req, res) { const activities = await getCollection('activity_logs', groupIdOf(req)); res.json({ success: true, activities: activities.slice(-10).reverse() }); }

async function getNotifications(req, res) { const notifications = (await getCollection('notifications', groupIdOf(req))).filter((n) => !n.userId || n.userId === req.user.uid); res.json({ success: true, unreadCount: notifications.filter((n) => !n.isRead).length, notifications }); }
async function markNotificationAsRead(req, res, next) { try { await db.collection('notifications').doc(req.params.id).set({ isRead: true }, { merge: true }); res.json({ success: true }); } catch (err) { next(err); } }
async function markAllNotificationsAsRead(req, res, next) { try { const notifications = await getNotificationsForUser(req.user.uid); await Promise.all(notifications.map((n) => db.collection('notifications').doc(n.id).set({ isRead: true }, { merge: true }))); res.json({ success: true }); } catch (err) { next(err); } }
async function getNotificationsForUser(uid) { const snapshot = await db.collection('notifications').where('userId', '==', uid).get(); return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })); }

async function getMonthlyReport(req, res) { const month = number(req.query.month) || new Date().getMonth() + 1; const year = number(req.query.year) || new Date().getFullYear(); const savings = (await getCollection('savings', groupIdOf(req))).filter((s) => number(s.month) === month && number(s.year) === year); const repayments = (await getCollection('repayments', groupIdOf(req))).filter((r) => number(value(r, 'paymentMonth', 'payment_month')) === month && number(value(r, 'paymentYear', 'payment_year')) === year); res.json({ success: true, month, year, summary: { monthSavings: savings.reduce((s, x) => s + number(x.amount), 0), monthInterest: repayments.reduce((s, x) => s + number(value(x, 'interestAmount', 'interest_amount')), 0), monthPrincipalRepaid: repayments.reduce((s, x) => s + number(value(x, 'principalAmount', 'principal_repayment_amount')), 0) }, savingsTransactions: savings, repaymentTransactions: repayments }); }
async function getPendingDuesReport(req, res) { const [members, savings, loans] = await Promise.all(['members', 'savings', 'loans'].map((name) => getCollection(name, groupIdOf(req)))); const month = number(req.query.month) || new Date().getMonth() + 1; const year = number(req.query.year) || new Date().getFullYear(); const duesList = members.filter((m) => m.status !== 'INACTIVE').map((m) => { const paid = savings.some((s) => s.memberId === m.id && number(s.month) === month && number(s.year) === year); const loan = loans.find((l) => l.memberId === m.id && l.status === 'ACTIVE'); const outstandingPrincipal = number(value(loan || {}, 'remainingAmount', 'outstanding_amount')); const pendingHafta = paid ? 0 : number(value(m, 'monthlyContribution', 'monthly_contribution')) || 1000; const pendingInterest = calculateMonthlyInterest(outstandingPrincipal, value(loan || {}, 'interestRate', 'interest_rate')); return { memberId: m.id, memberName: m.fullName || m.name, memberCode: m.memberCode, pendingHafta, outstandingPrincipal, pendingInterest, totalPending: pendingHafta + outstandingPrincipal + pendingInterest, isPending: pendingHafta > 0 || outstandingPrincipal > 0 }; }).filter((m) => m.isPending); res.json({ success: true, month, year, summary: { totalPendingMembers: duesList.length, totalPendingAmount: duesList.reduce((s, d) => s + d.totalPending, 0) }, duesList }); }
async function getLoansOverviewReport(req, res) { const loans = await getAllLoansData(groupIdOf(req)); res.json({ success: true, summary: { totalLoans: loans.length, totalPrincipalDisbursed: loans.reduce((s, l) => s + number(value(l, 'principalAmount', 'principal_amount')), 0) }, loans }); }
async function getAllLoansData(groupId) { return getCollection('loans', groupId); }

module.exports = { register, login, getMe, updateProfile, getGroupDetails, updateGroupDetails, getAllMembers, getMemberById, createMember, updateMember, deleteMember, getAllSavings, recordSavings, updateSavings, getAllLoans, getLoanById, createLoan, recordLoanRepayment, getLoanRepayments, getDashboardSummary, getMonthlyProgress, getRecentActivities, getNotifications, markNotificationAsRead, markAllNotificationsAsRead, getMonthlyReport, getPendingDuesReport, getLoansOverviewReport };