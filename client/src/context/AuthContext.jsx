import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('bachat_token') || null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('bachat_token');
      if (storedToken) {
        try {
          const data = await authService.getMe();
          if (data.success && data.user) {
            setUser(data.user);
          } else {
            logout();
          }
        } catch (err) {
          console.error('Auth verification failed:', err);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const data = await authService.login(email, password);
    if (data.success && data.token) {
      localStorage.setItem('bachat_token', data.token);
      localStorage.setItem('bachat_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data.user;
    }
    throw new Error(data.message || 'Login failed');
  };

  const logout = () => {
    localStorage.removeItem('bachat_token');
    localStorage.removeItem('bachat_user');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const data = await authService.getMe();
      if (data.success && data.user) {
        setUser(data.user);
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const roleName = (user?.role_name || user?.role || 'MEMBER').toUpperCase();
  const isAdmin = roleName === 'ADMIN';
  const isTreasurer = roleName === 'TREASURER';
  const isSecretary = roleName === 'SECRETARY';
  const isMember = roleName === 'MEMBER';

  // Permission capabilities
  const canManageMembers = isAdmin || isSecretary;
  const canManageSavings = isAdmin || isTreasurer;
  const canManageLoans = isAdmin || isTreasurer;
  const canManageGroup = isAdmin;

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!token && !!user,
    roleName,
    isAdmin,
    isTreasurer,
    isSecretary,
    isMember,
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
