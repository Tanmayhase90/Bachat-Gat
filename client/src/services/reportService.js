import {
  collection,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { groupService } from './groupService';
import {
  normalizeSavings,
  normalizeLoan,
  normalizeMember,
  isRegularMember,
  compareMemberNumericOrder,
  DEFAULT_GROUP_ID,
} from '../utils/formatters';

export const reportService = {
  /**
   * Monthly Financial and Member Collection Report
   */
  getMonthlyReport: async (month, year, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const m = parseInt(month, 10) || (new Date().getMonth() + 1);
      const y = parseInt(year, 10) || new Date().getFullYear();

      const [contributionsSnap, loansSnap, repaymentsSnap, membersSnap, groupSnap, settlementsSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'repayments')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
        getDoc(doc(db, 'groups', targetGroupId)).catch(() => null),
        getDocs(collection(db, 'groups', targetGroupId, 'settlements')).catch(() => ({ docs: [] })),
      ]);

      const rawGroup = groupSnap?.exists() ? groupSnap.data() : {};
      const monthlyContributionPerShare = Number(
        rawGroup.monthly_contribution_per_share ??
        rawGroup.monthlyContributionPerShare ??
        rawGroup.monthlyContribution ??
        rawGroup.monthly_contribution ??
        rawGroup.monthlyShare ??
        rawGroup.monthly_share ??
        rawGroup.monthlyContributionAmount ??
        0
      );

      // Map active member payment statuses (strictly regular group members)
      const regularMemberDocs = membersSnap.docs.filter((d) => isRegularMember({ id: d.id, ...d.data() }));
      const allMembers = regularMemberDocs.map((d) => normalizeMember(d.id, d.data()));
      const activeMembers = allMembers.filter((mem) => {
        const s = (mem.status || 'ACTIVE').toUpperCase();
        return mem.isActive !== false && s === 'ACTIVE';
      });

      // Sort members in ascending numerical order by Member ID / Member Code (e.g. M_1, M_2 ... M_10 ... M_365)
      activeMembers.sort(compareMemberNumericOrder);

      // Dynamically auto-calculate monthly target from active members (Total Member Shares * Monthly Contribution Per Share)
      const monthlyTarget = activeMembers.reduce(
        (sum, mem) => sum + (Number(mem.shares || mem.shareCount || 1) * monthlyContributionPerShare),
        0
      );

      // Filter contributions for selected month and year
      const monthContributions = contributionsSnap.docs
        .map((d) => normalizeSavings(d.id, d.data()))
        .filter((s) => s.month === m && s.year === y);

      const repaymentsList = repaymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const repaymentsByLoan = {};
      repaymentsList.forEach((r) => {
        const lId = r.loanId || r.loan_id;
        if (lId) {
          if (!repaymentsByLoan[lId]) repaymentsByLoan[lId] = [];
          repaymentsByLoan[lId].push(r);
        }
      });

      // Repayments in selected month and year
      const monthRepayments = repaymentsList.filter((r) => {
        const rMonth = Number(r.month || r.paymentMonth || r.payment_month || 0);
        const rYear = Number(r.year || r.paymentYear || r.payment_year || 0);
        if (rMonth === m && rYear === y) return true;
        const d = r.paymentDate || r.paidAt || r.payment_date;
        if (d) {
          const dt = new Date(d);
          return (dt.getMonth() + 1) === m && dt.getFullYear() === y;
        }
        return false;
      });

      const monthRepaymentsInterest = monthRepayments.reduce(
        (acc, r) => acc + Number(r.interestAmount || r.interestPaid || r.interest_amount || 0),
        0
      );
      const monthRepaymentsPrincipal = monthRepayments.reduce(
        (acc, r) => acc + Number(r.principalAmount || r.principalPaid || r.principalRepaid || r.principal_repayment_amount || 0),
        0
      );

      const totalSavingsCollected = monthContributions.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
      const totalInterestCollected = Math.round(
        (monthContributions.reduce((acc, s) => acc + (s.interestAmount || 0), 0) + monthRepaymentsInterest) * 100
      ) / 100;
      const totalPrincipalRepaid = monthContributions.reduce((acc, s) => acc + (s.loanPrincipalPaid || 0), 0) + monthRepaymentsPrincipal;
      const totalRevenueCollected = totalSavingsCollected + totalInterestCollected;

      // Active loans outstanding calculation
      const loansList = loansSnap.docs.map((d) => {
        const lRepays = repaymentsByLoan[d.id] || repaymentsByLoan[d.data().loanId] || [];
        return normalizeLoan(d.id, d.data(), lRepays);
      });

      const activeLoansDocs = loansList.filter((l) => {
        const s = (l.status || '').toUpperCase();
        const pending = Number(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0));
        return s === 'ACTIVE' && pending > 0;
      });
      const outstandingPrincipal = activeLoansDocs.reduce((acc, l) => {
        const pending = Number(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0));
        return acc + pending;
      }, 0);

      // Centralized Group Balances dynamically aggregated from all contributions and repayments
      const allSavings = contributionsSnap.docs.map((d) => normalizeSavings(d.id, d.data()));
      const totalSavings = allSavings.filter((c) => c.isPaid || c.paidAmount > 0).reduce((sum, c) => sum + (c.paidAmount || c.amount || 0), 0);

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
      const availableGroupBalance = Math.max(0, totalSavings + totalInterest - outstandingPrincipal);

      const paidMap = {};
      monthContributions.forEach((s) => {
        paidMap[s.memberId] = s;
      });

      // Map loans and month repayments by member
      const loansByMember = {};
      loansList.forEach((l) => {
        const mId = l.memberId || l.member_id;
        if (mId) {
          if (!loansByMember[mId]) loansByMember[mId] = [];
          loansByMember[mId].push(l);
        }
      });

      const repaymentsByMember = {};
      monthRepayments.forEach((r) => {
        const mId = r.memberId || r.member_id;
        if (mId) {
          if (!repaymentsByMember[mId]) repaymentsByMember[mId] = [];
          repaymentsByMember[mId].push(r);
        }
      });

      const memberCollections = activeMembers.map((mem) => {
        const savingRecord = paidMap[mem.id] || null;
        const memberShares = Number(mem.shares || mem.shareCount || 1);
        const memberMonthlySavings = memberShares * monthlyContributionPerShare;
        const paidSavings = savingRecord ? Number(savingRecord.paidAmount || 0) : 0;

        const mLoans = loansByMember[mem.id] || [];
        const mRepayments = repaymentsByMember[mem.id] || [];

        const loanPrincipal = mLoans.reduce((sum, l) => sum + Number(l.originalPrincipal || l.principalAmount || 0), 0);
        const outstandingLoan = mLoans.filter((l) => (l.status || '').toUpperCase() === 'ACTIVE').reduce(
          (sum, l) => sum + Number(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0)),
          0
        );

        const principalRepaid = mRepayments.reduce(
          (sum, r) => sum + Number(r.principalPaid || r.principalAmount || r.principalRepaid || r.principal_repayment_amount || 0),
          0
        ) + Number(savingRecord?.loanPrincipalPaid || 0);

        const interestPaid = mRepayments.reduce(
          (sum, r) => sum + Number(r.interestPaid || r.interestAmount || r.interest_paid || r.interest_amount || 0),
          0
        ) + Number(savingRecord?.interestAmount || 0);

        const totalPayment = paidSavings + principalRepaid + interestPaid;

        const paymentDate = savingRecord?.paymentDate || savingRecord?.payment_date || mRepayments[0]?.paymentDate || mRepayments[0]?.paidAt || mRepayments[0]?.payment_date || null;
        const paymentMode = savingRecord?.paymentMode || savingRecord?.payment_mode || mRepayments[0]?.paymentMode || mRepayments[0]?.payment_mode || 'UPI';

        const pendingHafta = Math.max(0, memberMonthlySavings - paidSavings);
        const pendingLoan = outstandingLoan;
        const pendingAmount = pendingLoan + pendingHafta;

        return {
          id: mem.id,
          member_id: mem.id,
          memberId: mem.id,
          member_name: mem.name || mem.fullName,
          memberName: mem.name || mem.fullName,
          member_code: mem.memberCode || mem.member_code || mem.id,
          memberCode: mem.memberCode || mem.member_code || mem.id,
          phone: mem.phone || '',
          shares: memberShares,
          shareCount: memberShares,
          expected_amount: memberMonthlySavings,
          expectedAmount: memberMonthlySavings,
          monthly_contribution: memberMonthlySavings,
          monthlyContribution: memberMonthlySavings,
          monthly_savings: memberMonthlySavings,
          monthlySavings: memberMonthlySavings,
          savings_amount: memberMonthlySavings,
          savingsAmount: memberMonthlySavings,
          paid_amount: paidSavings,
          paidAmount: paidSavings,
          loan_principal: loanPrincipal,
          loanPrincipal: loanPrincipal,
          interest_paid: interestPaid,
          interestPaid: interestPaid,
          interest_amount: interestPaid,
          interestAmount: interestPaid,
          principal_repaid: principalRepaid,
          principalRepaid: principalRepaid,
          total_payment: totalPayment,
          totalPayment: totalPayment,
          amount: totalPayment,
          outstanding_loan: outstandingLoan,
          outstandingLoan: outstandingLoan,
          pending_hafta: pendingHafta,
          pendingHafta: pendingHafta,
          pending_loan: pendingLoan,
          pendingLoan: pendingLoan,
          pending_amount: pendingAmount,
          pendingAmount: pendingAmount,
          month: m,
          year: y,
          status: paidSavings >= memberMonthlySavings
            ? 'PAID'
            : paidSavings > 0
            ? 'PARTIAL'
            : 'PENDING',
          payment_date: paymentDate,
          paymentDate: paymentDate,
          payment_mode: paymentMode,
          paymentMode: paymentMode,
        };
      });

      const totalPaidMembers = memberCollections.filter((m) => {
        const pAmt = m.paid_amount !== undefined ? m.paid_amount : (m.paidAmount || 0);
        const exp = Number(m.expected_amount || m.expectedAmount || 0);
        return pAmt >= exp;
      }).length;

      const totalPendingMembers = memberCollections.filter((m) => {
        const pAmt = m.paid_amount !== undefined ? m.paid_amount : (m.paidAmount || 0);
        const exp = Number(m.expected_amount || m.expectedAmount || 0);
        return pAmt < exp;
      }).length;

      return {
        success: true,
        summary: {
          month: m,
          year: y,
          monthSavings: totalSavingsCollected,
          totalSavingsCollected,
          monthInterest: totalInterestCollected,
          totalInterestCollected,
          totalPrincipalRepaid,
          totalRevenueCollected,
          outstandingPrincipal,
          availableGroupBalance,
          monthlyTarget,
          monthlyContributionPerShare,
          monthly_contribution_per_share: monthlyContributionPerShare,
          targetAchievement: monthlyTarget > 0 ? Math.round((totalSavingsCollected / monthlyTarget) * 100) : 0,
          totalActiveMembers: activeMembers.length,
          totalPaidMembers,
          totalPendingMembers,
        },
        collections: memberCollections,
        savingsTransactions: monthContributions.filter((c) => c.paidAmount > 0),
      };
    } catch (err) {
      console.error('Failed to generate monthly report from Firestore:', err);
      return {
        success: true,
        summary: {
          month: month || (new Date().getMonth() + 1),
          year: year || new Date().getFullYear(),
          monthSavings: 0,
          totalSavingsCollected: 0,
          monthInterest: 0,
          totalInterestCollected: 0,
          totalPrincipalRepaid: 0,
          totalRevenueCollected: 0,
          outstandingPrincipal: 0,
          availableGroupBalance: 0,
          monthlyTarget: 0,
          targetAchievement: 0,
          totalActiveMembers: 0,
          totalPaidMembers: 0,
          totalPendingMembers: 0,
        },
        collections: [],
        savingsTransactions: [],
      };
    }
  },

  /**
   * Pending Dues / Defaulters Report
   */
  getPendingDuesReport: async (month, year, search = '', groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const m = parseInt(month, 10) || (new Date().getMonth() + 1);
      const y = parseInt(year, 10) || new Date().getFullYear();

      const [contributionsSnap, loansSnap, membersSnap, groupSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
        getDoc(doc(db, 'groups', targetGroupId)).catch(() => null),
      ]);

      const rawGroup = groupSnap?.exists() ? groupSnap.data() : {};
      const monthlyContributionPerShare = Number(
        rawGroup.monthly_contribution_per_share ??
        rawGroup.monthlyContributionPerShare ??
        rawGroup.monthlyContribution ??
        rawGroup.monthly_contribution ??
        rawGroup.monthlyShare ??
        rawGroup.monthly_share ??
        rawGroup.monthlyContributionAmount ??
        0
      );

      const monthContributions = contributionsSnap.docs
        .map((d) => normalizeSavings(d.id, d.data()))
        .filter((s) => s.month === m && s.year === y);

      const paidMemberIds = new Set(
        monthContributions.filter((s) => s.paidAmount > 0 || s.isPaid).map((s) => s.memberId)
      );

      const regularMemberDocs = membersSnap.docs.filter((d) => isRegularMember({ id: d.id, ...d.data() }));
      const allMembers = regularMemberDocs.map((d) => normalizeMember(d.id, d.data()));
      const activeMembers = allMembers.filter((mem) => mem.isActive);
      const allLoans = loansSnap.docs.map((d) => normalizeLoan(d.id, d.data()));

      let pending = activeMembers
        .filter((mem) => !paidMemberIds.has(mem.id))
        .map((mem) => {
          const memberLoans = allLoans.filter((l) => l.memberId === mem.id && l.status === 'ACTIVE');
          const loanOutstanding = memberLoans.reduce((sum, l) => sum + (l.pendingPrincipal || 0), 0);
          const loanInterestRate = memberLoans.length > 0 ? (memberLoans[0].interestRate || 2.0) : 2.0;
          const pendingInterest = (loanOutstanding * loanInterestRate) / 100;
          const memberShares = Number(mem.shares || mem.shareCount || 1);
          const hafta = memberShares * monthlyContributionPerShare;
          const totalPending = hafta + loanOutstanding + pendingInterest;

          return {
            id: mem.id,
            member_id: mem.id,
            memberId: mem.id,
            member_name: mem.name || mem.fullName,
            memberName: mem.name || mem.fullName,
            member_code: mem.memberCode,
            memberCode: mem.memberCode,
            memberPhone: mem.phone || '',
            phone: mem.phone || '',
            shares: memberShares,
            shareCount: memberShares,
            monthly_contribution: hafta,
            monthlyContribution: hafta,
            monthly_savings: hafta,
            monthlySavings: hafta,
            pendingHafta: hafta,
            outstandingPrincipal: loanOutstanding,
            pendingInterest: Math.round(pendingInterest * 100) / 100,
            interestRate: loanInterestRate,
            due_amount: totalPending,
            totalPending: Math.round(totalPending * 100) / 100,
            status: 'UNPAID',
          };
        });

      if (search) {
        const s = search.toLowerCase();
        pending = pending.filter(
          (p) => p.memberName.toLowerCase().includes(s) || p.memberCode.toLowerCase().includes(s) || p.phone.includes(s)
        );
      }

      // Sort pending in ascending numerical order by Member ID / Member Code (e.g. M_1, M_2 ... M_9, M_10 ... M_365)
      pending.sort(compareMemberNumericOrder);

      const totalPendingAmount = pending.reduce((acc, p) => acc + (p.totalPending || 0), 0);

      return {
        success: true,
        count: pending.length,
        totalPendingAmount,
        summary: {
          totalPendingMembers: pending.length,
          totalPendingAmount,
        },
        pendingMembers: pending,
        duesList: pending,
      };
    } catch (err) {
      console.error('Failed to generate pending dues report:', err);
      return {
        success: true,
        count: 0,
        totalPendingAmount: 0,
        summary: {
          totalPendingMembers: 0,
          totalPendingAmount: 0,
        },
        pendingMembers: [],
        duesList: [],
      };
    }
  },

  /**
   * Loans Portfolio and Risk Overview Report
   */
  getLoansOverviewReport: async (groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;

      const [loansSnap, repaymentsSnap, membersSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'repayments')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
      ]);

      const membersMap = {};
      membersSnap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        membersMap[docSnap.id] = d.name || d.fullName || 'Member';
        if (d.userId) membersMap[d.userId] = d.name || d.fullName || 'Member';
        if (d.authUid) membersMap[d.authUid] = d.name || d.fullName || 'Member';
      });

      const repaymentsList = repaymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const repaymentsByLoan = {};
      repaymentsList.forEach((r) => {
        const lId = r.loanId || r.loan_id;
        if (lId) {
          if (!repaymentsByLoan[lId]) repaymentsByLoan[lId] = [];
          repaymentsByLoan[lId].push(r);
        }
      });

      const loans = loansSnap.docs.map((docSnap) => {
        const raw = docSnap.data();
        const lRepays = repaymentsByLoan[docSnap.id] || repaymentsByLoan[raw.loanId] || [];
        const normalized = normalizeLoan(docSnap.id, raw, lRepays);
        const memberName = membersMap[normalized.memberId] || normalized.memberName;

        return {
          ...normalized,
          member_name: memberName,
          memberName: memberName,
          repayments_count: lRepays.length,
        };
      });

      const activeLoans = loans.filter((l) => l.status === 'ACTIVE');
      const closedLoans = loans.filter((l) => l.status === 'CLOSED');

      const totalPrincipalDisbursed = loans.reduce((acc, l) => acc + (l.originalPrincipal || 0), 0);
      const totalOutstanding = activeLoans.reduce((acc, l) => acc + (l.pendingPrincipal || 0), 0);
      const totalPrincipalRecovered = loans.reduce((acc, l) => acc + (l.totalPrincipalPaid || 0), 0);
      const totalInterestEarned = loans.reduce((acc, l) => acc + (l.totalInterestPaid || 0), 0);

      return {
        success: true,
        summary: {
          totalLoans: loans.length,
          totalLoansCount: loans.length,
          activeLoansCount: activeLoans.length,
          closedLoansCount: closedLoans.length,
          totalPrincipalDisbursed,
          totalOutstanding,
          totalPrincipalRecovered,
          totalPrincipalCollected: totalPrincipalRecovered,
          totalInterestEarned,
          totalInterestCollected: totalInterestEarned,
        },
        loans,
        activeLoans,
        closedLoans,
      };
    } catch (err) {
      console.error('Failed to generate loans overview report:', err);
      return {
        success: true,
        summary: {
          totalLoans: 0,
          totalLoansCount: 0,
          activeLoansCount: 0,
          closedLoansCount: 0,
          totalPrincipalDisbursed: 0,
          totalOutstanding: 0,
          totalPrincipalRecovered: 0,
          totalPrincipalCollected: 0,
          totalInterestEarned: 0,
          totalInterestCollected: 0,
        },
        loans: [],
        activeLoans: [],
        closedLoans: [],
      };
    }
  },
};
