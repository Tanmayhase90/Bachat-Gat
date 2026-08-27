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
  runTransaction,
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
import { db, firebaseConfig } from '../config/firebase';
import {
  normalizeMember,
  normalizeSavings,
  normalizeLoan,
  DEFAULT_GROUP_ID,
} from '../utils/formatters';

export const memberService = {
  getNextMemberCode: async (groupId = DEFAULT_GROUP_ID) => {
    const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
    const [membersSnap, counterSnap] = await Promise.all([
      getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] })),
      getDoc(doc(db, 'groups', targetGroupId, 'system', 'member_counter')).catch(() => null),
    ]);
    let maxNumber = Number(counterSnap?.data()?.lastNumber || 0);
    membersSnap.docs.forEach((memberDoc) => {
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
    let secondaryApp = null;
    let createdAuthUser = null;
    try {
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
      const cleanName = (memberData.name || memberData.fullName || '').trim();
      const cleanEmail = (memberData.email || '').trim().toLowerCase();
      const cleanPhone = (memberData.phone || '').trim();
      const normalizedName = cleanName.toLowerCase().replace(/\s+/g, ' ');
      const password = memberData.password || '';
      const requestedRole = (memberData.role_name || 'MEMBER').trim().toUpperCase();
      const allowedRoles = ['MEMBER', 'TREASURER', 'SECRETARY'];

      if (!cleanName || !cleanEmail || password.length < 6) {
        throw new Error('Name, email, and a password of at least 6 characters are required.');
      }
      if (!allowedRoles.includes(requestedRole)) {
        throw new Error('Only Member, Treasurer, or Secretary roles can be assigned here.');
      }

      // Read the customer list once for duplicate checks and counter migration.
      const membersSnap = await getDocs(collection(db, 'groups', targetGroupId, 'members')).catch(() => ({ docs: [] }));
      const duplicateMember = membersSnap.docs.find((memberDoc) => {
        const data = memberDoc.data();
        const existingName = (data.name || data.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const existingEmail = (data.email || '').trim().toLowerCase();
        return existingEmail === cleanEmail ||
          (normalizedName && existingName === normalizedName);
      });
      if (duplicateMember) {
        const existing = duplicateMember.data();
        const existingEmail = (existing.email || '').trim().toLowerCase();
        const duplicateField = existingEmail === cleanEmail
          ? 'email address'
          : 'name';
        throw new Error(`Duplicate member not added. This ${duplicateField} already belongs to ${existing.name || existing.fullName || duplicateMember.id}.`);
      }
      let observedMax = 0;
      membersSnap.docs.forEach((d) => {
        const data = d.data();
        [d.id, data.memberCode, data.member_code].forEach((value) => {
          const num = parseInt(String(value || '').replace(/\D/g, ''), 10);
          if (Number.isFinite(num)) observedMax = Math.max(observedMax, num);
        });
      });

      // A secondary Auth instance creates the member account without replacing
      // the currently signed-in admin session.
      secondaryApp = initializeApp(firebaseConfig, `member-account-${Date.now()}`);
      const memberAuth = getAuth(secondaryApp);
      await setPersistence(memberAuth, inMemoryPersistence);
      const credential = await createUserWithEmailAndPassword(memberAuth, cleanEmail, password);
      createdAuthUser = credential.user;
      await updateProfile(createdAuthUser, { displayName: cleanName });

      // Allocate the serial atomically so two admins cannot receive the same code.
      const counterRef = doc(db, 'groups', targetGroupId, 'system', 'member_counter');
      const nextNumber = await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        const lastNumber = Math.max(Number(counterSnap.data()?.lastNumber || 0), observedMax);
        const allocatedNumber = lastNumber + 1;
        transaction.set(counterRef, {
          lastNumber: allocatedNumber,
          format: 'M-{number}',
          updatedAt: serverTimestamp(),
        }, { merge: true });
        return allocatedNumber;
      });
      const newMemberId = `M_${nextNumber}`;
      const newMemberCode = `M-${nextNumber}`;

      const newMemberPayload = {
        id: newMemberId,
        name: cleanName,
        fullName: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        userId: createdAuthUser.uid,
        authUid: createdAuthUser.uid,
        firebaseUid: createdAuthUser.uid,
        groupId: targetGroupId,
        memberCode: newMemberCode,
        member_code: newMemberCode,
        role: requestedRole.toLowerCase(),
        roleName: requestedRole,
        role_name: requestedRole,
        isActive: true,
        shares: parseInt(memberData.shares, 10) || 1,
        shareCount: parseInt(memberData.shares, 10) || 1,
        monthlyContribution: parseFloat(memberData.monthly_contribution || memberData.monthlyContribution) || 1000,
        monthlyContributionPerShare: 1000,
        monthlyHaftaAmount: parseFloat(memberData.monthly_contribution || memberData.monthlyContribution) || 1000,
        status: 'active',
        joinDate: memberData.joined_date || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const actId = `ACT_${Date.now()}_add`;
      const batch = writeBatch(db);
      batch.set(doc(db, 'groups', targetGroupId, 'members', newMemberId), newMemberPayload);
      batch.set(doc(db, 'users', createdAuthUser.uid), {
        uid: createdAuthUser.uid,
        fullName: cleanName,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        role: requestedRole.toLowerCase(),
        role_name: requestedRole,
        isActive: true,
        memberId: newMemberId,
        memberCode: newMemberPayload.memberCode,
        groupId: targetGroupId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
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

      return {
        success: true,
        message: 'Member registered successfully in Bachat Gat',
        member: normalizeMember(newMemberId, newMemberPayload),
        credentials: { email: cleanEmail },
      };
    } catch (err) {
      console.error('Failed to create member:', err);
      if (createdAuthUser) {
        await deleteUser(createdAuthUser).catch(() => {});
      }
      if (err.code === 'auth/email-already-in-use') {
        throw new Error('This email already has a login account. Use a different email.');
      }
      throw new Error(err.message || 'Failed to create member.');
    } finally {
      if (secondaryApp) {
        const secondaryAuth = getAuth(secondaryApp);
        if (secondaryAuth.currentUser) await signOut(secondaryAuth).catch(() => {});
        await deleteApp(secondaryApp).catch(() => {});
      }
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
      if (updateData.role_name || updateData.role) {
        const roleName = (updateData.role_name || updateData.role).trim().toUpperCase();
        if (!['MEMBER', 'TREASURER', 'SECRETARY'].includes(roleName)) {
          throw new Error('Invalid member role.');
        }
        payload.role = roleName.toLowerCase();
        payload.roleName = roleName;
        payload.role_name = roleName;
      }

      await setDoc(memberDocRef, payload, { merge: true });

      const memberSnap = await getDoc(memberDocRef);
      const linkedUid = memberSnap.data()?.authUid || memberSnap.data()?.userId || memberSnap.data()?.firebaseUid;
      if (linkedUid && (updateData.role_name || updateData.role)) {
        await setDoc(doc(db, 'users', linkedUid), {
          role: payload.role,
          role_name: payload.role_name,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

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
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
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
   * Delete a member from Firestore
   */
  deleteMember: async (memberId, groupId = DEFAULT_GROUP_ID) => {
    try {
      const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
      const memberDocRef = doc(db, 'groups', targetGroupId, 'members', memberId);
      const memberSnap = await getDoc(memberDocRef);
      if (!memberSnap.exists()) throw new Error('Member record not found.');

      const linkedUid = memberSnap.data().authUid || memberSnap.data().userId || memberSnap.data().firebaseUid;
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

      const refsToDelete = [memberDocRef, ...relatedRefs.values()];
      if (linkedUid) refsToDelete.push(doc(db, 'users', linkedUid));
      for (let start = 0; start < refsToDelete.length; start += 450) {
        const batch = writeBatch(db);
        refsToDelete.slice(start, start + 450).forEach((reference) => batch.delete(reference));
        await batch.commit();
      }

      return {
        success: true,
        message: 'Member and linked Firestore records deleted successfully',
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
    const targetGroupId = (groupId === 'group_001' || !groupId) ? DEFAULT_GROUP_ID : groupId;
    return onSnapshot(collection(db, 'groups', targetGroupId, 'members'), () => {
      memberService.getAllMembers({}, targetGroupId).then((res) => {
        if (res.success) callback(res);
      });
    });
  },
};
