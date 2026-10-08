import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { groupService } from './groupService.js';
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

      const sortedContribDocs = [...contributionsSnap.docs].sort((a, b) => {
        const aDate = a.data().updatedAt || a.data().createdAt || '';
        const bDate = b.data().updatedAt || b.data().createdAt || '';
        return bDate.localeCompare(aDate);
      });
      const allContributions = sortedContribDocs.map((d) => normalizeSavings(d.id, d.data()));
      const allLoans = loansSnap.docs.map((d) => normalizeLoan(d.id, d.data()));

      const regularMemberDocs = membersSnap.docs.filter((docSnap) =>
        isRegularMember({ id: docSnap.id, ...docSnap.data() })
      );

      const members = regularMemberDocs.map((docSnap) => {
        const raw = docSnap.data();
        const memberId = docSnap.id;
        const normalized = normalizeMember(memberId, raw);
        const memberCode = normalized.memberCode || raw.member_code || '';
        const cleanId = String(memberId).toLowerCase().replace(/[-_]/g, '');
        const cleanCode = String(memberCode).toLowerCase().replace(/[-_]/g, '');

        // Deduplicate contributions for this member (1 base + 1 monthly per month/year)
        const seenKeys = new Set();
        let memberSavingsTotal = 0;
        allContributions.forEach((s) => {
          const sMId = String(s.memberId || s.member_id || '');
          const sMCode = String(s.memberCode || s.member_code || '');
          const sCleanId = sMId.toLowerCase().replace(/[-_]/g, '');
          const sCleanCode = sMCode.toLowerCase().replace(/[-_]/g, '');
          const isThisMember = sMId === memberId || sMCode === memberCode || sCleanId === cleanId || sCleanCode === cleanCode;
          if (!isThisMember) return;

          const dedupKey = s.isBase ? 'base' : `${s.year}_${s.month}`;
          if (seenKeys.has(dedupKey)) return;
          seenKeys.add(dedupKey);

          if (s.isPaid || s.paidAmount > 0) {
            memberSavingsTotal += (s.paidAmount || s.amount || 0);
          }
        });

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
      const memberCode = memberData?.memberCode || memberData?.member_code || '';
      const cleanId = String(memberId).toLowerCase().replace(/[-_]/g, '');
      const cleanCode = String(memberCode).toLowerCase().replace(/[-_]/g, '');

      const getDocTimestamp = (d) => {
        const raw = d.data() || {};
        const v = raw.updatedAt || raw.updated_at || raw.createdAt || raw.created_at;
        if (!v) return 0;
        if (typeof v.toMillis === 'function') return v.toMillis();
        if (typeof v.toDate === 'function') return v.toDate().getTime();
        if (typeof v.seconds === 'number') return v.seconds * 1000;
        const ms = new Date(v).getTime();
        return isNaN(ms) ? 0 : ms;
      };

      // Sort contributions by timestamp descending so latest update strictly takes precedence
      const sortedContribDocs = [...contribsSnap.docs].sort((a, b) => {
        return getDocTimestamp(b) - getDocTimestamp(a);
      });

      const candidateMemberIds = new Set([
        String(memberId),
        String(memberCode),
        cleanId,
        cleanCode,
      ]);

      const memberContribList = [];
      sortedContribDocs.forEach((d) => {
        const s = normalizeSavings(d.id, d.data());
        const sMId = String(s.memberId || s.member_id || '');
        const sMCode = String(s.memberCode || s.member_code || '');
        const sCleanId = sMId.toLowerCase().replace(/[-_]/g, '');
        const sCleanCode = sMCode.toLowerCase().replace(/[-_]/g, '');
        if (candidateMemberIds.has(sMId) || candidateMemberIds.has(sMCode) || candidateMemberIds.has(sCleanId) || candidateMemberIds.has(sCleanCode)) {
          memberContribList.push(s);
        }
      });

      // Find the single canonical base/opening entry
      const initialEntry = memberContribList.find((s) => s.isBase || s.month === 0) || null;
      const initialAmount = initialEntry ? (initialEntry.paidAmount || initialEntry.amount || 0) : 0;

      // Filter and deduplicate monthly regular savings (month > 0, not base)
      const seenMonthKeys = new Set();
      const regularSavings = [];
      memberContribList.forEach((s) => {
        if (s.isBase || s.month === 0) return;
        const key = `${s.year}_${s.month}`;
        if (seenMonthKeys.has(key)) return;
        seenMonthKeys.add(key);

        const paidAmount = s.paidAmount !== undefined ? s.paidAmount : (s.amount || 0);

        regularSavings.push({
          ...s,
          paidAmount,
          paid_amount: paidAmount,
          amount: paidAmount,
        });
      });

      regularSavings.sort((a, b) => b.year - a.year || b.month - a.month);

      const repaymentsList = repaysSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => {
          const rMId = String(r.memberId || r.member_id || '');
          const rCleanId = rMId.toLowerCase().replace(/[-_]/g, '');
          return rMId === memberId || rCleanId === cleanId;
        });

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
        .filter((l) => {
          const lMId = String(l.memberId || l.member_id || '');
          const lCleanId = lMId.toLowerCase().replace(/[-_]/g, '');
          return lMId === memberId || lCleanId === cleanId;
        });

      const totalMonthlySavings = regularSavings.reduce((acc, s) => acc + (s.paidAmount || s.amount || 0), 0);
      const totalSavings = initialAmount + totalMonthlySavings;

      const totalOutstanding = memberLoans
        .filter((l) => (l.status || '').toUpperCase() === 'ACTIVE')
        .reduce((acc, l) => acc + (l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0)), 0);

      return {
        success: true,
        member: memberData,
        initialEntry,
        initialAmount,
        savings: regularSavings,
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
   * Performs an exact UPDATE/replacement of the member's existing initial opening balance.
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
      const cleanId = String(memberId).toLowerCase().replace(/[-_]/g, '');
      const cleanCode = String(memberCode).toLowerCase().replace(/[-_]/g, '');

      const dateObj = new Date(paymentDate);
      const year = !isNaN(dateObj.getFullYear()) ? dateObj.getFullYear() : (parseInt(data.year, 10) || 2026);

      // Check all existing contributions to locate existing base / opening contribution doc(s) for this member
      const contribsSnap = await getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] }));

      const existingBaseDocs = contribsSnap.docs.filter((d) => {
        const dData = d.data() || {};
        const dMId = String(dData.memberId || dData.member_id || '');
        const dMCode = String(dData.memberCode || dData.member_code || '');
        const dCleanId = dMId.toLowerCase().replace(/[-_]/g, '');
        const dCleanCode = dMCode.toLowerCase().replace(/[-_]/g, '');

        const isMatch = dMId === memberId || dMCode === memberCode || dCleanId === cleanId || dCleanCode === cleanCode || d.id.includes(memberId) || d.id.includes(memberCode);
        if (!isMatch) return false;

        const m = dData.month !== undefined ? parseInt(dData.month, 10) : null;
        return (
          dData.isBase === true ||
          dData.type === 'BASE_SAVINGS' ||
          m === 0 ||
          d.id.includes('_base') ||
          dData.paymentMode === 'Opening Balance' ||
          dData.payment_mode === 'Opening Balance'
        );
      });

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
        updatedAt: new Date().toISOString(),
      };

      const canonicalSnap = contribsSnap.docs.find((d) => d.id === docId);
      if (!canonicalSnap) {
        contributionPayload.createdAt = new Date().toISOString();
      }

      await setDoc(docRef, contributionPayload, { merge: true });

      // Clean up any duplicate/alternate base records for this member so only canonical docId remains
      for (const d of existingBaseDocs) {
        if (d.id !== docId) {
          try {
            await deleteDoc(doc(db, 'groups', targetGroupId, 'monthly_contributions', d.id));
          } catch (delErr) {
            console.warn('Notice: cleanup duplicate base doc error:', delErr);
          }
        }
      }

      // Log activity in activities
      const actId = `ACT_${Date.now()}_initial`;
      await setDoc(doc(db, 'groups', targetGroupId, 'activities', actId), {
        id: actId,
        type: 'adjustment',
        amount,
        description: `Initial one-time opening amount ₹${amount.toLocaleString('en-IN')} updated for ${memberName}`,
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
        const refreshedContribsSnap = await getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions'));
        const seenMemberMonths = new Set();
        let memberMonthlySavingsTotal = 0;

        refreshedContribsSnap.docs.forEach((d) => {
          const norm = normalizeSavings(d.id, d.data());
          const sMId = String(norm.memberId || norm.member_id || '');
          const sMCode = String(norm.memberCode || norm.member_code || '');
          const sCleanId = sMId.toLowerCase().replace(/[-_]/g, '');
          const sCleanCode = sMCode.toLowerCase().replace(/[-_]/g, '');

          const isMatch = sMId === memberId || sMCode === memberCode || sCleanId === cleanId || sCleanCode === cleanCode;
          if (!isMatch) return;

          if (norm.isBase || norm.month === 0) return;

          const dedupKey = `${norm.year}_${norm.month}`;
          if (seenMemberMonths.has(dedupKey)) return;
          seenMemberMonths.add(dedupKey);

          const pureAmt = norm.paidAmount !== undefined ? norm.paidAmount : (norm.amount || 0);

          if (norm.isPaid || pureAmt > 0) {
            memberMonthlySavingsTotal += pureAmt;
          }
        });

        const newTotalSavings = amount + memberMonthlySavingsTotal;

        await updateDoc(memRef, {
          totalSavings: newTotalSavings,
          total_savings: newTotalSavings,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Notice: Member total savings update on initial amount:', e);
      }

      // Authoritative synchronization of group summary metrics from all collections
      await groupService.recalculateAndSyncGroupAggregates(targetGroupId);

      return {
        success: true,
        message: 'Initial group starting amount updated successfully',
        id: docId,
      };
    } catch (err) {
      console.error('Failed to record initial starting amount:', err);
      throw new Error(err.message || 'Failed to record initial starting amount.');
    }
  },

  /**
   * 2. Record Historical Monthly Saving (Unique Per Member + Month + Year)
   * If an existing historical saving exists for the member in the same month/year, updates that record.
   * Otherwise, creates a new historical saving record.
   */
  recordHistoricalSaving: async (data, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const memberId = String(data.member_id || data.memberId || '').trim();
      const month = parseInt(data.month, 10);
      const year = parseInt(data.year, 10);
      const rawAmount = data.amount;
      const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount || '').replace(/,/g, ''));
      const paymentDate = data.payment_date || data.paymentDate || `${year}-${String(month).padStart(2, '0')}-10`;
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

      // Fetch member info
      const memRef = doc(db, 'groups', targetGroupId, 'members', memberId);
      const memSnap = await getDoc(memRef);
      if (!memSnap.exists()) {
        throw new Error('Selected member profile not found.');
      }
      const memData = memSnap.data();
      const memberName = memData.name || memData.fullName || 'Member';
      const memberCode = memData.memberCode || memData.member_code || memberId;
      const cleanId = String(memberId).toLowerCase().replace(/[-_]/g, '');
      const cleanCode = String(memberCode).toLowerCase().replace(/[-_]/g, '');

      const candidateMemberIds = new Set([
        String(memberId),
        String(memberCode),
        cleanId,
        cleanCode,
      ]);

      // Identify existing monthly contribution record(s) for this member + month + year
      const existingContribsSnap = await getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] }));
      
      const existingMonthlyDocs = existingContribsSnap.docs.filter((d) => {
        const dData = d.data();
        const dMId = String(dData.memberId || dData.member_id || '');
        const dMCode = String(dData.memberCode || dData.member_code || '');
        const dCleanId = dMId.toLowerCase().replace(/[-_]/g, '');
        const dCleanCode = dMCode.toLowerCase().replace(/[-_]/g, '');
        const isMatch = candidateMemberIds.has(dMId) || candidateMemberIds.has(dMCode) || candidateMemberIds.has(dCleanId) || candidateMemberIds.has(dCleanCode);
        if (!isMatch) return false;
        if (dData.isBase || Number(dData.month) === 0) return false;
        return Number(dData.month) === month && Number(dData.year) === year;
      });

      const docId = `C_${memberId}_${year}_${String(month).padStart(2, '0')}`;
      const docRef = doc(db, 'groups', targetGroupId, 'monthly_contributions', docId);
      const isUpdated = existingMonthlyDocs.length > 0 || (await getDoc(docRef)).exists();

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
        month,
        year,
        isBase: false,
        type: 'SAVING',
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
        updatedAt: new Date().toISOString(),
      };

      if (!isUpdated) {
        contributionPayload.createdAt = new Date().toISOString();
      }

      await setDoc(docRef, contributionPayload, { merge: true });

      // Clean up any duplicate/alternate doc IDs for this specific member + month + year so exactly ONE record exists
      for (const d of existingMonthlyDocs) {
        if (d.id !== docId) {
          try {
            await deleteDoc(doc(db, 'groups', targetGroupId, 'monthly_contributions', d.id));
          } catch (delErr) {
            console.warn('Notice: cleanup duplicate month doc error:', delErr);
          }
        }
      }

      // Log activity
      const actId = `ACT_${Date.now()}_saving`;
      await setDoc(doc(db, 'groups', targetGroupId, 'activities', actId), {
        id: actId,
        type: 'saving',
        amount,
        description: isUpdated
          ? `${formatMonthYear(month, year)} monthly saving of ₹${amount.toLocaleString('en-IN')} updated for ${memberName}`
          : `${formatMonthYear(month, year)} monthly saving of ₹${amount.toLocaleString('en-IN')} collected for ${memberName}`,
        memberId,
        memberName,
        referenceId: docId,
        month,
        year,
        date: paymentDate,
        createdAt: new Date().toISOString(),
      });

      // Recalculate member total savings from contributions
      try {
        const refreshedContribsSnap = await getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions'));
        const seenMemberMonths = new Set();
        let baseAmount = 0;
        let memberMonthlySavingsTotal = 0;

        refreshedContribsSnap.docs.forEach((d) => {
          const norm = normalizeSavings(d.id, d.data());
          const sMId = String(norm.memberId || norm.member_id || '');
          const sMCode = String(norm.memberCode || norm.member_code || '');
          const sCleanId = sMId.toLowerCase().replace(/[-_]/g, '');
          const sCleanCode = sMCode.toLowerCase().replace(/[-_]/g, '');

          const isMatch = candidateMemberIds.has(sMId) || candidateMemberIds.has(sMCode) || candidateMemberIds.has(sCleanId) || candidateMemberIds.has(sCleanCode);
          if (!isMatch) return;

          if (norm.isBase || norm.month === 0) {
            baseAmount = norm.paidAmount || norm.amount || 0;
            return;
          }

          const dedupKey = `${norm.year}_${norm.month}`;
          if (seenMemberMonths.has(dedupKey)) return;
          seenMemberMonths.add(dedupKey);

          const pureAmt = norm.paidAmount !== undefined ? norm.paidAmount : (norm.amount || 0);

          if (norm.isPaid || pureAmt > 0) {
            memberMonthlySavingsTotal += pureAmt;
          }
        });

        const newTotalSavings = baseAmount + memberMonthlySavingsTotal;

        await updateDoc(memRef, {
          totalSavings: newTotalSavings,
          total_savings: newTotalSavings,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Notice: Member total savings update on historical saving:', e);
      }

      // Authoritative synchronization of group summary metrics
      await groupService.recalculateAndSyncGroupAggregates(targetGroupId);

      return {
        success: true,
        message: isUpdated ? 'Historical monthly saving updated successfully' : 'Historical monthly saving saved successfully',
        id: docId,
        isUpdated,
      };
    } catch (err) {
      console.error('Failed to record historical monthly saving:', err);
      throw new Error(err.message || 'Failed to record historical monthly saving.');
    }
  },

  /**
   * 3a. Update Existing Historical Loan by exact Firestore Document ID
   * Updates ONLY the specified existing loan document. Never creates a new document.
   */
  updateHistoricalLoan: async (loanId, data, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      if (!loanId || typeof loanId !== 'string' || !loanId.trim()) {
        throw new Error('Valid Loan Document ID is required for update.');
      }
      const cleanLoanId = loanId.trim();

      const loanDocRef = doc(db, 'groups', targetGroupId, 'loans', cleanLoanId);
      const loanSnap = await getDoc(loanDocRef);
      if (!loanSnap.exists()) {
        throw new Error(`Historical loan record [${cleanLoanId}] not found in database.`);
      }

      const existingData = loanSnap.data() || {};
      const memberId = String(data.member_id || data.memberId || existingData.memberId || existingData.member_id || '').trim();
      const rawPrincipal = data.principal_amount !== undefined ? data.principal_amount : (data.principalAmount !== undefined ? data.principalAmount : data.originalPrincipal);
      const principal = typeof rawPrincipal === 'number' ? rawPrincipal : parseFloat(String(rawPrincipal || '').replace(/,/g, ''));
      const interestRate = parseFloat(data.interest_rate !== undefined ? data.interest_rate : (data.interestRate !== undefined ? data.interestRate : existingData.interestRate)) || 2.0;
      const durationMonths = parseInt(data.duration_months || data.durationMonths || existingData.durationMonths || 12, 10) || 12;
      const issueDate = data.loan_date || data.issueDate || data.payment_date || existingData.issueDate || existingData.loanDate || new Date().toISOString().split('T')[0];
      const purpose = (data.purpose || data.remarks || existingData.purpose || 'Historical Loan').trim();

      if (!Number.isFinite(principal) || isNaN(principal) || principal <= 0) {
        throw new Error('Please enter a valid positive loan principal amount.');
      }
      if (!issueDate) {
        throw new Error('Please select the actual historical loan issue date.');
      }

      const { month: targetMonth, year: targetYear } = getLoanMonthYear(issueDate);

      // Available balance validation based on difference between new and old principal
      const oldPrincipal = Number(existingData.originalPrincipal !== undefined ? existingData.originalPrincipal : (existingData.principalAmount || existingData.principal_amount || 0));
      const additionalRequired = principal - oldPrincipal;

      const balanceRes = await loanService.getAvailableBalance(targetGroupId);
      const availableBalance = (balanceRes && typeof balanceRes.availableBalance === 'number') ? balanceRes.availableBalance : 0;

      if (additionalRequired > 0) {
        if (availableBalance <= 0) {
          throw new Error('Loan amount increase cannot exceed available balance of ₹0.');
        }
        if (additionalRequired > availableBalance) {
          const formattedMax = `₹${Math.round(availableBalance).toLocaleString('en-IN')}`;
          const formattedAdd = `₹${Math.round(additionalRequired).toLocaleString('en-IN')}`;
          throw new Error(`Loan amount increase of ${formattedAdd} exceeds available balance of ${formattedMax}.`);
        }
      }

      // Fetch member info
      const memRef = doc(db, 'groups', targetGroupId, 'members', memberId);
      const memSnap = await getDoc(memRef).catch(() => null);
      const memberName = memSnap?.exists() ? (memSnap.data()?.name || memSnap.data()?.fullName || existingData.memberName || 'Member') : (existingData.memberName || 'Member');
      const memberCode = memSnap?.exists() ? (memSnap.data()?.memberCode || memSnap.data()?.member_code || memberId) : (existingData.memberCode || memberId);

      // Fetch repayments made against this loan
      const [repaysSnap, altRepaysSnap] = await Promise.all([
        getDocs(query(collection(db, 'groups', targetGroupId, 'repayments'), where('loanId', '==', cleanLoanId))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'groups', targetGroupId, 'repayments'), where('loan_id', '==', cleanLoanId))).catch(() => ({ docs: [] })),
      ]);

      const allRepayDocs = [...repaysSnap.docs, ...altRepaysSnap.docs.filter((d) => !repaysSnap.docs.some((rd) => rd.id === d.id))];
      const totalPrincipalRepaid = allRepayDocs.reduce((sum, d) => {
        const r = d.data() || {};
        return sum + Number(r.principalAmount || r.principalPaid || r.principalRepaid || r.principal_repayment_amount || 0);
      }, 0);

      const newPendingPrincipal = Math.max(0, principal - totalPrincipalRepaid);
      const status = newPendingPrincipal <= 0 ? 'CLOSED' : 'ACTIVE';

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

      await updateDoc(loanDocRef, updatedLoanPayload);

      // Log update activity
      const actId = `ACT_${Date.now()}_loan_update`;
      await setDoc(doc(db, 'groups', targetGroupId, 'activities', actId), {
        id: actId,
        type: 'loan_update',
        amount: principal,
        description: `Historical loan updated to ₹${principal.toLocaleString('en-IN')} for ${memberName} (${formatMonthYear(targetMonth, targetYear)})`,
        memberId,
        memberName,
        referenceId: cleanLoanId,
        date: issueDate,
        createdAt: new Date().toISOString(),
      });

      // Recalculate member active loan amount
      try {
        const refreshedLoansSnap = await getDocs(collection(db, 'groups', targetGroupId, 'loans'));
        const memberActiveLoans = refreshedLoansSnap.docs
          .map((d) => normalizeLoan(d.id, d.data()))
          .filter((l) => (String(l.memberId) === String(memberId) || String(l.member_id) === String(memberId)) && (l.status || '').toUpperCase() === 'ACTIVE');
        
        const memberLoanOutstanding = memberActiveLoans.reduce(
          (acc, l) => acc + (l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0)),
          0
        );

        await updateDoc(memRef, {
          activeLoanAmount: memberLoanOutstanding,
          outstanding_loans: memberLoanOutstanding,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Notice: Member loan outstanding update on historical loan update:', e);
      }

      // Authoritative synchronization of group summary metrics
      await groupService.recalculateAndSyncGroupAggregates(targetGroupId);

      return {
        success: true,
        message: 'Historical loan updated successfully',
        loanId: cleanLoanId,
        isUpdated: true,
      };
    } catch (err) {
      console.error('Failed to update historical loan:', err);
      throw new Error(err.message || 'Failed to update historical loan.');
    }
  },

  /**
   * 3b. Create New Historical Loan (CREATE Mode)
   */
  createHistoricalLoan: async (data, groupId = DEFAULT_GROUP_ID) => {
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

      const [balanceRes, memSnap, loansSnap, repaysSnap] = await Promise.all([
        loanService.getAvailableBalance(targetGroupId),
        getDoc(doc(db, 'groups', targetGroupId, 'members', memberId)),
        getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'repayments')).catch(() => ({ docs: [] })),
      ]);

      if (!memSnap.exists()) {
        throw new Error('Selected member profile not found.');
      }
      const mData = memSnap.data();
      const memberName = mData.name || mData.fullName || 'Member';
      const memberCode = mData.memberCode || mData.member_code || memberId;
      const cleanId = String(memberId).toLowerCase().replace(/[-_]/g, '');
      const cleanCode = String(memberCode).toLowerCase().replace(/[-_]/g, '');

      const candidateMemberIds = new Set([
        String(memberId),
        String(memberCode),
        cleanId,
        cleanCode,
      ]);

      // Check if the member already has an active / outstanding loan
      const repaymentsByLoan = {};
      repaysSnap.docs.forEach((d) => {
        const r = d.data() || {};
        const lId = r.loanId || r.loan_id;
        if (lId) {
          if (!repaymentsByLoan[lId]) repaymentsByLoan[lId] = [];
          repaymentsByLoan[lId].push({ id: d.id, ...r });
        }
      });

      const memberActiveLoans = loansSnap.docs
        .map((d) => {
          const lRepays = repaymentsByLoan[d.id] || repaymentsByLoan[d.data().loanId] || [];
          return normalizeLoan(d.id, d.data(), lRepays);
        })
        .filter((l) => {
          const lMId = String(l.memberId || l.member_id || '');
          const lMCode = String(l.memberCode || l.member_code || '');
          const lCleanId = lMId.toLowerCase().replace(/[-_]/g, '');
          const lCleanCode = lMCode.toLowerCase().replace(/[-_]/g, '');
          const isThisMember = candidateMemberIds.has(lMId) || candidateMemberIds.has(lMCode) || candidateMemberIds.has(lCleanId) || candidateMemberIds.has(lCleanCode);
          const isActive = (l.status || '').toUpperCase() === 'ACTIVE';
          const pending = Number(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0));
          return isThisMember && isActive && pending > 0;
        });

      if (memberActiveLoans.length > 0) {
        throw new Error('This member already has an active outstanding loan. A new loan cannot be issued until the existing loan is fully repaid.');
      }

      const availableBalance = (balanceRes && typeof balanceRes.availableBalance === 'number') ? balanceRes.availableBalance : 0;
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

      // Recalculate member active loan amount
      try {
        const memRef = doc(db, 'groups', targetGroupId, 'members', memberId);
        const refreshedLoansSnap = await getDocs(collection(db, 'groups', targetGroupId, 'loans'));
        const memberActiveLoans = refreshedLoansSnap.docs
          .map((d) => normalizeLoan(d.id, d.data()))
          .filter((l) => (String(l.memberId) === String(memberId) || String(l.member_id) === String(memberId)) && (l.status || '').toUpperCase() === 'ACTIVE');
        
        const memberLoanOutstanding = memberActiveLoans.reduce(
          (acc, l) => acc + (l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0)),
          0
        );

        await updateDoc(memRef, {
          activeLoanAmount: memberLoanOutstanding,
          outstanding_loans: memberLoanOutstanding,
          updatedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Notice: Member loan outstanding update on historical loan create:', e);
      }

      // Authoritative synchronization of group summary metrics
      await groupService.recalculateAndSyncGroupAggregates(targetGroupId);

      return {
        success: true,
        message: 'Historical loan saved successfully',
        loanId,
        isUpdated: false,
      };
    } catch (err) {
      console.error('Failed to create historical loan:', err);
      throw new Error(err.message || 'Failed to create historical loan.');
    }
  },

  /**
   * 3c. Record Historical Loan (Unified Dispatcher)
   */
  recordHistoricalLoan: async (data, groupId = DEFAULT_GROUP_ID) => {
    const targetLoanId = String(data.loan_id || data.loanId || '').trim();
    if (targetLoanId) {
      return adjustmentService.updateHistoricalLoan(targetLoanId, data, groupId);
    }
    return adjustmentService.createHistoricalLoan(data, groupId);
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
      await groupService.recalculateAndSyncGroupAggregates(targetGroupId);

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

  /**
   * 5. Delete Historical Monthly Saving
   */
  deleteHistoricalSaving: async (savingId, memberId, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      if (!savingId) throw new Error('Saving ID is required for deletion');

      const savingRef = doc(db, 'groups', targetGroupId, 'monthly_contributions', savingId);
      const savingSnap = await getDoc(savingRef);
      const savingData = savingSnap.exists() ? savingSnap.data() : null;
      const targetMemberId = memberId || savingData?.memberId || savingData?.member_id;
      const memberName = savingData?.memberName || savingData?.member_name || 'Member';
      const month = savingData?.month || 0;
      const year = savingData?.year || 2026;
      const amount = Number(savingData?.paidAmount || savingData?.amount || 0);

      await deleteDoc(savingRef);

      // Recalculate member total savings from remaining contributions
      if (targetMemberId) {
        try {
          const memRef = doc(db, 'groups', targetGroupId, 'members', targetMemberId);
          const memSnap = await getDoc(memRef);
          if (memSnap.exists()) {
            const memData = memSnap.data();
            if (!memberName || memberName === 'Member') {
              memberName = memData.name || memData.fullName || memData.full_name || 'Member';
            }
            const memberCode = memData.memberCode || memData.member_code || targetMemberId;
            const cleanId = String(targetMemberId).toLowerCase().replace(/[-_]/g, '');
            const cleanCode = String(memberCode).toLowerCase().replace(/[-_]/g, '');
            const candidateMemberIds = new Set([String(targetMemberId), String(memberCode), cleanId, cleanCode]);

            const refreshedContribsSnap = await getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions'));
            const seenMemberMonths = new Set();
            let baseAmount = 0;
            let memberMonthlySavingsTotal = 0;

            refreshedContribsSnap.docs.forEach((d) => {
              const norm = normalizeSavings(d.id, d.data());
              const sMId = String(norm.memberId || norm.member_id || '');
              const sMCode = String(norm.memberCode || norm.member_code || '');
              const sCleanId = sMId.toLowerCase().replace(/[-_]/g, '');
              const sCleanCode = sMCode.toLowerCase().replace(/[-_]/g, '');

              const isMatch = candidateMemberIds.has(sMId) || candidateMemberIds.has(sMCode) || candidateMemberIds.has(sCleanId) || candidateMemberIds.has(sCleanCode);
              if (!isMatch) return;

              if (norm.isBase || norm.month === 0) {
                baseAmount = norm.paidAmount || norm.amount || 0;
                return;
              }

              const dedupKey = `${norm.year}_${norm.month}`;
              if (seenMemberMonths.has(dedupKey)) return;
              seenMemberMonths.add(dedupKey);

              const pureAmt = norm.paidAmount !== undefined ? norm.paidAmount : (norm.amount || 0);
              if (norm.isPaid || pureAmt > 0) {
                memberMonthlySavingsTotal += pureAmt;
              }
            });

            const newTotalSavings = baseAmount + memberMonthlySavingsTotal;
            await updateDoc(memRef, {
              totalSavings: newTotalSavings,
              total_savings: newTotalSavings,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (memErr) {
          console.warn('Notice: Member total savings update on delete:', memErr);
        }
      }

      // Authoritative synchronization of group summary metrics
      await groupService.recalculateAndSyncGroupAggregates(targetGroupId);

      // Log activity
      const actId = `ACT_${Date.now()}_del_saving`;
      await setDoc(doc(db, 'groups', targetGroupId, 'activities', actId), {
        id: actId,
        type: 'saving_deleted',
        amount,
        description: `Historical monthly saving of ₹${amount.toLocaleString('en-IN')} deleted for ${memberName}`,
        memberId: targetMemberId,
        memberName,
        referenceId: savingId,
        month,
        year,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'Historical monthly saving deleted successfully',
      };
    } catch (err) {
      console.error('Failed to delete historical monthly saving:', err);
      throw new Error(err.message || 'Failed to delete historical monthly saving.');
    }
  },

  /**
   * 6. Delete Historical Loan
   */
  deleteHistoricalLoan: async (loanId, memberId, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      if (!loanId) throw new Error('Loan ID is required for deletion');

      const loanRef = doc(db, 'groups', targetGroupId, 'loans', loanId);
      const loanSnap = await getDoc(loanRef);
      const loanData = loanSnap.exists() ? loanSnap.data() : null;
      const targetMemberId = memberId || loanData?.memberId || loanData?.member_id;
      const memberName = loanData?.memberName || loanData?.member_name || 'Member';
      const principal = Number(loanData?.originalPrincipal || loanData?.principalAmount || 0);

      // Clean up any repayments made specifically against this loan
      const [repaysSnap, altRepaysSnap] = await Promise.all([
        getDocs(query(collection(db, 'groups', targetGroupId, 'repayments'), where('loanId', '==', loanId))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'groups', targetGroupId, 'repayments'), where('loan_id', '==', loanId))).catch(() => ({ docs: [] })),
      ]);

      const allRepayDocs = [...repaysSnap.docs, ...altRepaysSnap.docs.filter((d) => !repaysSnap.docs.some((rd) => rd.id === d.id))];
      for (const rDoc of allRepayDocs) {
        try {
          await deleteDoc(doc(db, 'groups', targetGroupId, 'repayments', rDoc.id));
        } catch (delRepayErr) {
          console.warn('Notice: cleanup repayment on loan delete error:', delRepayErr);
        }
      }

      await deleteDoc(loanRef);

      // Recalculate member outstanding loans
      if (targetMemberId) {
        try {
          const memRef = doc(db, 'groups', targetGroupId, 'members', targetMemberId);
          const memSnap = await getDoc(memRef);
          if (memSnap.exists()) {
            const memData = memSnap.data();
            if (!memberName || memberName === 'Member') {
              memberName = memData.name || memData.fullName || memData.full_name || 'Member';
            }
          }
          const remainingLoansSnap = await getDocs(collection(db, 'groups', targetGroupId, 'loans'));
          const memberActiveLoans = remainingLoansSnap.docs
            .map((d) => normalizeLoan(d.id, d.data()))
            .filter((l) => (String(l.memberId) === String(targetMemberId) || String(l.member_id) === String(targetMemberId)) && (l.status || '').toUpperCase() === 'ACTIVE');
          
          const memberLoanOutstanding = memberActiveLoans.reduce(
            (acc, l) => acc + (l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0)),
            0
          );

          await updateDoc(memRef, {
            activeLoanAmount: memberLoanOutstanding,
            outstanding_loans: memberLoanOutstanding,
            updatedAt: new Date().toISOString(),
          });
        } catch (memErr) {
          console.warn('Notice: Member outstanding loans update on delete:', memErr);
        }
      }

      // Authoritative synchronization of group summary metrics
      await groupService.recalculateAndSyncGroupAggregates(targetGroupId);

      // Log activity
      const actId = `ACT_${Date.now()}_del_loan`;
      await setDoc(doc(db, 'groups', targetGroupId, 'activities', actId), {
        id: actId,
        type: 'loan_deleted',
        amount: principal,
        description: `Historical loan of ₹${principal.toLocaleString('en-IN')} deleted for ${memberName}`,
        memberId: targetMemberId,
        memberName,
        referenceId: loanId,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'Historical loan deleted successfully',
      };
    } catch (err) {
      console.error('Failed to delete historical loan:', err);
      throw new Error(err.message || 'Failed to delete historical loan.');
    }
  },

  /**
   * 7. Delete Historical Repayment
   */
  deleteHistoricalRepayment: async (repaymentId, loanId, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      if (!repaymentId) throw new Error('Repayment ID is required for deletion');

      const repayRef = doc(db, 'groups', targetGroupId, 'repayments', repaymentId);
      const repaySnap = await getDoc(repayRef);
      if (!repaySnap.exists()) {
        throw new Error('Repayment record not found');
      }
      const repayData = repaySnap.data() || {};
      const targetLoanId = loanId || repayData.loanId || repayData.loan_id;
      const principalRepaid = Number(repayData.principalAmount || repayData.principalPaid || 0);
      const interestPaid = Number(repayData.interestAmount || repayData.interestPaid || 0);
      const memberId = repayData.memberId || repayData.member_id;

      // Adjust the parent loan
      if (targetLoanId) {
        try {
          const loanRef = doc(db, 'groups', targetGroupId, 'loans', targetLoanId);
          const loanSnap = await getDoc(loanRef);
          if (loanSnap.exists()) {
            const lData = loanSnap.data() || {};
            const origPrincipal = Number(lData.originalPrincipal || lData.principalAmount || 0);
            const currPending = Number(lData.pendingPrincipal !== undefined ? lData.pendingPrincipal : (lData.remainingAmount || 0));
            const currPrincipalPaid = Number(lData.totalPrincipalPaid || lData.total_principal_paid || 0);
            const currInterestPaid = Number(lData.totalInterestPaid || lData.total_interest_paid || 0);

            const newPending = Math.min(origPrincipal, currPending + principalRepaid);
            const newPrincipalPaid = Math.max(0, currPrincipalPaid - principalRepaid);
            const newInterestPaid = Math.max(0, currInterestPaid - interestPaid);
            const newStatus = newPending > 0 ? 'ACTIVE' : 'CLOSED';

            await updateDoc(loanRef, {
              pendingPrincipal: newPending,
              remainingAmount: newPending,
              outstandingAmount: newPending,
              totalPrincipalPaid: newPrincipalPaid,
              total_principal_paid: newPrincipalPaid,
              totalInterestPaid: newInterestPaid,
              total_interest_paid: newInterestPaid,
              status: newStatus,
              status_lower: newStatus.toLowerCase(),
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (loanErr) {
          console.warn('Notice: Loan update on repayment delete:', loanErr);
        }
      }

      await deleteDoc(repayRef);

      // Authoritative synchronization of group summary metrics
      await groupService.recalculateAndSyncGroupAggregates(targetGroupId);

      // Log activity
      const actId = `ACT_${Date.now()}_del_repay`;
      await setDoc(doc(db, 'groups', targetGroupId, 'activities', actId), {
        id: actId,
        type: 'repayment_deleted',
        amount: principalRepaid + interestPaid,
        description: `Historical repayment of ₹${(principalRepaid + interestPaid).toLocaleString('en-IN')} deleted`,
        memberId,
        referenceId: repaymentId,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'Historical repayment deleted successfully',
      };
    } catch (err) {
      console.error('Failed to delete historical repayment:', err);
      throw new Error(err.message || 'Failed to delete historical repayment.');
    }
  },
};
