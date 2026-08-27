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

  // 1. Look up in users/{uid}
  try {
    const userDocRef = doc(db, 'users', currentFirebaseUser.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      userData = userDocSnap.data();
    }
  } catch (err) {
    console.warn('Notice: Failed reading users/{uid}:', err);
  }

  // 2. Look up in members subcollection by authUid, userId, or email
  try {
    const cleanEmail = (currentFirebaseUser.email || '').trim().toLowerCase();
    const membersSnap = await getDocs(collection(db, 'groups', 'shivshahi_group_001', 'members')).catch(() => ({ docs: [] }));
    
    const found = membersSnap.docs.find((d) => {
      const m = d.data();
      return (
        m.userId === currentFirebaseUser.uid ||
        m.authUid === currentFirebaseUser.uid ||
        m.firebaseUid === currentFirebaseUser.uid ||
        (cleanEmail && m.email && m.email.toLowerCase() === cleanEmail)
      );
    });

    if (found) {
      memberData = found.data();
      memberId = found.id;
    }
  } catch (err) {
    console.warn('Notice: Member lookup query:', err);
  }

  // 3. Resolve active group details
  let currentGroupName = 'Chhatrapati Bachat Gat, Ghargaon Stand';
  try {
    const gRes = await groupService.getGroupDetails(userData?.groupId || memberData?.groupId || 'shivshahi_group_001');
    if (gRes.group?.groupName || gRes.group?.name) {
      currentGroupName = gRes.group.groupName || gRes.group.name;
    }
  } catch (e) {
    // fallback default
  }

  // 4. Resolve full name, phone, and role
  const isUserAdmin = userData?.role === 'admin' || userData?.role_name === 'ADMIN';
  const rawRole = isUserAdmin ? 'admin' : (userData?.role || memberData?.role || 'member').toLowerCase();
  const fullName = userData?.fullName || userData?.name || memberData?.fullName || memberData?.name || currentFirebaseUser.displayName || (currentFirebaseUser.email ? currentFirebaseUser.email.split('@')[0] : 'Member');
  const phone = userData?.phone || memberData?.phone || '';

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
    memberId: memberId || userData?.memberId || '',
    memberCode: memberData?.memberCode || userData?.memberCode || '',
  };

  // If user document didn't exist in users/{uid}, ensure it is saved
  if (!userData) {
    try {
      await setDoc(doc(db, 'users', currentFirebaseUser.uid), {
        uid: currentFirebaseUser.uid,
        fullName,
        name: fullName,
        email: currentFirebaseUser.email,
        phone,
        role: rawRole,
        role_name: rawRole.toUpperCase(),
        isActive: true,
        memberId: memberId || '',
        memberCode: memberData?.memberCode || '',
        groupId: memberData?.groupId || 'shivshahi_group_001',
        groupName: currentGroupName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.warn('Notice: Auto-sync user doc:', e);
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

  const [token, setToken] = useState(localStorage.getItem('bachat_token') || null);
  const [loading, setLoading] = useState(true);

  // 1. Listen for real-time changes to the active Group document in Firestore
  useEffect(() => {
    const groupDocRef = doc(db, 'groups', 'shivshahi_group_001');
    const unsubscribeGroup = onSnapshot(groupDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const liveName = data.groupName || data.group_name;
        if (liveName) {
          setGroupName(liveName);
          setUser((prev) => {
            if (!prev) return prev;
            const updated = { ...prev, groupName: liveName };
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

  const normalizedRole = (user?.role || 'member').toLowerCase();
  const roleName = normalizedRole.toUpperCase();
  const isAdmin = normalizedRole === 'admin';
  const isTreasurer = normalizedRole === 'treasurer';
  const isSecretary = normalizedRole === 'secretary';
  const isMember = normalizedRole === 'member';

  // Permission capabilities
  const canManageMembers = isAdmin || isSecretary;
  const canManageSavings = isAdmin || isTreasurer;
  const canManageLoans = isAdmin || isTreasurer;
  const canManageGroup = isAdmin;

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
    token,
    loading,
    login,
    register,
    logout,
    refreshUser,
    updateProfile,
    updateGroupName,
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
