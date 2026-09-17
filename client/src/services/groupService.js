import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  getDocs,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import {
  normalizeGroup,
  normalizeSavings,
  normalizeLoan,
  isRegularMember,
  DEFAULT_GROUP_ID,
} from '../utils/formatters.js';

export const groupService = {
  /**
   * Recalculates all authoritative group aggregates from Firestore collections and updates groups/{groupId}
   */
  recalculateAndSyncGroupAggregates: async (groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const groupDocRef = doc(db, 'groups', targetGroupId);

      const [groupSnap, membersSnap, contributionsSnap, loansSnap, repaymentsSnap, settlementsSnap] = await Promise.all([
        getDoc(groupDocRef).catch(() => null),
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'repayments')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'settlements')).catch(() => ({ docs: [] })),
      ]);

      const rawGroup = groupSnap?.exists() ? groupSnap.data() : {};

      // 1. Members count & target
      const regularDocs = membersSnap.docs.filter((d) => isRegularMember({ id: d.id, ...d.data() }));
      const totalMembers = regularDocs.length;
      const activeMembers = regularDocs.filter((d) => (d.data().status || 'active').toLowerCase() === 'active').length;

      const monthlyContributionPerShare = Number(
        rawGroup.monthly_contribution_per_share ??
        rawGroup.monthlyContributionPerShare ??
        rawGroup.monthlyContribution ??
        rawGroup.monthly_contribution ??
        rawGroup.monthlyShare ??
        rawGroup.monthly_share ??
        rawGroup.monthlyContributionAmount ??
        1000
      );
      const monthlyTarget = activeMembers * monthlyContributionPerShare;

      // 2. Total Savings
      const allSavings = contributionsSnap.docs.map((d) => normalizeSavings(d.id, d.data()));
      const totalSavings = allSavings
        .filter((c) => c.isPaid || c.paidAmount > 0)
        .reduce((sum, c) => sum + (c.paidAmount || c.amount || 0), 0);

      // 3. Loans & Repayments
      const repaymentsList = repaymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const repaymentsByLoan = {};
      repaymentsList.forEach((r) => {
        const lId = r.loanId || r.loan_id;
        if (lId) {
          if (!repaymentsByLoan[lId]) repaymentsByLoan[lId] = [];
          repaymentsByLoan[lId].push(r);
        }
      });

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
      const activeLoansTotal = activeLoansDocs.reduce((acc, l) => {
        const pending = Number(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0));
        return acc + pending;
      }, 0);
      const activeLoansCount = activeLoansDocs.length;

      // 4. Interest
      let allLoansInterest = loansList.reduce((sum, l) => sum + (l.totalInterestPaid || 0), 0);
      const matchedLoanIds = new Set(loansList.map((l) => l.id).concat(loansList.map((l) => l.loanId)));
      const orphanRepaymentsInterest = repaymentsList
        .filter((r) => {
          const lId = r.loanId || r.loan_id;
          return !lId || !matchedLoanIds.has(lId);
        })
        .reduce((s, r) => s + Number(r.interestAmount || r.interestPaid || r.interest_amount || 0), 0);
      allLoansInterest += orphanRepaymentsInterest;

      const allContributionsInterest = allSavings.reduce((sum, c) => sum + (c.interestAmount || c.interest || 0), 0);
      const totalSettledInterest = settlementsSnap.docs.reduce((sum, d) => sum + Number(d.data().interestShare || d.data().interest_share || 0), 0);

      const totalInterest = Math.max(0, Math.round((allContributionsInterest + allLoansInterest - totalSettledInterest) * 100) / 100);

      const totalGroupFund = totalSavings + totalInterest;
      const availableBalance = Math.max(0, totalGroupFund - activeLoansTotal);

      const updatePayload = {
        totalMembers,
        total_members: totalMembers,
        activeMembers,
        active_members: activeMembers,
        totalSavings,
        total_savings: totalSavings,
        savingsTotal: totalSavings,
        savings_total: totalSavings,
        totalLoans: activeLoansTotal,
        total_loans: activeLoansTotal,
        activeLoans: activeLoansTotal,
        active_loans: activeLoansTotal,
        activeLoansAmount: activeLoansTotal,
        active_loans_amount: activeLoansTotal,
        totalOutstandingLoans: activeLoansTotal,
        total_outstanding_loans: activeLoansTotal,
        activeLoansCount,
        active_loans_count: activeLoansCount,
        totalInterest,
        total_interest: totalInterest,
        totalInterestCollected: totalInterest,
        total_interest_collected: totalInterest,
        interestCollected: totalInterest,
        interest_collected: totalInterest,
        totalFund: totalGroupFund,
        total_fund: totalGroupFund,
        availableBalance,
        available_balance: availableBalance,
        balance: availableBalance,
        totalInterestSettled: totalSettledInterest,
        monthlyTarget,
        monthly_target: monthlyTarget,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(groupDocRef, updatePayload, { merge: true });

      return {
        success: true,
        summary: updatePayload,
      };
    } catch (err) {
      console.error('Error in recalculateAndSyncGroupAggregates:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Get complete group details from Firestore
   */
  getGroupDetails: async (groupId = DEFAULT_GROUP_ID, existingMembersSnap = null) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const groupDocRef = doc(db, 'groups', targetGroupId);
      let [groupDoc, membersSnap] = await Promise.all([
        getDoc(groupDocRef),
        existingMembersSnap ? Promise.resolve(existingMembersSnap) : getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
      ]);

      const rawData = groupDoc.exists() ? groupDoc.data() : {};
      const normalized = normalizeGroup(groupDoc.id || targetGroupId, rawData);

      const regularDocs = (membersSnap && membersSnap.docs)
        ? membersSnap.docs.filter((d) => isRegularMember({ id: d.id, ...d.data() }))
        : [];
      const memberCount = regularDocs.length > 0
        ? regularDocs.length
        : Number(rawData.totalMembers ?? rawData.total_members ?? 0);
      const activeCount = regularDocs.length > 0
        ? regularDocs.filter((d) => (d.data().status || 'active').toLowerCase() === 'active').length
        : Number(rawData.activeMembers ?? rawData.active_members ?? memberCount);

      const monthlyContributionPerShare = Number(
        rawData.monthly_contribution_per_share ??
        rawData.monthlyContributionPerShare ??
        rawData.monthlyContribution ??
        rawData.monthly_contribution ??
        rawData.monthlyShare ??
        rawData.monthly_share ??
        rawData.monthlyContributionAmount ??
        1000
      );

      const monthlyHaftaDay = parseInt(
        rawData.monthly_hafta_day ??
        rawData.monthlyHaftaDay ??
        10,
        10
      ) || 10;

      const calculatedMonthlyTarget = activeCount * monthlyContributionPerShare;

      return {
        success: true,
        group: {
          ...normalized,
          monthly_contribution_per_share: monthlyContributionPerShare,
          monthlyContributionPerShare: monthlyContributionPerShare,
          monthlyContribution: monthlyContributionPerShare,
          monthly_contribution: monthlyContributionPerShare,
          monthlyShare: monthlyContributionPerShare,
          monthly_share: monthlyContributionPerShare,
          monthlyHaftaDay: monthlyHaftaDay,
          monthly_hafta_day: monthlyHaftaDay,
          monthlyTarget: calculatedMonthlyTarget,
          monthly_target: calculatedMonthlyTarget,
          total_members: memberCount,
          total_active_members: activeCount,
          totalMembers: memberCount,
          totalActiveMembers: activeCount,
        },
      };
    } catch (err) {
      console.error('Error fetching group details from Firestore:', err);
      return {
        success: true,
        group: normalizeGroup(DEFAULT_GROUP_ID, {
          name: 'Chhatrapati Bachat Gat, Ghargaon Stand',
          totalSavings: 0,
          totalOutstandingLoans: 0,
          totalFund: 0,
          monthlyContributionAmount: 1000,
          monthlyHaftaDay: 10,
          monthly_hafta_day: 10,
          monthlyTarget: 0,
          total_members: 0,
          total_active_members: 0,
        }),
      };
    }
  },

  /**
   * Update group details in Firestore
   */
  updateGroupDetails: async (groupData, groupId = DEFAULT_GROUP_ID) => {
    const targetGroupId = groupId || DEFAULT_GROUP_ID;
    const groupDocRef = doc(db, 'groups', targetGroupId);
    const updatedName = (groupData.group_name || groupData.groupName || groupData.name || '').trim();
    const monthlyShare = parseFloat(groupData.monthly_contribution_per_share || groupData.monthlyContribution || groupData.monthlyContributionAmount) || 1000;
    const monthlyTarget = parseFloat(groupData.monthly_target || groupData.monthlyTarget) || 0;
    const monthlyHaftaDay = parseInt(groupData.monthly_hafta_day ?? groupData.monthlyHaftaDay ?? 10, 10) || 10;

    const updatePayload = {
      name: updatedName,
      groupName: updatedName,
      group_name: updatedName,
      monthlyContributionAmount: monthlyShare,
      monthlyContribution: monthlyShare,
      monthly_contribution: monthlyShare,
      monthly_contribution_per_share: monthlyShare,
      monthlyShare: monthlyShare,
      monthly_share: monthlyShare,
      monthlyHaftaDay: monthlyHaftaDay,
      monthly_hafta_day: monthlyHaftaDay,
      monthlyTarget: monthlyTarget,
      monthly_target: monthlyTarget,
      description: (groupData.description || '').trim(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(groupDocRef, updatePayload, { merge: true });

    return {
      success: true,
      message: 'Group settings updated successfully',
      group: normalizeGroup(targetGroupId, updatePayload),
    };
  },

  /**
   * Subscribe to real-time group changes
   */
  subscribeToGroup: (callback, groupId = DEFAULT_GROUP_ID) => {
    const targetGroupId = groupId || DEFAULT_GROUP_ID;
    const groupDocRef = doc(db, 'groups', targetGroupId);
    return onSnapshot(groupDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const normalized = normalizeGroup(docSnap.id, docSnap.data());
        callback(normalized);
      }
    });
  },
};
