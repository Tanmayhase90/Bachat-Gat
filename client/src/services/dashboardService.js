import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  limit as limitDocs,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { groupService } from './groupService.js';
import { reportService } from './reportService.js';
import { notificationService } from './notificationService.js';
import {
  formatCurrency,
  normalizeGroup,
  normalizeMember,
  normalizeSavings,
  normalizeLoan,
  normalizeActivity,
  DEFAULT_GROUP_ID,
  isRegularMember,
  calculateMonthlyMemberStatus,
  calculateMonthlyMemberStatuses,
} from '../utils/formatters.js';

export { groupService, reportService, notificationService };

/**
 * Unified Monthly Savings Progress Calculation
 * Implements the exact canonical business formulas:
 *   monthlyTarget = totalMembers * monthlyShare
 *   collectedAmount = paidMembers * monthlyShare
 *   pendingMembers = Math.max(0, totalMembers - paidMembers)
 *   expectedPending = pendingMembers * monthlyShare
 *   completionPercentage = monthlyTarget > 0 ? (collectedAmount / monthlyTarget) * 100 : 0
 */
export function calculateMonthlySavingsProgress({
  totalMembers = 0,
  paidMembers = 0,
  monthlyShare = 1000,
  pendingMembersList = [],
}) {
  const safeTotal = Number(totalMembers) || 0;
  const safePaid = Number(paidMembers) || 0;
  const safeShare = Number(monthlyShare) || 1000;

  const monthlyTarget = safeTotal * safeShare;
  const collectedAmount = safePaid * safeShare;
  const pendingMembers = Math.max(0, safeTotal - safePaid);
  const expectedPending = pendingMembers * safeShare;
  const completionPercentage = monthlyTarget > 0
    ? Math.min(100, Math.round(((collectedAmount / monthlyTarget) * 100) * 100) / 100)
    : 0;

  return {
    totalMembers: safeTotal,
    totalActiveMembers: safeTotal,
    totalEligibleMembers: safeTotal,
    paidMembers: safePaid,
    membersPaid: safePaid,
    pendingMembers: pendingMembersList,
    pendingMembersCount: pendingMembers,
    monthlyShare: safeShare,
    monthlyTarget,
    targetAmount: monthlyTarget,
    collectedAmount,
    expectedPending,
    expectedPendingAmount: expectedPending,
    progressPercentage: completionPercentage,
    completionPercentage,
  };
}

