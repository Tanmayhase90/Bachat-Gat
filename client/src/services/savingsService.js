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
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import {
  normalizeSavings,
  normalizeMember,
  isRegularMember,
  isMonthlySavingPaid,
  DEFAULT_GROUP_ID,
} from '../utils/formatters.js';

export const savingsService = {
  /**
   * Get all recorded savings / monthly contributions with member information
   */
  getAllSavings: async (params = {}, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;

      const [contributionsSnap, membersSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
      ]);

      const regularMemberDocs = (membersSnap && membersSnap.docs)
        ? membersSnap.docs.filter((d) => isRegularMember({ id: d.id, ...d.data() }))
        : [];
      const allMembers = regularMemberDocs.map((d) => normalizeMember(d.id, d.data()));
      const activeMembers = allMembers.filter((mem) => {
        const s = (mem.status || 'ACTIVE').toUpperCase();
        return mem.isActive !== false && s === 'ACTIVE';
      });

      const activeMemberMap = new Map();
      activeMembers.forEach((mem) => {
        if (mem.id) activeMemberMap.set(String(mem.id), mem);
        if (mem.memberId) activeMemberMap.set(String(mem.memberId), mem);
        if (mem.memberCode) activeMemberMap.set(String(mem.memberCode), mem);
        if (mem.member_code) activeMemberMap.set(String(mem.member_code), mem);
        if (mem.userId) activeMemberMap.set(String(mem.userId), mem);
        if (mem.authUid) activeMemberMap.set(String(mem.authUid), mem);
        const cleanId = String(mem.id || '').toLowerCase().replace(/[-_]/g, '');
        if (cleanId) activeMemberMap.set(cleanId, mem);
        const cleanCode = String(mem.memberCode || mem.member_code || '').toLowerCase().replace(/[-_]/g, '');
        if (cleanCode) activeMemberMap.set(cleanCode, mem);
      });

      // Sort docs so latest updated/created record takes precedence if duplicate
      const sortedDocs = [...contributionsSnap.docs].sort((a, b) => {
        const aDate = a.data().updatedAt || a.data().createdAt || '';
        const bDate = b.data().updatedAt || b.data().createdAt || '';
        return bDate.localeCompare(aDate);
      });

      const seenMemberPeriod = new Set();
      const validSavings = [];

      sortedDocs.forEach((docSnap) => {
        const raw = docSnap.data();
        const normalized = normalizeSavings(docSnap.id, raw);

        const mId = String(normalized.memberId || normalized.member_id || '');
        const mCode = String(normalized.memberCode || normalized.member_code || '');
        const cleanId = mId.toLowerCase().replace(/[-_]/g, '');
        const cleanCode = mCode.toLowerCase().replace(/[-_]/g, '');

        const member = activeMemberMap.get(mId) ||
                       activeMemberMap.get(mCode) ||
                       activeMemberMap.get(cleanId) ||
                       activeMemberMap.get(cleanCode);

        // Only include contributions belonging to valid active regular members of the group
        if (!member) {
          return;
        }

        // Deduplicate payments by (memberId, year, month)
        const dedupKey = `${member.id}_${normalized.year}_${normalized.month}`;
        if (seenMemberPeriod.has(dedupKey)) {
          return;
        }
        seenMemberPeriod.add(dedupKey);

        const memberName = member.name || member.fullName || normalized.memberName;
        const memberCode = member.memberCode || member.member_code || normalized.memberCode;

        validSavings.push({
          ...normalized,
          memberId: member.id,
          member_id: member.id,
          memberName,
          member_name: memberName,
          memberCode,
          member_code: memberCode,
        });
      });

      const savings = validSavings.filter(
        (s) => s.paidAmount > 0 || s.status === 'paid' || params.includePending
      );

      // Filter by month, year, search if provided
      let filtered = savings;
      if (params.month) {
        filtered = filtered.filter((s) => s.month === parseInt(params.month, 10));
      }
      if (params.year) {
        filtered = filtered.filter((s) => s.year === parseInt(params.year, 10));
      }
      if (params.memberId) {
        filtered = filtered.filter((s) => s.memberId === params.memberId || s.member_id === params.memberId);
      }
      if (params.search) {
        const s = params.search.toLowerCase();
        filtered = filtered.filter(
          (item) => item.member_name.toLowerCase().includes(s) || item.member_code.toLowerCase().includes(s)
        );
      }

      // Sort by Year desc, Month desc, Date desc
      filtered.sort((a, b) => b.year - a.year || b.month - a.month);

      const totalAmount = filtered.reduce((acc, curr) => acc + (curr.paidAmount || curr.amount || 0), 0);

      return {
        success: true,
        count: filtered.length,
        totalAmount,
        total_amount: totalAmount,
        savings: filtered,
      };
    } catch (err) {
      console.error('Failed to get savings from Firestore:', err);
      return { success: true, count: 0, totalAmount: 0, savings: [] };
    }
  },

  /**
   * Record monthly savings in Firestore (compatible with Flutter schema)
   */
  recordSavings: async (data, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const memberId = String(data.member_id || data.memberId || '');
      const month = parseInt(data.month, 10);
      const year = parseInt(data.year, 10);
      const amount = parseFloat(data.amount);
      const mode = data.payment_mode || data.paymentMode || 'UPI';
      const notes = data.remarks || data.notes || '';
      const paymentDate = data.payment_date || data.paymentDate || new Date().toISOString().split('T')[0];

      // Fetch member document to get member name and code
      let memberName = 'Member';
      let memberCode = memberId;
      try {
        const memSnap = await getDoc(doc(db, 'groups', targetGroupId, 'members', memberId));
        if (memSnap.exists()) {
          const mData = memSnap.data();
          memberName = mData.name || mData.fullName || 'Member';
          memberCode = mData.memberCode || mData.member_code || memberId;
        }
      } catch (e) {
        // fallback
      }

      const MONTH_NAMES_EN = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthLabel = MONTH_NAMES_EN[month - 1] || `Month ${month}`;

      const candidates = [
        memberId,
        memberCode,
        memberId.replace('-', '_'),
        memberId.replace('_', '-'),
      ].filter(Boolean);

      const docId = `C_${memberId}_${year}_${String(month).padStart(2, '0')}`;
      const docRef = doc(db, 'groups', targetGroupId, 'monthly_contributions', docId);
      let existingContribution = await getDoc(docRef);
      if (existingContribution.exists()) {
        const existingData = existingContribution.data();
        if (isMonthlySavingPaid(existingData, amount)) {
          throw new Error(`Saving already recorded for ${monthLabel} ${year} for ${memberName}.`);
        }
      }

      // Check all other possible docId formats
      for (const cand of candidates) {
        const checkDocId = `C_${cand}_${year}_${String(month).padStart(2, '0')}`;
        if (checkDocId === docId) continue;
        const checkRef = doc(db, 'groups', targetGroupId, 'monthly_contributions', checkDocId);
        const checkSnap = await getDoc(checkRef);
        if (checkSnap.exists()) {
          const checkData = checkSnap.data();
          if (isMonthlySavingPaid(checkData, amount)) {
            throw new Error(`Saving already recorded for ${monthLabel} ${year} for ${memberName}.`);
          }
          if (!existingContribution.exists()) {
            existingContribution = checkSnap;
          }
        }
      }

      // Also check query across collection in case document ID is formatted differently
      try {
        const existingQuerySnap = await getDocs(
          query(
            collection(db, 'groups', targetGroupId, 'monthly_contributions'),
            where('month', '==', month),
            where('year', '==', year)
          )
        );

        if (!existingQuerySnap.empty) {
          const candidateCleanSet = new Set(candidates.map((c) => String(c).toLowerCase().replace(/[-_]/g, '')));
          const paidExisting = existingQuerySnap.docs.some((d) => {
            const dData = d.data();
            const dMemId = String(dData.memberId || dData.member_id || '').toLowerCase().replace(/[-_]/g, '');
            const dMemCode = String(dData.memberCode || dData.member_code || '').toLowerCase().replace(/[-_]/g, '');
            if (candidateCleanSet.has(dMemId) || candidateCleanSet.has(dMemCode)) {
              return isMonthlySavingPaid(dData, amount);
            }
            return false;
          });
          if (paidExisting) {
            throw new Error(`Saving already recorded for ${monthLabel} ${year} for ${memberName}.`);
          }
        }
      } catch (qErr) {
        if (qErr.message && qErr.message.includes('Saving already recorded')) {
          throw qErr;
        }
      }

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
        paymentDate: paymentDate,
        payment_date: paymentDate,
        paymentMode: mode,
        payment_mode: mode,
        notes: notes.trim(),
        remarks: notes.trim(),
        createdAt: existingContribution.exists() ? (existingContribution.data().createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(docRef, contributionPayload, { merge: true });

      // Update Member aggregate total savings
      try {
        const memRef = doc(db, 'groups', targetGroupId, 'members', memberId);
        const memSnap = await getDoc(memRef);
        if (memSnap.exists()) {
          const mData = memSnap.data();
          const currentMemSavings = Number(mData.totalSavings || mData.total_savings || 0);
          await updateDoc(memRef, {
            totalSavings: currentMemSavings + amount,
            total_savings: currentMemSavings + amount,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn('Notice: Member total savings update on savings record:', e);
      }

      // Log activity in Flutter activities subcollection
      const actId = `ACT_${Date.now()}_saving`;
      await setDoc(doc(db, 'groups', targetGroupId, 'activities', actId), {
        id: actId,
        type: 'saving',
        amount,
        description: `Monthly savings ₹${amount} received from ${memberName}`,
        memberId,
        memberName,
        referenceId: docId,
        month: Number(month),
        year: Number(year),
        date: new Date().toISOString(),
      });

      // Update Group summary metrics in Firestore
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
            savingsTotal: currentSavings + amount,
            savings_total: currentSavings + amount,
            totalFund: currentFund + amount,
            total_fund: currentFund + amount,
            availableBalance: currentFund + amount,
            available_balance: currentFund + amount,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn('Notice: Group summary update on savings:', e);
      }

      return {
        success: true,
        message: 'Monthly savings recorded successfully in Bachat Gat',
        savingsId: docId,
      };
    } catch (err) {
      console.error('Failed to record savings in Firestore:', err);
      throw new Error(err.message || 'Failed to record savings.');
    }
  },

  /**
   * Update savings entry
   */
  updateSavings: async (id, data, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = groupId || DEFAULT_GROUP_ID;
      const docRef = doc(db, 'groups', targetGroupId, 'monthly_contributions', id);
      const payload = {
        updatedAt: new Date().toISOString(),
      };
      if (data.amount !== undefined) {
        const amt = parseFloat(data.amount);
        payload.paidAmount = amt;
        payload.totalPaid = amt;
        payload.status = amt > 0 ? 'paid' : 'pending';
      }
      if (data.payment_date) payload.paymentDate = data.payment_date;
      if (data.payment_mode) payload.paymentMode = data.payment_mode;
      if (data.remarks !== undefined) payload.notes = data.remarks.trim();

      await updateDoc(docRef, payload);
      return { success: true, message: 'Savings entry updated successfully' };
    } catch (err) {
      console.error('Failed to update savings in Firestore:', err);
      throw new Error(err.message || 'Failed to update savings.');
    }
  },

  /**
   * Subscribe to real-time savings
   */
  subscribeToSavings: (callback, groupId = DEFAULT_GROUP_ID) => {
    const targetGroupId = groupId || DEFAULT_GROUP_ID;
    return onSnapshot(collection(db, 'groups', targetGroupId, 'monthly_contributions'), () => {
      savingsService.getAllSavings({}, targetGroupId).then((res) => {
        if (res.success) callback(res);
      });
    });
  },
};
