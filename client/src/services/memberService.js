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
  orderBy,
  serverTimestamp,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { db, firebaseConfig } from '../config/firebase.js';
import {
  normalizeMember,
  normalizeSavings,
  normalizeLoan,
  calculateMonthlyMemberStatus,
  isRegularMember,
  compareMemberNumericOrder,
  DEFAULT_GROUP_ID,
} from '../utils/formatters.js';
import { groupService } from './groupService.js';

export { calculateMonthlyMemberStatus, isRegularMember };

/**
 * Pure helper to compute Monthly Payment Summary across members
 */
export function getMonthlyPaymentSummary({
  members = [],
  monthlyPayments = [],
  selectedMonth = new Date().getMonth() + 1,
  selectedYear = new Date().getFullYear(),
  defaultMonthlyShare = 1000,
}) {
  const m = Number(selectedMonth);
  const y = Number(selectedYear);

  const membersWithDues = members.map((mem) => {
    const dueInfo = calculateMonthlyMemberStatus({
      member: mem,
      payments: monthlyPayments,
      selectedMonth: m,
      selectedYear: y,
      monthlyShare: defaultMonthlyShare,
    });

    return {
      ...mem,
      ...dueInfo,
    };
  });

  const paidMembers = membersWithDues.filter((m) => m.isPaid);
  const pendingMembers = membersWithDues.filter((m) => m.isPending);

  return {
    totalMembers: membersWithDues.length,
    paidCount: paidMembers.length,
    pendingCount: pendingMembers.length,
    paidMembers,
    pendingMembers,
    membersWithDues,
  };
}

