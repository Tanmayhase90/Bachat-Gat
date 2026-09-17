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
import { db } from '../config/firebase.js';
import {
  normalizeLoan,
  normalizeMember,
  normalizeSavings,
  DEFAULT_GROUP_ID,
} from '../utils/formatters.js';

export async function calculateCurrentAvailableBalance(groupId = DEFAULT_GROUP_ID) {
  const targetGroupId = groupId || DEFAULT_GROUP_ID;
  const [contributionsSnap, loansSnap, repaymentsSnap, settlementsSnap] = await Promise.all([
    getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
    getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
    getDocs(collection(db, 'groups', targetGroupId, 'repayments')).catch(() => ({ docs: [] })),
    getDocs(collection(db, 'groups', targetGroupId, 'settlements')).catch(() => ({ docs: [] })),
  ]);

  const allSavings = contributionsSnap.docs.map((d) => normalizeSavings(d.id, d.data()));
  const totalSavings = allSavings
    .filter((c) => c.isPaid || c.paidAmount > 0)
    .reduce((sum, c) => sum + (c.paidAmount || c.amount || 0), 0);

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

  return {
    totalSavings,
    totalInterest,
    totalGroupFund,
    activeLoansTotal,
    availableBalance,
  };
}

export const loanService = {
  /**
   * Get current available group balance for loan issuance
   */
  getAvailableBalance: async (groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const balanceData = await calculateCurrentAvailableBalance(targetGroupId);
      return { success: true, ...balanceData };
    } catch (err) {
      console.error('Failed to get available balance:', err);
      return {
        success: true,
        totalSavings: 0,
        totalInterest: 0,
        totalGroupFund: 0,
        activeLoansTotal: 0,
        availableBalance: 0,
      };
    }
  },
  /**
   * Get all loans with member info and progress metrics from Flutter subcollections
   */
  getAllLoans: async (params = {}, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;

      const [loansSnap, repaymentsSnap, membersSnap, activitiesSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'repayments')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'activities')).catch(() => ({ docs: [] })),
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

      // Historical name fallback from activities/transactions for deleted members
      activitiesSnap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        const mName = d.memberName || d.member_name;
        if (mName && mName.trim() && !mName.startsWith('Member ')) {
          const cleanName = mName.trim();
          if (d.memberId && (!membersMap[d.memberId] || membersMap[d.memberId].name === 'Member')) {
            membersMap[d.memberId] = { name: cleanName, code: d.memberCode || d.member_code || d.memberId };
          }
        }
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

      const allLoans = loansSnap.docs.map((docSnap) => {
        const raw = docSnap.data();
        const loanRepays = repaymentsByLoan[docSnap.id] || repaymentsByLoan[raw.loanId] || [];
        const normalized = normalizeLoan(docSnap.id, raw, loanRepays);
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
      const totalPrincipalRecovered = allLoans.reduce((sum, l) => sum + (l.totalPrincipalPaid || 0), 0);
      const totalInterestEarned = allLoans.reduce((sum, l) => sum + (l.totalInterestPaid || 0), 0);

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
        totalPrincipalRecovered,
        totalPrincipalCollected: totalPrincipalRecovered,
        totalInterestEarned,
        totalInterestCollected: totalInterestEarned,
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
        totalDisbursed,
        totalPrincipalRecovered: 0,
        totalPrincipalCollected: 0,
        totalInterestEarned: 0,
        totalInterestCollected: 0,
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
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const loanDocRef = doc(db, 'groups', targetGroupId, 'loans', loanId);
      const loanSnap = await getDoc(loanDocRef);

      if (!loanSnap.exists()) {
        throw new Error('Loan profile not found in active Bachat Gat.');
      }

      const raw = loanSnap.data();
      const actualLoanId = loanSnap.id;

      // Fetch member info, repayments subcollection, activities, and monthly_contributions (fallback)
      const [repaymentsSnap, contributionsSnap, membersSnap, activitiesSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'repayments')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'activities')).catch(() => ({ docs: [] })),
      ]);

      const memberDoc = membersSnap.docs.find((d) => d.id === raw.memberId);
      let memberName = memberDoc?.data()?.name || memberDoc?.data()?.fullName || raw.memberName || raw.member_name;
      let memberCode = memberDoc?.data()?.memberCode || memberDoc?.data()?.member_code || raw.memberCode || raw.memberId;

      if (!memberName || memberName === 'Member' || memberName.startsWith('Member ')) {
        activitiesSnap.docs.forEach((d) => {
          const data = d.data();
          if ((data.referenceId === actualLoanId || data.memberId === raw.memberId) && data.memberName && !data.memberName.startsWith('Member ')) {
            memberName = data.memberName.trim();
          }
        });
      }
      if (!memberName) memberName = 'Member';

      // 1. Primary Repayments from 'repayments' collection
      const rawRepayments = repaymentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(
          (r) =>
            r.loanId === actualLoanId ||
            r.loan_id === actualLoanId ||
            r.loanId === raw.loanId ||
            r.loan_id === raw.loanId ||
            (r.memberId === raw.memberId && (r.principalAmount > 0 || r.interestAmount > 0))
        );

      // 2. Fallback Repayments from 'monthly_contributions' (if any legacy combined transactions)
      const legacyRepayments = contributionsSnap.docs
        .map((d) => normalizeSavings(d.id, d.data()))
        .filter(
          (s) =>
            (s.memberId === raw.memberId || s.member_id === raw.memberId) &&
            (s.loanPrincipalPaid > 0 || s.interestAmount > 0) &&
            !rawRepayments.some((r) => r.id === s.id)
        )
        .map((s) => ({
          id: s.id,
          repaymentId: s.id,
          loanId: actualLoanId,
          principalAmount: s.loanPrincipalPaid,
          interestAmount: s.interestAmount,
          amount: s.loanPrincipalPaid + s.interestAmount,
          paymentDate: s.paymentDate,
          paymentMode: s.paymentMode,
          paymentMonth: s.month,
          paymentYear: s.year,
        }));

      const allLoanRepayments = [...rawRepayments, ...legacyRepayments];
      const normalized = normalizeLoan(actualLoanId, raw, allLoanRepayments);

      const mappedRepayments = allLoanRepayments
        .map((r) => {
          const pPaid = Number(r.principalAmount || r.principalPaid || r.principalRepaid || r.principal_repayment_amount || 0);
          const iPaid = Number(r.interestAmount || r.interestPaid || r.interest_amount || 0);
          return {
            id: r.id,
            repayment_id: r.id,
            loan_id: actualLoanId,
            loan_number: normalized.loanNumber,
            principal_repayment_amount: pPaid,
            principalAmount: pPaid,
            interest_amount: iPaid,
            interestAmount: iPaid,
            total_payment: Number(r.totalPayment || r.totalPaid || r.amount || (pPaid + iPaid)),
            payment_date: r.paymentDate || r.paidAt || r.payment_date || r.createdAt || new Date().toISOString(),
            paymentDate: r.paymentDate || r.paidAt || r.payment_date || r.createdAt || new Date().toISOString(),
            payment_mode: r.paymentMode || r.payment_mode || 'UPI',
            paymentMode: r.paymentMode || r.payment_mode || 'UPI',
            payment_month: r.month || r.paymentMonth || r.payment_month || 0,
            payment_year: r.year || r.paymentYear || r.payment_year || 0,
          };
        })
        .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

      return {
        success: true,
        loan: {
          ...normalized,
          member_name: memberName,
          memberName: memberName,
          member_code: memberCode,
          memberCode: memberCode,
          total_principal_repaid: normalized.totalPrincipalPaid,
          totalPrincipalRepaid: normalized.totalPrincipalPaid,
          total_interest_paid: normalized.totalInterestPaid,
          totalInterestPaid: normalized.totalInterestPaid,
          repayments: mappedRepayments,
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
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const memberId = loanData.member_id || loanData.memberId;
      const rawPrincipal = loanData.principal_amount !== undefined ? loanData.principal_amount : (loanData.principalAmount !== undefined ? loanData.principalAmount : loanData.originalPrincipal);
      const principal = typeof rawPrincipal === 'number' ? rawPrincipal : parseFloat(String(rawPrincipal || '').replace(/,/g, ''));
      const interestRate = parseFloat(loanData.interest_rate || loanData.interestRate) || 2.0;
      const purpose = (loanData.purpose || 'General').trim();
      const dateStr = loanData.loan_date || loanData.loanDate || new Date().toISOString();
      const durationMonths = parseInt(loanData.duration_months || loanData.durationMonths, 10) || 12;

      // 1. Strict numeric validations: prevent 0, negative, empty, NaN, Infinity, overflow
      if (
        rawPrincipal === undefined ||
        rawPrincipal === null ||
        String(rawPrincipal).trim() === '' ||
        !Number.isFinite(principal) ||
        isNaN(principal) ||
        principal <= 0 ||
        principal > Number.MAX_SAFE_INTEGER
      ) {
        throw new Error('Please enter a valid positive loan amount.');
      }

      if (!memberId) {
        throw new Error('Please select a valid borrowing member.');
      }

      // 2. Real-time authoritative calculation of current available balance from live Firestore database
      const { availableBalance } = await calculateCurrentAvailableBalance(targetGroupId);

      if (availableBalance <= 0) {
        throw new Error('Insufficient available balance. No amount is currently available for a new loan.');
      }

      if (principal > availableBalance) {
        const formattedMax = `₹${Math.round(availableBalance).toLocaleString('en-IN')}`;
        throw new Error(`Insufficient available balance. You can issue a maximum loan of ${formattedMax}.`);
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
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
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
      const currentPending = Number(
        loanData.pendingPrincipal !== undefined && loanData.pendingPrincipal !== null ? loanData.pendingPrincipal :
        loanData.remainingAmount !== undefined && loanData.remainingAmount !== null ? loanData.remainingAmount :
        loanData.remainingPrincipal !== undefined && loanData.remainingPrincipal !== null ? loanData.remainingPrincipal :
        loanData.balanceAmount !== undefined && loanData.balanceAmount !== null ? loanData.balanceAmount :
        (Number(loanData.principalAmount || loanData.originalPrincipal || loanData.amount || 0) - Number(loanData.totalPrincipalPaid || loanData.total_principal_paid || 0)) || 0
      );

      if ((loanData.status || 'active').toLowerCase() !== 'active') throw new Error('This loan is already closed.');
      if (principalRepay < 0 || principalRepay > currentPending) throw new Error('Principal repayment is outside the valid outstanding balance.');
      const interestRate = Number(loanData.interestRate || 2.0);
      const calculatedInterest = Math.round(((currentPending * interestRate) / 100) * 100) / 100;
      const totalPayment = principalRepay + calculatedInterest + regularHafta;

      const memberId = loanData.memberId;
      const currentPrincipalPaid = Number(loanData.totalPrincipalPaid || loanData.total_principal_paid || 0);
      const currentInterestPaid = Number(loanData.totalInterestPaid || loanData.total_interest_paid || 0);

      const newPending = Math.max(0, Math.round((currentPending - principalRepay) * 100) / 100);
      const newStatus = newPending <= 0 ? 'CLOSED' : 'ACTIVE';

      // 1. Update Loan Document (Outstanding balance, principal paid, interest paid, status)
      await updateDoc(loanDocRef, {
        pendingPrincipal: newPending,
        remainingAmount: newPending,
        remainingPrincipal: newPending,
        totalPrincipalPaid: currentPrincipalPaid + principalRepay,
        total_principal_paid: currentPrincipalPaid + principalRepay,
        totalInterestPaid: currentInterestPaid + calculatedInterest,
        total_interest_paid: currentInterestPaid + calculatedInterest,
        status: newStatus.toUpperCase(),
        status_lower: newStatus.toLowerCase(),
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
        principalPaid: principalRepay,
        principal_paid: principalRepay,
        principalRepaid: principalRepay,
        interestAmount: calculatedInterest,
        interest_amount: calculatedInterest,
        interestPaid: calculatedInterest,
        interest_paid: calculatedInterest,
        regularHafta: regularHafta,
        regularHaftaAmount: regularHafta,
        regular_hafta_amount: regularHafta,
        regularContribution: regularHafta,
        amount: totalPayment,
        totalPaid: totalPayment,
        totalPayment: totalPayment,
        openingPrincipal: currentPending,
        closingPrincipal: newPending,
        pendingPrincipalAfterPayment: newPending,
        month,
        paymentMonth: month,
        payment_month: month,
        year,
        paymentYear: year,
        payment_year: year,
        paymentDate,
        payment_date: paymentDate,
        paymentMode: mode,
        payment_mode: mode,
        interestRate,
        remarks,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
    const targetGroupId = groupId || DEFAULT_GROUP_ID;
    return onSnapshot(collection(db, 'groups', targetGroupId, 'loans'), () => {
      loanService.getAllLoans({}, targetGroupId).then((res) => {
        if (res.success) callback(res);
      });
    });
  },
};
