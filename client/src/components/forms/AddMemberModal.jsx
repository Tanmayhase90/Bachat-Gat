import React, { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import { memberService } from '../../services/memberService';
import { UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';

const AddMemberModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    member_code: '',
    monthly_contribution: '1000',
    role_name: 'MEMBER',
    joined_date: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [codeLoading, setCodeLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setCodeLoading(true);
    memberService.getNextMemberCode()
      .then((result) => {
        if (active) setFormData((previous) => ({ ...previous, member_code: result.memberCode }));
      })
      .catch(() => {
        if (active) setError('Unable to preview the next member code. It will be assigned when saving.');
      })
      .finally(() => {
        if (active) setCodeLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || formData.password.length < 6) {
      setError('Please fill in Name, Email, and a password of at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await memberService.createMember({
        ...formData,
        monthly_contribution: parseFloat(formData.monthly_contribution),
      });

      if (res.success) {
        setSuccess(`Member ${res.member.member_code} created. Login ID: ${res.credentials.email}`);
        setTimeout(() => {
          setSuccess('');
          setFormData({
            name: '',
            email: '',
            phone: '',
            password: '',
            member_code: '',
            monthly_contribution: '1000',
            role_name: 'MEMBER',
            joined_date: new Date().toISOString().split('T')[0],
          });
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to add member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Group Member" maxWidth="520px">
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--danger-light)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '10px 14px', background: 'var(--success-light)', color: 'var(--success-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Full Name *</label>
          <input
            type="text"
            name="name"
            className="form-input"
            placeholder="e.g. Ramesh Shankar Patil"
            value={formData.name}
            onChange={handleChange}
            tabIndex={0}
            data-autofocus
            required
          />
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input
              type="email"
              name="email"
              className="form-input"
              placeholder="e.g. ramesh@example.com"
              value={formData.email}
              onChange={handleChange}
              tabIndex={0}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              type="tel"
              name="phone"
              className="form-input"
              placeholder="e.g. 9822012345"
              value={formData.phone}
              onChange={handleChange}
              tabIndex={0}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Temporary Login Password *</label>
          <input
            type="password"
            name="password"
            className="form-input"
            placeholder="Minimum 6 characters"
            value={formData.password}
            onChange={handleChange}
            tabIndex={0}
            minLength={6}
            autoComplete="new-password"
            required
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            The member can sign in immediately with their email and this password.
          </span>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Member Code (Auto)</label>
            <input
              type="text"
              name="member_code"
              className="form-input"
              placeholder={codeLoading ? 'Calculating...' : 'Auto-assigned'}
              value={formData.member_code}
              tabIndex={0}
              readOnly
              aria-readonly="true"
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Serially assigned from the customer list.</span>
          </div>

          <div className="form-group">
            <label className="form-label">Monthly Share (₹)</label>
            <input
              type="number"
              name="monthly_contribution"
              className="form-input"
              value={formData.monthly_contribution}
              onChange={handleChange}
              tabIndex={0}
              min="100"
              step="50"
              required
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Assigned Role</label>
            <select name="role_name" className="form-select" value={formData.role_name} onChange={handleChange} tabIndex={0}>
              <option value="MEMBER">Member (Standard)</option>
              <option value="TREASURER">Treasurer (Finance)</option>
              <option value="SECRETARY">Secretary (Administration)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Joining Date</label>
            <input
              type="date"
              name="joined_date"
              className="form-input"
              value={formData.joined_date}
              onChange={handleChange}
              tabIndex={0}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="btn-secondary" tabIndex={0}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading} tabIndex={0}>
            <UserPlus size={16} />
            {loading ? 'Adding Member...' : 'Register Member'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddMemberModal;
