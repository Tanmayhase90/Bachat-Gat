import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { authService } from '../services/authService';
import { groupService } from '../services/groupService';

const AuthContext = createContext(null);

/**
 * Robust User Profile Lookup and Fallback Resolution Strategy
 * Supports both existing Flutter Android records and newly registered Web users.
 */
async function resolveUserProfile(currentFirebaseUser) {
  if (!currentFirebaseUser) return null;

  let userData = null;
  let memberData = null;
  let memberId = null;
  const cleanEmail = (currentFirebaseUser.email || '').trim().toLowerCase();

  // 1. Look up in users/{uid}
  try {
    const userDocRef = doc(db, 'users', currentFirebaseUser.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      userData = userDocSnap.data();
      memberId = userData?.memberId || null;
    }
  } catch (err) {
    console.warn('Notice: Failed reading users/{uid}:', err);
  }

  const isUserAdmin = (userData?.role || userData?.role_name || '').toLowerCase() === 'admin';

  // 2. Look up member in subcollection groups/chhatrapati_group_001/members (Regular members ONLY)
  if (!isUserAdmin) {
    try {
      // Priority A: If memberId is known from users/{uid}, fetch directly (1 document read)
      if (memberId) {
        const memberDocSnap = await getDoc(doc(db, 'groups', 'chhatrapati_group_001', 'members', memberId)).catch(() => null);
        if (memberDocSnap && memberDocSnap.exists()) {
          const m = memberDocSnap.data();
          if (!cleanEmail || !m.email || m.email.trim().toLowerCase() === cleanEmail) {
            memberData = m;
          }
        }
      }

      // Priority B: Direct query by email
      if (!memberData && cleanEmail) {
        const emailSnap = await getDocs(query(collection(db, 'groups', 'chhatrapati_group_001', 'members'), where('email', '==', cleanEmail))).catch(() => ({ docs: [] }));
        if (emailSnap.docs.length > 0) {
          memberData = emailSnap.docs[0].data();
          memberId = emailSnap.docs[0].id;
        }
      }

      // Priority C: Direct query by userId / authUid
      if (!memberData) {
        const [uidSnap, authUidSnap] = await Promise.all([
          getDocs(query(collection(db, 'groups', 'chhatrapati_group_001', 'members'), where('userId', '==', currentFirebaseUser.uid))).catch(() => ({ docs: [] })),
          getDocs(query(collection(db, 'groups', 'chhatrapati_group_001', 'members'), where('authUid', '==', currentFirebaseUser.uid))).catch(() => ({ docs: [] })),
        ]);

        const foundDoc = uidSnap.docs[0] || authUidSnap.docs[0];
        if (foundDoc) {
          memberData = foundDoc.data();
          memberId = foundDoc.id;
        }
      }

      // Priority D: Fallback by direct member ID match
      if (!memberData) {
        const directSnap = await getDoc(doc(db, 'groups', 'chhatrapati_group_001', 'members', currentFirebaseUser.uid)).catch(() => null);
        if (directSnap && directSnap.exists()) {
          memberData = directSnap.data();
          memberId = directSnap.id;
        }
      }
    } catch (err) {
      console.warn('Notice: Member lookup query:', err);
    }
  }

  // 3. Resolve active group details
  let currentGroupName = 'Chhatrapati Bachat Gat, Ghargaon Stand';
  try {
    const gRes = await groupService.getGroupDetails(userData?.groupId || memberData?.groupId || 'chhatrapati_group_001');
    if (gRes.group?.groupName || gRes.group?.name) {
      currentGroupName = gRes.group.groupName || gRes.group.name;
    }
  } catch (e) {
    // fallback default
  }

  // 4. Resolve full name, phone, and role
  const rawRole = isUserAdmin ? 'admin' : (userData?.role || memberData?.role || 'member').toLowerCase();
  const fullName = userData?.fullName || userData?.name || memberData?.fullName || memberData?.name || currentFirebaseUser.displayName || (currentFirebaseUser.email ? currentFirebaseUser.email.split('@')[0] : 'Admin');
  const phone = userData?.phone || memberData?.phone || '';

  const resolvedMemberId = isUserAdmin
    ? (userData?.adminId || userData?.memberId || 'A_1')
    : (memberId || memberData?.memberId || '');
  const resolvedMemberCode = isUserAdmin
    ? (userData?.adminCode || userData?.memberCode || 'A-1')
    : (memberData?.memberCode || memberId || '');

  const resolvedUser = {
    ...memberData,
    ...userData,
    id: currentFirebaseUser.uid,
    uid: currentFirebaseUser.uid,
    fullName: fullName,
    name: fullName,
    email: currentFirebaseUser.email,
    phone: phone,
    role: rawRole,
    role_name: rawRole.toUpperCase(),
    groupName: currentGroupName,
    memberId: resolvedMemberId,
    memberCode: resolvedMemberCode,
    adminId: isUserAdmin ? resolvedMemberId : undefined,
    adminCode: isUserAdmin ? resolvedMemberCode : undefined,
  };

  // If user document didn't exist in users/{uid} and is admin, ensure it is saved with A series
  if (!userData && isUserAdmin) {
    try {
      await setDoc(doc(db, 'users', currentFirebaseUser.uid), {
        uid: currentFirebaseUser.uid,
        id: currentFirebaseUser.uid,
        fullName,
        name: fullName,
        email: currentFirebaseUser.email,
        phone,
        role: 'admin',
        role_name: 'ADMIN',
        memberId: resolvedMemberId,
        memberCode: resolvedMemberCode,
        adminId: resolvedMemberId,
        adminCode: resolvedMemberCode,
        isActive: true,
        groupId: 'chhatrapati_group_001',
        groupName: currentGroupName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.warn('Notice: Auto-sync admin user doc:', e);
    }
  }

  return resolvedUser;
}

export const AuthProvider = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('bachat_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  const [groupName, setGroupName] = useState(() => {
    try {
      const stored = localStorage.getItem('bachat_user');
      const parsed = stored ? JSON.parse(stored) : null;
      return parsed?.groupName || 'Chhatrapati Bachat Gat';
    } catch (e) {
      return 'Chhatrapati Bachat Gat';
    }
  });

  const [monthlyHaftaDay, setMonthlyHaftaDay] = useState(() => {
    try {
      const stored = localStorage.getItem('bachat_user');
      const parsed = stored ? JSON.parse(stored) : null;
      return parsed?.monthlyHaftaDay || parsed?.monthly_hafta_day || 10;
    } catch (e) {
      return 10;
    }
  });

  const [monthlyContributionPerShare, setMonthlyContributionPerShare] = useState(() => {
    try {
      const stored = localStorage.getItem('bachat_user');
      const parsed = stored ? JSON.parse(stored) : null;
      return Number(parsed?.monthlyContributionPerShare ?? parsed?.monthly_contribution_per_share ?? 1000) || 1000;
    } catch (e) {
      return 1000;
    }
  });

  const [token, setToken] = useState(localStorage.getItem('bachat_token') || null);
  const [loading, setLoading] = useState(true);

  // 1. Listen for real-time changes to the active Group document in Firestore
  useEffect(() => {
    const groupDocRef = doc(db, 'groups', 'chhatrapati_group_001');
    const unsubscribeGroup = onSnapshot(groupDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const liveName = data.groupName || data.group_name;
        const liveDueDay = parseInt(data.monthlyHaftaDay ?? data.monthly_hafta_day, 10) || 10;
        const liveShare = Number(
          data.monthly_contribution_per_share ??
          data.monthlyContributionPerShare ??
          data.monthlyContribution ??
          data.monthly_contribution ??
          data.monthlyShare ??
          data.monthly_share ??
          data.monthlyContributionAmount ??
          1000
        ) || 1000;

        if (liveDueDay) {
          setMonthlyHaftaDay(liveDueDay);
        }
        if (liveShare) {
          setMonthlyContributionPerShare(liveShare);
        }
        if (liveName || liveDueDay || liveShare) {
          if (liveName) setGroupName(liveName);
          setUser((prev) => {
            if (!prev) return prev;
            const updated = {
              ...prev,
              ...(liveName ? { groupName: liveName } : {}),
              monthlyHaftaDay: liveDueDay,
              monthly_hafta_day: liveDueDay,
              monthlyContributionPerShare: liveShare,
              monthly_contribution_per_share: liveShare,
            };
            localStorage.setItem('bachat_user', JSON.stringify(updated));
            return updated;
          });
        }
      }
    }, (err) => {
      console.warn('Group snapshot listener error:', err);
    });

    return () => unsubscribeGroup();
  }, []);

  // 2. Listen for Firebase Authentication state changes
  useEffect(() => {
    let unsubscribeUserDoc = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentFirebaseUser) => {
      setFirebaseUser(currentFirebaseUser);

      if (currentFirebaseUser) {
        try {
          const userToken = await currentFirebaseUser.getIdToken();
          setToken(userToken);
          localStorage.setItem('bachat_token', userToken);

          // Asynchronously resolve user profile before concluding loading state
          const resolved = await resolveUserProfile(currentFirebaseUser);
          if (resolved) {
            setUser(resolved);
            if (resolved.groupName) setGroupName(resolved.groupName);
            localStorage.setItem('bachat_user', JSON.stringify(resolved));
          }

          // Attach real-time listener on users/{uid} for live updates
          const userDocRef = doc(db, 'users', currentFirebaseUser.uid);
          unsubscribeUserDoc = onSnapshot(userDocRef, (userSnap) => {
            if (userSnap.exists()) {
              const uData = userSnap.data();
              const rawRole = (uData.role || 'member').toLowerCase();
              setUser((prev) => {
                const updated = {
                  ...prev,
                  ...uData,
                  fullName: uData.fullName || uData.name || prev?.fullName || currentFirebaseUser.displayName || 'Member',
                  name: uData.fullName || uData.name || prev?.name || currentFirebaseUser.displayName || 'Member',
                  role: rawRole,
                  role_name: rawRole.toUpperCase(),
                };
                localStorage.setItem('bachat_user', JSON.stringify(updated));
                return updated;
              });
            }
          }, (err) => {
            console.warn('Notice: User snapshot listener error:', err);
          });
        } catch (err) {
          console.error('Failed to resolve Firebase user session:', err);
        } finally {
          setLoading(false);
        }
      } else {
        if (unsubscribeUserDoc) unsubscribeUserDoc();
        setToken(null);
        setUser(null);
        localStorage.removeItem('bachat_token');
        localStorage.removeItem('bachat_user');
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
  }, []);

  const login = async (email, password, expectedRole = null) => {
    setLoading(true);
    try {
      const data = await authService.login(email, password, expectedRole);
      if (data.success && data.token) {
        localStorage.setItem('bachat_token', data.token);
        localStorage.setItem('bachat_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        setFirebaseUser(auth.currentUser);
        if (data.user.groupName) {
          setGroupName(data.user.groupName);
        }
        return data;
      }
      throw new Error(data.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const register = async (formData) => {
    setLoading(true);
    try {
      const data = await authService.register(formData);
      if (data.success && data.token) {
        localStorage.setItem('bachat_token', data.token);
        localStorage.setItem('bachat_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        setFirebaseUser(auth.currentUser);
        if (data.user.groupName) {
          setGroupName(data.user.groupName);
        }
        return data.user;
      }
      return data;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout();
    localStorage.removeItem('bachat_token');
    localStorage.removeItem('bachat_user');
    setToken(null);
    setUser(null);
    setFirebaseUser(null);
  };

  const refreshUser = useCallback(async () => {
    try {
      if (!auth.currentUser) return null;
      const resolved = await resolveUserProfile(auth.currentUser);
      if (resolved) {
        setUser(resolved);
        if (resolved.groupName) setGroupName(resolved.groupName);
        localStorage.setItem('bachat_user', JSON.stringify(resolved));
        return resolved;
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  }, []);

  const updateProfile = async (profileData) => {
    await authService.updateProfile(profileData);
    await refreshUser();
  };

  const updateGroupName = (newGroupName) => {
    if (!newGroupName) return;
    setGroupName(newGroupName);
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, groupName: newGroupName };
      localStorage.setItem('bachat_user', JSON.stringify(updated));
      return updated;
    });
  };

  const normalizedRole = (user?.role || user?.role_name || '').toLowerCase();
  const roleName = (user?.role_name || (normalizedRole ? normalizedRole.toUpperCase() : 'ADMIN'));
  const isAdmin = normalizedRole === 'admin' || roleName === 'ADMIN';
  const isTreasurer = false;
  const isSecretary = false;
  const isMember = false;

  // Permission capabilities in Web Admin Portal (Admin has full control)
  const canManageMembers = true;
  const canManageSavings = true;
  const canManageLoans = true;
  const canManageGroup = true;

  const value = {
    firebaseUser,
    user,
    userProfile: user,
    uid: user?.uid || firebaseUser?.uid,
    fullName: user?.fullName || user?.name || '',
    email: user?.email || firebaseUser?.email || '',
    phone: user?.phone || '',
    role: normalizedRole,
    roleName,
    isAdmin,
    isTreasurer,
    isSecretary,
    isMember,
    groupName: groupName || user?.groupName || 'Chhatrapati Bachat Gat',
    monthlyHaftaDay: monthlyHaftaDay || 10,
    monthly_hafta_day: monthlyHaftaDay || 10,
    monthlyContributionPerShare: monthlyContributionPerShare || 1000,
    monthly_contribution_per_share: monthlyContributionPerShare || 1000,
    token,
    loading,
    login,
    register,
    logout,
    refreshUser,
    updateProfile,
    updateGroupName,
    updateMonthlyHaftaDay: (d) => setMonthlyHaftaDay(parseInt(d, 10) || 10),
    updateMonthlyContributionPerShare: (val) => setMonthlyContributionPerShare(Number(val) || 1000),
    isAuthenticated: !!token && !!user,
    canManageMembers,
    canManageSavings,
    canManageLoans,
    canManageGroup,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
