import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import {
  User,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  const { register, isAuthenticated, loading: authLoading } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Field validation
  const validateForm = () => {
    const newErrors = {};

    // 1. Full Name
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full Name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full Name must be at least 2 characters';
    }

    // 2. Email Address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = 'Email Address is required';
    } else if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    // 3. Phone Number
    const phoneClean = formData.phone.replace(/[\s\-+()]/g, '');
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone Number is required';
    } else if (phoneClean.length < 10 || isNaN(phoneClean)) {
      newErrors.phone = 'Please enter a valid phone number (at least 10 digits)';
    }

    // 4. Password
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    // 5. Confirm Password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm Password is required';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field-specific error as user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setServerError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      const result = await register({
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      setSuccessMessage(`${result.message || 'Account registered successfully!'} Redirecting to dashboard...`);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err) {
      setServerError(err.message || 'Registration failed. Please check details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8FAFC',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glowing circles */}
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
          maxWidth: '480px',
          background: '#FFFFFF',
          borderRadius: 'var(--radius-xl)',
          padding: '36px 32px',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-color)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--primary-gradient)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.6rem',
              margin: '0 auto 14px',
              boxShadow: 'var(--shadow-pink)',
            }}
          >
            ₹
          </div>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--primary)' }}>
            Create Your Account
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            Join Bachat Gat and start managing your savings digitally.
          </p>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--success-light)',
              color: 'var(--success-text)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid #A7F3D0',
            }}
          >
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Server Error Alert */}
        {serverError && (
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--danger-light)',
              color: 'var(--danger-text)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid #FECACA',
            }}
          >
            <AlertCircle size={18} />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Full Name */}
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <div style={{ position: 'relative' }}>
              <User
                size={18}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                name="fullName"
                className="form-input"
                style={{
                  paddingLeft: '38px',
                  borderColor: errors.fullName ? 'var(--danger)' : undefined,
                }}
                placeholder="e.g. Ramesh Shankar Patil"
                value={formData.fullName}
                onChange={handleChange}
                required
              />
            </div>
            {errors.fullName && (
              <span style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '2px', fontWeight: 600 }}>
                {errors.fullName}
              </span>
            )}
          </div>

          {/* Email Address */}
          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={18}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="email"
                name="email"
                className="form-input"
                style={{
                  paddingLeft: '38px',
                  borderColor: errors.email ? 'var(--danger)' : undefined,
                }}
                placeholder="ramesh@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            {errors.email && (
              <span style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '2px', fontWeight: 600 }}>
                {errors.email}
              </span>
            )}
          </div>

          {/* Phone Number */}
          <div className="form-group">
            <label className="form-label">Phone Number *</label>
            <div style={{ position: 'relative' }}>
              <Phone
                size={18}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="tel"
                name="phone"
                className="form-input"
                style={{
                  paddingLeft: '38px',
                  borderColor: errors.phone ? 'var(--danger)' : undefined,
                }}
                placeholder="e.g. 9822012345"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>
            {errors.phone && (
              <span style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '2px', fontWeight: 600 }}>
                {errors.phone}
              </span>
            )}
          </div>

          {/* Password & Confirm Password */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  color="var(--text-muted)"
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="password"
                  name="password"
                  className="form-input"
                  style={{
                    paddingLeft: '32px',
                    borderColor: errors.password ? 'var(--danger)' : undefined,
                    fontSize: '0.9rem',
                  }}
                  placeholder="Min 6 characters"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
              {errors.password && (
                <span style={{ fontSize: '0.725rem', color: 'var(--danger)', marginTop: '2px', fontWeight: 600 }}>
                  {errors.password}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password *</label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  color="var(--text-muted)"
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="password"
                  name="confirmPassword"
                  className="form-input"
                  style={{
                    paddingLeft: '32px',
                    borderColor: errors.confirmPassword ? 'var(--danger)' : undefined,
                    fontSize: '0.9rem',
                  }}
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
              {errors.confirmPassword && (
                <span style={{ fontSize: '0.725rem', color: 'var(--danger)', marginTop: '2px', fontWeight: 600 }}>
                  {errors.confirmPassword}
                </span>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px', marginTop: '12px', fontSize: '0.95rem' }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        {/* Back to Login Link */}
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link
            to="/login"
            style={{
              color: 'var(--primary)',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Login
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Secure Self Help Group Portal • Bachat Gat 2026
        </div>
      </div>
    </div>
  );
};

export default Register;
