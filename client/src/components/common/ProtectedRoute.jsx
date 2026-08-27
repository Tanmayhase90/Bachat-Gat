import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Loader from './Loader';

const ProtectedRoute = ({ allowedRoles }) => {
  const { firebaseUser, user, token, loading, role, isAuthenticated } = useAuth();

  // 1. Block rendering and redirection while session is loading
  if (loading) {
    return <Loader fullScreen text="Loading portal session..." />;
  }

  // 2. Redirect to login only after loading is completed and no user exists
  if (!isAuthenticated && !firebaseUser && !user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Enforce role restrictions if specified
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = (role || user?.role || 'member').toLowerCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());

    if (!normalizedAllowed.includes(userRole)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
