import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  normalizeLoan,
  normalizeMember,
  normalizeSavings,
  DEFAULT_GROUP_ID,
} from '../utils/formatters';

export const loanService = {
  /**
   * Get all loans with member info and progress metrics from Flutter subcollections
   */
  getAllLoans: async (params = {}, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;

      const [loansSnap, membersSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
      ]);

      const membersMap = {};
      membersSnap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        membersMap[docSnap.id] = d.name || d.fullName || 'Member';
        if (d.userId) membersMap[d.userId] = d.name || d.fullName || 'Member';
        if (d.authUid) membersMap[d.authUid] = d.name || d.fullName || 'Member';
      });

      const loans = loansSnap.docs.map((docSnap) => {
        const raw = docSnap.data();
        const normalized = normalizeLoan(docSnap.id, raw);
        const memberName = membersMap[normalized.memberId] || normalized.memberName;

        return {
          ...normalized,
          member_name: memberName,
          memberName: memberName,
        };
      });

      let filtered = loans;
      if (params.status) {
        filtered = filtered.filter((l) => l.status === params.status.toUpperCase());
      }
      if (params.memberId) {
        filtered = filtered.filter((l) => l.memberId === params.memberId || l.member_id === params.memberId);
      }
      if (params.search) {
        const s = params.search.toLowerCase();
        filtered = filtered.filter(
          (l) =>
            l.member_name.toLowerCase().includes(s) ||
            l.member_code.toLowerCase().includes(s) ||
            l.loan_number.toLowerCase().includes(s) ||
            l.purpose.toLowerCase().includes(s)
        );
      }

      return {
        success: true,
        count: filtered.length,
        loans: filtered,
      };
    } catch (err) {
      console.error('Failed to get loans from Firestore:', err);
      return { success: true, count: 0, loans: [] };
    }
  },

  /**
   * Get single loan details by ID
   */
  getLoanById: async (loanId, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
      const loanDocRef = doc(db, 'groups', targetGroupId, 'loans', loanId);
      const loanSnap = await getDoc(loanDocRef);

      if (!loanSnap.exists()) {
        throw new Error('Loan profile not found in active Bachat Gat.');
      }

      const raw = loanSnap.data();
      const normalized = normalizeLoan(loanSnap.id, raw);

      // Fetch member info
      let memberName = normalized.memberName;
      let memberCode = normalized.memberCode;
      try {
        const memSnap = await getDoc(doc(db, 'groups', targetGroupId, 'members', normalized.memberId));
        if (memSnap.exists()) {
          const mData = memSnap.data();
          memberName = mData.name || mData.fullName || memberName;
          memberCode = mData.memberCode || mData.member_code || normalized.memberId;
        }
      } catch (e) {
        // fallback
      }

      // Fetch repayments/contributions
      const contributionsSnap = await getDocs(
        collection(db, 'groups', targetGroupId, 'monthly_contributions')
      ).catch(() => ({ docs: [] }));

      const repaymentsList = contributionsSnap.docs
        .map((d) => normalizeSavings(d.id, d.data()))
        .filter((s) => s.memberId === normalized.memberId && (s.loanPrincipalPaid > 0 || s.interestAmount > 0))
        .map((r) => ({
          ...r,
          id: r.id,
          repayment_id: r.id,
          loan_id: loanId,
          loan_number: normalized.loanNumber,
          principal_repayment_amount: r.loanPrincipalPaid,
          principalAmount: r.loanPrincipalPaid,
          interest_amount: r.interestAmount,
          interestAmount: r.interestAmount,
          total_payment: r.loanPrincipalPaid + r.interestAmount,
          payment_date: r.paymentDate,
          payment_mode: r.paymentMode,
          payment_month: r.month,
          payment_year: r.year,
        }));

      const totalPrincipalRepaid = normalized.totalPrincipalPaid;
      const totalInterestPaid = repaymentsList.reduce((acc, r) => acc + (r.interestAmount || 0), 0);

      return {
        success: true,
        loan: {
          ...normalized,
          member_name: memberName,
          memberName: memberName,
          member_code: memberCode,
          memberCode: memberCode,
          total_principal_repaid: totalPrincipalRepaid,
          total_interest_paid: totalInterestPaid,
          totalInterestPaid: totalInterestPaid,
          repayments: repaymentsList,
        },
      };
    } catch (err) {
      console.error('Failed to get loan by ID:', err);
      throw err;
    }
  },

  /**
   * Create & disburse new loan in Firestore (compatible with Flutter schema)
   */
  createLoan: async (loanData, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
      const memberId = loanData.member_id || loanData.memberId;
      const principal = parseFloat(loanData.principal_amount || loanData.principalAmount || loanData.originalPrincipal);
      const interestRate = parseFloat(loanData.interest_rate || loanData.interestRate) || 2.0;
      const purpose = (loanData.purpose || 'General').trim();
      const dateStr = loanData.loan_date || loanData.loanDate || new Date().toISOString();
      const durationMonths = parseInt(loanData.duration_months || loanData.durationMonths, 10) || 12;

      if (!memberId || !Number.isFinite(principal) || principal <= 0) {
        throw new Error('A valid member and principal amount are required.');
      }
      const selectedMemberSnap = await getDoc(doc(db, 'groups', targetGroupId, 'members', memberId));
      if (!selectedMemberSnap.exists() || selectedMemberSnap.data().isActive === false || (selectedMemberSnap.data().status || 'active').toLowerCase() === 'inactive') {
        throw new Error('The selected member is not active or no longer exists.');
      }

      const loanId = `L_${Date.now()}`;
      const loanDocRef = doc(db, 'groups', targetGroupId, 'loans', loanId);

      const loanPayload = {
        id: loanId,
        loanId: loanId,
        groupId: targetGroupId,
        memberId,
        originalPrincipal: principal,
        pendingPrincipal: principal,
        interestRate,
        durationMonths,
        purpose,
        status: 'active',
        issueDate: dateStr,
        loanDate: dateStr,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(loanDocRef, loanPayload);

      // Fetch member name for logging
      let memberName = 'Member';
      try {
        const memSnap = await getDoc(doc(db, 'groups', targetGroupId, 'members', memberId));
        if (memSnap.exists()) memberName = memSnap.data().name || memSnap.data().fullName || 'Member';
      } catch (e) {
        // fallback
      }

      // Log activity
      const actId = `ACT_${Date.now()}_loan`;
      await setDoc(doc(db, 'groups', targetGroupId, 'activities', actId), {
        id: actId,
        type: 'loan',
        amount: principal,
        description: `Loan of ₹${principal} approved for ${memberName}`,
        memberId,
        memberName,
        referenceId: loanId,
        date: new Date().toISOString(),
      });

      // Update Group summary metrics in Firestore
      try {
        const groupRef = doc(db, 'groups', targetGroupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists()) {
          const gData = groupSnap.data();
          const currentLoans = Number(gData.totalOutstandingLoans || 0);
          const currentFund = Number(gData.totalFund || 0);
          await updateDoc(groupRef, {
            totalOutstandingLoans: currentLoans + principal,
            totalFund: Math.max(0, currentFund - principal),
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn('Notice: Group summary update on loan creation:', e);
      }

      return {
        success: true,
        message: 'Loan disbursed successfully in Bachat Gat',
        loanId,
        loanNumber: loanId,
      };
    } catch (err) {
      console.error('Failed to create loan in Firestore:', err);
      throw new Error(err.message || 'Failed to create loan.');
    }
  },

  /**
   * Record loan repayment installment in Firestore
   */
  recordRepayment: async (repayData, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
      const loanId = repayData.loan_id || repayData.loanId;
      const principalRepay = parseFloat(repayData.principal_repayment_amount || repayData.principalAmount || 0);
      const regularHafta = parseFloat(repayData.regular_hafta_amount || 0);
      const paymentDate = repayData.payment_date || repayData.paymentDate || new Date().toISOString();
      const month = parseInt(repayData.payment_month || repayData.month, 10) || (new Date().getMonth() + 1);
      const year = parseInt(repayData.payment_year || repayData.year, 10) || new Date().getFullYear();
      const mode = repayData.payment_mode || repayData.paymentMode || 'UPI';
      const remarks = (repayData.remarks || '').trim();

      const loanDocRef = doc(db, 'groups', targetGroupId, 'loans', loanId);
      const loanSnap = await getDoc(loanDocRef);

      if (!loanSnap.exists()) {
        throw new Error('Loan document not found.');
      }

      const loanData = loanSnap.data();
      const currentPending = Number(loanData.pendingPrincipal || loanData.remainingAmount || 0);
      if ((loanData.status || 'active').toLowerCase() !== 'active') throw new Error('This loan is already closed.');
      if (principalRepay < 0 || principalRepay > currentPending) throw new Error('Principal repayment is outside the valid outstanding balance.');
      const interestRate = Number(loanData.interestRate || 2.0);
      const calculatedInterest = Math.round(((currentPending * interestRate) / 100) * 100) / 100;
      const totalPayment = principalRepay + calculatedInterest + regularHafta;

      const newPending = Math.max(0, currentPending - principalRepay);
      const newStatus = newPending <= 0 ? 'closed' : 'active';

      // Update Loan doc
      await updateDoc(loanDocRef, {
        pendingPrincipal: newPending,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      // Save/Update monthly contribution doc
      const memberId = loanData.memberId;
      const contribDocId = `C_${memberId}_${year}_${String(month).padStart(2, '0')}`;
      const contribRef = doc(db, 'groups', targetGroupId, 'monthly_contributions', contribDocId);

      await setDoc(contribRef, {
        id: contribDocId,
        groupId: targetGroupId,
        memberId,
        month,
        year,
        expectedAmount: regularHafta > 0 ? regularHafta : 1000,
        regularHaftaAmount: regularHafta,
        paidAmount: regularHafta,
        loanPrincipalPaid: principalRepay,
        interestAmount: calculatedInterest,
        totalPaid: totalPayment,
        status: 'paid',
        paymentDate,
        paymentMode: mode,
        notes: remarks,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Keep an immutable repayment ledger in its own collection. The monthly
      // contribution document remains the aggregate used by dashboard reports.
      const repaymentId = `REP_${loanId}_${Date.now()}`;
      await setDoc(doc(db, 'groups', targetGroupId, 'repayments', repaymentId), {
        id: repaymentId,
        groupId: targetGroupId,
        loanId,
        memberId,
        principalAmount: principalRepay,
        interestAmount: calculatedInterest,
        regularHaftaAmount: regularHafta,
        amount: totalPayment,
        paymentMonth: month,
        paymentYear: year,
        paymentDate,
        paymentMode: mode,
        remarks,
        createdAt: serverTimestamp(),
      });

      // Fetch member name for logging
      let memberName = 'Member';
      try {
        const memSnap = await getDoc(doc(db, 'groups', targetGroupId, 'members', memberId));
        if (memSnap.exists()) memberName = memSnap.data().name || memSnap.data().fullName || 'Member';
      } catch (e) {
        // fallback
      }

      // Log activity
      const actId = `ACT_${Date.now()}_repay`;
      await setDoc(doc(db, 'groups', targetGroupId, 'activities', actId), {
        id: actId,
        type: 'repayment',
        amount: totalPayment,
        description: `Installment of ₹${totalPayment} (Principal: ₹${principalRepay}, Interest: ₹${calculatedInterest}) received from ${memberName}`,
        memberId,
        memberName,
        referenceId: loanId,
        date: new Date().toISOString(),
      });

      // Update Group summary metrics in Firestore
      try {
        const groupRef = doc(db, 'groups', targetGroupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists()) {
          const gData = groupSnap.data();
          const currentLoans = Number(gData.totalOutstandingLoans || 0);
          const currentInterest = Number(gData.totalInterestCollected || 0);
          const currentFund = Number(gData.totalFund || 0);
          await updateDoc(groupRef, {
            totalOutstandingLoans: Math.max(0, currentLoans - principalRepay),
            totalInterestCollected: currentInterest + calculatedInterest,
            totalFund: currentFund + totalPayment,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn('Notice: Group summary update on repayment:', e);
      }

      return {
        success: true,
        message: 'Repayment recorded successfully in Bachat Gat',
        newOutstanding: newPending,
        loanStatus: newStatus,
        repaymentId,
      };
    } catch (err) {
      console.error('Failed to record repayment in Firestore:', err);
      throw new Error(err.message || 'Failed to record repayment.');
    }
  },

  /**
   * Subscribe to real-time loans
   */
  subscribeToLoans: (callback, groupId = DEFAULT_GROUP_ID) => {
    const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
    return onSnapshot(collection(db, 'groups', targetGroupId, 'loans'), () => {
      loanService.getAllLoans({}, targetGroupId).then((res) => {
        if (res.success) callback(res);
      });
    });
  },
};
