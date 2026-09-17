import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { loanService } from './loanService.js';
import { DEFAULT_GROUP_ID } from '../utils/formatters.js';

export const repaymentService = {
  /**
   * Get all repayments across all loans with member and loan info
   */
  getAllRepayments: async (groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const [repaymentsSnap, membersSnap, loansSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'repayments')),
        getDocs(collection(db, 'groups', targetGroupId, 'members')),
        getDocs(collection(db, 'groups', targetGroupId, 'loans')),
      ]);

      const membersMap = {};
      membersSnap.docs.forEach((d) => {
        membersMap[d.id] = d.data().fullName || d.data().name || 'Member';
      });

      const loansMap = {};
      loansSnap.docs.forEach((d) => {
        loansMap[d.id] = d.data().loanNumber || d.data().loan_number || 'Loan';
      });

      const repayments = repaymentsSnap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          repayment_id: docSnap.id,
          loan_id: data.loanId || data.loan_id,
          loan_number: loansMap[data.loanId || data.loan_id] || 'Loan',
          member_id: data.memberId || data.member_id,
          member_name: membersMap[data.memberId || data.member_id] || 'Member',
          amount: parseFloat(data.amount || data.totalPaid || data.totalPayment || data.total_repayment || data.total_paid) || 0,
          principal_amount: parseFloat(data.principalPaid || data.principalAmount || data.principalRepaid || data.principal_paid || data.principal_repayment_amount) || 0,
          interest_amount: parseFloat(data.interestPaid || data.interestAmount || data.interest_paid || data.interest_amount || data.interest) || 0,
          regular_hafta_amount: parseFloat(data.regularHafta || data.regularHaftaAmount || data.regularContribution || data.regular_hafta_amount) || 0,
          payment_month: parseInt(data.paymentMonth || data.payment_month || data.month, 10) || (new Date().getMonth() + 1),
          payment_year: parseInt(data.paymentYear || data.payment_year || data.year, 10) || new Date().getFullYear(),
          payment_date: data.paidAt || data.paymentDate || data.payment_date || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString().split('T')[0] : (typeof data.createdAt === 'string' ? data.createdAt.split('T')[0] : new Date().toISOString().split('T')[0])),
          payment_mode: data.paymentMode || data.payment_mode || 'UPI',
          remarks: data.remarks || '',
          created_at: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString()),
        };
      });

      repayments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return {
        success: true,
        count: repayments.length,
        repayments,
      };
    } catch (err) {
      console.error('Failed to get repayments:', err);
      return { success: true, count: 0, repayments: [] };
    }
  },

  /**
   * Get repayments for a specific loan
   */
  getRepaymentsByLoanId: async (loanId) => {
    return await loanService.getLoanRepayments(loanId);
  },

  /**
   * Record a loan repayment
   */
  recordRepayment: async (loanId, data, groupId = DEFAULT_GROUP_ID) => {
    return await loanService.recordRepayment({ ...data, loanId }, groupId);
  },

  /**
   * Subscribe to repayments in real-time
   */
  subscribeToRepayments: (callback, groupId = DEFAULT_GROUP_ID) => {
    const targetGroupId = groupId || DEFAULT_GROUP_ID;
    return onSnapshot(collection(db, 'groups', targetGroupId, 'repayments'), () => {
      repaymentService.getAllRepayments(targetGroupId).then((res) => {
        if (res.success) callback(res.repayments);
      });
    });
  },
};