export const dashboardService = {
  calculateMonthlySavingsProgress,
  /**
   * Calculate all real-time summary financial metrics directly from Firestore collections
   */
  getSummary: async (groupId = DEFAULT_GROUP_ID, memberId = null) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;

      const [groupDocSnap, contributionsSnap, loansSnap, repaymentsSnap, membersSnap, settlementsSnap] = await Promise.all([
        getDoc(doc(db, 'groups', targetGroupId)).catch(() => null),
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'repayments')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'settlements')).catch(() => ({ docs: [] })),
      ]);

      const groupRaw = groupDocSnap?.exists() ? groupDocSnap.data() : {};
      const group = normalizeGroup(targetGroupId, groupRaw);
      const groupName = group.name || group.groupName || 'Chhatrapati Bachat Gat, Ghargaon Stand';
      const groupCode = group.groupCode || targetGroupId;

      // 1. Core Financial Baseline calculated dynamically from real collections
      const regularMemberDocs = (membersSnap && membersSnap.docs)
        ? membersSnap.docs.filter((d) => isRegularMember({ id: d.id, ...d.data() }))
        : [];
      const validMemberIdSet = new Set();
      regularMemberDocs.forEach((d) => {
        validMemberIdSet.add(d.id);
        const mData = d.data();
        if (mData.memberCode) validMemberIdSet.add(mData.memberCode);
        if (mData.member_code) validMemberIdSet.add(mData.member_code);
        if (mData.userId) validMemberIdSet.add(mData.userId);
        if (mData.authUid) validMemberIdSet.add(mData.authUid);
        const cleanId = d.id.toLowerCase().replace(/[-_]/g, '');
        if (cleanId) validMemberIdSet.add(cleanId);
      });

      const contributionsList = contributionsSnap.docs
        .map((d) => normalizeSavings(d.id, d.data()))
        .filter((c) => {
          const mId = String(c.memberId || c.member_id || '');
          const mCode = String(c.memberCode || c.member_code || '');
          const cleanId = mId.toLowerCase().replace(/[-_]/g, '');
          const cleanCode = mCode.toLowerCase().replace(/[-_]/g, '');
          return validMemberIdSet.has(mId) || validMemberIdSet.has(mCode) || validMemberIdSet.has(cleanId) || validMemberIdSet.has(cleanCode);
        });

      const liveSavingsTotal = contributionsList
        .filter((c) => c.isPaid || c.paidAmount > 0)
        .reduce((sum, c) => sum + (c.paidAmount || c.amount || 0), 0);

      const totalSettledSavings = settlementsSnap.docs.reduce((sum, d) => {
        const data = d.data() || {};
        const st = (data.status || '').toUpperCase();
        if (st && st !== 'COMPLETED') return sum;
        return sum + Number(data.lifetimeSavings || data.lifetime_savings || 0);
      }, 0);

      // liveSavingsTotal represents the canonical member savings of current active regular members.
      // Do NOT subtract totalSettledSavings again, as departed members' savings are already excluded from active members.
      const totalSavings = liveSavingsTotal;
      const memberContributions = totalSavings;

      // 2. Map Repayments by Loan ID
      const repaymentsList = repaymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const repaymentsByLoan = {};
      repaymentsList.forEach((r) => {
        const lId = r.loanId || r.loan_id;
        if (lId) {
          if (!repaymentsByLoan[lId]) repaymentsByLoan[lId] = [];
          repaymentsByLoan[lId].push(r);
        }
      });

      // 3. Loans & Repayments calculated dynamically
      const loansList = loansSnap.docs.map((d) => {
        const loanId = d.id;
        const raw = d.data();
        const loanRepays = repaymentsByLoan[loanId] || repaymentsByLoan[raw.loanId] || [];
        return normalizeLoan(loanId, raw, loanRepays);
      });

      const activeLoansDocs = loansList.filter((l) => {
        const s = (l.status || '').toUpperCase();
        const pending = Number(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0));
        return s === 'ACTIVE' && pending > 0;
      });
      const sumCalculatedLoans = activeLoansDocs.reduce((acc, l) => {
        const pending = Number(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0));
        return acc + pending;
      }, 0);

      const activeLoans = sumCalculatedLoans;
      const activeLoansCount = activeLoansDocs.length;
      const totalPrincipalRepaid = loansList.reduce((acc, l) => acc + (l.totalPrincipalPaid || l.total_principal_paid || 0), 0);

      // 4. Total Interest Earned (from contributions + loan repayments minus settled member interest)
      const interestFromContributions = contributionsList.reduce((sum, c) => sum + (c.interestAmount || c.interest || 0), 0);
      let interestFromLoans = loansList.reduce((sum, l) => sum + (l.totalInterestPaid || l.total_interest_paid || 0), 0);

      // Include standalone repayments not directly matched to a loan document
      const matchedLoanIds = new Set(loansList.map((l) => l.id).concat(loansList.map((l) => l.loanId)));
      const orphanRepaymentsInterest = repaymentsList
        .filter((r) => {
          const lId = r.loanId || r.loan_id;
          return !lId || !matchedLoanIds.has(lId);
        })
        .reduce((s, r) => s + Number(r.interestAmount || r.interestPaid || r.interest_amount || 0), 0);

      interestFromLoans += orphanRepaymentsInterest;

      const totalSettledInterest = settlementsSnap.docs.reduce((sum, d) => {
        const data = d.data() || {};
        const st = (data.status || '').toUpperCase();
        if (st && st !== 'COMPLETED') return sum;
        return sum + Number(data.interestShare || data.interest_share || 0);
      }, 0);
      const calculatedInterest = Math.max(0, Math.round((interestFromContributions + interestFromLoans - totalSettledInterest) * 100) / 100);
      const totalInterest = calculatedInterest;

      // 5. Exact Mathematical Invariants:
      // totalGroupFund = memberContributions + totalInterest
      const totalGroupFund = totalSavings + totalInterest;

      // availableBalance = totalGroupFund - activeLoans
      const availableBalance = Math.max(0, totalGroupFund - activeLoans);

      // 5. Member metrics (strictly regular group members)
      const totalMembers = regularMemberDocs.length || group.totalMembers || group.total_members || 0;
      const activeMembers = regularMemberDocs.length > 0
        ? regularMemberDocs.filter((d) => (d.data().status || 'active').toLowerCase() === 'active').length
        : totalMembers;

      // 6. Member Personal Summary (if memberId provided)
      let memberSummary = null;
      if (memberId) {
        const contributionsList = contributionsSnap.docs.map((d) => normalizeSavings(d.id, d.data()));
        const myContributions = contributionsList.filter(
          (c) => c.memberId === memberId || c.member_id === memberId
        );
        const mySavings = myContributions.reduce((acc, c) => acc + (c.paidAmount || c.amount || 0), 0);
        const myInterestPaid = myContributions.reduce((acc, c) => acc + (c.interestAmount || c.interest || 0), 0);

        const myLoans = loansList.filter(
          (l) => (l.memberId === memberId || l.member_id === memberId) && (l.status || '').toUpperCase() === 'ACTIVE'
        );
        const myLoanOutstanding = myLoans.reduce((acc, l) => {
          const pending = Number(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0));
          return acc + pending;
        }, 0);

        memberSummary = {
          mySavings,
          myLoanOutstanding,
          myActiveLoansCount: myLoans.length,
          myInterestPaid,
        };
      }

      return {
        success: true,
        summary: {
          groupName,
          groupCode,
          memberContributions,
          totalSavings,
          totalSettledSavings,
          total_settled_savings: totalSettledSavings,
          totalGroupFund,
          activeLoans,
          activeLoansCount,
          totalInterest,
          totalPrincipalRepaid,
          availableBalance,
          totalMembers,
          activeMembers,
          monthlyHaftaDay: group.monthlyHaftaDay || 10,
          monthly_hafta_day: group.monthly_hafta_day || 10,
        },
        memberSummary,
      };
    } catch (err) {
      console.error('Failed to compute dashboard summary from Firestore:', err);
      return {
        success: false,
        summary: {
          groupName: 'Chhatrapati Bachat Gat',
          groupCode: DEFAULT_GROUP_ID,
          totalGroupFund: 0,
          totalSavings: 0,
          activeLoans: 0,
          activeLoansCount: 0,
          totalInterest: 0,
          totalPrincipalRepaid: 0,
          availableBalance: 0,
          totalMembers: 0,
          activeMembers: 0,
        },
        memberSummary: {
          mySavings: 0,
          myLoanOutstanding: 0,
          myActiveLoansCount: 0,
          myInterestPaid: 0,
        },
      };
    }
  },

  getDashboardSummary: async (groupId = DEFAULT_GROUP_ID, memberId = null) => {
    return dashboardService.getSummary(groupId, memberId);
  },

  /**
   * Get Monthly collection progress against target (auto-calculated dynamically from settings & members)
   */
  getMonthlyProgress: async (
    month = new Date().getMonth() + 1,
    year = new Date().getFullYear(),
    groupId = DEFAULT_GROUP_ID
  ) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const m = parseInt(month, 10) || (new Date().getMonth() + 1);
      const y = parseInt(year, 10) || new Date().getFullYear();

      // Read collections directly for target group
      const [membersSnap, contributionsSnap, groupDocSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
        getDoc(doc(db, 'groups', targetGroupId)).catch(() => null),
      ]);

      const monthlyShare = Number(
        groupDocSnap?.data()?.monthly_contribution_per_share ??
        groupDocSnap?.data()?.monthlyContributionPerShare ??
        groupDocSnap?.data()?.monthlyContribution ??
        groupDocSnap?.data()?.monthly_contribution ??
        groupDocSnap?.data()?.monthlyContributionAmount ??
        groupDocSnap?.data()?.monthlyShare ??
        groupDocSnap?.data()?.monthly_share ??
        1000
      );
      const regularMemberDocs = (membersSnap && membersSnap.docs)
        ? membersSnap.docs.filter((d) => isRegularMember({ id: d.id, ...d.data() }))
        : [];
      const allMembers = regularMemberDocs.map((d) => normalizeMember(d.id, d.data()));
      const activeMembers = allMembers.filter((mem) => {
        const s = (mem.status || 'ACTIVE').toUpperCase();
        return mem.isActive !== false && s === 'ACTIVE';
      });

      const allContributions = contributionsSnap.docs.map((d) => normalizeSavings(d.id, d.data()));

      // 1. Calculate canonical monthly summary via single source of truth
      const summary = calculateMonthlyMemberStatuses({
        activeMembers,
        payments: allContributions,
        selectedMonth: m,
        selectedYear: y,
        monthlyShare,
      });

      const groupRaw = groupDocSnap?.exists() ? groupDocSnap.data() : {};
      const monthlyHaftaDay = parseInt(groupRaw.monthly_hafta_day ?? groupRaw.monthlyHaftaDay ?? 10, 10) || 10;

      return {
        success: true,
        progress: {
          month: m,
          year: y,
          totalMembers: summary.totalMembers,
          totalActiveMembers: summary.totalMembers,
          totalEligibleMembers: summary.totalMembers,
          paidMembers: summary.paidCount,
          membersPaid: summary.paidCount,
          pendingMembers: summary.pendingMembers,
          pendingMembersCount: summary.pendingCount,
          monthlyShare,
          monthlyHaftaDay,
          monthly_hafta_day: monthlyHaftaDay,
          monthlyTarget: summary.monthlyTarget,
          targetAmount: summary.monthlyTarget,
          collectedAmount: summary.collectedAmount,
          expectedPending: summary.expectedPending,
          expectedPendingAmount: summary.expectedPending,
          progressPercentage: summary.progressPercentage,
          completionPercentage: summary.completionPercentage,
          monthlyStatuses: summary.monthlyStatuses,
        },
      };
    } catch (err) {
      console.error('Failed to get monthly progress:', err);
      const m = parseInt(month, 10) || (new Date().getMonth() + 1);
      const y = parseInt(year, 10) || new Date().getFullYear();
      return {
        success: true,
        progress: {
          month: m,
          year: y,
          totalMembers: 0,
          totalActiveMembers: 0,
          totalEligibleMembers: 0,
          paidMembers: 0,
          membersPaid: 0,
          pendingMembers: [],
          pendingMembersCount: 0,
          monthlyShare: 1000,
          monthlyTarget: 0,
          targetAmount: 0,
          collectedAmount: 0,
          expectedPending: 0,
          expectedPendingAmount: 0,
          progressPercentage: 0,
          completionPercentage: 0,
          monthlyStatuses: [],
        },
      };
    }
  },

  /**
   * Get recent activities from Firestore subcollection
   */
  getRecentActivities: async (limitCount = 8, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const [activitiesSnap, membersSnap, contribSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'activities')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
      ]);

      const membersMap = {};
      membersSnap.docs.forEach((d) => {
        const data = d.data();
        const mName = data.name || data.fullName || data.full_name || '';
        membersMap[d.id] = mName;
        if (data.memberId) membersMap[data.memberId] = mName;
        if (data.userId) membersMap[data.userId] = mName;
        if (data.authUid) membersMap[data.authUid] = mName;
      });

      const contribMap = {};
      contribSnap.docs.forEach((d) => {
        const c = d.data();
        contribMap[d.id] = c;
        if (c.id) contribMap[c.id] = c;
        if (c.contribId) contribMap[c.contribId] = c;
      });

      let activities = activitiesSnap.docs
        .map((d) => {
          const raw = d.data();
          const norm = normalizeActivity(d.id, raw);
          const resolvedMemberName = norm.memberName || raw.memberName || raw.member_name || membersMap[norm.memberId] || membersMap[raw.member_id] || membersMap[raw.userId] || membersMap[raw.authUid] || '';
          
          let month = norm.month || raw.month || raw.contributionMonth;
          let year = norm.year || raw.year || raw.contributionYear;
          if ((!month || !year) && norm.referenceId && contribMap[norm.referenceId]) {
            month = contribMap[norm.referenceId].month;
            year = contribMap[norm.referenceId].year;
          }
          if ((!month || !year) && (norm.type === 'SAVING' || norm.type === 'SAVINGS' || norm.type === 'MONTHLYINVESTMENT' || (norm.description && (norm.description.toLowerCase().includes('saving') || norm.description.includes('मासिक बचत'))))) {
            const memId = norm.memberId || raw.memberId || raw.member_id;
            if (memId) {
              const matchingContribs = contribSnap.docs
                .map(cd => cd.data())
                .filter(c => (c.memberId === memId || c.member_id === memId));
              if (matchingContribs.length === 1) {
                month = matchingContribs[0].month;
                year = matchingContribs[0].year;
              } else if (matchingContribs.length > 1) {
                const byAmt = matchingContribs.find(c => Number(c.paidAmount || c.amount || c.regularHaftaAmount) === Number(norm.amount));
                if (byAmt) {
                  month = byAmt.month;
                  year = byAmt.year;
                } else {
                  month = matchingContribs[0].month;
                  year = matchingContribs[0].year;
                }
              }
            }
          }

          return {
            ...norm,
            memberName: resolvedMemberName,
            month: month ? Number(month) : undefined,
            year: year ? Number(year) : undefined,
          };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      // If activities collection is empty, fallback to recent contributions, loans, and repayments
      if (activities.length === 0) {
        const [loansSnap, repaySnap] = await Promise.all([
          getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'groups', targetGroupId, 'repayments')).catch(() => ({ docs: [] })),
        ]);

        const fallbackItems = [];

        contribSnap.docs.forEach((d) => {
          const c = d.data();
          if (c.paidAmount > 0 || c.amount > 0 || c.status === 'PAID') {
            const mId = c.memberId || c.member_id || '';
            const mName = c.memberName || c.member_name || membersMap[mId] || '';
            const amt = Number(c.paidAmount || c.amount || 0);
            fallbackItems.push({
              id: d.id,
              type: 'SAVING',
              amount: amt,
              description: `Monthly savings ₹${amt} received from ${mName}`,
              date: c.paymentDate || c.payment_date || c.createdAt || new Date().toISOString(),
              created_at: c.paymentDate || c.payment_date || c.createdAt || new Date().toISOString(),
              memberId: mId,
              memberName: mName,
              referenceId: d.id,
              month: Number(c.month),
              year: Number(c.year),
            });
          }
        });

        loansSnap.docs.forEach((d) => {
          const l = d.data();
          const mId = l.memberId || l.member_id || '';
          const mName = l.memberName || l.member_name || membersMap[mId] || '';
          const amt = Number(l.originalPrincipal || l.principalAmount || 0);
          fallbackItems.push({
            id: d.id,
            type: 'LOAN',
            amount: amt,
            description: `Loan of ₹${amt} approved for ${mName}`,
            date: l.issueDate || l.loanDate || l.loan_date || l.createdAt || new Date().toISOString(),
            created_at: l.issueDate || l.loanDate || l.loan_date || l.createdAt || new Date().toISOString(),
            memberId: mId,
            memberName: mName,
          });
        });

        repaySnap.docs.forEach((d) => {
          const r = d.data();
          const mId = r.memberId || r.member_id || '';
          const mName = r.memberName || r.member_name || membersMap[mId] || '';
          const amt = Number(r.amount || r.totalPayment || r.totalPaid || 0);
          fallbackItems.push({
            id: d.id,
            type: 'REPAYMENT',
            amount: amt,
            description: `Loan repayment ₹${amt} received from ${mName}`,
            date: r.paymentDate || r.payment_date || r.paidAt || r.createdAt || new Date().toISOString(),
            created_at: r.paymentDate || r.payment_date || r.paidAt || r.createdAt || new Date().toISOString(),
            memberId: mId,
            memberName: mName,
          });
        });

        fallbackItems.sort((a, b) => new Date(b.date) - new Date(a.date));
        activities = fallbackItems;
      }

      return {
        success: true,
        activities: activities.slice(0, limitCount),
      };
    } catch (err) {
      console.error('Failed to get recent activities:', err);
      return { success: true, activities: [] };
    }
  },

  /**
   * Subscribe to Real-Time Dashboard Updates across all collections
   */
  subscribeToDashboard: (groupId, memberId, callback) => {
    const targetGroupId = groupId || DEFAULT_GROUP_ID;

    let debounceTimer = null;
    const triggerUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        dashboardService.getSummary(targetGroupId, memberId).then((res) => {
          if (res.success) callback(res);
        });
      }, 50);
    };

    // Listen to the main group document
    const unsubGroup = onSnapshot(doc(db, 'groups', targetGroupId), triggerUpdate, (err) => console.warn('Group listener error:', err));
    // Listen to members collection
    const unsubMembers = onSnapshot(collection(db, 'groups', targetGroupId, 'members'), triggerUpdate, (err) => console.warn('Members listener error:', err));
    // Listen to monthly contributions collection
    const unsubContrib = onSnapshot(collection(db, 'groups', targetGroupId, 'monthly_contributions'), triggerUpdate, (err) => console.warn('Contributions listener error:', err));
    // Listen to loans collection
    const unsubLoans = onSnapshot(collection(db, 'groups', targetGroupId, 'loans'), triggerUpdate, (err) => console.warn('Loans listener error:', err));
    // Listen to repayments collection
    const unsubRepay = onSnapshot(collection(db, 'groups', targetGroupId, 'repayments'), triggerUpdate, (err) => console.warn('Repayments listener error:', err));
    // Listen to activities collection
    const unsubActivities = onSnapshot(collection(db, 'groups', targetGroupId, 'activities'), triggerUpdate, (err) => console.warn('Activities listener error:', err));
    // Listen to settlements collection
    const unsubSettlements = onSnapshot(collection(db, 'groups', targetGroupId, 'settlements'), triggerUpdate, (err) => console.warn('Settlements listener error:', err));

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubGroup();
      unsubMembers();
      unsubContrib();
      unsubLoans();
      unsubRepay();
      unsubActivities();
      unsubSettlements();
    };
  },
};
