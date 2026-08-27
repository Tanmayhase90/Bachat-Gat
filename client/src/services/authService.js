import { initializeApp, deleteApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  sendPasswordResetEmail,
  updateProfile as updateFirebaseProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../config/firebase';
import { groupService } from './groupService';

/**
 * Format Firebase Auth errors into accurate, clear, user-friendly messages
 */
function formatAuthError(err) {
  const code = err.code || '';
  const msg = err.message || '';

  if (code === 'auth/invalid-email' || msg.includes('invalid-email')) {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/user-not-found' || msg.includes('user-not-found')) {
    return 'Account not found. Please Sign Up first.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || msg.includes('invalid-credential') || msg.includes('wrong-password')) {
    return 'Invalid email or password.';
  }
  if (code === 'auth/email-already-in-use' || msg.includes('email-already-in-use')) {
    return 'This email is already registered.';
  }
  if (code === 'auth/weak-password' || msg.includes('weak-password')) {
    return 'Password must be at least 6 characters.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password login is not enabled in Firebase.';
  }
  if (code === 'auth/user-disabled') {
    return 'Your account is deactivated. Please contact admin.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many failed login attempts. Please try again later.';
  }
  if (code === 'auth/network-request-failed' || msg.includes('network-request-failed')) {
    return 'Network error. Please check your internet connection.';
  }
  return msg || 'Authentication failed. Please check your credentials.';
}

export const authService = {
  sendPasswordReset: async (email) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) throw new Error('Please enter your email address first.');

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return {
        success: true,
        message: 'Password reset link sent. Please check your email inbox and spam folder.',
      };
    } catch (err) {
      throw new Error(formatAuthError(err));
    }
  },

  /**
   * Register a new user using Firebase Authentication & Cloud Firestore
   * - Creates the Firebase Auth user via createUserWithEmailAndPassword
   * - Finds any existing Firestore member with the same email (e.g. from seeded/Flutter data)
   * - Attaches authUid/firebaseUid to the existing member document without deleting or creating duplicates
   */
  register: async ({ fullName, email, phone, password }) => {
    let accountWasCreated = false;
    let reactivatedExistingAccount = false;
    let user = null;
    let reactivationApp = null;

    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanName = (fullName || '').trim();
      const cleanPhone = (phone || '').trim();

      // Deleted members can leave an orphaned Auth identity. Verify ownership with
      // the previous password, then safely rebuild the deleted Firestore profile.
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        user = userCredential.user;
        accountWasCreated = true;
      } catch (createError) {
        if (createError.code !== 'auth/email-already-in-use') throw createError;

        let existingCredential;
        try {
          reactivationApp = initializeApp(firebaseConfig, `registration-reactivation-${Date.now()}`);
          const reactivationAuth = getAuth(reactivationApp);
          await setPersistence(reactivationAuth, inMemoryPersistence);
          existingCredential = await signInWithEmailAndPassword(reactivationAuth, cleanEmail, password);
        } catch (signInError) {
          if (signInError.code === 'auth/invalid-credential' || signInError.code === 'auth/wrong-password') {
            throw new Error('This email belonged to an existing or deleted account. Use its previous password to reactivate it.');
          }
          throw signInError;
        }

        user = existingCredential.user;
        const existingUserSnap = await getDoc(doc(db, 'users', user.uid));
        if (existingUserSnap.exists() && existingUserSnap.data().isActive !== false) {
          throw new Error('This email is already registered and active. Please login instead.');
        }
        reactivatedExistingAccount = true;
      }

      // 2. Update Firebase Auth display name
      await updateFirebaseProfile(user, { displayName: cleanName });

      // 3. Search for existing member document in Firestore groups/shivshahi_group_001/members
      let existingMember = null;
      let existingMemberId = null;

      try {
        const membersSnap = await getDocs(collection(db, 'groups', 'shivshahi_group_001', 'members'));
        const found = membersSnap.docs.find((d) => {
          const m = d.data();
          return (
            (m.email && m.email.toLowerCase() === cleanEmail) ||
            (cleanPhone && m.phone && m.phone === cleanPhone) ||
            (cleanName && (m.name === cleanName || m.fullName === cleanName))
          );
        });

        if (found) {
          existingMember = found.data();
          existingMemberId = found.id;
        }
      } catch (err) {
        console.warn('Notice: Unable to query existing members in subcollection:', err);
      }

      // Fetch active group details
      const defaultGroup = await groupService.getGroupDetails('shivshahi_group_001');
      const groupId = 'shivshahi_group_001';
      const groupName = defaultGroup.group?.groupName || defaultGroup.group?.name || 'Chhatrapati Bachat Gat, Ghargaon Stand';
      const monthlyContribution = defaultGroup.group?.monthlyContribution || 1000;

      let memberId = existingMemberId;
      let memberCode = existingMember?.memberCode || existingMemberId;

      if (existingMemberId) {
        // Link the existing member document to the newly created Firebase Auth UID
        const memberDocRef = doc(db, 'groups', 'shivshahi_group_001', 'members', existingMemberId);
        await setDoc(memberDocRef, {
          userId: user.uid,
          authUid: user.uid,
          firebaseUid: user.uid,
          email: cleanEmail,
          phone: cleanPhone || existingMember.phone || '',
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } else {
        // Create new member document in 'groups/shivshahi_group_001/members' if none existed
        const membersSnap = await getDocs(collection(db, 'groups', 'shivshahi_group_001', 'members')).catch(() => ({ docs: [] }));
        let maxNum = 0;
        membersSnap.docs.forEach((d) => {
          const num = parseInt(d.id.replace(/\D/g, ''), 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        });
        memberId = `M_${maxNum + 1}`;
        memberCode = memberId;

        const newMemberDocRef = doc(db, 'groups', 'shivshahi_group_001', 'members', memberId);
        await setDoc(newMemberDocRef, {
          id: memberId,
          userId: user.uid,
          authUid: user.uid,
          firebaseUid: user.uid,
          groupId: groupId,
          name: cleanName,
          fullName: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          shares: 1,
          shareCount: 1,
          monthlyContribution: monthlyContribution,
          monthlyContributionPerShare: 1000,
          monthlyHaftaAmount: monthlyContribution,
          status: 'active',
          joinDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // 4. Create / update user document in 'users' collection: users/{uid}
      const userDocRef = doc(db, 'users', user.uid);
      const resolvedName = cleanName || existingMember?.fullName || existingMember?.name || 'Member';
      const userData = {
        uid: user.uid,
        fullName: resolvedName,
        name: resolvedName,
        email: cleanEmail,
        phone: cleanPhone || existingMember?.phone || '',
        role: 'member',
        role_name: 'MEMBER',
        isActive: true,
        memberId: memberId,
        memberCode: memberCode || '',
        groupId: groupId,
        groupName: groupName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userDocRef, userData, { merge: true });

      const resolvedUser = {
        ...userData,
        id: user.uid,
      };

      if (reactivatedExistingAccount) {
        const primaryCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        user = primaryCredential.user;
      }
      const token = await user.getIdToken();

      return {
        success: true,
        message: reactivatedExistingAccount
          ? 'Deleted member account reactivated successfully!'
          : 'Account registered successfully! Welcome to Bachat Gat.',
        token,
        user: resolvedUser,
      };
    } catch (err) {
      if (accountWasCreated && user) {
        await deleteUser(user).catch(() => {});
      } else if (reactivatedExistingAccount) {
        await signOut(auth).catch(() => {});
      }
      throw new Error(formatAuthError(err));
    } finally {
      if (reactivationApp) {
        const reactivationAuth = getAuth(reactivationApp);
        if (reactivationAuth.currentUser) await signOut(reactivationAuth).catch(() => {});
        await deleteApp(reactivationApp).catch(() => {});
      }
    }
  },

  /**
   * Log in user with Firebase Auth and load their Firestore member/user profile
   */
  login: async (email, password, expectedRole = null) => {
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      // 1. Check user profile in Firestore: users/{uid}
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      let userData = userDoc.exists() ? userDoc.data() : null;

      // 2. Look up matching member in Firestore by authUid, userId, or email
      let linkedMember = null;
      let linkedMemberId = userData?.memberId || null;

      if (linkedMemberId) {
        const memDoc = await getDoc(doc(db, 'groups', 'shivshahi_group_001', 'members', linkedMemberId));
        if (memDoc.exists()) {
          linkedMember = memDoc.data();
        }
      }

      if (!linkedMember) {
        try {
          const membersSnap = await getDocs(collection(db, 'groups', 'shivshahi_group_001', 'members'));
          const found = membersSnap.docs.find((d) => {
            const m = d.data();
            return (
              m.userId === user.uid ||
              m.authUid === user.uid ||
              m.firebaseUid === user.uid ||
              (m.email && m.email.toLowerCase() === cleanEmail)
            );
          });

          if (found) {
            linkedMember = found.data();
            linkedMemberId = found.id;

            // Link member document with this Firebase Auth UID
            await setDoc(doc(db, 'groups', 'shivshahi_group_001', 'members', linkedMemberId), {
              userId: user.uid,
              authUid: user.uid,
              firebaseUid: user.uid,
              email: cleanEmail,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          }
        } catch (e) {
          console.warn('Notice: Member lookup by email failed in subcollection:', e);
        }
      }

      // 3. Construct or ensure Firestore user profile
      const isUserAdmin = userData?.role === 'admin' || userData?.role_name === 'ADMIN';
      const resolvedRole = isUserAdmin ? 'admin' : (userData?.role || linkedMember?.role || 'member').toLowerCase();
      const resolvedFullName = userData?.fullName || userData?.name || linkedMember?.fullName || linkedMember?.name || user.displayName || 'Member';

      if (!userDoc.exists()) {
        userData = {
          uid: user.uid,
          id: user.uid,
          fullName: resolvedFullName,
          name: resolvedFullName,
          email: cleanEmail,
          phone: userData?.phone || linkedMember?.phone || '',
          role: resolvedRole,
          role_name: resolvedRole.toUpperCase(),
          isActive: linkedMember?.isActive !== false && linkedMember?.status !== 'INACTIVE',
          memberId: linkedMemberId || '',
          memberCode: linkedMember?.memberCode || '',
          groupId: linkedMember?.groupId || 'shivshahi_group_001',
          groupName: linkedMember?.groupName || 'Chhatrapati Bachat Gat',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(userDocRef, userData, { merge: true });
      }

      // 4. Check if user/member is active
      if (userData.isActive === false || linkedMember?.status === 'INACTIVE' || linkedMember?.isActive === false) {
        await signOut(auth);
        throw new Error('Your account is deactivated. Please contact admin.');
      }

      // 5. Enforce role requirement based on selected tab (Admin Login vs Member Login)
      if (expectedRole) {
        const reqRole = expectedRole.toLowerCase();
        if (reqRole === 'admin' && resolvedRole !== 'admin') {
          await signOut(auth);
          throw new Error('This account does not have admin access.');
        }
        if (reqRole === 'member' && resolvedRole !== 'member') {
          await signOut(auth);
          throw new Error('This account is not registered as a member.');
        }
        if (reqRole === 'member' && (!linkedMemberId || !linkedMember)) {
          await signOut(auth);
          throw new Error('This login is not assigned to a group member. Please contact admin.');
        }
      }

      // 6. Retrieve dynamic group details
      const groupData = await groupService.getGroupDetails(userData.groupId || 'shivshahi_group_001');
      const liveGroupName = groupData.group?.groupName || userData.groupName || 'Chhatrapati Bachat Gat';

      const resolvedUser = {
        ...userData,
        id: user.uid,
        uid: user.uid,
        fullName: resolvedFullName,
        name: resolvedFullName,
        email: user.email,
        phone: userData.phone || linkedMember?.phone || '',
        role: resolvedRole,
        role_name: resolvedRole.toUpperCase(),
        groupName: liveGroupName,
        memberId: linkedMemberId || userData.memberId || '',
        memberCode: linkedMember?.memberCode || userData.memberCode || '',
      };

      const token = await user.getIdToken();

      return {
        success: true,
        message: 'Login successful',
        token,
        user: resolvedUser,
      };
    } catch (err) {
      if (
        err.message === 'This account does not have admin access.' ||
        err.message === 'This account is not registered as a member.' ||
        err.message === 'Your account is deactivated. Please contact admin.'
      ) {
        throw err;
      }
      throw new Error(formatAuthError(err));
    }
  },

  /**
   * Log out user from Firebase
   */
  logout: async () => {
    await signOut(auth);
    return { success: true };
  },

  /**
   * Get current authenticated user details from Firestore
   */
  getMe: async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, message: 'No authenticated user.' };
    }

    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      return { success: false, message: 'User profile not found.' };
    }

    const userData = userDoc.data();
    const groupData = await groupService.getGroupDetails(userData.groupId || 'shivshahi_group_001');
    const liveGroupName = groupData.group?.groupName || userData.groupName || 'Chhatrapati Bachat Gat';
    const userRole = (userData.role || 'member').toLowerCase();

    return {
      success: true,
      user: {
        ...userData,
        id: currentUser.uid,
        uid: currentUser.uid,
        fullName: userData.fullName || userData.name || currentUser.displayName || 'Member',
        name: userData.fullName || userData.name || currentUser.displayName || 'Member',
        email: currentUser.email,
        phone: userData.phone || '',
        role: userRole,
        role_name: userRole.toUpperCase(),
        groupName: liveGroupName,
      },
    };
  },

  /**
   * Update profile info in Firestore (Full Name & Phone Number)
   */
  updateProfile: async ({ fullName, name, phone, currentPassword, newPassword }) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated.');
    }

    const userDocRef = doc(db, 'users', currentUser.uid);
    const updatePayload = {
      updatedAt: serverTimestamp(),
    };

    const newName = (fullName || name || '').trim();
    if (newName) {
      updatePayload.fullName = newName;
      updatePayload.name = newName;
      await updateFirebaseProfile(currentUser, { displayName: newName });
    }
    if (phone !== undefined) {
      updatePayload.phone = phone.trim();
    }

    if (newPassword) {
      if (!currentPassword) throw new Error('Current password is required to set a new password.');
      if (newPassword.length < 6) throw new Error('New password must be at least 6 characters.');
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
    }

    await updateDoc(userDocRef, updatePayload);
    return { success: true, message: newPassword ? 'Profile and password updated successfully.' : 'Profile updated successfully.' };
  },
};
