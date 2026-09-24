import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { savingsService } from './savingsService.js';
import { loanService } from './loanService.js';
import {
  normalizeSavings,
  normalizeLoan,
  normalizeMember,
  isRegularMember,
  compareMemberNumericOrder,
  getLoanMonthYear,
  formatMonthYear,
  DEFAULT_GROUP_ID,
} from '../utils/formatters.js';

export const adjustmentService = {
  /**
   * Get all active regular members for immediate selection in Adjustment interface
   */
  getActiveMembers: async (groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const [membersSnap, contributionsSnap, loansSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
      ]);

      const allContributions = contributionsSnap.docs.map((d) => normalizeSavings(d.id, d.data()));
      const allLoans = loansSnap.docs.map((d) => normalizeLoan(d.id, d.data()));

      const regularMemberDocs = membersSnap.docs.filter((docSnap) =>
        isRegularMember({ id: docSnap.id, ...docSnap.data() })
      );

      const members = regularMemberDocs.map((docSnap) => {
        const raw = docSnap.data();
        const memberId = docSnap.id;
        const normalized = normalizeMember(memberId, raw);

        const memberSavingsTotal = allContributions
          .filter((s) => s.memberId === memberId || s.member_id === memberId)
          .reduce((acc, s) => acc + (s.paidAmount || 0), 0);

        const memberActiveLoans = allLoans.filter(
          (l) => (l.memberId === memberId || l.member_id === memberId) && (l.status || '').toUpperCase() === 'ACTIVE'
        );
        const memberLoanOutstanding = memberActiveLoans.reduce(
          (acc, l) => acc + (l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0)),
          0
        );

        return {
          ...normalized,
          totalSavings: memberSavingsTotal,
          total_savings: memberSavingsTotal,
          outstandingLoans: memberLoanOutstanding,
          outstanding_loans: memberLoanOutstanding,
          activeLoansCount: memberActiveLoans.length,
        };
      }).filter((m) => m.isActive);

      members.sort(compareMemberNumericOrder);

      return {
        success: true,
        count: members.length,
        members,
      };
    } catch (err) {
      console.error('Failed to get active members for adjustment:', err);
      return { success: false, count: 0, members: [], error: err.message };
    }
  },

  /**
   * Get member historical data (initial amount, monthly contributions, loans, repayments)
   */
  getMemberHistoricalData: async (memberId, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      if (!memberId) throw new Error('Member ID is required');

      const [memberSnap, contribsSnap, loansSnap, repaysSnap] = await Promise.all([
        getDoc(doc(db, 'groups', targetGroupId, 'members', memberId)).catch(() => null),
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'repayments')).catch(() => ({ docs: [] })),
      ]);

      const memberData = memberSnap?.exists() ? normalizeMember(memberId, memberSnap.data()) : null;

      const memberContributions = contribsSnap.docs
        .map((d) => normalizeSavings(d.id, d.data()))
        .filter((s) => s.memberId === memberId || s.member_id === memberId)
        .sort((a, b) => b.year - a.year || b.month - a.month);

      const initialEntry = memberContributions.find((s) => s.isBase || s.month === 0);

      const repaymentsList = repaysSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.memberId === memberId || r.member_id === memberId);

      const repaymentsByLoan = {};
      repaymentsList.forEach((r) => {
        const lId = r.loanId || r.loan_id;
        if (lId) {
          if (!repaymentsByLoan[lId]) repaymentsByLoan[lId] = [];
          repaymentsByLoan[lId].push(r);
        }
      });

      const memberLoans = loansSnap.docs
        .map((d) => {
          const lRepays = repaymentsByLoan[d.id] || repaymentsByLoan[d.data().loanId] || [];
          return normalizeLoan(d.id, d.data(), lRepays);
        })
        .filter((l) => l.memberId === memberId || l.member_id === memberId);

      const totalSavings = memberContributions.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
      const totalOutstanding = memberLoans
        .filter((l) => (l.status || '').toUpperCase() === 'ACTIVE')
        .reduce((acc, l) => acc + (l.pendingPrincipal || 0), 0);

      return {
        success: true,
        member: memberData,
        initialEntry: initialEntry || null,
        initialAmount: initialEntry ? initialEntry.paidAmount : 0,
        savings: memberContributions.filter((s) => !s.isBase && s.month > 0),
        loans: memberLoans,
        repayments: repaymentsList,
        totalSavings,
        totalOutstanding,
      };
    } catch (err) {
      console.error('Failed to get member historical data:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * 1. Record Initial One-Time Starting Amount (Base / Opening Savings, Month 0)
   */
  recordInitialAmount: async (data, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const memberId = String(data.member_id || data.memberId || '').trim();
      const rawAmount = data.amount;
      const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount || '').replace(/,/g, ''));
      const paymentDate = data.payment_date || data.paymentDate || '2026-07-01';
      const mode = data.payment_mode || data.paymentMode || 'Opening Balance';
      const notes = (data.remarks || data.notes || 'Initial group opening amount').trim();

      if (!memberId) {
        throw new Error('Please select a valid member.');
      }
      if (!Number.isFinite(amount) || isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid initial amount greater than ₹0.');
      }

      // Fetch member info
      const memRef = doc(db, 'groups', targetGroupId, 'members', memberId);
      const memSnap = await getDoc(memRef);
      if (!memSnap.exists()) {
        throw new Error('Member profile not found.');
      }
      const memData = memSnap.data();
      const memberName = memData.name || memData.fullName || 'Member';
      const memberCode = memData.memberCode || memData.member_code || memberId;

      const dateObj = new Date(paymentDate);
      const year = !isNaN(dateObj.getFullYear()) ? dateObj.getFullYear() : (parseInt(data.year, 10) || 2026);

      const docId = `C_${memberId}_base`;
      const docRef = doc(db, 'groups', targetGroupId, 'monthly_contributions', docId);

      const contributionPayload = {
        id: docId,
        contribId: docId,
        contrib_id: docId,
        groupId: targetGroupId,
        group_id: targetGroupId,
        memberId,
        member_id: memberId,
        memberName,
        member_name: memberName,
        memberCode,
        member_code: memberCode,
        month: 0,
        year,
        isBase: true,
        type: 'BASE_SAVINGS',
        expectedAmount: amount,
        expected_amount: amount,
        regularHaftaAmount: amount,
        regular_hafta_amount: amount,
        paidAmount: amount,
        paid_amount: amount,
        amount,
        totalPaid: amount,
        total_paid: amount,
        loanPrincipalPaid: 0,
        loan_principal_paid: 0,
        interestAmount: 0,
        interest_amount: 0,
        interest: 0,
        status: 'PAID',
        status_lower: 'paid',
        paymentDate,
        payment_date: paymentDate,
        paymentMode: mode,
        payment_mode: mode,
        notes,
        remarks: notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(docRef, contributionPayload, { merge: true });

      // Log activity in activities
      const actId = `ACT_${Date.now()}_initial`;
      await setDoc(doc(db, 'groups', targetGroupId, 'activities', actId), {
        id: actId,
        type: 'adjustment',
        amount,
        description: `Initial one-time opening amount ₹${amount.toLocaleString('en-IN')} recorded for ${memberName}`,
        memberId,
        memberName,
        referenceId: docId,
        month: 0,
        year,
        date: paymentDate || new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      // Recalculate member total savings from contributions
      try {
        const contribsSnap = await getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions'));
        const newTotalSavings = contribsSnap.docs
          .map((d) => normalizeSavings(d.id, d.data()))
          .filter((s) => s.memberId === memberId || s.member_id === memberId)
          .reduce((sum, s) => sum + (s.paidAmount || 0), 0);

        await updateDoc(memRef, {
          totalSavings: newTotalSavings,
          total_savings: newTotalSavings,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Notice: Member total savings update on initial amount:', e);
      }

      // Update Group summary metrics
      try {
        const groupRef = doc(db, 'groups', targetGroupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists()) {
          const gData = groupSnap.data();
          const currentSavings = Number(gData.totalSavings || gData.total_savings || 0);
          const currentFund = Number(gData.totalFund || gData.total_fund || 0);
          await updateDoc(groupRef, {
            totalSavings: currentSavings + amount,
            total_savings: currentSavings + amount,
            totalFund: currentFund + amount,
            total_fund: currentFund + amount,
            availableBalance: currentFund + amount,
            available_balance: currentFund + amount,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn('Notice: Group summary update on initial amount:', e);
      }

      return {
        success: true,
        message: 'Initial group starting amount recorded successfully',
        id: docId,
      };
    } catch (err) {
      console.error('Failed to record initial starting amount:', err);
      throw new Error(err.message || 'Failed to record initial starting amount.');
    }
  },

  /**
   * 2. Record Historical Monthly Saving (Uses savingsService logic + duplicate protection)
   */
  recordHistoricalSaving: async (data, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const memberId = String(data.member_id || data.memberId || '').trim();
      const month = parseInt(data.month, 10);
      const year = parseInt(data.year, 10);
      const rawAmount = data.amount;
      const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount || '').replace(/,/g, ''));
      const paymentDate = data.payment_date || data.paymentDate;
      const mode = data.payment_mode || data.paymentMode || 'Cash';
      const notes = (data.remarks || data.notes || '').trim();

      if (!memberId) {
        throw new Error('Please select a valid member.');
      }
      if (!month || month < 1 || month > 12) {
        throw new Error('Please select a valid month (1-12).');
      }
      if (!year || year < 2000 || year > 2100) {
        throw new Error('Please select a valid year.');
      }
      if (!Number.isFinite(amount) || isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid savings amount.');
      }
      if (!paymentDate) {
        throw new Error('Please select the actual historical payment date.');
      }

      // Delegate to standard savingsService for exact data consistency and duplicate checking
      return await savingsService.recordSavings({
        member_id: memberId,
        month,
        year,
        amount,
        payment_date: paymentDate,
        payment_mode: mode,
        remarks: notes,
      }, targetGroupId);
    } catch (err) {
      console.error('Failed to record historical monthly saving:', err);
      throw new Error(err.message || 'Failed to record historical monthly saving.');
    }
  },

  /**
   * 3. Record Historical Loan (Unique Per Member + Month + Year)
   * If an existing historical loan exists for the member in the same month/year, updates that record.
   * Otherwise, creates a new historical loan record.
   */
  recordHistoricalLoan: async (data, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const memberId = String(data.member_id || data.memberId || '').trim();
      const rawPrincipal = data.principal_amount !== undefined ? data.principal_amount : (data.principalAmount !== undefined ? data.principalAmount : data.originalPrincipal);
      const principal = typeof rawPrincipal === 'number' ? rawPrincipal : parseFloat(String(rawPrincipal || '').replace(/,/g, ''));
      const interestRate = parseFloat(data.interest_rate || data.interestRate) || 2.0;
      const durationMonths = parseInt(data.duration_months || data.durationMonths, 10) || 12;
      const issueDate = data.loan_date || data.issueDate || data.payment_date || new Date().toISOString().split('T')[0];
      const purpose = (data.purpose || data.remarks || 'Historical Loan').trim();

      if (!memberId) {
        throw new Error('Please select a valid member.');
      }
      if (!Number.isFinite(principal) || isNaN(principal) || principal <= 0) {
        throw new Error('Please enter a valid positive loan principal amount.');
      }
      if (!issueDate) {
        throw new Error('Please select the actual historical loan issue date.');
      }

      const { month: targetMonth, year: targetYear } = getLoanMonthYear(issueDate);

      // Fetch all loans to check for existing loan for this member in the same month/year
      const [loansSnap, balanceRes, memSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
        loanService.getAvailableBalance(targetGroupId),
        getDoc(doc(db, 'groups', targetGroupId, 'members', memberId)),
      ]);

      if (!memSnap.exists()) {
        throw new Error('Selected member profile not found.');
      }
      const mData = memSnap.data();
      const memberName = mData.name || mData.fullName || 'Member';
      const memberCode = mData.memberCode || mData.member_code || memberId;

      const existingLoanDoc = loansSnap.docs.find((d) => {
        const dData = d.data() || {};
        const dMemberId = String(dData.memberId || dData.member_id || '');
        if (dMemberId !== String(memberId)) return false;
        const dDate = dData.issueDate || dData.loanDate || dData.loan_date || dData.createdAt;
        const { month: dMonth, year: dYear } = getLoanMonthYear(dDate);
        return dMonth === targetMonth && dYear === targetYear;
      });

      const availableBalance = (balanceRes && typeof balanceRes.availableBalance === 'number') ? balanceRes.availableBalance : 0;

      if (existingLoanDoc) {
        // ============================================================
        // UPDATE EXISTING HISTORICAL LOAN (SAME MEMBER + MONTH + YEAR)
        // ============================================================
        const loanId = existingLoanDoc.id;
        const existingData = existingLoanDoc.data() || {};
        const oldPrincipal = Number(existingData.originalPrincipal !== undefined ? existingData.originalPrincipal : (existingData.principalAmount || existingData.principal_amount || 0));
        const oldPending = Number(existingData.pendingPrincipal !== undefined ? existingData.pendingPrincipal : (existingData.remainingAmount !== undefined ? existingData.remainingAmount : oldPrincipal));

        // Historical loan amount must not exceed actual current group available balance
        if (availableBalance <= 0) {
          throw new Error('Loan amount cannot exceed available balance of ₹0.');
        }
        if (principal > availableBalance) {
          const formattedMax = `₹${Math.round(availableBalance).toLocaleString('en-IN')}`;
          throw new Error(`Loan amount cannot exceed available balance of ${formattedMax}.`);
        }

        // Fetch any repayments made against this loan
        const [repaysSnap, altRepaysSnap] = await Promise.all([
          getDocs(query(collection(db, 'groups', targetGroupId, 'repayments'), where('loanId', '==', loanId))).catch(() => ({ docs: [] })),
          getDocs(query(collection(db, 'groups', targetGroupId, 'repayments'), where('loan_id', '==', loanId))).catch(() => ({ docs: [] })),
        ]);

        const allRepayDocs = [...repaysSnap.docs, ...altRepaysSnap.docs.filter((d) => !repaysSnap.docs.some((rd) => rd.id === d.id))];
        const totalPrincipalRepaid = allRepayDocs.reduce((sum, d) => {
          const r = d.data() || {};
          return sum + Number(r.principalAmount || r.principalPaid || r.principalRepaid || r.principal_repayment_amount || 0);
        }, 0);

        const newPendingPrincipal = Math.max(0, principal - totalPrincipalRepaid);
        const status = newPendingPrincipal <= 0 ? 'CLOSED' : 'ACTIVE';
        const deltaPending = newPendingPrincipal - oldPending;

        const loanDocRef = doc(db, 'groups', targetGroupId, 'loans', loanId);
        const updatedLoanPayload = {
          originalPrincipal: principal,
          principalAmount: principal,
          principal_amount: principal,
          pendingPrincipal: newPendingPrincipal,
          remainingAmount: newPendingPrincipal,
          outstandingAmount: newPendingPrincipal,
          interestRate,
          interest_rate: interestRate,
          durationMonths,
          duration_months: durationMonths,
          purpose,
          status,
          status_lower: status.toLowerCase(),
          issueDate,
          loanDate: issueDate,
          loan_date: issueDate,
          updatedAt: new Date().toISOString(),
        };

        await setDoc(loanDocRef, updatedLoanPayload, { merge: true });

        // Log update activity
        const actId = `ACT_${Date.now()}_loan_update`;
        await setDoc(doc(db, 'groups', targetGroupId, 'activities', actId), {
          id: actId,
          type: 'loan_update',
          amount: principal,
          description: `Historical loan updated to ₹${principal.toLocaleString('en-IN')} for ${memberName} (${formatMonthYear(targetMonth, targetYear)})`,
          memberId,
          memberName,
          referenceId: loanId,
          date: issueDate,
          createdAt: new Date().toISOString(),
        });

        // Update Group summary metrics by delta
        try {
          const groupRef = doc(db, 'groups', targetGroupId);
          const groupSnap = await getDoc(groupRef);
          if (groupSnap.exists()) {
            const gData = groupSnap.data();
            const currentLoans = Number(gData.totalOutstandingLoans || gData.total_outstanding_loans || 0);
            const newTotalLoans = Math.max(0, currentLoans + deltaPending);
            await updateDoc(groupRef, {
              totalOutstandingLoans: newTotalLoans,
              total_outstanding_loans: newTotalLoans,
              activeLoans: newTotalLoans,
              active_loans: newTotalLoans,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.warn('Notice: Group summary update on historical loan update:', e);
        }

        return {
          success: true,
          message: 'Historical loan updated successfully',
          loanId,
          isUpdated: true,
        };
      }

      // ============================================================
      // CREATE NEW HISTORICAL LOAN (NEW MONTH / YEAR)
      // ============================================================
      if (availableBalance <= 0) {
        throw new Error('Loan amount cannot exceed available balance of ₹0.');
      }
      if (principal > availableBalance) {
        const formattedMax = `₹${Math.round(availableBalance).toLocaleString('en-IN')}`;
        throw new Error(`Loan amount cannot exceed available balance of ${formattedMax}.`);
      }

      const loanId = `L_${Date.now()}`;
      const loanDocRef = doc(db, 'groups', targetGroupId, 'loans', loanId);

      const loanPayload = {
        id: loanId,
        loanId: loanId,
        loanNumber: `LN-${String(loanId).slice(-6)}`,
        loan_number: `LN-${String(loanId).slice(-6)}`,
        groupId: targetGroupId,
        group_id: targetGroupId,
        memberId,
        member_id: memberId,
        memberName,
        member_name: memberName,
        memberCode,
        member_code: memberCode,
        originalPrincipal: principal,
        principalAmount: principal,
        principal_amount: principal,
        pendingPrincipal: principal,
        remainingAmount: principal,
        outstandingAmount: principal,
        interestRate,
        interest_rate: interestRate,
        durationMonths,
        duration_months: durationMonths,
        purpose,
        status: 'ACTIVE',
        status_lower: 'active',
        issueDate,
        loanDate: issueDate,
        loan_date: issueDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(loanDocRef, loanPayload);

      // Log activity
      const actId = `ACT_${Date.now()}_loan`;
      await setDoc(doc(db, 'groups', targetGroupId, 'activities', actId), {
        id: actId,
        type: 'loan',
        amount: principal,
        description: `Historical loan of ₹${principal.toLocaleString('en-IN')} issued to ${memberName}`,
        memberId,
        memberName,
        referenceId: loanId,
        date: issueDate,
        createdAt: new Date().toISOString(),
      });

      // Update Group summary metrics
      try {
        const groupRef = doc(db, 'groups', targetGroupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists()) {
          const gData = groupSnap.data();
          const currentLoans = Number(gData.totalOutstandingLoans || gData.total_outstanding_loans || 0);
          await updateDoc(groupRef, {
            totalOutstandingLoans: currentLoans + principal,
            total_outstanding_loans: currentLoans + principal,
            activeLoans: currentLoans + principal,
            active_loans: currentLoans + principal,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn('Notice: Group summary update on historical loan:', e);
      }

      return {
        success: true,
        message: 'Historical loan saved successfully',
        loanId,
        isUpdated: false,
      };
    } catch (err) {
      console.error('Failed to record historical loan:', err);
      throw new Error(err.message || 'Failed to record historical loan.');
    }
  },

  /**
   * 4. Record Historical Loan Repayment
   */
  recordHistoricalRepayment: async (data, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const loanId = String(data.loan_id || data.loanId || '').trim();
      const rawPrincipal = data.principal_amount !== undefined ? data.principal_amount : (data.principalPaid !== undefined ? data.principalPaid : data.principalRepay);
      const principalRepay = typeof rawPrincipal === 'number' ? rawPrincipal : parseFloat(String(rawPrincipal || '0').replace(/,/g, ''));
      const rawInterest = data.interest_amount !== undefined ? data.interest_amount : (data.interestPaid !== undefined ? data.interestPaid : data.interest);
      const interestAmount = typeof rawInterest === 'number' ? rawInterest : parseFloat(String(rawInterest || '0').replace(/,/g, ''));
      const month = parseInt(data.month || data.payment_month || data.paymentMonth, 10) || (new Date().getMonth() + 1);
      const year = parseInt(data.year || data.payment_year || data.paymentYear, 10) || new Date().getFullYear();
      const paymentDate = data.payment_date || data.paymentDate || new Date().toISOString().split('T')[0];
      const mode = data.payment_mode || data.paymentMode || 'Cash';
      const remarks = (data.remarks || data.notes || 'Historical repayment').trim();

      if (!loanId) {
        throw new Error('Please select a loan to record repayment for.');
      }
      if (principalRepay < 0) {
        throw new Error('Principal repayment amount cannot be negative.');
      }
      if (interestAmount < 0) {
        throw new Error('Interest repayment amount cannot be negative.');
      }
      if (principalRepay === 0 && interestAmount === 0) {
        throw new Error('Please enter a principal or interest repayment amount greater than ₹0.');
      }

      // Fetch loan details
      const loanDocRef = doc(db, 'groups', targetGroupId, 'loans', loanId);
      const loanSnap = await getDoc(loanDocRef);
      if (!loanSnap.exists()) {
        throw new Error('Selected loan not found.');
      }
      const loanData = loanSnap.data();
      const memberId = loanData.memberId || loanData.member_id;
      const currentPending = Number(loanData.pendingPrincipal !== undefined ? loanData.pendingPrincipal : (loanData.remainingAmount || loanData.originalPrincipal || 0));

      if (principalRepay > currentPending) {
        throw new Error(`Principal repayment (₹${principalRepay}) cannot exceed outstanding principal of ₹${currentPending.toLocaleString('en-IN')}.`);
      }

      const currentPrincipalPaid = Number(loanData.totalPrincipalPaid || loanData.total_principal_paid || 0);
      const currentInterestPaid = Number(loanData.totalInterestPaid || loanData.total_interest_paid || 0);

      const newPending = Math.max(0, Math.round((currentPending - principalRepay) * 100) / 100);
      const newStatus = newPending <= 0 ? 'CLOSED' : 'ACTIVE';
      const totalPayment = Math.round((principalRepay + interestAmount) * 100) / 100;

      // 1. Update Loan Document
      await updateDoc(loanDocRef, {
        pendingPrincipal: newPending,
        remainingAmount: newPending,
        remainingPrincipal: newPending,
        totalPrincipalPaid: currentPrincipalPaid + principalRepay,
        total_principal_paid: currentPrincipalPaid + principalRepay,
        totalInterestPaid: currentInterestPaid + interestAmount,
        total_interest_paid: currentInterestPaid + interestAmount,
        status: newStatus.toUpperCase(),
        status_lower: newStatus.toLowerCase(),
        updatedAt: new Date().toISOString(),
      });

      // 2. Save Repayment record in 'repayments' collection
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
        interestAmount: interestAmount,
        interest_amount: interestAmount,
        interestPaid: interestAmount,
        interest_paid: interestAmount,
        regularHafta: 0,
        regularHaftaAmount: 0,
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
        remarks,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
        description: `Historical loan repayment ₹${totalPayment.toLocaleString('en-IN')} (Principal: ₹${principalRepay}, Interest: ₹${interestAmount}) received from ${memberName}`,
        memberId,
        memberName,
        referenceId: loanId,
        date: paymentDate,
        createdAt: new Date().toISOString(),
      });

      // Update Group summary metrics
      try {
        const groupRef = doc(db, 'groups', targetGroupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists()) {
          const gData = groupSnap.data();
          const currentGroupOutstanding = Number(gData.totalOutstandingLoans || gData.total_outstanding_loans || 0);
          const currentInterestCollected = Number(gData.totalInterestCollected || gData.total_interest_collected || 0);
          const currentTotalFund = Number(gData.totalFund || gData.total_fund || 0);

          await updateDoc(groupRef, {
            totalOutstandingLoans: Math.max(0, currentGroupOutstanding - principalRepay),
            total_outstanding_loans: Math.max(0, currentGroupOutstanding - principalRepay),
            activeLoans: Math.max(0, currentGroupOutstanding - principalRepay),
            active_loans: Math.max(0, currentGroupOutstanding - principalRepay),
            totalInterestCollected: currentInterestCollected + interestAmount,
            total_interest_collected: currentInterestCollected + interestAmount,
            totalInterest: currentInterestCollected + interestAmount,
            total_interest: currentInterestCollected + interestAmount,
            totalFund: Math.max(0, currentTotalFund + principalRepay + interestAmount),
            total_fund: Math.max(0, currentTotalFund + principalRepay + interestAmount),
            availableBalance: Math.max(0, currentTotalFund + principalRepay + interestAmount),
            available_balance: Math.max(0, currentTotalFund + principalRepay + interestAmount),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (e) {
        console.warn('Notice: Group summary update on historical repayment:', e);
      }

      return {
        success: true,
        message: 'Historical loan repayment recorded successfully',
        repaymentId,
      };
    } catch (err) {
      console.error('Failed to record historical repayment:', err);
      throw new Error(err.message || 'Failed to record historical loan repayment.');
    }
  },
};
