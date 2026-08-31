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
import { db } from '../config/firebase';
import { groupService } from './groupService';
import { reportService } from './reportService';
import { notificationService } from './notificationService';
import {
  formatCurrency,
  normalizeGroup,
  normalizeMember,
  normalizeSavings,
  normalizeLoan,
  normalizeActivity,
  DEFAULT_GROUP_ID,
  calculateMonthlyMemberStatus,
  calculateMonthlyMemberStatuses,
} from '../utils/formatters';

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
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;

      const [groupRes, contributionsSnap, loansSnap, membersSnap] = await Promise.all([
        groupService.getGroupDetails(targetGroupId),
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
      ]);

      const group = groupRes.group || {};
      const groupName = group.name || group.groupName || 'Chhatrapati Bachat Gat, Ghargaon Stand';
      const groupCode = group.groupCode || targetGroupId;

      // 1. Core Financial Baseline calculated dynamically from real collections
      const contributionsList = contributionsSnap.docs.map((d) => normalizeSavings(d.id, d.data()));
      const liveSavingsTotal = contributionsList
        .filter((c) => c.isPaid || c.paidAmount > 0)
        .reduce((sum, c) => sum + (c.paidAmount || c.amount || 0), 0);

      const memberContributions = liveSavingsTotal;
      const totalSavings = memberContributions;

      // 2. Loans & Repayments calculated dynamically
      const loansList = loansSnap.docs.map((d) => normalizeLoan(d.id, d.data()));
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

      // 3. Total Interest Earned
      const interestFromContributions = contributionsList.reduce((sum, c) => sum + (c.interestAmount || c.interest || 0), 0);
      const interestFromLoans = loansList.reduce((sum, l) => sum + (l.totalInterestPaid || l.total_interest_paid || 0), 0);
      const calculatedInterest = Math.round((interestFromContributions + interestFromLoans) * 100) / 100;
      const totalInterest = calculatedInterest;

      // 4. Exact Mathematical Invariants:
      // totalGroupFund = memberContributions + totalInterest
      const totalGroupFund = totalSavings + totalInterest;

      // availableBalance = totalGroupFund - activeLoans
      const availableBalance = Math.max(0, totalGroupFund - activeLoans);

      // 5. Member metrics
      const totalMembers = membersSnap.size || group.totalMembers || group.total_members || 368;
      const activeMembers = membersSnap.docs && membersSnap.docs.length > 0
        ? membersSnap.docs.filter((d) => (d.data().status || 'active').toLowerCase() === 'active').length
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
          totalGroupFund,
          activeLoans,
          activeLoansCount,
          totalInterest,
          totalPrincipalRepaid,
          availableBalance,
          totalMembers,
          activeMembers,
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

  /**
   * Get Monthly collection progress against target (auto-calculated dynamically from settings & members)
   */
  getMonthlyProgress: async (
    month = new Date().getMonth() + 1,
    year = new Date().getFullYear(),
    groupId = DEFAULT_GROUP_ID
  ) => {
    try {
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
      const m = parseInt(month, 10) || (new Date().getMonth() + 1);
      const y = parseInt(year, 10) || new Date().getFullYear();

      // Read collections directly for target group
      const [membersSnap, contributionsSnap, groupDocSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
        getDoc(doc(db, 'groups', targetGroupId)).catch(() => null),
      ]);

      const monthlyShare = Number(groupDocSnap?.data()?.monthlyContribution ?? groupDocSnap?.data()?.monthly_contribution ?? 1000);
      const allMembers = membersSnap.docs.map((d) => normalizeMember(d.id, d.data()));
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
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
      const activitiesSnap = await getDocs(
        collection(db, 'groups', targetGroupId, 'activities')
      ).catch(() => ({ docs: [] }));

      const activities = activitiesSnap.docs
        .map((d) => normalizeActivity(d.id, d.data()))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

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
    const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;

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

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubGroup();
      unsubMembers();
      unsubContrib();
      unsubLoans();
      unsubRepay();
    };
  },
};
