import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, ShieldCheck, UserCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, isAuthenticated, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState('admin'); // 'admin' | 'member'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Ensure fields are clean on mount unless redirected from registration
  useEffect(() => {
    if (location.state?.message) {
      setSuccessInfo(location.state.message);
    }
    if (location.state?.registeredEmail) {
      setEmail(location.state.registeredEmail);
      setActiveTab('member');
      setPassword('');
    } else {
      setEmail('');
      setPassword('');
    }
  }, [location.state]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setEmail('');
    setPassword('');
    setError('');
    setSuccessInfo('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccessInfo('');
      // Authenticate with Firebase and enforce role based on selected tab ('admin' | 'member')
      await login(email.trim(), password, activeTab);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const emailFieldName = activeTab === 'admin' ? 'admin_login_email' : 'member_login_email';
  const passwordFieldName = activeTab === 'admin' ? 'admin_login_password' : 'member_login_password';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background subtle glowing circles */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          right: '-5%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(190, 24, 93, 0.08) 0%, rgba(255,255,255,0) 70%)',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          left: '-5%',
          width: '450px',
          height: '450px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(219, 39, 119, 0.06) 0%, rgba(255,255,255,0) 70%)',
          zIndex: 0,
        }}
      />

      <div
        className="fade-in"
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#FFFFFF',
          borderRadius: 'var(--radius-xl)',
          padding: '40px 36px',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-color)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--primary-gradient)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.75rem',
              margin: '0 auto 16px',
              boxShadow: 'var(--shadow-pink)',
            }}
          >
            ₹
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--primary)' }}>
            Bachat Gat
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            Digital Savings Group Management System
          </p>
        </div>

        {/* Login Role Tabs */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#F1F5F9', padding: '4px', borderRadius: 'var(--radius-lg)' }}>
            <button
              type="button"
              onClick={() => handleTabChange('admin')}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: activeTab === 'admin' ? '#FFFFFF' : 'transparent',
                border: activeTab === 'admin' ? '1px solid var(--border-color)' : 'none',
                color: activeTab === 'admin' ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '0.875rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: activeTab === 'admin' ? 'var(--shadow-xs)' : 'none',
                transition: 'var(--transition)',
              }}
            >
              <ShieldCheck size={16} /> Admin Login
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('member')}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: activeTab === 'member' ? '#FFFFFF' : 'transparent',
                border: activeTab === 'member' ? '1px solid var(--border-color)' : 'none',
                color: activeTab === 'member' ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '0.875rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: activeTab === 'member' ? 'var(--shadow-xs)' : 'none',
                transition: 'var(--transition)',
              }}
            >
              <UserCheck size={16} /> Member Login
            </button>
          </div>
        </div>

        {/* Success Alert from Register Page */}
        {successInfo && (
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--success-light)',
              color: 'var(--success-text)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid #A7F3D0',
            }}
          >
            <CheckCircle2 size={16} /> {successInfo}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--danger-light)',
              color: 'var(--danger-text)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid #FECACA',
            }}
          >
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form
          key={`login-form-${activeTab}`}
          onSubmit={handleLogin}
          autoComplete="off"
        >
          <div className="form-group">
            <label className="form-label" htmlFor={emailFieldName}>
              {activeTab === 'admin' ? 'Admin Email' : 'Member Email'}
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={18}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                key={emailFieldName}
                id={emailFieldName}
                name={emailFieldName}
                type="email"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck="false"
                className="form-input"
                style={{ paddingLeft: '38px' }}
                placeholder={activeTab === 'admin' ? 'admin@example.com' : 'member@example.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={passwordFieldName}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={18}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                key={passwordFieldName}
                id={passwordFieldName}
                name={passwordFieldName}
                type="password"
                autoComplete="new-password"
                className="form-input"
                style={{ paddingLeft: '38px' }}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px', marginTop: '12px', fontSize: '0.95rem' }}
          >
            {loading ? 'Authenticating...' : `Sign In as ${activeTab === 'admin' ? 'Admin' : 'Member'}`}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        {/* Signup / Register Link */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '22px',
            paddingTop: '18px',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}
        >
          Don't have an account?{' '}
          <Link
            to="/register"
            style={{
              color: 'var(--primary)',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Sign Up
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
          Secure Self Help Group Portal • Bachat Gat 2026
        </div>
      </div>
    </div>
  );
};

export default Login;
