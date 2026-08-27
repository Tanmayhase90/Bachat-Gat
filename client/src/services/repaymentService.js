import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { loanService } from './loanService';

export const repaymentService = {
  /**
   * Get all repayments across all loans with member and loan info
   */
  getAllRepayments: async () => {
    try {
      const [repaymentsSnap, membersSnap, loansSnap] = await Promise.all([
        getDocs(collection(db, 'repayments')),
        getDocs(collection(db, 'members')),
        getDocs(collection(db, 'loans')),
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
          amount: parseFloat(data.amount || data.total_repayment) || 0,
          principal_amount: parseFloat(data.principalAmount || data.principal_repayment_amount) || 0,
          interest_amount: parseFloat(data.interestAmount || data.interest_amount) || 0,
          regular_hafta_amount: parseFloat(data.regularHaftaAmount || data.regular_hafta_amount) || 0,
          payment_month: parseInt(data.paymentMonth || data.payment_month, 10),
          payment_year: parseInt(data.paymentYear || data.payment_year, 10),
          payment_date: data.paidAt || data.paymentDate || data.payment_date || new Date().toISOString().split('T')[0],
          payment_mode: data.paymentMode || data.payment_mode || 'UPI',
          remarks: data.remarks || '',
          created_at: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
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
  recordRepayment: async (loanId, data) => {
    return await loanService.recordRepayment(loanId, data);
  },

  /**
   * Subscribe to repayments in real-time
   */
  subscribeToRepayments: (callback) => {
    return onSnapshot(collection(db, 'repayments'), () => {
      repaymentService.getAllRepayments().then((res) => {
        if (res.success) callback(res.repayments);
      });
    });
  },
};
