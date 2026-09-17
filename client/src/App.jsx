import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import Loader from './components/common/Loader';

// Pages - Lazy Loaded for optimal initial load performance
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Members = lazy(() => import('./pages/Members'));
const MemberDetails = lazy(() => import('./pages/MemberDetails'));
const Savings = lazy(() => import('./pages/Savings'));
const Loans = lazy(() => import('./pages/Loans'));
const LoanDetails = lazy(() => import('./pages/LoanDetails'));
const Reports = lazy(() => import('./pages/Reports'));
const ReportView = lazy(() => import('./pages/ReportView'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <LanguageProvider>
          <AuthProvider>
            <Suspense fallback={<Loader fullScreen text="Loading Bachat Gat Admin Portal..." />}>
              <Routes>
                {/* Public Route */}
                <Route path="/login" element={<Login />} />
                
                {/* Redirect any legacy member signup/register links to Admin login */}
                <Route path="/signup" element={<Navigate to="/login" replace />} />
                <Route path="/register" element={<Navigate to="/login" replace />} />

                {/* Admin-Only Protected Routes */}
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                  <Route element={<MainLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/members" element={<Members />} />
                    <Route path="/members/:id" element={<MemberDetails />} />
                    <Route path="/savings" element={<Savings />} />
                    <Route path="/monthly-savings" element={<Savings />} />
                    <Route path="/loans" element={<Loans />} />
                    <Route path="/loans/:id" element={<LoanDetails />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/reports/view" element={<ReportView />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>
                </Route>

                {/* Fallback */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </LanguageProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
