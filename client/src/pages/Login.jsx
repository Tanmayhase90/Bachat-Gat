import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { Lock, Mail, ArrowRight, ShieldCheck, UserCheck, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, isAuthenticated, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState('member'); // 'member' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Load any registration success info or registered email on initial mount only
  useEffect(() => {
    if (location.state?.message) {
      setSuccessInfo(location.state.message);
    }
    if (location.state?.registeredEmail) {
      setEmail(location.state.registeredEmail);
      setActiveTab('member');
    }
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
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
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setSuccessInfo('');
      setError('Please enter your email address first.');
      return;
    }

    try {
      setResetLoading(true);
      setError('');
      setSuccessInfo('');
      const result = await authService.sendPasswordReset(email);
      setSuccessInfo(result.message);
    } catch (err) {
      setError(err.message || 'Unable to send password reset email.');
    } finally {
      setResetLoading(false);
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
              onClick={() => handleTabChange('member')}
              aria-pressed={activeTab === 'member'}
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
            <button
              type="button"
              onClick={() => handleTabChange('admin')}
              aria-pressed={activeTab === 'admin'}
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
          onSubmit={handleLogin}
          autoComplete="off"
        >
          <div className="form-group">
            <label className="form-label" htmlFor="login_email_input">
              {activeTab === 'admin' ? 'Admin Email' : 'Member Email'}
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={18}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                id="login_email_input"
                name="email"
                type="email"
                autoComplete="email"
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <label className="form-label" htmlFor="login_password_input">
                Password
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                style={{
                  background: 'transparent',
                  color: 'var(--primary)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '2px 0',
                }}
              >
                {resetLoading ? 'Sending...' : 'Forgot Password?'}
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock
                size={18}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                id="login_password_input"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="form-input"
                style={{ paddingLeft: '38px', paddingRight: '40px' }}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
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

        {/* Sign Up Navigation Option */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '20px',
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}
        >
          Don't have an account?{' '}
          <Link
            to="/signup"
            style={{
              color: 'var(--primary)',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Sign Up
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
          Secure Self Help Group Portal • Bachat Gat 2026
        </div>
      </div>
    </div>
  );
};

export default Login;
