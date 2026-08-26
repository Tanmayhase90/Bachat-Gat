import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, ShieldCheck, UserCheck, AlertCircle, CheckCircle2, UserPlus } from 'lucide-react';

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState(location.state?.registeredEmail || 'admin@bachatgat.com');
  const [password, setPassword] = useState(location.state?.registeredEmail ? '' : 'Admin@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState(location.state?.message || '');

  useEffect(() => {
    if (location.state?.message) {
      setSuccessInfo(location.state.message);
    }
    if (location.state?.registeredEmail) {
      setEmail(location.state.registeredEmail);
      setPassword('');
    }
  }, [location.state]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccessInfo('');
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setDemoCredentials = (role) => {
    if (role === 'admin') {
      setEmail('admin@bachatgat.com');
      setPassword('Admin@123');
    } else {
      setEmail('rahul@bachatgat.com');
      setPassword('Member@123');
    }
    setError('');
    setSuccessInfo('');
  };

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

        {/* Demo Fast Login Buttons */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
            Quick Demo Accounts:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setDemoCredentials('admin')}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                background: email === 'admin@bachatgat.com' ? 'var(--accent-soft)' : '#F1F5F9',
                border: email === 'admin@bachatgat.com' ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                color: email === 'admin@bachatgat.com' ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <ShieldCheck size={15} /> Admin Login
            </button>
            <button
              type="button"
              onClick={() => setDemoCredentials('member')}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                background: email === 'rahul@bachatgat.com' ? 'var(--accent-soft)' : '#F1F5F9',
                border: email === 'rahul@bachatgat.com' ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                color: email === 'rahul@bachatgat.com' ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <UserCheck size={15} /> Member Login
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

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email or Username</label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={18}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '38px' }}
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={18}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="password"
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
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
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
