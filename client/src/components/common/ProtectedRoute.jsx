import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Loader from './Loader';

const ProtectedRoute = ({ allowedRoles = ['admin'] }) => {
  const { firebaseUser, user, loading, role, isAuthenticated, isAdmin, logout } = useAuth();

  // 1. Block rendering while session is resolving
  if (loading) {
    return <Loader fullScreen text="Loading admin portal..." />;
  }

  // 2. Redirect to login if not authenticated
  if (!isAuthenticated && !firebaseUser && !user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Enforce Admin-only verification
  const userRole = (role || user?.role || user?.role_name || '').toLowerCase();
  const isAuthorizedAdmin = isAdmin || userRole === 'admin';

  if (!isAuthorizedAdmin) {
    // If a non-admin account is detected, terminate web session and redirect with error
    if (logout) {
      logout();
    }
    return (
      <Navigate
        to="/login"
        replace
        state={{ error: 'Access denied. The Web application is restricted to Administrators only.' }}
      />
    );
  }

  // 4. Custom role restriction if specified
  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    if (!normalizedAllowed.includes(userRole)) {
      return (
        <Navigate
          to="/login"
          replace
          state={{ error: 'Access denied. You do not have permission to view this page.' }}
        />
      );
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
