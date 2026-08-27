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
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  normalizeMember,
  normalizeSavings,
  normalizeLoan,
  DEFAULT_GROUP_ID,
} from '../utils/formatters';

export const memberService = {
  /**
   * Get all members with aggregated savings and loan data from Flutter subcollections
   */
  getAllMembers: async (params = {}, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;

      const [membersSnap, contributionsSnap, loansSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'loans')).catch(() => ({ docs: [] })),
      ]);

      const allContributions = contributionsSnap.docs.map((d) => normalizeSavings(d.id, d.data()));
      const allLoans = loansSnap.docs.map((d) => normalizeLoan(d.id, d.data()));

      const members = membersSnap.docs.map((docSnap) => {
        const raw = docSnap.data();
        const memberId = docSnap.id;
        const normalized = normalizeMember(memberId, raw);

        // Calculate member savings total
        const memberSavingsTotal = allContributions
          .filter((s) => s.memberId === memberId || s.member_id === memberId)
          .reduce((acc, s) => acc + (s.paidAmount || 0), 0);

        // Calculate active loan outstanding
        const memberActiveLoans = allLoans.filter(
          (l) => (l.memberId === memberId || l.member_id === memberId) && l.status === 'ACTIVE'
        );
        const memberLoanOutstanding = memberActiveLoans.reduce(
          (acc, l) => acc + (l.pendingPrincipal || 0),
          0
        );

        return {
          ...normalized,
          total_savings: memberSavingsTotal,
          totalSavings: memberSavingsTotal,
          outstanding_loans: memberLoanOutstanding,
          active_loan_amount: memberLoanOutstanding,
          active_loans_count: memberActiveLoans.length,
        };
      });

      // Filter by search / status if passed
      let filtered = members;
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

      // Sort by member ID naturally (e.g. M_1, M_2, M_10)
      filtered.sort((a, b) => {
        const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });

      return {
        success: true,
        count: filtered.length,
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
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;

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

      // Fetch member monthly contributions
      const contributionsSnap = await getDocs(
        collection(db, 'groups', targetGroupId, 'monthly_contributions')
      ).catch(() => ({ docs: [] }));

      const memberSavings = contributionsSnap.docs
        .map((d) => normalizeSavings(d.id, d.data()))
        .filter((s) => s.memberId === actualMemberId || s.member_id === actualMemberId)
        .sort((a, b) => b.year - a.year || b.month - a.month);

      // Fetch member loans
      const loansSnap = await getDocs(
        collection(db, 'groups', targetGroupId, 'loans')
      ).catch(() => ({ docs: [] }));

      const memberLoans = loansSnap.docs
        .map((d) => normalizeLoan(d.id, d.data()))
        .filter((l) => l.memberId === actualMemberId || l.member_id === actualMemberId);

      const totalSavings = memberSavings.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
      const totalOutstanding = memberLoans
        .filter((l) => l.status === 'ACTIVE')
        .reduce((acc, l) => acc + (l.pendingPrincipal || 0), 0);

      const memberPayload = {
        ...normalized,
        total_savings: totalSavings,
        totalSavings: totalSavings,
        total_outstanding: totalOutstanding,
        totalOutstanding: totalOutstanding,
        savings_history: memberSavings,
        savingsHistory: memberSavings,
        loans_history: memberLoans,
        loans: memberLoans,
        repayments: memberSavings.filter((s) => s.loanPrincipalPaid > 0 || s.interestAmount > 0),
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
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
      const cleanName = (memberData.name || memberData.fullName || '').trim();
      const cleanEmail = (memberData.email || '').trim().toLowerCase();
      const cleanPhone = (memberData.phone || '').trim();

      // Check max member sequence to assign next M_xxx
      const membersSnap = await getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] }));
      let maxNum = 0;
      membersSnap.docs.forEach((d) => {
        const num = parseInt(d.id.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      });
      const newMemberId = `M_${maxNum + 1}`;

      const newMemberPayload = {
        id: newMemberId,
        name: cleanName,
        fullName: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        groupId: targetGroupId,
        shares: parseInt(memberData.shares, 10) || 1,
        shareCount: parseInt(memberData.shares, 10) || 1,
        monthlyContribution: parseFloat(memberData.monthly_contribution || memberData.monthlyContribution) || 1000,
        monthlyContributionPerShare: 1000,
        monthlyHaftaAmount: parseFloat(memberData.monthly_contribution || memberData.monthlyContribution) || 1000,
        status: 'active',
        joinDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'groups', targetGroupId, 'members', newMemberId), newMemberPayload);

      // Log activity
      const actId = `ACT_${Date.now()}_add`;
      await setDoc(doc(db, 'groups', targetGroupId, 'activities', actId), {
        id: actId,
        type: 'adjustment',
        amount: newMemberPayload.monthlyContribution,
        description: `Member added: ${cleanName} (Shares: ${newMemberPayload.shares}, Hafta: ₹${newMemberPayload.monthlyContribution})`,
        memberId: newMemberId,
        memberName: cleanName,
        referenceId: newMemberId,
        date: new Date().toISOString(),
      });

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
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
      const memberDocRef = doc(db, 'groups', targetGroupId, 'members', memberId);

      const payload = {
        updatedAt: new Date().toISOString(),
      };

      if (updateData.name || updateData.fullName) {
        const n = (updateData.name || updateData.fullName).trim();
        payload.name = n;
        payload.fullName = n;
      }
      if (updateData.phone !== undefined) payload.phone = updateData.phone.trim();
      if (updateData.email !== undefined) payload.email = updateData.email.trim().toLowerCase();
      if (updateData.monthly_contribution !== undefined || updateData.monthlyContribution !== undefined) {
        const mc = parseFloat(updateData.monthly_contribution || updateData.monthlyContribution);
        payload.monthlyContribution = mc;
        payload.monthlyContributionPerShare = mc;
        payload.monthlyHaftaAmount = mc;
      }
      if (updateData.status) {
        payload.status = updateData.status.toLowerCase();
      }

      await setDoc(memberDocRef, payload, { merge: true });

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
   * Subscribe to real-time members list
   */
  subscribeToMembers: (callback, groupId = DEFAULT_GROUP_ID) => {
    const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
    return onSnapshot(collection(db, 'groups', targetGroupId, 'members'), () => {
      memberService.getAllMembers({}, targetGroupId).then((res) => {
        if (res.success) callback(res);
      });
    });
  },
};
