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
        const memberName = d.name || d.fullName || 'Member';
        const memberCode = d.memberCode || d.member_code || docSnap.id;
        membersMap[docSnap.id] = { name: memberName, code: memberCode };
        if (d.userId) membersMap[d.userId] = { name: memberName, code: memberCode };
        if (d.authUid) membersMap[d.authUid] = { name: memberName, code: memberCode };
      });

      const allLoans = loansSnap.docs.map((docSnap) => {
        const raw = docSnap.data();
        const normalized = normalizeLoan(docSnap.id, raw);
        const memInfo = membersMap[normalized.memberId] || { name: normalized.memberName, code: normalized.memberCode };

        return {
          ...normalized,
          member_name: memInfo.name || normalized.memberName,
          memberName: memInfo.name || normalized.memberName,
          member_code: memInfo.code || normalized.memberCode,
          memberCode: memInfo.code || normalized.memberCode,
        };
      });

      const totalActiveLoansCount = allLoans.filter((l) => l.status === 'ACTIVE').length;
      const totalClosedLoansCount = allLoans.filter((l) => l.status === 'CLOSED').length;
      const totalOutstanding = allLoans
        .filter((l) => l.status === 'ACTIVE')
        .reduce((sum, l) => sum + (l.pendingPrincipal || 0), 0);
      const totalDisbursed = allLoans.reduce((sum, l) => sum + (l.originalPrincipal || 0), 0);

      let filtered = allLoans;
      if (params.memberId) {
        filtered = filtered.filter((l) => l.memberId === params.memberId || l.member_id === params.memberId);
      }
      if (params.status) {
        filtered = filtered.filter((l) => l.status === params.status.toUpperCase());
      }
      if (params.search) {
        const s = params.search.toLowerCase();
        filtered = filtered.filter(
          (l) =>
            (l.member_name && l.member_name.toLowerCase().includes(s)) ||
            (l.member_code && l.member_code.toLowerCase().includes(s)) ||
            (l.loan_number && l.loan_number.toLowerCase().includes(s)) ||
            (l.purpose && l.purpose.toLowerCase().includes(s))
        );
      }

      // Sort by issue date descending
      filtered.sort((a, b) => new Date(b.issueDate || b.loanDate || 0) - new Date(a.issueDate || a.loanDate || 0));

      return {
        success: true,
        count: filtered.length,
        totalLoansCount: allLoans.length,
        activeLoansCount: totalActiveLoansCount,
        closedLoansCount: totalClosedLoansCount,
        totalOutstanding,
        totalDisbursed,
        loans: filtered,
        allLoans,
      };
    } catch (err) {
      console.error('Failed to get loans from Firestore:', err);
      return {
        success: true,
        count: 0,
        totalLoansCount: 0,
        activeLoansCount: 0,
        closedLoansCount: 0,
        totalOutstanding: 0,
        totalDisbursed: 0,
        loans: [],
        allLoans: [],
      };
    }
  },

  /**
   * Get loans specifically for a member
   */
  getLoansByMember: async (memberId, groupId = DEFAULT_GROUP_ID) => {
    return loanService.getAllLoans({ memberId }, groupId);
  },

  /**
   * Get only active loans
   */
  getActiveLoans: async (groupId = DEFAULT_GROUP_ID) => {
    return loanService.getAllLoans({ status: 'ACTIVE' }, groupId);
  },

  /**
   * Get only closed loans
   */
  getClosedLoans: async (groupId = DEFAULT_GROUP_ID) => {
    return loanService.getAllLoans({ status: 'CLOSED' }, groupId);
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

      const memberId = loanData.memberId;
      const currentPrincipalPaid = Number(loanData.totalPrincipalPaid || loanData.total_principal_paid || 0);
      const currentInterestPaid = Number(loanData.totalInterestPaid || loanData.total_interest_paid || 0);

      // 1. Update Loan Document (Outstanding balance, principal paid, interest paid, status)
      await updateDoc(loanDocRef, {
        pendingPrincipal: newPending,
        totalPrincipalPaid: currentPrincipalPaid + principalRepay,
        total_principal_paid: currentPrincipalPaid + principalRepay,
        totalInterestPaid: currentInterestPaid + calculatedInterest,
        total_interest_paid: currentInterestPaid + calculatedInterest,
        status: newStatus.toUpperCase(),
        updatedAt: new Date().toISOString(),
      });

      // 2. Save immutable loan repayment record in 'repayments' collection
      const repaymentId = `REP_${loanId}_${Date.now()}`;
      await setDoc(doc(db, 'groups', targetGroupId, 'repayments', repaymentId), {
        id: repaymentId,
        repaymentId: repaymentId,
        repayment_id: repaymentId,
        groupId: targetGroupId,
        group_id: targetGroupId,
        loanId,
        loan_id: loanId,
        memberId,
        member_id: memberId,
        type: 'LOAN_REPAYMENT',
        transactionType: 'LOAN_REPAYMENT',
        principalAmount: principalRepay,
        principal_amount: principalRepay,
        interestAmount: calculatedInterest,
        interest_amount: calculatedInterest,
        regularHaftaAmount: regularHafta,
        regular_hafta_amount: regularHafta,
        amount: totalPayment,
        paymentMonth: month,
        payment_month: month,
        paymentYear: year,
        payment_year: year,
        paymentDate,
        payment_date: paymentDate,
        paymentMode: mode,
        payment_mode: mode,
        remarks,
        createdAt: serverTimestamp(),
      });

      // 3. ONLY if regularHafta was explicitly entered (> 0), record separate savings contribution
      if (regularHafta > 0) {
        const contribDocId = `C_${memberId}_${year}_${String(month).padStart(2, '0')}`;
        const contribRef = doc(db, 'groups', targetGroupId, 'monthly_contributions', contribDocId);
        const existingContrib = await getDoc(contribRef);
        const existingPaid = existingContrib.exists() ? Number(existingContrib.data().paidAmount || 0) : 0;
        const totalPaidSavings = existingPaid + regularHafta;
        const expectedShare = existingContrib.exists() ? Number(existingContrib.data().expectedAmount || 1000) : 1000;
        const isPaidFull = totalPaidSavings >= expectedShare;

        await setDoc(contribRef, {
          id: contribDocId,
          contribId: contribDocId,
          contrib_id: contribDocId,
          groupId: targetGroupId,
          group_id: targetGroupId,
          memberId,
          member_id: memberId,
          month,
          year,
          expectedAmount: expectedShare,
          expected_amount: expectedShare,
          paidAmount: totalPaidSavings,
          paid_amount: totalPaidSavings,
          amount: totalPaidSavings,
          regularHaftaAmount: totalPaidSavings,
          regular_hafta_amount: totalPaidSavings,
          status: isPaidFull ? 'PAID' : 'PENDING',
          status_lower: isPaidFull ? 'paid' : 'pending',
          paymentDate,
          payment_date: paymentDate,
          paymentMode: mode,
          payment_mode: mode,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

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
        description: `Loan repayment ₹${totalPayment} (Principal: ₹${principalRepay}, Interest: ₹${calculatedInterest}) received from ${memberName}`,
        memberId,
        memberName,
        referenceId: loanId,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      // 3. Update Group Document Aggregate Metrics
      const groupRef = doc(db, 'groups', targetGroupId);
      const groupSnap = await getDoc(groupRef);
      if (groupSnap.exists()) {
        const groupData = groupSnap.data();
        const currentGroupOutstanding = Number(groupData.totalOutstandingLoans || groupData.total_outstanding_loans || 0);
        const currentInterestCollected = Number(groupData.totalInterestCollected || groupData.total_interest_collected || 0);
        const currentTotalFund = Number(groupData.totalFund || groupData.total_fund || 0);

        await updateDoc(groupRef, {
          totalOutstandingLoans: Math.max(0, currentGroupOutstanding - principalRepay),
          total_outstanding_loans: Math.max(0, currentGroupOutstanding - principalRepay),
          activeLoans: Math.max(0, currentGroupOutstanding - principalRepay),
          active_loans: Math.max(0, currentGroupOutstanding - principalRepay),
          totalInterestCollected: currentInterestCollected + calculatedInterest,
          total_interest_collected: currentInterestCollected + calculatedInterest,
          totalInterest: currentInterestCollected + calculatedInterest,
          total_interest: currentInterestCollected + calculatedInterest,
          totalFund: Math.max(0, currentTotalFund + principalRepay + calculatedInterest),
          total_fund: Math.max(0, currentTotalFund + principalRepay + calculatedInterest),
          availableBalance: Math.max(0, currentTotalFund + principalRepay + calculatedInterest),
          available_balance: Math.max(0, currentTotalFund + principalRepay + calculatedInterest),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
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
