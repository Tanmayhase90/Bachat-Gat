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
import { db } from '../config/firebase';
import {
  normalizeSavings,
  normalizeMember,
  DEFAULT_GROUP_ID,
} from '../utils/formatters';

export const savingsService = {
  /**
   * Get all recorded savings / monthly contributions with member information
   */
  getAllSavings: async (params = {}, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;

      const [contributionsSnap, membersSnap] = await Promise.all([
        getDocs(collection(db, 'groups', targetGroupId, 'monthly_contributions')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
      ]);

      const membersMap = {};
      membersSnap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        membersMap[docSnap.id] = d.name || d.fullName || 'Member';
        if (d.userId) membersMap[d.userId] = d.name || d.fullName || 'Member';
        if (d.authUid) membersMap[d.authUid] = d.name || d.fullName || 'Member';
      });

      const savings = contributionsSnap.docs
        .map((docSnap) => {
          const raw = docSnap.data();
          const normalized = normalizeSavings(docSnap.id, raw);
          const memberName = membersMap[normalized.memberId] || normalized.memberName;

          return {
            ...normalized,
            member_name: memberName,
            memberName: memberName,
          };
        })
        .filter((s) => s.paidAmount > 0 || s.status === 'paid' || params.includePending);

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
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
      const memberId = data.member_id || data.memberId;
      const month = parseInt(data.month, 10);
      const year = parseInt(data.year, 10);
      const amount = parseFloat(data.amount);
      const mode = data.payment_mode || data.paymentMode || 'UPI';
      const notes = data.remarks || data.notes || '';

      const docId = `C_${memberId}_${year}_${String(month).padStart(2, '0')}`;
      const docRef = doc(db, 'groups', targetGroupId, 'monthly_contributions', docId);
      const existingContribution = await getDoc(docRef);
      if (existingContribution.exists()) {
        const existingData = existingContribution.data();
        const alreadyPaid = Number(existingData.paidAmount || existingData.regularHaftaAmount || 0);
        if (alreadyPaid > 0) {
          throw new Error(`Savings for ${month}/${year} are already recorded for this member.`);
        }
      }

      const contributionPayload = {
        id: docId,
        groupId: targetGroupId,
        memberId,
        month,
        year,
        expectedAmount: amount,
        regularHaftaAmount: amount,
        paidAmount: amount,
        totalPaid: amount,
        loanPrincipalPaid: 0,
        interestAmount: 0,
        status: 'paid',
        paymentDate: data.payment_date || new Date().toISOString(),
        paymentMode: mode,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(docRef, contributionPayload, { merge: true });

      // Fetch member name for logging
      let memberName = 'Member';
      try {
        const memSnap = await getDoc(doc(db, 'groups', targetGroupId, 'members', memberId));
        if (memSnap.exists()) memberName = memSnap.data().name || memSnap.data().fullName || 'Member';
      } catch (e) {
        // fallback
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
        date: new Date().toISOString(),
      });

      // Update Group summary metrics in Firestore
      try {
        const groupRef = doc(db, 'groups', targetGroupId);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists()) {
          const gData = groupSnap.data();
          const currentSavings = Number(gData.totalSavings || 0);
          const currentFund = Number(gData.totalFund || 0);
          await updateDoc(groupRef, {
            totalSavings: currentSavings + amount,
            totalFund: currentFund + amount,
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
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
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
    const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
    return onSnapshot(collection(db, 'groups', targetGroupId, 'monthly_contributions'), () => {
      savingsService.getAllSavings({}, targetGroupId).then((res) => {
        if (res.success) callback(res);
      });
    });
  },
};