export const memberService = {
  calculateMonthlyMemberStatus,
  getMonthlyPaymentSummary,
  /**
   * Get next member serial code
   */
  getNextMemberCode: async (groupId = DEFAULT_GROUP_ID) => {
    const targetGroupId = groupId || DEFAULT_GROUP_ID;
    const [membersSnap, counterSnap] = await Promise.all([
      getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
      getDoc(doc(db, 'groups', targetGroupId, 'system', 'member_counter')).catch(() => null),
    ]);
    let maxNumber = Number(counterSnap?.data()?.lastNumber || 0);
    membersSnap.docs.filter((d) => isRegularMember(d.data())).forEach((memberDoc) => {
      const data = memberDoc.data();
      const candidates = [memberDoc.id, data.memberCode, data.member_code];
      candidates.forEach((value) => {
        const number = parseInt(String(value || '').replace(/\D/g, ''), 10);
        if (Number.isFinite(number)) maxNumber = Math.max(maxNumber, number);
      });
    });
    return { success: true, memberCode: `M-${maxNumber + 1}` };
  },

  /**
   * Get all members with aggregated savings and loan data from Flutter subcollections
   */
  getAllMembers: async (params = {}, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const m = parseInt(params.month, 10) || (new Date().getMonth() + 1);
      const y = parseInt(params.year, 10) || new Date().getFullYear();

      // Read collections directly for target group
      const [membersSnap, contributionsSnap, loansSnap, groupDocSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
        getDoc(doc(db, 'groups', targetGroupId)).catch(() => null),
      ]);

      const defaultMonthlyShare = Number(
        groupDocSnap?.data()?.monthly_contribution_per_share ??
        groupDocSnap?.data()?.monthlyContributionPerShare ??
        groupDocSnap?.data()?.monthlyContribution ??
        groupDocSnap?.data()?.monthly_contribution ??
        groupDocSnap?.data()?.monthlyShare ??
        groupDocSnap?.data()?.monthly_share ??
        groupDocSnap?.data()?.monthlyContributionAmount ??
        1000
      );
      const allContributions = contributionsSnap.docs.map((d) => normalizeSavings(d.id, d.data()));
      const allLoans = loansSnap.docs.map((d) => normalizeLoan(d.id, d.data()));

      const regularMemberDocs = membersSnap.docs.filter((docSnap) => isRegularMember({ id: docSnap.id, ...docSnap.data() }));

      const members = regularMemberDocs.map((docSnap) => {
        const raw = docSnap.data();
        const memberId = docSnap.id;
        const normalized = normalizeMember(memberId, raw);

        // Calculate member savings total
        const memberSavingsTotal = allContributions
          .filter((s) => s.memberId === memberId || s.member_id === memberId)
          .reduce((acc, s) => acc + (s.paidAmount || 0), 0);

        // Calculate active loan outstanding
        const memberActiveLoans = allLoans.filter(
          (l) => (l.memberId === memberId || l.member_id === memberId) && (l.status || '').toUpperCase() === 'ACTIVE'
        );
        const memberLoanOutstanding = memberActiveLoans.reduce(
          (acc, l) => acc + (l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.remainingAmount || 0)),
          0
        );

        // Monthly due calculation for the selected period
        const dueInfo = calculateMonthlyMemberStatus({
          member: normalized,
          payments: allContributions,
          selectedMonth: m,
          selectedYear: y,
          monthlyShare: defaultMonthlyShare,
        });

        return {
          ...normalized,
          ...dueInfo,
          account_status: normalized.status || 'ACTIVE',
          accountStatus: normalized.status || 'ACTIVE',
          member_status: normalized.status || 'ACTIVE',
          memberStatus: normalized.status || 'ACTIVE',
          total_savings: memberSavingsTotal,
          totalSavings: memberSavingsTotal,
          outstanding_loans: memberLoanOutstanding,
          active_loan_amount: memberLoanOutstanding,
          active_loans_count: memberActiveLoans.length,
          monthly_share: dueInfo.requiredAmount,
          monthlyShare: dueInfo.requiredAmount,
          monthlyContribution: dueInfo.requiredAmount,
          monthly_contribution: dueInfo.requiredAmount,
          monthlyContributionPerShare: defaultMonthlyShare,
          monthly_contribution_per_share: defaultMonthlyShare,
          monthlyHaftaAmount: dueInfo.requiredAmount,
          paid_amount: dueInfo.amountPaid,
          paidAmount: dueInfo.amountPaid,
          current_due: dueInfo.currentDues,
          currentDue: dueInfo.currentDues,
          pending_amount: dueInfo.currentDues,
          pendingAmount: dueInfo.currentDues,
          remaining_due: dueInfo.currentDues,
          remainingDue: dueInfo.currentDues,
          status: dueInfo.status,
          due_status: dueInfo.status,
          dueStatus: dueInfo.status,
          payment_status: dueInfo.status,
          paymentStatus: dueInfo.status,
          has_paid_current_month: dueInfo.isPaid,
          hasPaidCurrentMonth: dueInfo.isPaid,
          is_pending_dues: dueInfo.isPending,
          isPendingDues: dueInfo.isPending,
        };
      }).filter((m) => isRegularMember(m));

      // Filter by search / status / role if passed
      let filtered = members;
      if (params.role) {
        const targetRole = params.role.toLowerCase();
        filtered = filtered.filter((m) => (m.role || '').toLowerCase() === targetRole);
      }
      if (params.status === 'active') {
        filtered = filtered.filter((m) => m.isActive);
      } else if (params.status === 'inactive') {
        filtered = filtered.filter((m) => !m.isActive);
      }

      if (params.search) {
        const s = params.search.toLowerCase();
        filtered = filtered.filter(
          (m) =>
            m.name.toLowerCase().includes(s) ||
            m.email.toLowerCase().includes(s) ||
            m.phone.includes(s) ||
            m.memberCode.toLowerCase().includes(s) ||
            m.id.toLowerCase().includes(s)
        );
      }

      // Sort by member ID in natural ascending numerical order (e.g. M_1, M_2 ... M_9, M_10 ... M_99, M_100 ... M_365)
      filtered.sort(compareMemberNumericOrder);

      const pendingMembersCount = filtered.filter((m) => m.isPendingDues).length;
      const paidMembersCount = filtered.filter((m) => m.hasPaidCurrentMonth).length;

      return {
        success: true,
        count: filtered.length,
        totalMembers: filtered.length,
        paidCount: paidMembersCount,
        pendingCount: pendingMembersCount,
        members: filtered,
      };
    } catch (err) {
      console.error('Failed to get members from Firestore:', err);
      return { success: true, count: 0, members: [] };
    }
  },

  /**
   * Get single member details by ID with savings and loan history
   */
  getMemberById: async (memberId, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;

      let memberDocRef = doc(db, 'groups', targetGroupId, 'members', memberId);
      let memberDocSnap = await getDoc(memberDocRef);
      let actualMemberId = memberId;
      let rawData = null;

      if (memberDocSnap.exists()) {
        rawData = memberDocSnap.data();
      } else {
        // Search by userId or authUid or email
        try {
          const membersSnap = await getDocs(collection(db, 'groups', targetGroupId, 'members'));
          const found = membersSnap.docs.find((d) => {
            const data = d.data();
            return (
              d.id === memberId ||
              data.userId === memberId ||
              data.authUid === memberId ||
              data.firebaseUid === memberId ||
              (data.email && data.email.toLowerCase() === memberId.toLowerCase())
            );
          });

          if (found) {
            memberDocSnap = found;
            actualMemberId = found.id;
            rawData = found.data();
          }
        } catch (e) {
          console.warn('Notice: Subcollection search in getMemberById:', e);
        }
      }

      if (!rawData) {
        throw new Error('Member profile not found in active Bachat Gat.');
      }

      const normalized = normalizeMember(actualMemberId, rawData);

      // Fetch member monthly contributions, loans, repayments, and group config
      const [contributionsSnap, loansSnap, repaymentsSnap, groupDocSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'repayments')).catch(() => ({ docs: [] })),
        getDoc(doc(db, 'groups', targetGroupId)).catch(() => null),
      ]);

      const groupContributionPerShare = Number(
        groupDocSnap?.data()?.monthly_contribution_per_share ??
        groupDocSnap?.data()?.monthlyContributionPerShare ??
        groupDocSnap?.data()?.monthlyContribution ??
        groupDocSnap?.data()?.monthly_contribution ??
        groupDocSnap?.data()?.monthlyShare ??
        groupDocSnap?.data()?.monthly_share ??
        groupDocSnap?.data()?.monthlyContributionAmount ??
        1000
      );
      const memberShares = Number(normalized.shares || normalized.shareCount || 1);
      const calculatedMonthlyContribution = memberShares * groupContributionPerShare;

      const memberSavings = contributionsSnap.docs
        .map((d) => normalizeSavings(d.id, d.data()))
        .filter((s) => s.memberId === actualMemberId || s.member_id === actualMemberId)
        .sort((a, b) => b.year - a.year || b.month - a.month);

      const repaymentsList = repaymentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.memberId === actualMemberId || r.member_id === actualMemberId);

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
        .filter((l) => l.memberId === actualMemberId || l.member_id === actualMemberId);

      const totalSavings = memberSavings.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
      const totalOutstanding = memberLoans
        .filter((l) => l.status === 'ACTIVE')
        .reduce((acc, l) => acc + (l.pendingPrincipal || 0), 0);

      const legacyRepayments = memberSavings
        .filter((s) => s.loanPrincipalPaid > 0 || s.interestAmount > 0)
        .map((s) => ({
          id: s.id,
          repaymentId: s.id,
          principalAmount: s.loanPrincipalPaid,
          interestAmount: s.interestAmount,
          amount: s.loanPrincipalPaid + s.interestAmount,
          paymentDate: s.paymentDate,
          paymentMode: s.paymentMode,
          month: s.month,
          year: s.year,
        }));

      const allMemberRepayments = [
        ...repaymentsList.map((r) => ({
          id: r.id,
          repaymentId: r.id,
          loanId: r.loanId || r.loan_id,
          principalAmount: Number(r.principalAmount || r.principalPaid || r.principalRepaid || 0),
          interestAmount: Number(r.interestAmount || r.interestPaid || r.interest_amount || 0),
          amount: Number(r.totalPayment || r.totalPaid || r.amount || 0),
          paymentDate: r.paymentDate || r.paidAt || r.payment_date || r.createdAt,
          paymentMode: r.paymentMode || r.payment_mode || 'UPI',
          month: r.month || r.paymentMonth || 0,
          year: r.year || r.paymentYear || 0,
        })),
        ...legacyRepayments.filter((lr) => !repaymentsList.some((r) => r.id === lr.id)),
      ].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

      const memberPayload = {
        ...normalized,
        monthlyContribution: calculatedMonthlyContribution,
        monthly_contribution: calculatedMonthlyContribution,
        monthlyContributionPerShare: groupContributionPerShare,
        monthly_contribution_per_share: groupContributionPerShare,
        monthlyShare: calculatedMonthlyContribution,
        monthly_share: calculatedMonthlyContribution,
        monthlyHaftaAmount: calculatedMonthlyContribution,
        total_savings: totalSavings,
        totalSavings: totalSavings,
        total_outstanding: totalOutstanding,
        totalOutstanding: totalOutstanding,
        savings_history: memberSavings,
        savingsHistory: memberSavings,
        loans_history: memberLoans,
        loans: memberLoans,
        repayments: allMemberRepayments,
      };

      return {
        success: true,
        member: memberPayload,
      };
    } catch (err) {
      console.error('Failed to get member by ID:', err);
      throw err;
    }
  },

  /**
   * Register or add new member in Firestore
   */
  createMember: async (memberData, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const cleanName = (memberData.name || memberData.fullName || '').trim();
      const cleanEmail = (memberData.email || '').trim().toLowerCase();
      const cleanPhone = (memberData.phone || '').trim();
      const normalizedName = cleanName.toLowerCase().replace(/\s+/g, ' ');
      const requestedRole = (memberData.role_name || 'MEMBER').trim().toUpperCase();
      const allowedRoles = ['MEMBER', 'TREASURER', 'SECRETARY'];

      if (!cleanName) {
        throw new Error('Member name is required.');
      }
      if (!allowedRoles.includes(requestedRole)) {
        throw new Error('Only Member, Treasurer, or Secretary roles can be assigned here.');
      }

      // Read the customer list and counter for duplicate checks and serial allocation
      const counterRef = doc(db, 'groups', targetGroupId, 'system', 'member_counter');
      const [membersSnap, counterSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
        getDoc(counterRef).catch(() => null),
      ]);

      const duplicateMember = membersSnap.docs.find((memberDoc) => {
        const data = memberDoc.data();
        const existingName = (data.name || data.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const existingEmail = (data.email || '').trim().toLowerCase();
        return (cleanEmail && existingEmail === cleanEmail) ||
          (normalizedName && existingName === normalizedName);
      });
      if (duplicateMember) {
        const existing = duplicateMember.data();
        const existingEmail = (existing.email || '').trim().toLowerCase();
        const duplicateField = (cleanEmail && existingEmail === cleanEmail)
          ? 'email address'
          : 'name';
        throw new Error(`Duplicate member not added. This ${duplicateField} already belongs to ${existing.name || existing.fullName || duplicateMember.id}.`);
      }
      let observedMax = Number(counterSnap?.data()?.lastNumber || 0);
      membersSnap.docs.forEach((d) => {
        const data = d.data();
        [d.id, data.memberCode, data.member_code].forEach((value) => {
          const num = parseInt(String(value || '').replace(/\D/g, ''), 10);
          if (Number.isFinite(num)) observedMax = Math.max(observedMax, num);
        });
      });

      const nextNumber = observedMax + 1;
      const newMemberId = `M_${nextNumber}`;
      const newMemberCode = `M-${nextNumber}`;

      const totalMonthlyContribution = parseFloat(memberData.monthly_contribution || memberData.monthlyContribution) || 1000;
      const numShares = parseInt(memberData.shares, 10) || 1;
      const contributionPerShare = parseFloat(memberData.monthlyContributionPerShare || memberData.monthly_contribution_per_share) || (totalMonthlyContribution / numShares);

      const newMemberPayload = {
        id: newMemberId,
        name: cleanName,
        fullName: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        userId: null,
        authUid: null,
        firebaseUid: null,
        groupId: targetGroupId,
        memberCode: newMemberCode,
        member_code: newMemberCode,
        role: requestedRole.toLowerCase(),
        roleName: requestedRole,
        role_name: requestedRole,
        isActive: true,
        shares: numShares,
        shareCount: numShares,
        monthlyContribution: totalMonthlyContribution,
        monthly_contribution: totalMonthlyContribution,
        monthlyContributionPerShare: contributionPerShare,
        monthly_contribution_per_share: contributionPerShare,
        monthlyHaftaAmount: totalMonthlyContribution,
        status: 'ACTIVE',
        status_lower: 'active',
        joinDate: memberData.joined_date || new Date().toISOString(),
        join_date: memberData.joined_date || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const actId = `ACT_${Date.now()}_add`;
      const batch = writeBatch(db);
      batch.set(counterRef, {
        lastNumber: nextNumber,
        format: 'M-{number}',
        updatedAt: serverTimestamp(),
      }, { merge: true });
      batch.set(doc(db, 'groups', targetGroupId, 'members', newMemberId), newMemberPayload);
      batch.set(doc(db, 'groups', targetGroupId, 'activities', actId), {
        id: actId,
        type: 'adjustment',
        amount: newMemberPayload.monthlyContribution,
        description: `Member added: ${cleanName} (Shares: ${newMemberPayload.shares}, Hafta: ₹${newMemberPayload.monthlyContribution})`,
        memberId: newMemberId,
        memberName: cleanName,
        referenceId: newMemberId,
        date: new Date().toISOString(),
      });
      await batch.commit();

      // Update Group Aggregate Document
      try {
        const groupRef = doc(db, 'groups', targetGroupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists()) {
          const gData = groupSnap.data();
          const currentTotal = Number(gData.totalMembers || gData.total_members || 0);
          const currentActive = Number(gData.activeMembers || gData.active_members || 0);
          await updateDoc(groupRef, {
            totalMembers: currentTotal + 1,
            total_members: currentTotal + 1,
            activeMembers: currentActive + 1,
            active_members: currentActive + 1,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (e) {
        console.warn('Notice: Group totalMembers update on member creation:', e);
      }

      return {
        success: true,
        message: 'Member registered successfully in Bachat Gat',
        member: normalizeMember(newMemberId, newMemberPayload),
      };
    } catch (err) {
      console.error('Failed to create member:', err);
      throw new Error(err.message || 'Failed to create member.');
    }
  },

  /**
   * Update existing member in Firestore
   */
  updateMember: async (memberId, updateData, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const memberDocRef = doc(db, 'groups', targetGroupId, 'members', memberId);

      const payload = {
        updatedAt: new Date().toISOString(),
      };

      if (updateData.name || updateData.fullName || updateData.full_name) {
        const n = (updateData.name || updateData.fullName || updateData.full_name).trim();
        payload.name = n;
        payload.fullName = n;
        payload.full_name = n;
      }
      if (updateData.phone !== undefined || updateData.phoneNumber !== undefined || updateData.phone_number !== undefined) {
        const p = (updateData.phone || updateData.phoneNumber || updateData.phone_number || '').trim();
        payload.phone = p;
        payload.phoneNumber = p;
        payload.phone_number = p;
      }
      if (updateData.email !== undefined) {
        payload.email = updateData.email.trim().toLowerCase();
      }
      if (updateData.shares !== undefined || updateData.shareCount !== undefined) {
        const sh = parseInt(updateData.shares || updateData.shareCount, 10) || 1;
        payload.shares = sh;
        payload.shareCount = sh;
      }
      if (updateData.monthly_contribution !== undefined || updateData.monthlyContribution !== undefined || updateData.monthlyHaftaAmount !== undefined || updateData.monthlyShare !== undefined) {
        const mc = parseFloat(updateData.monthly_contribution || updateData.monthlyContribution || updateData.monthlyHaftaAmount || updateData.monthlyShare) || 1000;
        payload.monthlyContribution = mc;
        payload.monthly_contribution = mc;
        payload.monthlyContributionPerShare = updateData.monthlyContributionPerShare ? parseFloat(updateData.monthlyContributionPerShare) : (mc / (payload.shares || 1));
        payload.monthly_contribution_per_share = payload.monthlyContributionPerShare;
        payload.monthlyHaftaAmount = mc;
        payload.monthlyShare = mc;
        payload.monthly_share = mc;
      }
      if (updateData.status) {
        const st = updateData.status.toUpperCase();
        payload.status = st;
        payload.status_lower = st.toLowerCase();
        payload.isActive = st === 'ACTIVE';
        payload.is_active = st === 'ACTIVE';
      }
      if (updateData.role_name || updateData.role || updateData.roleName) {
        const roleName = (updateData.role_name || updateData.role || updateData.roleName).trim().toUpperCase();
        if (!['MEMBER', 'TREASURER', 'SECRETARY'].includes(roleName)) {
          throw new Error('Invalid member role. Only Member, Treasurer, or Secretary roles can be assigned.');
        }
        payload.role = roleName.toLowerCase();
        payload.roleName = roleName;
        payload.role_name = roleName;
      }

      await setDoc(memberDocRef, payload, { merge: true });

      const memberSnap = await getDoc(memberDocRef);
      const linkedUid = memberSnap.data()?.authUid || memberSnap.data()?.userId || memberSnap.data()?.firebaseUid;
      if (linkedUid) {
        const userUpdate = {
          updatedAt: serverTimestamp(),
        };
        if (payload.name) {
          userUpdate.name = payload.name;
          userUpdate.fullName = payload.fullName;
        }
        if (payload.phone !== undefined) {
          userUpdate.phone = payload.phone;
        }
        if (payload.email) {
          userUpdate.email = payload.email;
        }
        if (payload.role) {
          userUpdate.role = payload.role;
          userUpdate.role_name = payload.role_name;
        }
        if (payload.status) {
          userUpdate.isActive = payload.isActive;
        }
        await setDoc(doc(db, 'users', linkedUid), userUpdate, { merge: true });
      }

      // Log activity
      const cleanName = payload.name || memberSnap.data()?.name || 'Member';
      const actId = `ACT_${Date.now()}_edit`;
      await setDoc(doc(db, 'groups', targetGroupId, 'activities', actId), {
        id: actId,
        type: 'adjustment',
        description: `Member profile updated: ${cleanName}`,
        memberId: memberId,
        memberName: cleanName,
        referenceId: memberId,
        date: new Date().toISOString(),
      }).catch((e) => console.warn('Activity log notice:', e));

      return {
        success: true,
        message: 'Member profile updated successfully',
      };
    } catch (err) {
      console.error('Failed to update member:', err);
      throw new Error(err.message || 'Failed to update member.');
    }
  },

  /**
   * Create or verify a Firebase Auth account and link it to an existing member.
   */
  assignMemberLogin: async (memberId, { email, password }, groupId = DEFAULT_GROUP_ID) => {
    let secondaryApp = null;
    let accountUser = null;
    let createdNewAccount = false;

    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
        throw new Error('Please enter a valid member email address.');
      }
      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      const memberRef = doc(db, 'groups', targetGroupId, 'members', memberId);
      const memberSnap = await getDoc(memberRef);
      if (!memberSnap.exists()) throw new Error('Member record not found.');

      const memberData = memberSnap.data();
      if (memberData.authUid || memberData.userId || memberData.firebaseUid) {
        throw new Error('Login is already enabled for this member.');
      }

      const membersSnap = await getDocs(collection(db, 'groups', targetGroupId, 'members'));
      const emailOwner = membersSnap.docs.find((memberDoc) => {
        if (memberDoc.id === memberId) return false;
        return (memberDoc.data().email || '').trim().toLowerCase() === cleanEmail &&
          Boolean(memberDoc.data().authUid || memberDoc.data().userId || memberDoc.data().firebaseUid);
      });
      if (emailOwner) throw new Error('This email is already linked to another member.');

      secondaryApp = initializeApp(firebaseConfig, `existing-member-login-${Date.now()}`);
      const memberAuth = getAuth(secondaryApp);
      await setPersistence(memberAuth, inMemoryPersistence);

      try {
        const credential = await createUserWithEmailAndPassword(memberAuth, cleanEmail, password);
        accountUser = credential.user;
        createdNewAccount = true;
      } catch (authError) {
        if (authError.code !== 'auth/email-already-in-use') throw authError;
        const credential = await signInWithEmailAndPassword(memberAuth, cleanEmail, password);
        accountUser = credential.user;
      }

      const existingUserSnap = await getDoc(doc(db, 'users', accountUser.uid));
      if (existingUserSnap.exists()) {
        const existingProfile = existingUserSnap.data();
        if (existingProfile.role === 'admin') {
          throw new Error('An admin account cannot be assigned to a member.');
        }
        if (existingProfile.memberId && existingProfile.memberId !== memberId) {
          throw new Error('This login account is already assigned to another member.');
        }
      }

      const memberName = memberData.fullName || memberData.name || 'Member';
      const role = (memberData.role || memberData.role_name || 'member').toLowerCase();
      const roleName = role.toUpperCase();
      const memberCode = memberData.memberCode || memberData.member_code || memberId;
      const batch = writeBatch(db);

      batch.set(memberRef, {
        email: cleanEmail,
        userId: accountUser.uid,
        authUid: accountUser.uid,
        firebaseUid: accountUser.uid,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      batch.set(doc(db, 'users', accountUser.uid), {
        uid: accountUser.uid,
        fullName: memberName,
        name: memberName,
        email: cleanEmail,
        phone: memberData.phone || '',
        role,
        role_name: roleName,
        isActive: memberData.isActive !== false && (memberData.status || 'active').toLowerCase() !== 'inactive',
        memberId,
        memberCode,
        groupId: targetGroupId,
        createdAt: existingUserSnap.exists() ? existingUserSnap.data().createdAt || serverTimestamp() : serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      const activityId = `ACT_${Date.now()}_login`;
      batch.set(doc(db, 'groups', targetGroupId, 'activities', activityId), {
        id: activityId,
        type: 'member_login_assigned',
        memberId,
        memberName,
        referenceId: accountUser.uid,
        description: `Login enabled for ${memberName}`,
        date: new Date().toISOString(),
      });
      await batch.commit();

      return {
        success: true,
        message: 'Member login enabled successfully.',
        email: cleanEmail,
        createdNewAccount,
      };
    } catch (err) {
      if (createdNewAccount && accountUser) await deleteUser(accountUser).catch(() => {});
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        throw new Error('This email already exists, but the password is incorrect.');
      }
      throw new Error(err.message || 'Failed to enable member login.');
    } finally {
      if (secondaryApp) {
        const secondaryAuth = getAuth(secondaryApp);
        if (secondaryAuth.currentUser) await signOut(secondaryAuth).catch(() => {});
        await deleteApp(secondaryApp).catch(() => {});
      }
    }
  },

  /**
   * Get complete real-time financial balance for member deletion clearance and settlement calculation
   */
  getMemberFinancialBalance: async (memberId, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const res = await memberService.getMemberById(memberId, targetGroupId);
      if (!res.success || !res.member) {
        throw new Error('Member profile not found.');
      }

      const m = res.member;
      const activeLoans = (m.loans || []).filter((l) => (l.status || '').toUpperCase() === 'ACTIVE');

      const totalOutstandingPrincipal = activeLoans.reduce((sum, l) => sum + Number(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.outstandingAmount || 0)), 0);
      const totalOutstandingInterest = activeLoans.reduce((sum, l) => {
        const p = Number(l.pendingPrincipal !== undefined ? l.pendingPrincipal : (l.outstandingAmount || 0));
        const r = Number(l.interestRate || l.interest_rate || 2);
        return sum + Math.round(((p * r) / 100) * 100) / 100;
      }, 0);

      const pendingSavings = m.current_due !== undefined && m.current_due > 0
        ? Number(m.current_due)
        : (m.currentDue !== undefined && m.currentDue > 0 ? Number(m.currentDue) : 0);

      const totalPayable = Math.round((totalOutstandingPrincipal + totalOutstandingInterest + pendingSavings) * 100) / 100;
      const isClear = totalPayable <= 0 && activeLoans.length === 0;

      // Group totals & member interest share calculation
      const [groupDocSnap, membersSnap, repaymentsSnap, contributionsSnap, settlementsSnap] = await Promise.all([
        getDoc(doc(db, 'groups', targetGroupId)).catch(() => null),
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'repayments')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'settlements')).catch(() => ({ docs: [] })),
      ]);

      const regularMembers = membersSnap.docs.filter((d) => isRegularMember({ id: d.id, ...d.data() }));
      const totalGroupMembers = Math.max(1, regularMembers.length);

      // Total interest calculation from existing data
      const allSavings = contributionsSnap.docs.map((d) => normalizeSavings(d.id, d.data()));
      const allContributionsInterest = allSavings.reduce((sum, c) => sum + (c.interestAmount || c.interest || 0), 0);

      const repaymentsList = repaymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const allRepaymentsInterest = repaymentsList.reduce((sum, r) => sum + Number(r.interestAmount || r.interestPaid || r.interest_amount || 0), 0);

      const totalSettledInterest = settlementsSnap.docs.reduce((sum, d) => sum + Number(d.data().interestShare || d.data().interest_share || 0), 0);

      const rawGroup = groupDocSnap?.exists() ? groupDocSnap.data() : {};
      const storedGroupInterest = Number(rawGroup.totalInterest ?? rawGroup.total_interest ?? rawGroup.totalInterestCollected ?? rawGroup.total_interest_collected ?? 0);
      
      const dynamicTotalInterest = Math.max(0, Math.round((allContributionsInterest + allRepaymentsInterest - totalSettledInterest) * 100) / 100);
      const totalGroupInterest = storedGroupInterest > 0 ? storedGroupInterest : dynamicTotalInterest;

      // Formula: memberInterestShare = totalGroupInterest / totalGroupMembers (total count before deletion)
      const memberInterestShare = totalGroupMembers > 0
        ? Math.round((totalGroupInterest / totalGroupMembers) * 100) / 100
        : 0;

      const lifetimeSavings = Number(m.total_savings || m.totalSavings || 0);
      const totalSettlementPayable = Math.round((lifetimeSavings + memberInterestShare) * 100) / 100;

      return {
        success: true,
        member: m,
        activeLoans,
        totalOutstandingPrincipal,
        totalOutstandingInterest,
        pendingSavings,
        totalPayable,
        isClear,
        lifetimeSavings,
        totalGroupInterest,
        totalGroupMembers,
        memberInterestShare,
        totalSettlementPayable,
      };
    } catch (err) {
      console.error('Failed to get member financial balance:', err);
      throw new Error(err.message || 'Failed to calculate member financial balance.');
    }
  },

  /**
   * Delete a member from Firestore with complete settlement payout and atomic group balance update
   */
  deleteMember: async (memberId, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const memberDocRef = doc(db, 'groups', targetGroupId, 'members', memberId);
      const memberSnap = await getDoc(memberDocRef);
      if (!memberSnap.exists()) throw new Error('Member record not found.');

      // 1. Double check financial clearance before deletion
      const balanceRes = await memberService.getMemberFinancialBalance(memberId, targetGroupId);
      if (!balanceRes.isClear) {
        throw new Error(`Cannot delete member "${balanceRes.member.name}". Outstanding balance of ₹${balanceRes.totalPayable} must be cleared first.`);
      }

      const linkedUid = memberSnap.data().authUid || memberSnap.data().userId || memberSnap.data().firebaseUid;
      const memberName = memberSnap.data().name || memberSnap.data().fullName || balanceRes.member?.name || 'Member';
      const lifetimeSavings = Number(balanceRes.lifetimeSavings || 0);
      const totalGroupInterest = Number(balanceRes.totalGroupInterest || 0);
      const totalGroupMembers = Number(balanceRes.totalGroupMembers || 1);
      const memberInterestShare = Number(balanceRes.memberInterestShare || 0);
      const totalSettlementAmount = Math.round((lifetimeSavings + memberInterestShare) * 100) / 100;

      const collectionNames = ['monthly_contributions', 'loans', 'repayments', 'activities', 'notifications'];
      const relatedRefs = new Map();

      for (const collectionName of collectionNames) {
        const collectionRef = collection(db, 'groups', targetGroupId, collectionName);
        const snapshots = await Promise.all([
          getDocs(query(collectionRef, where('memberId', '==', memberId))).catch(() => ({ docs: [] })),
          getDocs(query(collectionRef, where('member_id', '==', memberId))).catch(() => ({ docs: [] })),
        ]);
        snapshots.flatMap((snapshot) => snapshot.docs).forEach((documentSnap) => {
          relatedRefs.set(documentSnap.ref.path, documentSnap.ref);
        });
      }

      // Record final settlement record in Firestore
      const settleId = `SETTLE_${Date.now()}_${memberId}`;
      const settlementDocRef = doc(db, 'groups', targetGroupId, 'settlements', settleId);
      await setDoc(settlementDocRef, {
        id: settleId,
        memberId,
        memberName,
        lifetimeSavings,
        interestShare: memberInterestShare,
        totalSettlementAmount,
        totalGroupInterestBefore: totalGroupInterest,
        totalGroupMembersBefore: totalGroupMembers,
        settlementDate: new Date().toISOString(),
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
      });

      const refsToDelete = [memberDocRef, ...relatedRefs.values()];
      if (linkedUid) refsToDelete.push(doc(db, 'users', linkedUid));
      for (let start = 0; start < refsToDelete.length; start += 450) {
        const batch = writeBatch(db);
        refsToDelete.slice(start, start + 450).forEach((reference) => batch.delete(reference));
        await batch.commit();
      }

      // Log activity and recalculate authoritative Group aggregates from Firestore collections
      try {
        const actId = `ACT_${Date.now()}_del`;
        await setDoc(doc(db, 'groups', targetGroupId, 'activities', actId), {
          id: actId,
          type: 'member_settled_and_deleted',
          amount: totalSettlementAmount,
          lifetimeSavings,
          interestShare: memberInterestShare,
          description: `Member account settled & deleted: ${memberName} (Payout: ₹${totalSettlementAmount.toLocaleString('en-IN')})`,
          memberId,
          memberName,
          date: new Date().toISOString(),
        });

        // Recalculate and update all canonical group aggregates in groups/{groupId}
        await groupService.recalculateAndSyncGroupAggregates(targetGroupId);
      } catch (e) {
        console.warn('Notice: Group stats recalculation on member delete:', e);
      }

      return {
        success: true,
        message: 'Member account settled and deleted successfully',
        settlement: {
          memberId,
          memberName,
          lifetimeSavings,
          interestShare: memberInterestShare,
          totalSettlementAmount,
        },
      };
    } catch (err) {
      console.error('Failed to delete member:', err);
      throw new Error(err.message || 'Failed to delete member.');
    }
  },

  /**
   * Subscribe to real-time members list
   */
  subscribeToMembers: (callback, groupId = DEFAULT_GROUP_ID) => {
    const targetGroupId = groupId || DEFAULT_GROUP_ID;
    return onSnapshot(collection(db, 'groups', targetGroupId, 'members'), () => {
      memberService.getAllMembers({}, targetGroupId).then((res) => {
        if (res.success) callback(res);
      });
    });
  },
};
